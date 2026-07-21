/* ============================================================
   12-ui-misc.js — export JSON, แถบสถานะ, ลบนักเรียน, INIT เริ่มระบบ, lightbox
   (แยกมาจาก index.html เดิม บรรทัด 3581-3788 โดยรักษาลำดับโค้ดเดิม)
   ============================================================ */
function exportJSON() {
  const json = JSON.stringify(DB.students, null, 2);
  const blob = new Blob([json], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'dltv_students.json'; a.click();
  URL.revokeObjectURL(url);
  showStatus('✅ Export JSON สำเร็จ', 'success');
}

// ─── Sidebar nav student avatars ─────────────────────────
let _navAvatarTimer = null;
let _navAvatarIdx = { banking: 0, payment: 1 };

function updateNavAvatars() {
  const students = DB.students || [];
  const withPhoto = students.filter(s => s.photoUrl);
  if (!withPhoto.length) return;

  ['banking', 'payment'].forEach(key => {
    const el = document.getElementById('nav-avatar-' + key);
    if (!el) return;
    const s = withPhoto[_navAvatarIdx[key] % withPhoto.length];
    if (!s) return;
    const src = fixDriveUrl(s.photoUrl);
    el.innerHTML = `<img class="nav-avatar-img" src="${src}"
      alt="${s.name}"
      onerror="this.style.display='none';this.parentElement.textContent='${initials(s.name)}'">`;
    _navAvatarIdx[key] = (_navAvatarIdx[key] + 3) % Math.max(withPhoto.length, 1);
  });
}

function startNavAvatarRotation() {
  updateNavAvatars();
  if (_navAvatarTimer) clearInterval(_navAvatarTimer);
  _navAvatarTimer = setInterval(() => {
    updateNavAvatars();
  }, 4000);
}

function updateSyncStatus(connected, label) { setSyncDot(connected ? 'online' : 'offline'); }

// ─── Debounced save: รอ 1.5 วินาทีหลังหยุดแก้ไขค่อย sync ──
const _debounceSaveTimers = {};
function debouncedSave(idx) {
  saveToStorage(); // บันทึก local ทันที
  if (_debounceSaveTimers[idx]) clearTimeout(_debounceSaveTimers[idx]);
  _debounceSaveTimers[idx] = setTimeout(() => {
    delete _debounceSaveTimers[idx];
    saveStudentToSheet(idx);
  }, 1500);
}

// ─── สร้าง style ของ popup สถานะ (ครั้งเดียว) ─────────────
function _ensureStatusStyles() {
  if (document.getElementById('status-pop-style')) return;
  const st = document.createElement('style');
  st.id = 'status-pop-style';
  st.textContent = `
    #status-pop-wrap{position:fixed;inset:0;z-index:10002;display:flex;align-items:center;justify-content:center;pointer-events:none}
    .status-pop{pointer-events:auto;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:14px;
      min-width:230px;max-width:82vw;padding:28px 36px;border-radius:22px;text-align:center;
      font-family:Sarabun,sans-serif;background:#fff;color:#1A1D2E;
      box-shadow:0 24px 64px rgba(15,17,35,.30),0 4px 14px rgba(15,17,35,.12);
      border:1px solid rgba(15,17,35,.06);
      animation:popIn .44s cubic-bezier(.18,1.4,.4,1) both}
    .status-pop.pop-out{animation:popOut .26s cubic-bezier(.4,0,1,1) both}
    .status-pop .sp-ico{width:70px;height:70px;border-radius:50%;display:flex;align-items:center;justify-content:center;
      font-size:40px;font-weight:900;color:#fff;box-shadow:0 8px 20px rgba(0,0,0,.18);
      animation:icoPop .58s .08s cubic-bezier(.18,1.6,.4,1) both}
    .status-pop .sp-msg{font-size:16px;font-weight:600;line-height:1.5;max-width:34ch}
    .status-pop.sp-success .sp-ico{background:linear-gradient(135deg,#1AA86A,#15803D)}
    .status-pop.sp-error   .sp-ico{background:linear-gradient(135deg,#F05252,#DC2626)}
    .status-pop.sp-info    .sp-ico{background:linear-gradient(135deg,#3B82F6,#2563EB)}
    @keyframes popIn{0%{opacity:0;transform:scale(.7)}60%{transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}
    @keyframes popOut{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.85)}}
    @keyframes icoPop{0%{transform:scale(0) rotate(-30deg)}100%{transform:scale(1) rotate(0)}}
  `;
  document.head.appendChild(st);
}

let _statusTimer = null, _statusKey = '';

function hideStatus() {
  const wrap = document.getElementById('status-pop-wrap');
  _statusKey = '';
  if (!wrap || !wrap.firstElementChild) return;
  const card = wrap.firstElementChild;
  card.classList.add('pop-out');
  setTimeout(() => { if (card.parentElement) card.remove(); }, 260);
}

// ─── แสดงสถานะแบบ popup เดี่ยว กลางจอ ไอคอนใหญ่ + กันข้อความซ้ำ ───
function showStatus(msg, type = 'success') {
  _ensureStatusStyles();
  const t = ['success', 'error', 'info'].includes(type) ? type : 'success';
  const icons = { success: '✓', error: '✕', info: 'i' };
  const key = t + '|' + msg;
  const dur = (t === 'error') ? 4500 : (t === 'info') ? 5000 : 2200;

  let wrap = document.getElementById('status-pop-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'status-pop-wrap'; document.body.appendChild(wrap); }

  // กันข้อความซ้ำ: ถ้ากำลังแสดงข้อความเดียวกันอยู่ แค่ต่อเวลา ไม่เด้งใหม่
  if (key === _statusKey && wrap.firstElementChild) {
    clearTimeout(_statusTimer);
    _statusTimer = setTimeout(hideStatus, dur);
    return;
  }

  _statusKey = key;
  wrap.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'status-pop sp-' + t;
  card.innerHTML = `<div class="sp-ico">${icons[t]}</div><div class="sp-msg"></div>`;
  card.querySelector('.sp-msg').textContent = msg;
  card.addEventListener('click', hideStatus);   // คลิกเพื่อปิดเอง
  wrap.appendChild(card);

  clearTimeout(_statusTimer);
  _statusTimer = setTimeout(hideStatus, dur);
}

function showLoading(show, msg = '') {
  let ov = document.getElementById('loading-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'loading-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)';
    ov.innerHTML = '<div style="background:#fff;border-radius:14px;padding:28px 36px;text-align:center;font-family:Sarabun,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.15)"><div style="font-size:32px;margin-bottom:10px">⏳</div><div id="loading-msg" style="font-size:14px;color:#1C1B18;font-weight:600"></div></div>';
    document.body.appendChild(ov);
  }
  ov.style.display = show ? 'flex' : 'none';
  if (msg) document.getElementById('loading-msg').textContent = msg;
}

// ─── บันทึก + ปิด modal (optimistic UI) ──────────────────
function saveAndRefresh() {
  DB.students.forEach((s, i) => {
    s.no = i + 1;
    // sync s.payment จาก semPayments ล่าสุดเสมอ ก่อน render
    if (s.semPayments && s.semPayments.length > 0) {
      const lp = s.semPayments[s.semPayments.length - 1];
      s.payment = { term: lp.term, p1: lp.p1||0, p2: lp.p2||0,
                    item1: lp.item1||'ค่าเงินบำรุงการศึกษา', item2: lp.item2||'ค่าใช้จ่ายในการเรียน' };
    }
  });
  saveToStorage();
  const savedIdx = editingIndex;
  closeModal('student-modal');
  renderStudents(); renderDashboard(); populateFilters();
  // refresh payment page ถ้ากำลังดูอยู่
  const payPage = document.getElementById('page-payment');
  if (payPage && payPage.classList.contains('active')) { populateTermFilter(); renderPayment(); }
  if (savedIdx !== null) saveStudentToSheet(savedIdx);   // sync ใน background
}

// Override deleteStudent to also delete from Sheet
function deleteStudent(idx) {
  if (!confirm('ยืนยันการลบ "' + DB.students[idx].name + '" ?')) return;
  const sid  = DB.students[idx].id;
  const sdat = { no: DB.students[idx].no, name: DB.students[idx].name, school_m1: DB.students[idx].school_m1 };
  DB.students.splice(idx, 1);
  DB.students.forEach((s, i) => { s.no = i + 1; });
  saveToStorage();
  renderStudents(); renderDashboard(); populateFilters();
  deleteStudentFromSheet(sid, sdat);
  showStatus('✅ ลบข้อมูลสำเร็จ', 'success');
}

// ============ INIT ============
(function() {
  loadFromStorage();
  console.log('DB.students count:', DB.students.length);
  console.log('First student semGpa:', DB.students[0]?.semGpa);
  renderDashboard();
  renderStudents();
  populateFilters();
  startNavAvatarRotation();
  // โหลดข้อมูลจาก Sheet อัตโนมัติเมื่อเปิดหน้า — เฉพาะเมื่อ "ไม่ได้" ใช้ Firebase
  // (ถ้าใช้ Firebase แล้ว การโหลดจาก Sheet จะทับข้อมูลคลาวด์และเด้ง popup โดยไม่จำเป็น)
  const FB_ACTIVE = !!(window.FIREBASE_CONFIG
    && window.FIREBASE_CONFIG.projectId
    && window.FIREBASE_CONFIG.projectId !== 'your-project-id'
    && String(window.FIREBASE_CONFIG.apiKey).indexOf('ใส่ค่า') === -1);
  if (FB_ACTIVE) {
    console.log('☁️ ใช้ Firebase เป็นแหล่งข้อมูลหลัก — ข้ามการโหลดจาก Google Sheet');
  } else if (SCRIPT_URL) {
    loadFromSheet(false);
  } else {
    showStatus('💡 ตั้งค่า SCRIPT_URL ใน index.html เพื่อเชื่อมต่อ Google Sheet', 'info');
  }
})();

// ============ LIGHTBOX ============
function openLightbox(url, name) {
  if (!url) return;
  const fullUrl = fixDriveUrl(url).replace('sz=w200', 'sz=w800');
  const img = document.getElementById('lightbox-img');
  const nameEl = document.getElementById('lightbox-name');
  img.src = fullUrl;
  img.alt = name || '';
  nameEl.textContent = name || '';
  document.getElementById('lightbox-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  document.getElementById('lightbox-overlay').classList.remove('open');
  document.getElementById('lightbox-img').src = '';
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

// ============ SCHOOL MAP ============
// lat/long data per student (matched by no, from Excel)
