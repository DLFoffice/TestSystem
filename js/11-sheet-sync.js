/* ============================================================
   11-sheet-sync.js — ซิงก์กับ Google Sheet (Apps Script): polling, save, load
   (แยกมาจาก index.html เดิม บรรทัด 3059-3580 โดยรักษาลำดับโค้ดเดิม)
   ============================================================ */
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzytJf5cvW3hxcMCDByruDk4NiQFkZBxpA9tlj6eAZFgSA-9S3K5gQR_zH1RGBTVoBssQ/exec';

const POLL_INTERVAL_MS  = 5000;   // poll ทุก 5 วินาที
const RETRY_MAX         = 3;      // retry ก่อน offline

let isConnected     = false;
let lastKnownUpdate = null;       // lastUpdated timestamp จาก meta sheet
let _pollTimer      = null;
let _retryCount     = 0;
let _isSaving       = false;      // lock ป้องกัน race condition

// ─── helpers ──────────────────────────────────────────────
function parseJsonField(val) {
  if (!val) return null;
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const t = val.trim();
    if (t.startsWith('[') || t.startsWith('{')) {
      try { return JSON.parse(t); } catch(e) { return null; }
    }
  }
  return null;
}

function normalizeStudent(s) {
  // ── 1. map ฟิลด์ระดับบนสุดจาก Sheet → school_m1_addr ──────
  // Sheet ส่งมา: district, Amphoe, lat, lng, directorM_1, Tel.directorM_1, AdvisorM_1, TelAdvisorM_1
  if (!s.school_m1_addr) s.school_m1_addr = {};

  // district (ตำบลที่ตั้งโรงเรียน)
  if (!s.school_m1_addr.district && s.district) s.school_m1_addr.district = s.district;

  // Amphoe (Sheet ใช้ capital A)
  if (!s.school_m1_addr.amphoe) {
    s.school_m1_addr.amphoe = s.Amphoe || s.amphoe || s.school_amphoe || '';
  }

  // lat / lng
  if (!s.school_m1_addr.lat && s.lat) s.school_m1_addr.lat = Number(s.lat) || '';
  if (!s.school_m1_addr.lng && s.lng) s.school_m1_addr.lng = Number(s.lng) || '';

  // director & advisor (Sheet ใช้ underscore + capital naming)
  if (!s.school_m1_addr.directorM1)    s.school_m1_addr.directorM1    = s.directorM_1     || s.directorM1     || '';
  if (!s.school_m1_addr.telDirectorM1) s.school_m1_addr.telDirectorM1 = s.Tel_directorM_1 || s.telDirectorM1  || '';
  if (!s.school_m1_addr.advisorM1)     s.school_m1_addr.advisorM1     = s.AdvisorM_1      || s.advisorM1      || '';
  if (!s.school_m1_addr.telAdvisorM1)  s.school_m1_addr.telAdvisorM1  = s.TelAdvisorM_1   || s.telAdvisorM1   || '';

  // ทำให้ทุกฟิลด์มีค่าเริ่มต้น
  ['district','amphoe','tambon','zip','address','directorM1','telDirectorM1','advisorM1','telAdvisorM1'].forEach(k=>{
    if (s.school_m1_addr[k] === undefined) s.school_m1_addr[k] = '';
  });

  // ── 2. map addr ──────────────────────────────────────────────
  // Sheet ส่ง addr.addr (บ้านเลขที่ฝั่ง addr object), addr_nat (ระดับบน)
  if (!s.addr) s.addr = {};
  if (!s.addr.no  && s.addr.addr) s.addr.no  = s.addr.addr;   // บ้านเลขที่
  if (!s.addr.nat && s.addr_nat)  s.addr.nat  = s.addr_nat;    // สัญชาติ
  if (!s.addr.rel && s.religion)  s.addr.rel  = s.religion;    // ศาสนา
  // ทำให้ทุกฟิลด์มีค่าเริ่มต้น
  ['no','moo','village','tambon','amphoe','province','zip','nat','rel'].forEach(k=>{
    if (s.addr[k] === undefined) s.addr[k] = '';
  });

  // ── 3. mentor ─────────────────────────────────────────────────
  // Sheet ส่ง mentor_firstName, mentor_lastName ระดับบนสุด
  if (!s.mentor || typeof s.mentor !== 'object') s.mentor = {};
  if (!s.mentor.firstName) s.mentor.firstName = s.mentor_firstName || '';
  if (!s.mentor.lastName)  s.mentor.lastName  = s.mentor_lastName  || '';
  if (!s.mentor.phone)    s.mentor.phone    = s.mentor_phone    || '';
  if (!s.mentor.position) s.mentor.position = s.mentor_position || '';

// 🟢 และ behavior
  if (!s.hasOwnProperty('behavior')) s.behavior = s.behavior || '';

  // ── 4. behavior ───────────────────────────────────────────────
  if (!s.hasOwnProperty('behavior')) s.behavior = '';

  // ── 5. semPayments ─────────────────────────────────────────────
  const rawPay = Array.isArray(s.semPayments) ? s.semPayments : parseJsonField(s.semPayments);
  if (rawPay && rawPay.length > 0) {
    s.semPayments = rawPay.map(p => ({
      term: p.term || '', p1: Number(p.p1)||0, p2: Number(p.p2)||0,
      item1: p.item1||'ค่าเงินบำรุงการศึกษา', item2: p.item2||'ค่าใช้จ่ายในการเรียน'
    }));
  } else {
    s.semPayments = [];
  }
  // sync s.payment จาก semPayments ล่าสุด
  if (s.semPayments.length > 0) {
    const lp = s.semPayments[s.semPayments.length - 1];
    s.payment = { term: lp.term, p1: lp.p1, p2: lp.p2, item1: lp.item1, item2: lp.item2 };
  }

  // ── 6. semGpa ─────────────────────────────────────────────────
  // Sheet ไม่ได้ส่ง semGpa มา — ต้องสร้างจาก gpa object
  const pg = parseJsonField(s.semGpa);
  if (pg && pg.length > 0) {
    s.semGpa = pg.map(g => ({
      term: g.term||'1/2568', gpa: Number(g.gpa)||0,
      riskLevel: g.riskLevel||'ปานกลาง',
      hasObstacle: g.hasObstacle===true||g.hasObstacle==='true'||g.hasObstacle==='TRUE',
      obstacleType: g.obstacleType||'', weakSubjects: g.weakSubjects||'', schoolSupport: g.schoolSupport||''
    }));
  } else if (!Array.isArray(s.semGpa) || s.semGpa.length === 0) {
    // สร้าง semGpa จากข้อมูล gpa ใน Sheet
    const gpaObj = s.gpa || {};
    s.semGpa = [{
      term:         gpaObj.term        || '1/2568',
      gpa:          Number(gpaObj.gpa) || 0,
      riskLevel:    gpaObj.riskLevel   || 'ปานกลาง',
      hasObstacle:  gpaObj.hasObstacle === true || gpaObj.hasObstacle === 'TRUE' || gpaObj.hasObstacle === 'true',
      obstacleType: gpaObj.obstacleType  || '',
      weakSubjects: gpaObj.weakSubjects  || '',
      schoolSupport:gpaObj.schoolSupport || ''
    }];
  }

  // ── 7. gpa object (sync กับ semGpa ล่าสุด) ────────────────────
  if (!s.gpa || typeof s.gpa !== 'object') s.gpa = {};
  const latestG = s.semGpa[s.semGpa.length - 1] || {};
  if (!s.gpa.gpa)           s.gpa.gpa          = latestG.gpa          || 0;
  if (!s.gpa.riskLevel)     s.gpa.riskLevel     = latestG.riskLevel    || 'ปานกลาง';
  if (s.gpa.hasObstacle === undefined) s.gpa.hasObstacle = latestG.hasObstacle || false;
  if (!s.gpa.obstacleType)  s.gpa.obstacleType  = latestG.obstacleType || '';
  if (!s.gpa.weakSubjects)  s.gpa.weakSubjects  = latestG.weakSubjects || '';
  if (!s.gpa.schoolSupport) s.gpa.schoolSupport = latestG.schoolSupport|| '';

  // ── 8. bank fallback ──────────────────────────────────────────
  if (!s.bank || typeof s.bank !== 'object') s.bank = {};

  return s;
}

