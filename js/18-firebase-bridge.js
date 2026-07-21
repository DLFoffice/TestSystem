/* ============================================================
   18-firebase-bridge.js (v2) — เชื่อมแอปหลักกับ Cloud Firestore
   ------------------------------------------------------------
   สิ่งที่เปลี่ยนจาก v1:
   • แก้ popup "ข้อมูลอัปเดตจากคลาวด์" เด้งรัว:
     เทียบข้อมูลแบบ canonical (เรียง key ก่อน stringify) — echo จาก
     การบันทึกของเราเองจะถูกมองว่า "เหมือนเดิม" และถูกข้ามแบบเงียบๆ
     การอัปเดตจากเครื่องอื่นจะวาดหน้าจอใหม่โดยไม่มี popup (กะพริบจุด sync แทน)
   • ยังไม่ล็อกอิน → พาไปหน้า login.html (ดีไซน์ใหม่) แทน overlay เดิม
   • เมนูบัญชีมุมล่างขวา: เปลี่ยนรหัสผ่าน / จัดการบัญชี (เฉพาะแอดมิน) / ออกจากระบบ
   • บังคับเปลี่ยนรหัสผ่านครั้งแรก ถ้าบัญชีถูกตั้งค่า mustChangePassword
   ============================================================ */

(function () {
  'use strict';

  /* ---------- 0) ตรวจความพร้อม ---------- */
  const cfg = window.FIREBASE_CONFIG;
  const configured = cfg && typeof firebase !== 'undefined'
    && cfg.projectId && cfg.projectId !== 'your-project-id'
    && String(cfg.apiKey).indexOf('ใส่ค่า') === -1;

  if (!configured) {
    console.log('☁️ Firebase ยังไม่ตั้งค่า — ใช้โหมด localStorage ตามเดิม');
    return;
  }

  firebase.initializeApp(cfg);
  const auth = firebase.auth();
  const fsdb = firebase.firestore();
  const COL  = 'students';

  // คืนเมนูเต็มสำหรับครู/แอดมิน (กรณี hint จากเซสชันก่อนเป็นนักเรียน)
  function restoreFullNav() {
    document.querySelectorAll('#sidebar-nav .nav-btn, #sidebar-nav .sidebar-section-label')
      .forEach(el => el.style.display = '');
    const acts = document.querySelector('.sidebar-actions');
    if (acts) acts.style.display = '';
  }

  // ลดการกระพริบ: ถ้าเซสชันก่อนหน้าบนเครื่องนี้เป็นบัญชีนักเรียน
  // ให้ซ่อนเมนู/สลับหน้าแบบฟอร์มทันที ไม่ต้องรอผลตรวจสิทธิ์ (แวบเดียว dashboard จะไม่โผล่)
  try {
    if (localStorage.getItem('fbRoleHint') === 'student') applyStudentRestrictions();
  } catch (e) {}

  // กัน back-forward cache: กดปุ่ม back กลับมาแล้วเบราว์เซอร์คืนสภาพหน้าเก่า
  // (รวมข้อมูลเก่าก่อนกรองสิทธิ์) → บังคับโหลดหน้าใหม่เพื่อให้สิทธิ์ถูกตรวจซ้ำเสมอ
  window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });

  let fbReady = false;
  let unsubscribe = null;
  let pushPending = false;   // มีการบันทึกที่ยังไม่ขึ้นคลาวด์ → ห้าม snapshot ทับ
  let isAdmin = false;
  let studentMode = false;   // บัญชีนักเรียน: เห็นเฉพาะแบบฟอร์ม+สถานะของตัวเอง

  /* ── แถบเตือนบนหน้า (แทน popup ตอนเข้าระบบ) ── */
  function showTopBanner(msg) {
    let b = document.getElementById('fb-top-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'fb-top-banner';
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99997;background:#FEF3C7;'
        + 'color:#7A5B00;border-bottom:1px solid #E8CC7A;padding:10px 44px 10px 16px;'
        + "font-family:'Sarabun',sans-serif;font-size:13.5px;line-height:1.6;text-align:center";
      const x = document.createElement('button');
      x.textContent = '✕';
      x.style.cssText = 'position:absolute;right:10px;top:6px;border:none;background:none;'
        + 'cursor:pointer;font-size:15px;color:#7A5B00;padding:4px 8px';
      x.onclick = () => b.remove();
      b.appendChild(x);
      const span = document.createElement('span');
      span.id = 'fb-top-banner-msg';
      b.insertBefore(span, x);
      (document.body || document.documentElement).appendChild(b);
    }
    const m = document.getElementById('fb-top-banner-msg');
    if (m) m.textContent = msg;
  }

  /* ── โหมดนักเรียน: ซ่อนทุกเมนู เหลือ "แบบฟอร์มทุนการศึกษา" + "ติดตามการกรอกแบบฟอร์ม" ── */
  function applyStudentRestrictions() {
    document.querySelectorAll('#sidebar-nav .sidebar-section-label').forEach(l => l.style.display = 'none');
    let formBtn = null;
    document.querySelectorAll('#sidebar-nav .nav-btn').forEach(b => {
      const oc = b.getAttribute('onclick') || '';
      const keep = oc.indexOf("'scholarform'") !== -1 || oc.indexOf("'formtrack'") !== -1;
      if (!keep) b.style.display = 'none';
      else if (oc.indexOf("'scholarform'") !== -1) formBtn = b;
    });
    // ซ่อนปุ่ม Sync/Save/Export (งานของครู/แอดมิน)
    const acts = document.querySelector('.sidebar-actions');
    if (acts) acts.style.display = 'none';
    // พาเข้าหน้าแบบฟอร์มของตัวเองทันที
    try { if (typeof showPage === 'function') showPage('scholarform', formBtn || undefined); } catch (e) {}
  }

  /* ---------- helpers ---------- */
  function cleanForCloud(s) {
    const c = JSON.parse(JSON.stringify(s));
    delete c._updatedAt;
    delete c._docId;          // ฟิลด์ภายในของแอป ไม่เก็บขึ้นคลาวด์
    if (c.photoUrl && String(c.photoUrl).startsWith('data:')) c.photoUrl = '';
    return c;
  }

  // เทียบชื่อแบบยืดหยุ่น (ตัดคำนำหน้า/ช่องว่าง) — ใช้ยืนยันตัวตนนักเรียน
  function bNormName(n) {
    return String(n || '')
      .replace(/เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|นางสาว|นาย|นาง/g, '')
      .replace(/\s+/g, '').trim();
  }
  function bSurname(n) {
    const t = String(n || '').trim().split(/\s+/);
    return bNormName(t.length > 1 ? t[t.length - 1] : '');
  }
  function bNameMatch(a, b) {
    const x = bNormName(a), y = bNormName(b);
    if (!x || !y) return false;
    return x === y || (x.length >= 5 && (x.includes(y) || y.includes(x)));
  }

  // stringify แบบเรียง key ทุกชั้น — ทำให้เทียบข้อมูลได้แม้ Firestore คืน key คนละลำดับ
  function stableStringify(v) {
    if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
    if (v && typeof v === 'object') {
      return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
    }
    return JSON.stringify(v);
  }
  function canon(students) {
    return stableStringify(
      students.slice().sort((a, b) => (a.no || 0) - (b.no || 0)).map(cleanForCloud)
    );
  }

  // ── ลายเซ็นของเอกสารที่ "ตรงกับคลาวด์แล้ว" (docId → stableStringify) ──
  // เดิม: ทุกครั้งที่กดบันทึก 1 ครั้ง = เขียน Firestore 72 ครั้ง (merge:false ทับทั้งเอกสาร)
  // แค่กรอกแบบฟอร์มไม่กี่หน้าก็ชน quota ฟรีเทียร์ (20,000 writes/วัน) และเสี่ยงลบฟิลด์ที่แอปยังไม่รู้จัก
  const _cloudSig = new Map();
  function docIdOf(s) {
    if (studentMode && window.STUDENT_MODE) return String(window.STUDENT_MODE.studentId);
    return String(s._docId || s.id);   // รหัสเอกสารจริงมาก่อนฟิลด์เลขบัตรเสมอ
  }
  function seedCloudSig(students) {
    _cloudSig.clear();
    students.forEach(s => { const id = docIdOf(s); if (id && id !== 'undefined') _cloudSig.set(id, stableStringify(cleanForCloud(s))); });
  }

  // คืน/สร้าง "รหัสเอกสารถาวร" ให้ทุกระเบียน — กันนักเรียนที่ยังไม่ได้กรอกเลขบัตร
  // (เช่น คนที่เพิ่งถูกเพิ่มกลับเข้าระบบ เช่นลำดับ 1) ถูกคัดทิ้งจนไม่ได้บันทึกขึ้นคลาวด์
  // แล้ว "หายไป" ทันทีที่ snapshot/รีโหลดเอาข้อมูลคลาวด์มาทับ DB.students
  function ensureDocId(s) {
    if (studentMode && window.STUDENT_MODE) return String(window.STUDENT_MODE.studentId);
    let id = String(s._docId || s.id || '').trim();
    if (id && id !== 'undefined') return id;
    // ไม่มีทั้ง _docId และเลขบัตร → ตั้งรหัสเอกสารถาวรจาก "ลำดับ" (unique 1..N)
    // ถ้าไม่มีลำดับด้วยจริง ๆ ค่อย fallback เป็น auto-id ของ Firestore
    id = (s.no != null && String(s.no) !== '') ? ('no-' + s.no) : fsdb.collection(COL).doc().id;
    s._docId = id;   // จำไว้กับตัวระเบียน → การแก้ครั้งถัดไปเขียนทับเอกสารเดิม (ไม่เกิดเอกสารซ้ำ)
    return id;
  }

  /** เขียนขึ้นคลาวด์เฉพาะเอกสารที่เนื้อหาเปลี่ยนจริง (force=true → เขียนทุกฉบับ) */
  async function pushAllToCloud(force) {
    const students = DB.students.slice();   // ทุกคนต้องถูกบันทึก — ไม่คัดใครทิ้งเงียบ ๆ อีก
    const dirty = [];
    students.forEach(s => {
      const id = ensureDocId(s);
      if (!id || id === 'undefined') return;
      const sig = stableStringify(cleanForCloud(s));
      if (force || _cloudSig.get(id) !== sig) dirty.push({ id, s, sig });
    });
    if (!dirty.length) return 0;
    for (let i = 0; i < dirty.length; i += 450) {
      const batch = fsdb.batch();
      dirty.slice(i, i + 450).forEach(({ id, s }) => {
        // merge:true — ไม่ลบฟิลด์ที่เวอร์ชันนี้ยังไม่รู้จัก (กันข้อมูลหายเหมือนเคสลำดับ 1)
        batch.set(fsdb.collection(COL).doc(id), cleanForCloud(s), { merge: true });
      });
      await batch.commit();
    }
    dirty.forEach(({ id, sig }) => _cloudSig.set(id, sig));
    console.log('☁️ เขียนขึ้นคลาวด์ ' + dirty.length + '/' + students.length + ' เอกสาร');
    return dirty.length;
  }

  // แปลงข้อมูลดิบจากคลาวด์ให้อยู่ในรูปเดียวกับ DB (เติมฟิลด์ที่ระบบต้องมี)
  function prepareCloudStudents(students) {
    const normalized = students.map(raw => {
      const s = JSON.parse(JSON.stringify(raw));
      delete s._updatedAt;
      return (typeof normalizeStudent === 'function') ? normalizeStudent(s) : s;
    });
    normalized.sort((a, b) => (a.no || 0) - (b.no || 0));
    return normalized;
  }

  function applyCloudStudents(students) {
    let normalized = prepareCloudStudents(students);
    // โหมดนักเรียน: เห็นเฉพาะระเบียนของตัวเองเท่านั้น
    if (studentMode && window.STUDENT_MODE) {
      const myId = String(window.STUDENT_MODE.studentId);
      const filtered = normalized.filter(s => String(s._docId || s.id) === myId);
      // ข้อมูลโหมดนักเรียนมาจาก "เอกสารของตัวเอง" ที่ผ่าน Rules แล้วเสมอ (ทีละ 1 ฉบับ)
      // ถ้าเลขบัตรในข้อมูลไม่ตรง (เพิ่งถูกครูแก้) อย่าคัดทิ้งจนจอว่าง — ระบบจะย้ายการผูกให้เอง
      if (filtered.length === 0 && normalized.length === 1) {
        console.warn('☁️ เลขบัตรในข้อมูลไม่ตรงกับบัญชี (จะถูกย้ายการผูกอัตโนมัติ):',
          String(normalized[0].id), '≠', myId);
      } else {
        normalized = filtered;
      }
    }
    // คงรูป base64 ที่มีเฉพาะในเครื่อง (คลาวด์ไม่เก็บรูป data:)
    const localPhotos = {};
    DB.students.forEach(s => {
      if (s.photoUrl && String(s.photoUrl).startsWith('data:')) localPhotos[String(s.id)] = s.photoUrl;
    });
    normalized.forEach(s => {
      if (!s.photoUrl && localPhotos[String(s.id)]) s.photoUrl = localPhotos[String(s.id)];
    });
    DB.students = normalized;
    // เติมฟิลด์ที่ขาดให้ครบ "ก่อน" จำลายเซ็น มิฉะนั้นการวาดหน้าจอจะทำให้ข้อมูลต่างจากลายเซ็นทันที
    try { if (typeof ensureStudentShape === 'function') DB.students.forEach(ensureStudentShape); } catch (e) {}
    seedCloudSig(DB.students);          // ข้อมูลชุดนี้ = ตรงกับคลาวด์แล้ว ไม่ต้องเขียนซ้ำ
    renderDashboard(); renderStudents(); populateFilters();
    if (typeof renderGpaSheet === 'function' && document.getElementById('page-gpa-sheet')?.classList.contains('active')) renderGpaSheet();
    // ถ้าเปิดหน้าแบบฟอร์ม/สถานะการกรอกอยู่ ให้วาดลิสต์ใหม่ด้วย (ไม่งั้นลิสต์เก่าค้าง)
    if (typeof sfRenderPage === 'function' && document.getElementById('page-scholarform')?.classList.contains('active')) sfRenderPage();
    if (typeof renderFormTrack === 'function' && document.getElementById('page-formtrack')?.classList.contains('active')) renderFormTrack();
  }

  /* ---------- 1) ดัก saveToStorage ---------- */
  const _origSaveToStorage = saveToStorage;
  let _pushTimer = null;
  saveToStorage = async function () {
    await _origSaveToStorage();
    if (!fbReady) return;
    pushPending = true;
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(async () => {
      try {
        await pushAllToCloud();
        if (typeof setSyncDot === 'function') setSyncDot('online');
      } catch (e) {
        console.warn('☁️ push ไป Firestore ไม่สำเร็จ:', e.code, e.message,
          '| uid:', auth.currentUser && auth.currentUser.uid,
          '| studentMode:', studentMode,
          '| studentId:', window.STUDENT_MODE && window.STUDENT_MODE.studentId);
        if (typeof showStatus === 'function') {
          const hint = e.code === 'permission-denied'
            ? ' — เปิดหน้า check.html เพื่อวินิจฉัยสิทธิ์ หรือตรวจว่า Publish Rules เวอร์ชันล่าสุดแล้ว'
            : '';
          showStatus('⚠️ บันทึกขึ้นคลาวด์ไม่สำเร็จ: ' + e.message + hint, 'error');
        }
      } finally {
        pushPending = false;
      }
    }, 800);
  };

  /* ---------- 2) ดัก deleteStudent ---------- */
  const _origDeleteStudent = deleteStudent;
  deleteStudent = function (idx) {
    const before = DB.students.map(s => String(s._docId || s.id));
    _origDeleteStudent(idx);
    const after = new Set(DB.students.map(s => String(s._docId || s.id)));
    before.filter(id => id && id !== 'undefined' && !after.has(id)).forEach(id => {
      if (!fbReady) return;
      fsdb.collection(COL).doc(id).delete()
        .catch(e => console.warn('☁️ ลบในคลาวด์ไม่สำเร็จ:', e.message));
    });
  };

  /* ---------- 3) ปิดการดึงรายชื่อจาก Google Sheet ---------- */
  if (typeof stopPolling === 'function') stopPolling();
  if (typeof loadFromSheet === 'function') {
    loadFromSheet = async function () {};
  }

  /* ---------- 4) ปุ่มบัญชีใน sidebar (ล่างซ้าย) + modal เปลี่ยนรหัสผ่าน ---------- */
  const ui = document.createElement('div');
  ui.innerHTML = `
    <style>
      .fb-side-actions{display:flex;gap:6px;margin-top:8px}
      .fb-side-actions .sidebar-action-btn{flex:1}
      /* ปุ่มลอยสำรอง กรณีหา sidebar ไม่เจอ */
      .fb-float{position:fixed;bottom:14px;right:14px;z-index:9000;display:none;flex-direction:column;
        align-items:flex-end;gap:8px;font-family:'Sarabun',sans-serif}
      .fb-float button{border:none;border-radius:20px;padding:8px 15px;font-size:12.5px;cursor:pointer;
        font-family:'Sarabun',sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25);color:#fff;background:rgba(26,29,46,.9)}
      #fb-pass-modal{position:fixed;inset:0;background:rgba(20,18,10,.5);z-index:99998;display:none;
        align-items:center;justify-content:center;font-family:'Sarabun',sans-serif}
      #fb-pass-modal.open{display:flex}
      #fb-pass-card{width:min(380px,92%);background:#fff;border-radius:16px;padding:26px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
      #fb-pass-card h3{margin:0 0 4px;font-family:'Noto Sans Thai',sans-serif;font-size:17px;color:#1A1D2E}
      #fb-pass-card p{margin:0 0 14px;font-size:12.5px;color:#8A8F9E;line-height:1.6}
      .fb-field{position:relative;margin-bottom:9px}
      .fb-field input{width:100%;padding:11px 40px 11px 12px;border:1.5px solid #E5E0D4;border-radius:10px;
        font-size:14px;font-family:'Sarabun',sans-serif;box-sizing:border-box}
      .fb-field input:focus{outline:none;border-color:#F5A623;box-shadow:0 0 0 3px rgba(245,166,35,.18)}
      .fb-eye{position:absolute;right:5px;top:50%;transform:translateY(-50%);border:none;background:none;
        cursor:pointer;padding:7px;font-size:15px;opacity:.6;border-radius:8px}
      .fb-eye:hover{opacity:1}
      #fb-pass-err{color:#DC2626;font-size:12.5px;min-height:17px;margin-top:4px}
      .fb-actions{display:flex;gap:10px;margin-top:12px}
      .fb-actions button{flex:1;padding:10px;border-radius:10px;font-family:'Noto Sans Thai',sans-serif;
        font-weight:700;font-size:14px;cursor:pointer}
      #fb-pass-cancel{border:1.5px solid #E5E0D4;background:#fff;color:#5A5F6E}
      #fb-pass-save{border:none;background:linear-gradient(90deg,#F5A623,#F08C00);color:#fff}
      #fb-pass-save:disabled{opacity:.6}
    </style>
    <div class="fb-float" id="fb-float">
      <button id="fb-chpass-float">🔑 เปลี่ยนรหัสผ่าน</button>
      <button id="fb-logout-float">🚪 ออกจากระบบ</button>
    </div>
    <div id="fb-pass-modal">
      <div id="fb-pass-card">
        <h3>🔑 เปลี่ยนรหัสผ่าน</h3>
        <p id="fb-pass-note">รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร</p>
        <div class="fb-field"><input id="fb-old" type="password" placeholder="รหัสผ่านปัจจุบัน" autocomplete="current-password">
          <button type="button" class="fb-eye" data-for="fb-old">👁️</button></div>
        <div class="fb-field"><input id="fb-new1" type="password" placeholder="รหัสผ่านใหม่" autocomplete="new-password">
          <button type="button" class="fb-eye" data-for="fb-new1">👁️</button></div>
        <div class="fb-field"><input id="fb-new2" type="password" placeholder="ยืนยันรหัสผ่านใหม่" autocomplete="new-password">
          <button type="button" class="fb-eye" data-for="fb-new2">👁️</button></div>
        <div id="fb-pass-err"></div>
        <div class="fb-actions">
          <button id="fb-pass-cancel">ยกเลิก</button>
          <button id="fb-pass-save">บันทึกรหัสใหม่</button>
        </div>
      </div>
    </div>`;

  function mountUI() {
    document.body.appendChild(ui);

    // ── ปุ่มใน sidebar footer (ล่างซ้าย) ──
    const footer = document.querySelector('.sidebar-footer');
    if (footer) {
      const row = document.createElement('div');
      row.className = 'fb-side-actions';
      row.innerHTML = `
        <button class="sidebar-action-btn" id="fb-chpass-btn" title="เปลี่ยนรหัสผ่านของฉัน">🔑 รหัสผ่าน</button>
        <button class="sidebar-action-btn" id="fb-admin-btn" title="จัดการบัญชีผู้ใช้ (แอดมิน)" style="display:none">👥 บัญชี</button>
        <button class="sidebar-action-btn" id="fb-logout-btn" title="ออกจากระบบ">🚪 ออก</button>`;
      footer.appendChild(row);
      document.getElementById('fb-chpass-btn').onclick = () => openPassModal(false);
      document.getElementById('fb-admin-btn').onclick = () => location.href = 'accounts.html';
      document.getElementById('fb-logout-btn').onclick = () => { if (confirm('ออกจากระบบ?')) auth.signOut(); };
    } else {
      // สำรอง: ปุ่มลอย
      const fl = document.getElementById('fb-float');
      fl.style.display = 'flex';
      document.getElementById('fb-chpass-float').onclick = () => openPassModal(false);
      document.getElementById('fb-logout-float').onclick = () => { if (confirm('ออกจากระบบ?')) auth.signOut(); };
    }

    // ตาดูรหัสในทุกช่อง
    ui.querySelectorAll('.fb-eye').forEach(b => {
      b.onclick = () => {
        const inp = document.getElementById(b.dataset.for);
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        b.textContent = show ? '🙈' : '👁️';
      };
    });

    const modal = document.getElementById('fb-pass-modal');
    document.getElementById('fb-pass-cancel').onclick = () => {
      if (modal.dataset.forced === '1') { alert('กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งาน'); return; }
      modal.classList.remove('open');
    };
    document.getElementById('fb-pass-save').onclick = doChangePassword;
  }
  if (document.body) mountUI(); else document.addEventListener('DOMContentLoaded', mountUI);

  // แสดงชื่อผู้ล็อกอินที่มุมล่างซ้ายของ sidebar
  function updateSidebarUser(accData, user) {
    const nameEl = document.querySelector('.sidebar-user-name');
    const roleEl = document.querySelector('.sidebar-user-role');
    const avaEl  = document.querySelector('.sidebar-user-avatar');
    const display = (accData && accData.name) || user.email || '';
    if (nameEl && display) nameEl.textContent = display;
    if (roleEl) {
      const who = accData && accData.username ? accData.username : (user.email || '');
      roleEl.textContent = (isAdmin ? 'Admin' : 'นักเรียนทุน') + ' · ' + who;
    }
    if (avaEl && display) avaEl.textContent = display.trim().charAt(0);
  }

  function openPassModal(forced) {
    const modal = document.getElementById('fb-pass-modal');
    modal.dataset.forced = forced ? '1' : '0';
    document.getElementById('fb-pass-note').textContent = forced
      ? 'เพื่อความปลอดภัย กรุณาตั้งรหัสผ่านใหม่แทนรหัสเริ่มต้นก่อนใช้งาน (อย่างน้อย 6 ตัวอักษร)'
      : 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร';
    document.getElementById('fb-pass-err').textContent = '';
    ['fb-old','fb-new1','fb-new2'].forEach(id => document.getElementById(id).value = '');
    modal.classList.add('open');
    document.getElementById('fb-old').focus();
  }

  async function doChangePassword() {
    const errEl = document.getElementById('fb-pass-err');
    const oldP = document.getElementById('fb-old').value;
    const n1 = document.getElementById('fb-new1').value;
    const n2 = document.getElementById('fb-new2').value;
    errEl.textContent = '';
    if (!oldP || !n1 || !n2) { errEl.textContent = 'กรอกให้ครบทุกช่อง'; return; }
    if (n1.length < 6) { errEl.textContent = 'รหัสใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร'; return; }
    if (n1 !== n2) { errEl.textContent = 'รหัสผ่านใหม่สองช่องไม่ตรงกัน'; return; }
    if (n1 === oldP) { errEl.textContent = 'รหัสใหม่ต้องต่างจากรหัสเดิม'; return; }
    const btn = document.getElementById('fb-pass-save');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    try {
      const user = auth.currentUser;
      const cred = firebase.auth.EmailAuthProvider.credential(user.email, oldP);
      await user.reauthenticateWithCredential(cred);
      await user.updatePassword(n1);
      await fsdb.collection('accounts').doc(user.uid)
        .set({ mustChangePassword: false, passwordChangedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
        .catch(() => {});
      document.getElementById('fb-pass-modal').classList.remove('open');
      if (typeof showStatus === 'function') showStatus('✅ เปลี่ยนรหัสผ่านเรียบร้อย', 'success');
    } catch (e) {
      errEl.textContent = ({
        'auth/invalid-credential': 'รหัสผ่านปัจจุบันไม่ถูกต้อง',
        'auth/wrong-password': 'รหัสผ่านปัจจุบันไม่ถูกต้อง',
        'auth/weak-password': 'รหัสใหม่ง่ายเกินไป',
        'auth/too-many-requests': 'ลองหลายครั้งเกินไป กรุณารอสักครู่',
      })[e.code] || e.message;
    } finally {
      btn.disabled = false; btn.textContent = 'บันทึกรหัสใหม่';
    }
  }

  /* ---------- 5) สถานะล็อกอิน ---------- */
  auth.onAuthStateChanged(async user => {
    if (!user) {
      fbReady = false;
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      location.replace('login.html');      // → หน้า login ดีไซน์ใหม่
      return;
    }

    // แอดมิน? → โชว์ปุ่มจัดการบัญชีใน sidebar
    try {
      const adm = await fsdb.collection('admins').doc(user.email).get();
      isAdmin = adm.exists;
      const ab = document.getElementById('fb-admin-btn');
      if (ab && isAdmin) ab.style.display = '';
    } catch (e) { /* ไม่มีสิทธิ์อ่าน = ไม่ใช่แอดมิน */ }

    // ดึงระเบียนบัญชี → แสดงชื่อที่ sidebar + บังคับเปลี่ยนรหัสครั้งแรกถ้าจำเป็น
    let accData = null;
    try {
      const acc = await fsdb.collection('accounts').doc(user.uid).get();
      if (acc.exists) accData = acc.data();
      if (accData && accData.mustChangePassword) openPassModal(true);
    } catch (e) { /* ข้าม */ }
    updateSidebarUser(accData, user);

    // บัญชีนักเรียน (สมัครเอง/แอดมินสร้างให้) → โหมดจำกัดสิทธิ์
    // role === 'student' ก็พอ — บัญชีที่ยังผูก studentId ไม่สำเร็จก็ต้องถูกจำกัดสิทธิ์ด้วย
    // (เดิม: ไม่มี studentId → หลุดไปเป็นโหมดครู เห็นเมนูครบ)
    studentMode = !isAdmin && !!(accData && accData.role === 'student');
    window.STUDENT_MODE = studentMode ? accData : null;
    try { localStorage.setItem('fbRoleHint', studentMode ? 'student' : 'staff'); } catch (e) {}
    if (!studentMode) restoreFullNav();   // เผื่อ hint เก่าเคยซ่อนเมนูไว้

    if (studentMode) {
      // ทำทันทีโดยไม่รอคลาวด์: กรองข้อมูลที่ค้างในเครื่อง (cache เก่าอาจมีครบ 72 คน)
      // ให้เหลือเฉพาะของตัวเอง + จำกัดเมนู + เขียนทับ cache ด้วยข้อมูลที่กรองแล้ว
      const myId = String(accData.studentId);
      DB.students = DB.students.filter(s => String(s._docId || s.id) === myId
        && (!accData.name || bNameMatch(s.name, accData.name)
            || (bSurname(s.name) && bSurname(s.name) === bSurname(accData.name))));
      try { renderDashboard(); renderStudents(); populateFilters(); } catch (e) {}
      applyStudentRestrictions();
      try { await _origSaveToStorage(); } catch (e) {}   // ล้างข้อมูลคนอื่นออกจาก localStorage
    }

    /* ---- โหลดข้อมูลครั้งแรก ---- */
    try {
      if (studentMode) {
        /* ═══ โหมดนักเรียน: โหลดเฉพาะระเบียนของตัวเอง ═══ */
        let sid = accData.studentId ? String(accData.studentId) : '';
        let d = sid
          ? await fsdb.collection(COL).doc(sid).get().catch(() => ({ exists: false, data: () => ({}) }))
          : { exists: false, data: () => ({}) };

        /* ── ยืนยันการผูกบัญชีด้วย "ลำดับ + ชื่อ" (แหล่งความจริงจากตอนสมัคร) ──
           หลักการ: ห้ามแสดงข้อมูลของคนอื่นเด็ดขาด และห้ามลบ/ย้ายเอกสารเอง
           1. ถ้าเอกสารที่ผูกไว้เป็น "ชื่อเรา" → ใช้ได้เลย
           2. ถ้าไม่ใช่ → ค้นทุกเอกสารที่ "ลำดับ" ตรงกับบัญชี แล้วเลือกฉบับที่ชื่อตรง → ผูกใหม่
           3. ถ้าเอกสารที่ผูกไว้ยังอยู่แต่ชื่อไม่ตรงและไม่มีตัวเลือกที่ดีกว่า → คงเดิม
              (เผื่อครูแค่แก้สะกดชื่อ) — แต่ถ้าผูกไว้กับ "คนละคน" ชัดเจนและหาไม่เจอ → แสดงหน้าว่าง
           ── */
        const boundNameOk = d.exists && bNameMatch(d.data().name, accData.name);
        let bindingValid = boundNameOk;
        if (!boundNameOk && accData.no != null) {
          try {
            // ค้นทั้งแบบตัวเลขและข้อความ (ข้อมูล "ลำดับ" ในระบบอาจถูกเก็บคนละชนิด)
            const cands = []; const seenIds = {};
            for (const noVal of [Number(accData.no), String(accData.no)]) {
              try {
                const q = await fsdb.collection(COL).where('no', '==', noVal).get();
                q.forEach(c => { if (!seenIds[c.id]) { seenIds[c.id] = 1; cands.push(c); } });
              } catch (qe) { /* ชนิดนี้ถูกปฏิเสธ ลองชนิดถัดไป */ }
            }
            const best = cands.find(c => bNameMatch(c.data().name, accData.name));
            const pick = best || (!d.exists && cands.length === 1 ? cands[0] : null);
            if (pick && pick.id !== sid) {
              await fsdb.collection('accounts').doc(user.uid)
                .set({ studentId: pick.id }, { merge: true });
              accData.studentId = pick.id;
              if (window.STUDENT_MODE) window.STUDENT_MODE.studentId = pick.id;
              sid = pick.id;
              d = pick;
              bindingValid = true;
              console.log('☁️ ผูกบัญชีใหม่ตามลำดับ+ชื่อ → students/' + pick.id);
            } else if (pick && pick.id === sid) {
              bindingValid = true;
            } else if (!pick && d.exists) {
              // ไม่พบตัวจริง: คงเอกสารเดิมได้เฉพาะเมื่อ "นามสกุล" ยังตรงกัน
              // (เผื่อครูแก้สะกดชื่อ) — ถ้าชื่อไม่เกี่ยวข้องกันเลย ห้ามแสดง (อาจเป็นคนอื่น)
              const sn1 = bSurname(d.data().name), sn2 = bSurname(accData.name);
              if (sn1 && sn1 === sn2) {
                bindingValid = true;   // นามสกุลตรง = คนเดียวกัน (ครูแก้สะกดชื่อ)
              } else {
                console.warn('☁️ เอกสารที่ผูกไว้เป็นของ "' + d.data().name + '" ไม่ใช่ '
                  + accData.name + ' → ไม่แสดงเพื่อความปลอดภัย');
                d = { exists: false, data: () => ({}) };
              }
            }
          } catch (e) {
            console.warn('☁️ ตรวจการผูกบัญชีไม่สำเร็จ:', e.code, e.message,
              '(ถ้าเป็น permission-denied แปลว่า Rules ยังไม่ใช่เวอร์ชันล่าสุด)');
          }
        }

        // ❗ เดิมบรรทัดนี้คือ `if (!bindingValid && d.exists) bindingValid = true;`
        // ซึ่งทำให้บัญชีที่ "ไม่มีฟิลด์ no" หรือ "ไม่มีฟิลด์ name" ผ่านเข้าไปดูเอกสารของคนอื่นได้
        // ตอนนี้ต้องผ่านการตรวจชื่อ (boundNameOk) หรือการผูกใหม่ตามลำดับ+ชื่อเท่านั้น
        if (!bindingValid && d.exists && boundNameOk) bindingValid = true;

        const cloud = (bindingValid && d.exists) ? [Object.assign({ _docId: d.id || sid }, d.data())] : [];
        applyCloudStudents(cloud);
        if (!bindingValid) {
          DB.students = [];
          try { renderDashboard(); renderStudents(); populateFilters(); } catch (e) {}
          try {
            if (typeof sfRenderPage === 'function') sfRenderPage();
            if (typeof renderFormTrack === 'function') renderFormTrack();
          } catch (e) {}
          try { await _origSaveToStorage(); } catch (e) {}   // ล้าง cache กันข้อมูลคนอื่นค้างเครื่อง
        }
        fbReady = bindingValid;   // ผูกไม่ได้ = งดบันทึกขึ้นคลาวด์ กันเขียนทับเอกสารคนอื่น
        if (typeof setSyncDot === 'function') setSyncDot('online');
        if (!d.exists || !bindingValid)
          showTopBanner('⚠️ ยังเชื่อมข้อมูลของคุณไม่ได้ (ลำดับ ' + (accData.no ?? '-') + ' · '
            + (accData.name || '') + ') — ระบบไม่แสดงข้อมูลของคนอื่นเพื่อความปลอดภัย '
            + 'แจ้งครูผู้ดูแลให้กด "🩺 ตรวจ+แก้การเชื่อมทั้งระบบ" ในหน้าจัดการบัญชีผู้ใช้');

        // realtime เฉพาะเอกสารของตัวเอง — และเฉพาะเมื่อการผูกผ่านการยืนยันแล้วเท่านั้น
        if (!bindingValid) return;
        unsubscribe = fsdb.collection(COL).doc(sid).onSnapshot(ds => {
          if (ds.metadata.hasPendingWrites) return;
          if (pushPending) return;
          // ยามอีกชั้น: ถ้าเอกสารถูกเปลี่ยนเป็นข้อมูลของคนอื่น (ชื่อไม่ตรงเลย) ไม่รับ
          if (ds.exists && accData.name && !bNameMatch(ds.data().name, accData.name)
              && bSurname(ds.data().name) !== bSurname(accData.name)) {
            console.warn('☁️ realtime: เอกสารกลายเป็นของคนอื่น — ไม่นำมาแสดง');
            return;
          }
          const remote = ds.exists ? [Object.assign({ _docId: ds.id }, ds.data())] : [];
          const prepared = prepareCloudStudents(remote);
          if (canon(prepared) === canon(DB.students)) {
            if (typeof setSyncDot === 'function') setSyncDot('online');
            return;
          }
          applyCloudStudents(prepared);
          if (typeof flashSyncDot === 'function') flashSyncDot();
        }, e => console.warn('☁️ realtime error:', e.message));
        return;
      }

      /* ═══ โหมดครู/แอดมิน: โหลดทั้งหมด ═══ */
      const snap = await fsdb.collection(COL).get();
      const cloud = [];
      snap.forEach(d => cloud.push(Object.assign({ _docId: d.id }, d.data())));

      if (cloud.length > 0) {
        applyCloudStudents(cloud);
        fbReady = true;
      } else {
        fbReady = true;
        if (DB.students.length > 0 && confirm(
          'ยังไม่มีข้อมูลบน Firestore\nอัปโหลดข้อมูลในเครื่อง (' + DB.students.length + ' คน) ขึ้นคลาวด์เลยหรือไม่?')) {
          await pushAllToCloud(true);
          if (typeof showStatus === 'function') showStatus('☁️ อัปโหลดข้อมูลขึ้นคลาวด์ครบแล้ว', 'success');
        }
      }
      if (typeof setSyncDot === 'function') setSyncDot('online');

      /* ---- realtime (เงียบ: ไม่มี popup รัวอีก) ---- */
      unsubscribe = fsdb.collection(COL).onSnapshot(s => {
        if (s.metadata.hasPendingWrites) return;         // echo ระหว่างเขียนของเราเอง
        if (pushPending) return;                         // เรามีของใหม่กว่ารอส่งอยู่
        const remote = [];
        s.forEach(d => remote.push(Object.assign({ _docId: d.id }, d.data())));
        const prepared = prepareCloudStudents(remote);   // normalize ให้รูปเดียวกับ DB ก่อนเทียบ
        if (canon(prepared) === canon(DB.students)) {    // ข้อมูลเหมือนเดิมทุกประการ
          if (typeof setSyncDot === 'function') setSyncDot('online');
          return;                                        // → เงียบ ไม่วาดใหม่ ไม่เด้งอะไร
        }
        applyCloudStudents(prepared);                    // มีของใหม่จากเครื่องอื่นจริงๆ
        if (typeof flashSyncDot === 'function') flashSyncDot();  // กะพริบจุดเล็กๆ พอ
      }, e => console.warn('☁️ realtime listener error:', e.message));

    } catch (e) {
      console.error('☁️ โหลดจากคลาวด์ไม่สำเร็จ:', e);
      showTopBanner('⚠️ โหลดข้อมูลจากคลาวด์ไม่สำเร็จ: ' + e.message
        + (e.code === 'permission-denied' ? ' — ตรวจ Security Rules หรือเปิดหน้า check.html' : ''));
    }
  });

  console.log('☁️ Firebase bridge v2 เปิดใช้งาน (โปรเจกต์: ' + cfg.projectId + ')');
})();
