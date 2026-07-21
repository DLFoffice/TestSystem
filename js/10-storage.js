/* ============================================================
   10-storage.js — บันทึก/โหลดข้อมูลจาก localStorage — จุดที่จะสลับเป็น Firestore
   (แยกมาจาก index.html เดิม บรรทัด 2897-3058 โดยรักษาลำดับโค้ดเดิม)
   ============================================================ */
const STORAGE_KEY = 'dltv_student_photos';
const STORAGE_KEY_DATA = 'dltv_students_data';
const DATA_VERSION = '2568v9_empty_sheet_guard'; // v9: กัน Sheet ว่างทับข้อมูลตั้งต้น + ล้าง cache ค่าว่าง
// ล้าง cache เก่าถ้า version ไม่ตรง (ล้างทั้งหมดเพื่อให้โหลดข้อมูลใหม่จาก RAW)
if (localStorage.getItem('dltv_data_version') !== DATA_VERSION) {
  localStorage.removeItem(STORAGE_KEY_DATA);
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem('dltv_data_version', DATA_VERSION);
  console.log('🔄 Cache cleared, loading fresh data from RAW');
}

function compressDataUrl(dataUrl, maxWidth=300) {
  return new Promise(resolve => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) { resolve(dataUrl); return; }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function saveToStorage() {
  try {
    // ---- 1. บันทึกข้อมูลนักเรียนทั้งหมด (ไม่รวมรูป base64 เพื่อประหยัดพื้นที่) ----
    const studentsToSave = DB.students.map(s => ({
      ...s,
      photoUrl: (s.photoUrl && s.photoUrl.startsWith('data:')) ? '' : (s.photoUrl || '')
    }));
    try {
      localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(studentsToSave));
    } catch(e) {
      console.warn('saveToStorage: student data too large, skipping:', e.message);
    }

    // ---- 2. บันทึกรูปภาพแยกต่างหาก ----
    const photos = {};
    for (const s of DB.students) {
      if (s.photoUrl) {
        photos[s.id || s.no] = s.photoUrl.startsWith('data:')
          ? await compressDataUrl(s.photoUrl)
          : s.photoUrl;
      }
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
    } catch(e) {
      const urlOnlyPhotos = {};
      for (const [k,v] of Object.entries(photos)) {
        if (!v.startsWith('data:')) urlOnlyPhotos[k] = v;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(urlOnlyPhotos));
        showStatus('⚠️ พื้นที่จัดเก็บเต็ม: บันทึก URL รูปเท่านั้น', 'info');
      } catch(e2) {
        console.warn('Storage full, photos not saved:', e2.message);
      }
    }
  } catch(e) {
    console.warn('saveToStorage error:', e);
  }
}