function cleanForSheet(s) {
  // สร้าง object ใหม่อย่างชัดเจน (ไม่ใช้ ...spread) เพื่อป้องกันฟิลด์หาย/ทับ
  const sa   = s.school_m1_addr || {};
  const addr = s.addr || {};
  const bank = s.bank || {};
  const latestGpa = (s.semGpa && s.semGpa.length > 0)
    ? s.semGpa[s.semGpa.length - 1]
    : (s.gpa || {});

  return {
    // ─── ข้อมูลพื้นฐาน ───────────────────────────────────
    no:           s.no          || '',
    id:           s.id          || '',
    name:         s.name        || '',
    nickname:     s.nickname    || '',
    dob:          s.dob         || '',
    phone:        s.phone       || '',
    parent:       s.parent      || '',
    parentPhone:  s.parentPhone || '',
    gpa_p6:       s.gpa_p6      || '',
    school_p6:    s.school_p6   || '',
    school_m1:    s.school_m1   || '',
    province:     s.province    || '',
    org:          s.org         || '',
    // รูปภาพ: ไม่ส่ง base64
    photoUrl: (s.photoUrl || '').startsWith('data:') ? '' : (s.photoUrl || ''),

    // ─── ที่อยู่โรงเรียน (ชื่อ field ตรงกับ GAS header) ──
    district:         sa.district      || '',
    Amphoe:           sa.amphoe        || '',
    'lat.':           sa.lat           || '',
    'long.':          sa.lng           || '',
    directorM_1:      sa.directorM1    || '',
    'Tel.directorM_1':sa.telDirectorM1 || '',
    AdvisorM_1:       sa.advisorM1     || '',
    TelAdvisorM_1:    sa.telAdvisorM1  || '',

    // ─── ที่อยู่บ้าน ───────────────────────────────────────
    addr:          addr.addr    || addr.no || '',
    addr_moo:      addr.moo     || '',
    addr_village:  addr.village || '',
    addr_tambon:   addr.tambon  || '',
    addr_amphoe:   addr.amphoe  || '',
    addr_province: addr.province|| '',
    addr_zip:      addr.zip     || '',
    addr_nat:      addr.nat     || '',
    religion:      addr.rel     || s.religion || '',

    // ─── ธนาคาร ───────────────────────────────────────────
    bank_contract:     bank.contract     || '',
    bank_contractDate: bank.contractDate || '',
    bank_bankSt:       bank.bankSt       || '',
    bank_branchSt:     bank.branchSt     || '',
    bank_accNoSt:      bank.accNoSt      || '',
    bank_accNameSt:    bank.accNameSt    || '',
    bank_bankSch:      bank.bankSch      || '',
    bank_branchSch:    bank.branchSch    || '',
    bank_accNoSch:     bank.accNoSch     || '',
    bank_accNameSch:   bank.accNameSch   || '',

    // ─── GPA ──────────────────────────────────────────────
    gpa: {
      gpa:           latestGpa.gpa          || 0,
      riskLevel:     latestGpa.riskLevel     || 'ปานกลาง',
      hasObstacle:   latestGpa.hasObstacle   || false,
      obstacleType:  latestGpa.obstacleType  || '',
      weakSubjects:  latestGpa.weakSubjects  || '',
      schoolSupport: latestGpa.schoolSupport || '',
    },

    // ─── พี่เลี้ยง / behavior ──────────────────────────────
    mentor_firstName: (s.mentor && s.mentor.firstName) || s.mentor_firstName || '',
    mentor_lastName:  (s.mentor && s.mentor.lastName)  || s.mentor_lastName  || '',
    mentor_phone:     (s.mentor && s.mentor.phone)     || s.mentor_phone     || '',
    mentor_position:  (s.mentor && s.mentor.position)  || s.mentor_position  || '',
    behavior: s.behavior || '',

    // ─── semPayments array (GAS อ่านเพื่อ upsertPayment) ──
    semPayments: (s.semPayments || []).map(p => ({
      term:  p.term  || '',
      p1:    Number(p.p1)  || 0,
      p2:    Number(p.p2)  || 0,
      item1: p.item1 || 'ค่าเงินบำรุงการศึกษา',
      item2: p.item2 || 'ค่าใช้จ่ายในการเรียน',
    })),

    // ─── semGpa array (ส่งทุก record เพื่อ sync ข้ามเครื่อง) ──
    semGpa: (s.semGpa || []).map(g => ({
      term:          g.term          || '',
      gpa:           Number(g.gpa)   || 0,
      riskLevel:     g.riskLevel     || 'ปานกลาง',
      hasObstacle:   g.hasObstacle   || false,
      obstacleType:  g.obstacleType  || '',
      weakSubjects:  g.weakSubjects  || '',
      schoolSupport: g.schoolSupport || '',
    })),

    // ─── GPA แบบ column (แต่ละภาคเรียน = column ใหม่) ──────
    // ใช้ key: GPA_1/2568, Risk_1/2568, Obs_1/2568, ObsType_1/2568, WeakSub_1/2568, Support_1/2568
    ...Object.fromEntries(
      (s.semGpa || []).flatMap(g => {
        const t = g.term || 'unknown';
        return [
          [`GPA_${t}`,          Number(g.gpa) || 0],
          [`Risk_${t}`,         g.riskLevel   || ''],
          [`Obs_${t}`,          g.hasObstacle ? 'TRUE' : 'FALSE'],
          [`ObsType_${t}`,      g.obstacleType  || ''],
          [`WeakSub_${t}`,      g.weakSubjects  || ''],
          [`Support_${t}`,      g.schoolSupport || ''],
        ];
      })
    ),
  };
}

async function gasPost(body) {
  const res = await fetch(SCRIPT_URL, { method:'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (json.status !== 'ok') throw new Error(json.message || 'GAS error');
  return json;
}

// ─── โหลดครั้งแรก ─────────────────────────────────────────
async function loadFromSheet(silent = false) {
  if (!SCRIPT_URL) {
    if (!silent) showStatus('⚠️ ยังไม่ได้ตั้งค่า SCRIPT_URL ใน index.html', 'error');
    return false;
  }
  if (!silent) showLoading(true, 'กำลังโหลดข้อมูลจาก Google Sheet...');
  setSyncDot('syncing');
  try {
    const res  = await fetch(SCRIPT_URL + '?t=' + Date.now()); // cache-bust
    const json = await res.json();
    if (json.status !== 'ok') throw new Error(json.message || 'โหลดไม่สำเร็จ');
    const incoming = Array.isArray(json.data) ? json.data : [];

    // ── ป้องกัน "ไก่กับไข่": ถ้า Sheet ยังว่าง แต่ในเครื่องมีข้อมูลตั้งต้นอยู่
    //    ห้ามเอา array ว่างไปทับ — ให้คงข้อมูลเดิมไว้ แล้วชวนให้กด Save อัปโหลดขึ้น Sheet
    if (incoming.length === 0 && DB.students && DB.students.length > 0) {
      isConnected = true; _retryCount = 0;
      lastKnownUpdate = json.lastUpdated || lastKnownUpdate;
      setSyncDot('online');
      startPolling();
      if (!silent) showStatus('⚠️ Google Sheet ยังว่าง — กดปุ่ม 💾 Save (ซ้ายล่าง) เพื่ออัปโหลดข้อมูลตั้งต้น ' + DB.students.length + ' คนขึ้น Sheet', 'info');
      return true;
    }

    // เก็บข้อมูล "แบบฟอร์มทุนการศึกษา" (form1/form2) ที่กรอกไว้ในเครื่อง
    // ไว้ก่อน เพราะ Sheet หลัก (รายชื่อนักเรียน) ไม่มีคอลัมน์นี้ —
    // ถ้าไม่กู้คืน จะทำให้สถานะ "กรอกแล้ว/ยังไม่กรอก" หายไปทุกครั้งที่ sync
    const oldFormsById = {};
    (DB.students || []).forEach(s => {
      if (s && s.id && (s.form1 || s.form2)) {
        oldFormsById[s.id] = { form1: s.form1, form2: s.form2 };
      }
    });

    DB.students = incoming.map(s => normalizeStudent(s));
    DB.students.forEach(s => {
      const old = oldFormsById[s.id];
      if (old) {
        if (old.form1 && !s.form1) s.form1 = old.form1;
        if (old.form2 && !s.form2) s.form2 = old.form2;
      }
    });
    lastKnownUpdate = json.lastUpdated || null;
    isConnected = true; _retryCount = 0;
    loadPhotosFromStorage();  // กู้เฉพาะรูป base64 จาก localStorage (ไม่ทับข้อมูลจาก Sheet)
    saveToStorage();
    renderDashboard(); renderStudents(); populateFilters();
    startNavAvatarRotation();
    if (!silent) showStatus('✅ โหลดสำเร็จ — ' + DB.students.length + ' คน', 'success');
    setSyncDot('online');
    startPolling();
    return true;
  } catch (err) {
    setSyncDot('offline');
    if (!silent) showStatus('❌ เชื่อมต่อ Google Sheet ไม่ได้ (กำลังแสดงข้อมูลออฟไลน์): ' + err.message + ' — กด 🔄 Sync เพื่อลองใหม่', 'error');
    return false;
  } finally {
    if (!silent) showLoading(false);
  }
}

// ─── POLLING CORE ──────────────────────────────────────────
function startPolling() {
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = setInterval(pollTick, POLL_INTERVAL_MS);
}
function stopPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

async function pollTick() {
  // ข้ามถ้า: ไม่ได้เชื่อมต่อ / กำลังบันทึก / กำลังเปิดหน้าต่างแก้ไขนักเรียนอยู่
  // (กันไม่ให้ข้อมูลจาก Sheet มาทับรายการที่ผู้ใช้กำลังกรอก เช่น เพิ่งกดเพิ่มภาคเรียนใหม่)
  if (!isConnected || _isSaving || editingIndex !== null) return;
  if (Object.keys(_debounceSaveTimers).length > 0) return; // มีการแก้ไขรอ save อยู่
  try {
    // Step 1: check lastUpdated เท่านั้น (super lightweight)
    const res  = await fetch(SCRIPT_URL + '?check=1&t=' + Date.now());
    const json = await res.json();
    if (json.status !== 'ok') throw new Error('poll error');

    _retryCount = 0;
    const serverUpdate = json.lastUpdated;

    // ถ้า timestamp ไม่เปลี่ยน → ไม่ต้องทำอะไร
    // ป้องกัน skip เมื่อ lastKnownUpdate เป็นค่าว่างหรือ epoch
    const isUnknown = !lastKnownUpdate || lastKnownUpdate === new Date(0).toISOString();
    if (!isUnknown && serverUpdate && serverUpdate === lastKnownUpdate) {
      setSyncDot('online');
      return;
    }

    // Step 2: มีการเปลี่ยนแปลง → ดึงเฉพาะที่เปลี่ยนหลัง lastKnownUpdate
    const since = lastKnownUpdate || '';
    const res2  = await fetch(`${SCRIPT_URL}?since=${encodeURIComponent(since)}&t=${Date.now()}`);
    const json2 = await res2.json();
    if (json2.status !== 'ok') throw new Error('fetch diff error');

    const changed = json2.data || [];
    if (changed.length > 0) {
      // Merge diff เข้า DB (ไม่ reload ทั้งหมด)
      let addCount = 0, updateCount = 0;
      changed.forEach(incoming => {
        const norm = normalizeStudent(incoming);
        const idx  = DB.students.findIndex(s => String(s.id) === String(norm.id));
        if (idx >= 0) {
          // merge แต่ให้ semPayments และ semGpa จาก server override เสมอ (ไม่เอา local)
          DB.students[idx] = {
            ...DB.students[idx],
            ...norm,
            semPayments: (norm.semPayments && norm.semPayments.length > 0)
              ? norm.semPayments
              : DB.students[idx].semPayments,
            semGpa: (norm.semGpa && norm.semGpa.length > 0)
              ? norm.semGpa
              : (DB.students[idx].semGpa && DB.students[idx].semGpa.length > 0)
                ? DB.students[idx].semGpa   // รักษา local ถ้า server ยังไม่มี
                : norm.semGpa,
            // รักษา photoUrl local ไว้ถ้า server ไม่มี
            photoUrl: norm.photoUrl || DB.students[idx].photoUrl,
          };
          updateCount++;
        } else {
          DB.students.push(norm);
          addCount++;
        }
      });
      DB.students.forEach((s, i) => { s.no = i + 1; });
      lastKnownUpdate = json2.lastUpdated || serverUpdate;
      saveToStorage();
      renderDashboard(); renderStudents(); populateFilters();
      // แจ้งเตือนแบบ toast เบาๆ
      const msg = [];
      if (updateCount) msg.push(`อัปเดต ${updateCount} คน`);
      if (addCount)    msg.push(`เพิ่มใหม่ ${addCount} คน`);
      showStatus('🔄 ' + msg.join(' • ') + ' (จากผู้ใช้อื่น)', 'info');
      flashSyncDot();
    } else {
      lastKnownUpdate = serverUpdate;
    }
    setSyncDot('online');
  } catch(e) {
    _retryCount++;
    if (_retryCount >= RETRY_MAX) {
      setSyncDot('offline');
      isConnected = false;
      showStatus('📡 ขาดการเชื่อมต่อ — กด 🔄 Sync เพื่อลองใหม่', 'error');
      stopPolling();
    }
  }
}

// ─── Sync dot visual ──────────────────────────────────────
function setSyncDot(state) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const map = {
    online:  { text:'🟢 Live', title:'Real-time sync ทุก 5 วินาที', bg:'rgba(58,106,16,0.25)' },
    syncing: { text:'🔵 กำลัง sync...', title:'กำลังโหลด...', bg:'rgba(26,95,168,0.25)' },
    offline: { text:'🔴 ออฟไลน์', title:'กด 🔄 Sync เพื่อเชื่อมต่อใหม่', bg:'rgba(158,43,43,0.25)' }
  };
  const s = map[state] || map.offline;
  el.textContent = s.text;
  el.title = s.title;
  el.style.background = s.bg;
}
function flashSyncDot() {
  const el = document.getElementById('sync-status');
  if (!el) return;
  el.style.transition = 'opacity 0.1s';
  el.style.opacity = '0.3';
  setTimeout(() => { el.style.opacity = '1'; }, 200);
}

// ─── บันทึก 1 คน (optimistic + upsert) ───────────────────
async function saveStudentToSheet(idx) {
  if (!SCRIPT_URL) return;
  const s = DB.students[idx];
  if (!s) return;
  _isSaving = true;
  setSyncDot('syncing');
  try {
    const cleaned = cleanForSheet(s);
    // 1) upsert students + payment sheet
    const result = await gasPost({ action: 'upsert', student: cleaned });
    if (result.lastUpdated) lastKnownUpdate = result.lastUpdated;
    // 2) upsert GPA sheet แบบ column format (แต่ละภาคเรียน = column ใหม่ พร้อม header)
    if (s.semGpa && s.semGpa.length > 0) {
      // สร้าง flat object: { id, no, name, school_m1, GPA_1/2568, Risk_1/2568, ... }
      const gpaColObj = {
        id: s.id, no: s.no, name: s.name,
        nickname: s.nickname || '',
        school_m1: s.school_m1 || '',
        province: s.province || '',
        gpa_p6: s.gpa_p6 || '',
      };
      s.semGpa.forEach(g => {
        const t = g.term || 'unknown';
        gpaColObj[`GPA_${t}`]     = Number(g.gpa) || 0;
        gpaColObj[`Risk_${t}`]    = g.riskLevel   || '';
        gpaColObj[`Obs_${t}`]     = g.hasObstacle ? 'TRUE' : 'FALSE';
        gpaColObj[`ObsType_${t}`] = g.obstacleType  || '';
        gpaColObj[`WeakSub_${t}`] = g.weakSubjects  || '';
        gpaColObj[`Support_${t}`] = g.schoolSupport || '';
      });
      // ยังส่ง semGpa array ไปด้วยเพื่อ backward-compat
      gpaColObj.semGpa = s.semGpa;
      const gpaResult = await gasPost({ action: 'upsertGpa', student: gpaColObj });
      if (gpaResult.lastUpdated) lastKnownUpdate = gpaResult.lastUpdated;
    }
    isConnected = true; _retryCount = 0;
    setSyncDot('online');
    showStatus('☁️ บันทึก ' + (s.name||'นักเรียนใหม่') + ' ไปยัง Sheet แล้ว', 'success');
    if (!_pollTimer) startPolling();
  } catch (err) {
    setSyncDot('offline');
    showStatus('⚠️ Sheet ไม่ตอบสนอง (บันทึก local ไว้แล้ว) — จะ retry อัตโนมัติ', 'error');
    setTimeout(() => saveStudentToSheet(idx), 10000);
  } finally {
    _isSaving = false;
  }
}

// ─── บันทึกทุกคน (import / reset) ────────────────────────
async function saveAllToSheet() {
  if (!SCRIPT_URL) {
    showStatus('⚠️ ยังไม่ได้ตั้งค่า SCRIPT_URL', 'error'); return;
  }
  if (!confirm('บันทึกข้อมูลทั้งหมด (' + DB.students.length + ' คน) ไปยัง Google Sheet?\n⚠️ จะเขียนทับข้อมูลทั้งหมดใน Sheet')) return;
  stopPolling(); _isSaving = true;
  showLoading(true, 'กำลังบันทึก ' + DB.students.length + ' คน...');
  setSyncDot('syncing');
  try {
    const result = await gasPost({ action: 'saveAll', students: DB.students.map(s => cleanForSheet(s)) });
    if (result.lastUpdated) lastKnownUpdate = result.lastUpdated;
    isConnected = true; setSyncDot('online');
    showStatus('✅ บันทึกทั้งหมด ' + DB.students.length + ' คนสำเร็จ', 'success');
  } catch (err) {
    setSyncDot('offline');
    showStatus('❌ บันทึกไม่สำเร็จ: ' + err.message, 'error');
  } finally {
    _isSaving = false;
    showLoading(false);
    startPolling();
  }
}

// ─── ลบออกจาก Sheet ───────────────────────────────────────
async function deleteStudentFromSheet(studentId, studentData) {
  if (!SCRIPT_URL) return;
  try {
    // 1) ล้าง GPA rows ของนักเรียนคนนี้ก่อน (ส่ง semGpa=[])
    if (studentData) {
      await gasPost({ action: 'upsertGpa', student: {
        id: studentId, no: studentData.no || '', name: studentData.name || '',
        school_m1: studentData.school_m1 || '', semGpa: []
      }});
    }
    // 2) ลบจาก students + payment sheet
    const result = await gasPost({ action: 'delete', id: studentId });
    if (result.lastUpdated) lastKnownUpdate = result.lastUpdated;
  } catch(e) { console.warn('deleteStudentFromSheet:', e.message); }
}

// ─── Export JSON ───────────────────────────────────────────