function loadFromStorage() {
  try {
    // ---- 1. โหลดข้อมูลนักเรียนทั้งหมดจาก storage (ถ้ามี) ----
    const rawData = localStorage.getItem(STORAGE_KEY_DATA);
    if (rawData) {
      const savedStudents = JSON.parse(rawData);
      if (Array.isArray(savedStudents) && savedStudents.length > 0) {
        // Migrate: ตรวจสอบ semPayments / semGpa ให้ครบ
        // หา RAW map เพื่อ merge ฟิลด์ school_m1_addr ที่อาจหายไปจาก cache เก่า
        const rawMap = {};
        RAW.forEach(r => { rawMap[r.id] = r; });
        DB.students = savedStudents.map(s => {
          if (!s.semPayments) s.semPayments = [];
          // migrate mentor & behavior fields
          if (!s.mentor) s.mentor = { firstName: '', lastName: '', phone: '', position: '' };
          if (!s.hasOwnProperty('behavior')) s.behavior = '';
          // migrate school_m1_addr: merge ฟิลด์ใหม่จาก RAW ถ้า cache เก่าไม่มี
          if (!s.school_m1_addr) s.school_m1_addr = {};
          const rawS = rawMap[s.id] || {};
          const rawSa = rawS.school_m1_addr || {};
          ['district','amphoe','directorM1','telDirectorM1','advisorM1','telAdvisorM1','lat','lng'].forEach(k => {
            if (!s.school_m1_addr[k] && rawSa[k]) s.school_m1_addr[k] = rawSa[k];
          });
          // migrate addr.no (บ้านเลขที่) จาก RAW ถ้า cache เก่าไม่มี
          if (!s.addr) s.addr = {};
          const rawAddr = rawS.addr || {};
          ['no','moo','village','tambon','amphoe','province','zip','nat','rel'].forEach(k => {
            if (!s.addr[k] && rawAddr[k]) s.addr[k] = rawAddr[k];
          });
          // ถ้า semGpa ว่างหรือ gpa=0 ทั้งหมด ให้ rebuild จาก gpa field
          if (!s.semGpa || s.semGpa.length === 0 || s.semGpa.every(g => !g.gpa || g.gpa === 0)) {
            s.semGpa = [{
              term: s.gpa?.term || '1/2568',
              gpa: s.gpa?.gpa || 0, riskLevel: s.gpa?.riskLevel || 'ปานกลาง',
              hasObstacle: s.gpa?.hasObstacle || false,
              obstacleType: s.gpa?.obstacleType || '',
              weakSubjects: s.gpa?.weakSubjects || '',
              schoolSupport: s.gpa?.schoolSupport || ''
            }];
          }
          return s;
        });
      }
    }

    // ---- 2. โหลดรูปภาพแยกมาใส่ทับ (รูปอาจมีขนาดใหญ่กว่า) ----
    const rawPhotos = localStorage.getItem(STORAGE_KEY);
    if (rawPhotos) {
      const photos = JSON.parse(rawPhotos);
      DB.students.forEach(s => {
        const key = s.id || s.no;
        if (photos[key]) s.photoUrl = photos[key];
      });
    }
  } catch(e) {
    console.warn('loadFromStorage error:', e);
  }
}

// โหลด "เฉพาะรูป" จาก localStorage มาวางทับ (ไม่แตะข้อมูลส่วนอื่น)
// ใช้หลังจากดึงข้อมูลสดจาก Google Sheet เพื่อกู้รูปที่อัปโหลดในเครื่อง (base64)
// กลับมา โดยไม่ทับข้อมูลนักเรียนที่เพิ่งโหลดมาจาก Sheet
function loadPhotosFromStorage() {
  try {
    const rawPhotos = localStorage.getItem(STORAGE_KEY);
    if (!rawPhotos) return;
    const photos = JSON.parse(rawPhotos);
    DB.students.forEach(s => {
      const key = s.id || s.no;
      const local = photos[key];
      if (!local) return;
      // ใช้รูป local ก็ต่อเมื่อ (1) Sheet ไม่มีรูป หรือ (2) รูป local เป็นภาพอัปโหลด base64
      // ในกรณีอื่นให้ใช้ URL รูปจาก Sheet เป็นหลัก เพื่อให้รูปที่แก้ใน Sheet ขึ้นในทุกเครื่อง
      if (!s.photoUrl || (typeof local === 'string' && local.startsWith('data:'))) {
        s.photoUrl = local;
      }
    });
  } catch(e) {
    console.warn('loadPhotosFromStorage error:', e);
  }
}

// ╔══════════════════════════════════════════════════════════╗
//  REAL-TIME SYNC ENGINE — GitHub Pages + Google Apps Script
//  Strategy: 5-second smart polling + optimistic UI
//  - กด "บันทึก" → อัปเดตหน้าจอทันที (optimistic) + upsert ไป Sheet
//  - ทุก 5 วินาที → check lastUpdated ใน Sheet (1 request เบามาก)
//  - ถ้า lastUpdated เปลี่ยน → ดึงเฉพาะ record ที่ต่างกัน (diff)
//  - ไม่มี full reload → UI ไม่กระตุก
// ╚══════════════════════════════════════════════════════════╝

// ▸ ใส่ URL ของ Google Apps Script Web App ที่นี่
