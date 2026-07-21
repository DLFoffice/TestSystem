/* ============================================================
   19-term-system.js — ระบบ "ภาคเรียน" (Term / Semester)
   ------------------------------------------------------------
   สิ่งที่ไฟล์นี้เพิ่มเข้ามา
   1. โครงสร้างข้อมูลใหม่  student.forms['1/2568'] = { form1:{}, form2:{}, m1:{}, m2:{} }
      แบบฟอร์ม 1/2 จึงถูกเก็บ "แยกตามภาคเรียน" (เดิมมีชุดเดียว ภาคเรียนใหม่ทับของเก่า)
   2. ย้ายข้อมูลเก่า (student.form1/form2) เข้าภาคเรียนแรกให้อัตโนมัติ ครั้งเดียว
   3. student.form1 / student.form2 ยังใช้ได้เหมือนเดิม — เป็น "นามแฝง" (alias)
      ที่ชี้ไปยังภาคเรียนที่กำลังเปิดใช้งาน → โค้ดเดิม (พิมพ์/ส่ง Sheet/preview) ไม่ต้องแก้
   4. แถบเลือกภาคเรียนบนหน้าแบบฟอร์ม + ปุ่ม "ส่งแบบฟอร์ม" (ล็อกสถานะ + ประทับเวลา)
   5. หน้าใหม่ "รายงานรายภาคเรียน" (page-termreport) + ส่งออก CSV
   6. ภาคเรียนที่เปิดใช้งานถูกซิงก์ผ่าน Firestore settings/activeTerm (ครูตั้ง นักเรียนอ่าน)

   ต้องโหลด "หลัง" 18-firebase-bridge.js
   ============================================================ */
(function () {
  'use strict';

  const LS_KEY = 'dltv_active_term';
  const DEFAULT_TERM = '1/2568';

  /* ══════════ 1) ยูทิลิตี้ภาคเรียน ══════════ */
  function parseTerm(t) {
    const m = String(t || '').match(/^\s*(\d)\s*\/\s*(\d{4})\s*$/);
    return m ? { sem: +m[1], year: +m[2] } : null;
  }
  function termKey(t) { const p = parseTerm(t); return p ? p.year * 10 + p.sem : -1; }
  function isValidTerm(t) { const p = parseTerm(t); return !!p && (p.sem === 1 || p.sem === 2); }
  function cmpTerm(a, b) { return termKey(a) - termKey(b); }
  function nextTerm(t) {
    const p = parseTerm(t); if (!p) return DEFAULT_TERM;
    return p.sem === 1 ? `2/${p.year}` : `1/${p.year + 1}`;
  }
  function termLabel(t) {
    const p = parseTerm(t); if (!p) return t || '-';
    return `ภาคเรียนที่ ${p.sem} ปีการศึกษา ${p.year}`;
  }

  /** ภาคเรียนทั้งหมดที่ "ปรากฏในข้อมูลจริง" (GPA + การเบิกจ่าย + แบบฟอร์ม) */
  function allTerms() {
    const set = new Set();
    (DB.students || []).forEach(s => {
      (s.semGpa || []).forEach(g => g.term && set.add(g.term));
      (s.semPayments || []).forEach(p => p.term && set.add(p.term));
      if (s.forms) Object.keys(s.forms).forEach(t => set.add(t));
    });
    const active = getActiveTerm();
    if (active) set.add(active);
    const out = [...set].filter(isValidTerm).sort(cmpTerm);
    return out.length ? out : [DEFAULT_TERM];
  }

  /* ══════════ 2) ภาคเรียนที่เปิดใช้งาน ══════════ */
  let _activeTerm = null;
  function getActiveTerm() {
    if (_activeTerm) return _activeTerm;
    try { _activeTerm = localStorage.getItem(LS_KEY) || null; } catch (e) {}
    if (!isValidTerm(_activeTerm)) _activeTerm = null;
    return _activeTerm || DEFAULT_TERM;
  }
  function setActiveTerm(t, opts) {
    if (!isValidTerm(t)) return false;
    _activeTerm = t;
    try { localStorage.setItem(LS_KEY, t); } catch (e) {}
    const cur = (typeof sfState === 'object' && sfState.studentIdx !== null) ? DB.students[sfState.studentIdx] : null;
    if (cur) bindTerm(cur, t);
    if (!(opts && opts.silent)) pushActiveTermToCloud(t);
    return true;
  }

  function fsdb() {
    try {
      if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) return firebase.firestore();
    } catch (e) {}
    return null;
  }
  function isStaffUser() {
    // โหมดนักเรียนถูกตั้งโดย 18-firebase-bridge.js
    return !window.STUDENT_MODE;
  }
  async function pushActiveTermToCloud(t) {
    if (!isStaffUser()) return;              // นักเรียนเปลี่ยนภาคเรียนของทั้งระบบไม่ได้
    const db = fsdb(); if (!db) return;
    try { await db.collection('settings').doc('activeTerm').set({ term: t, at: new Date().toISOString() }, { merge: true }); }
    catch (e) { console.warn('ตั้งภาคเรียนบนคลาวด์ไม่สำเร็จ:', e.message); }
  }
  async function pullActiveTermFromCloud() {
    const db = fsdb(); if (!db) return;
    try {
      const d = await db.collection('settings').doc('activeTerm').get();
      if (d.exists && isValidTerm(d.data().term) && d.data().term !== getActiveTerm()) {
        setActiveTerm(d.data().term, { silent: true });
        rerenderTermViews();
      }
    } catch (e) { /* ยังไม่มี settings หรือไม่มีสิทธิ์ — ใช้ค่าในเครื่อง */ }
  }

  /* ══════════ 2b) สิทธิ์เปิด/ปิดการกรอกแบบฟอร์ม (ครูตั้ง · นักเรียนกรอกได้เฉพาะที่เปิด) ══════════ */
  const LS_ACCESS = 'dltv_form_access';
  let _formAccess = null;
  function getFormAccess() {
    if (_formAccess) return _formAccess;
    let v = null;
    try { v = JSON.parse(localStorage.getItem(LS_ACCESS) || 'null'); } catch (e) {}
    _formAccess = (v && typeof v === 'object')
      ? { form1: v.form1 !== false, form2: v.form2 !== false }
      : { form1: true, form2: true };   // ค่าเริ่มต้น = เปิดทั้งคู่
    return _formAccess;
  }
  function isFormOpen(key) { return getFormAccess()[key] !== false; }
  function setFormAccess(key, open) {
    if (!isStaffUser()) return;               // นักเรียนเปลี่ยนสิทธิ์ไม่ได้
    const a = getFormAccess();
    a[key] = !!open; _formAccess = a;
    try { localStorage.setItem(LS_ACCESS, JSON.stringify(a)); } catch (e) {}
    pushFormAccessToCloud(a);
    rerenderTermViews();
  }
  async function pushFormAccessToCloud(a) {
    if (!isStaffUser()) return;
    const db = fsdb(); if (!db) return;
    try {
      await db.collection('settings').doc('formAccess').set(
        { form1: a.form1 !== false, form2: a.form2 !== false, at: new Date().toISOString() },
        { merge: true });
    } catch (e) { console.warn('ตั้งสิทธิ์แบบฟอร์มบนคลาวด์ไม่สำเร็จ:', e.message); }
  }
  async function pullFormAccessFromCloud() {
    const db = fsdb(); if (!db) return;
    try {
      const d = await db.collection('settings').doc('formAccess').get();
      if (d.exists) {
        const v = d.data();
        _formAccess = { form1: v.form1 !== false, form2: v.form2 !== false };
        try { localStorage.setItem(LS_ACCESS, JSON.stringify(_formAccess)); } catch (e) {}
        rerenderTermViews();
      }
    } catch (e) { /* ยังไม่มี settings หรือไม่มีสิทธิ์ */ }
  }

  /* ══════════ 3) โครงสร้าง forms[term] + การย้ายข้อมูลเก่า ══════════ */
  function emptyBucket() { return { form1: {}, form2: {}, m1: {}, m2: {} }; }

  /** ย้าย student.form1/form2 แบบเก่า → forms[<ภาคเรียนแรกสุดที่รู้จัก>] (ทำครั้งเดียว) */
  function migrateLegacy(s) {
    if (s.forms && typeof s.forms === 'object') return;
    const touched = (s.form1 && s.form1.__touched) || (s.form2 && s.form2.__touched);
    if (!touched) return;                     // ไม่มีของเก่า → ไม่ต้องสร้าง forms (กันเขียนคลาวด์เปล่าๆ)
    const gpaTerms = (s.semGpa || []).map(g => g.term).filter(isValidTerm).sort(cmpTerm);
    const legacyTerm = gpaTerms[0] || DEFAULT_TERM;
    s.forms = {};
    s.forms[legacyTerm] = {
      form1: s.form1 || {}, form2: s.form2 || {},
      m1: (s.form1 && s.form1.__touched) ? { startedAt: '' } : {},
      m2: (s.form2 && s.form2.__touched) ? { startedAt: '' } : {}
    };
  }

  /** ทำให้ student.form1/form2 ชี้ไปที่ภาคเรียน t (สร้างถังใหม่ถ้ายังไม่มี) */
  function bindTerm(s, t) {
    if (!s) return null;
    t = t || getActiveTerm();
    migrateLegacy(s);
    if (!s.forms || typeof s.forms !== 'object') s.forms = {};
    if (!s.forms[t]) s.forms[t] = emptyBucket();
    const b = s.forms[t];
    if (!b.form1) b.form1 = {};
    if (!b.form2) b.form2 = {};
    if (!b.m1) b.m1 = {};
    if (!b.m2) b.m2 = {};
    s.form1 = b.form1;      // alias — โค้ดเดิมทั้งหมดเขียน/อ่านผ่านตรงนี้ได้เหมือนเดิม
    s.form2 = b.form2;
    return b;
  }
  function bucketOf(s, t) {
    migrateLegacy(s);
    return (s.forms && s.forms[t]) || null;
  }

  /* ══════════ 4) แทนที่ตัวเข้าถึงข้อมูลของ 14/15 ══════════ */
  // sfEnsureFormStore ถูกเรียกทุกครั้งที่อ่าน/เขียนค่าในฟอร์ม → ใช้เป็นจุดผูกภาคเรียน
  const _origEnsure = window.sfEnsureFormStore;
  window.sfEnsureFormStore = function (student) {
    bindTerm(student, getActiveTerm());
    if (_origEnsure) _origEnsure(student);
  };

  /** ความคืบหน้าการกรอก 0..1 ของฟอร์มหนึ่ง ในภาคเรียนหนึ่ง (ไม่แตะ/ไม่ prefill ข้อมูล) */
  function formProgress(student, formKey, term) {
    const b = bucketOf(student, term);
    const store = b && b[formKey];
    if (!store) return 0;
    let total = 0, filled = 0;
    sfGetSections(formKey).forEach(sec => sec.fields.forEach(f => {
      if (f.type === 'heading' || f.type === 'note' || f.type === 'table' || f.type === 'matrix') return;
      if (f.optional) return;                    // ช่องไม่บังคับ ไม่นับรวม
      total++;
      const v = store[f.id];
      if (v === undefined || v === null) return;
      if (f.type === 'radio') { if (v.choice) filled++; }
      else if (f.type === 'checkboxgroup') { if ((v.selected && v.selected.length) || v.other) filled++; }
      else if (v !== '') filled++;
    }));
    return total ? filled / total : 0;
  }
  function formMeta(student, formKey, term) {
    const b = bucketOf(student, term);
    return (b && b[formKey === 'form1' ? 'm1' : 'm2']) || {};
  }

  /* ช่องนี้ "ผู้ใช้กรอกเอง" จริงหรือไม่ — ไม่นับค่าที่ระบบเติมให้อัตโนมัติ (from:)
     เพื่อไม่ให้แค่ "เปิดฟอร์ม" (ซึ่งเติมชื่อ/โรงเรียน/เบอร์จากระเบียนนักเรียน) ถูกนับว่าเริ่มกรอก */
  function _isUserEntered(student, store, f) {
    const v = store ? store[f.id] : undefined;
    if (v === undefined || v === null) return false;
    if (f.type === 'table') {
      if (!Array.isArray(v)) return false;
      // ค่าที่ระบบ seed ไว้ล่วงหน้า (เช่น education_history: ประถม/มัธยมต้น/มัธยมปลาย)
      // ไม่ถือเป็น "ผู้ใช้กรอกเอง" — แค่เปิดฟอร์มจึงไม่ถูกนับว่าเริ่มกรอก
      const seeded = new Set();
      if (Array.isArray(f.seedRowsData)) {
        f.seedRowsData.forEach(r => Object.values(r || {}).forEach(x => {
          if (x != null && x !== '') seeded.add(String(x));
        }));
      }
      return v.some(r => r && r.cells && Object.values(r.cells).some(x =>
        x !== '' && x != null && !seeded.has(String(x))));
    }
    if (f.type === 'matrix') {
      return v.values && Object.keys(v.values).some(rk => Object.values(v.values[rk] || {}).some(x => x !== '' && x != null));
    }
    if (f.type === 'radio') return !!v.choice;
    if (f.type === 'checkboxgroup') return !!((v.selected && v.selected.length) || v.other);
    if (v === '') return false;
    if (f.from) {                                   // ค่าที่เท่ากับ prefill = ระบบเติมให้ ไม่ใช่ผู้ใช้กรอก
      try { const fv = f.from(student); if (fv != null && String(fv) === String(v)) return false; } catch (e) {}
    }
    return true;
  }
  function userHasInput(student, formKey, term) {
    const b = bucketOf(student, term); const store = b && b[formKey];
    if (!store) return false;
    return sfGetSections(formKey).some(sec => sec.fields.some(f => {
      if (f.type === 'heading' || f.type === 'note') return false;
      return _isUserEntered(student, store, f);
    }));
  }

  /** none | partial | filled | submitted */
  function formState(student, formKey, term) {
    if (formMeta(student, formKey, term).submittedAt) return 'submitted';
    if (!userHasInput(student, formKey, term)) return 'none';   // เปิดฟอร์มเฉย ๆ = ยังไม่กรอก
    return formProgress(student, formKey, term) >= 0.999 ? 'filled' : 'partial';
  }

  // สถานะที่ 15-form-tracking.js / picker ใช้ — ตอนนี้อิงภาคเรียนที่เปิดอยู่
  window.sfFormStatus = function (student) {
    const t = getActiveTerm();
    const s1 = formState(student, 'form1', t);
    const s2 = formState(student, 'form2', t);
    return {
      has1: s1 !== 'none',
      has2: s2 !== 'none',
      done1: ['filled', 'submitted'].includes(s1),
      done2: ['filled', 'submitted'].includes(s2),
      started1: s1 !== 'none',
      started2: s2 !== 'none',
      term: t
    };
  };

  /* ══════════ 5) แถบเลือกภาคเรียนบนหน้าแบบฟอร์ม ══════════ */
  function termBarHtml() {
    const t = getActiveTerm();
    const opts = allTerms().map(x => `<option value="${x}" ${x === t ? 'selected' : ''}>${termLabel(x)}</option>`).join('');
    const staff = isStaffUser();
    const s = (typeof sfGetStudent === 'function' && sfState.studentIdx !== null) ? sfGetStudent() : null;
    let submitBtn = '';
    if (s) {
      const st = formState(s, sfState.formKey, t);
      const meta = formMeta(s, sfState.formKey, t);
      submitBtn = st === 'submitted'
        ? `<span class="tm-submitted">✅ ส่งแล้ว ${meta.submittedAt ? '· ' + new Date(meta.submittedAt).toLocaleDateString('th-TH') : ''}</span>
           <button type="button" class="tm-btn" id="tm-unsubmit">↩︎ แก้ไขอีกครั้ง</button>`
        : `<button type="button" class="tm-btn tm-btn-primary" id="tm-submit">📤 ส่งแบบฟอร์มภาคเรียนนี้</button>`;
    }
    const acc = getFormAccess();
    const accCtrls = staff
      ? `<span class="tm-acc-group">
           <button type="button" class="tm-btn ${acc.form1 ? 'tm-on' : 'tm-off'}" id="tm-acc1">${acc.form1 ? '🔓' : '🔒'} ฟอร์ม 1: ${acc.form1 ? 'เปิด' : 'ปิด'}</button>
           <button type="button" class="tm-btn ${acc.form2 ? 'tm-on' : 'tm-off'}" id="tm-acc2">${acc.form2 ? '🔓' : '🔒'} ฟอร์ม 2: ${acc.form2 ? 'เปิด' : 'ปิด'}</button>
         </span>`
      : ((!acc.form1 || !acc.form2)
          ? `<span class="tm-closed-flag">🔒 ${!acc.form1 ? 'ฟอร์ม 1 ' : ''}${!acc.form2 ? 'ฟอร์ม 2 ' : ''}ปิดรับการกรอก</span>`
          : '');
    return `<div class="tm-bar">
      <span class="tm-label">📅 ภาคเรียน</span>
      <select id="tm-select" class="tm-select">${opts}</select>
      ${staff ? `<button type="button" class="tm-btn" id="tm-new">➕ เปิดภาคเรียนใหม่</button>` : ''}
      ${accCtrls}
      <span class="tm-spacer"></span>
      ${submitBtn}
    </div>`;
  }

  function injectTermBar() {
    const root = document.getElementById('sf-root');
    if (!root) return;
    const old = root.querySelector('.tm-bar');
    if (old) old.remove();
    root.insertAdjacentHTML('afterbegin', termBarHtml());

    const sel = document.getElementById('tm-select');
    if (sel) sel.onchange = () => {
      if (!isStaffUser() && sel.value !== getActiveTerm()) {
        // นักเรียนดูย้อนหลังได้ แต่ไม่เปลี่ยนภาคเรียนของทั้งระบบ
        setActiveTerm(sel.value, { silent: true });
      } else {
        setActiveTerm(sel.value);
      }
      rerenderTermViews();
    };

    const nb = document.getElementById('tm-new');
    if (nb) nb.onclick = () => {
      const suggested = nextTerm(allTerms().slice(-1)[0]);
      const t = (prompt('เปิดภาคเรียนใหม่ (รูปแบบ 1/2569 หรือ 2/2569)', suggested) || '').trim();
      if (!t) return;
      if (!isValidTerm(t)) { alert('รูปแบบไม่ถูกต้อง — ต้องเป็น 1/2568 หรือ 2/2568'); return; }
      setActiveTerm(t);
      saveToStorage();
      rerenderTermViews();
      if (typeof showStatus === 'function') showStatus('✅ เปิด ' + termLabel(t) + ' แล้ว — แบบฟอร์มเริ่มต้นใหม่ทุกคน', 'success');
    };

    const sb = document.getElementById('tm-submit');
    if (sb) sb.onclick = () => {
      const s = sfGetStudent(); if (!s) return;
      const t = getActiveTerm();
      const pct = Math.round(formProgress(s, sfState.formKey, t) * 100);
      if (pct < 100 && !confirm(`กรอกไปแล้ว ${pct}% — ยืนยันส่งแบบฟอร์มภาคเรียนนี้หรือไม่?`)) return;
      const b = bindTerm(s, t);
      b[sfState.formKey === 'form1' ? 'm1' : 'm2'] = {
        submittedAt: new Date().toISOString(),
        submittedBy: (window.STUDENT_MODE && window.STUDENT_MODE.username) || 'staff',
        progress: pct
      };
      saveToStorage();
      rerenderTermViews();
      if (typeof showStatus === 'function') showStatus('📤 ส่งแบบฟอร์ม ' + termLabel(t) + ' เรียบร้อย', 'success');
    };

    const ub = document.getElementById('tm-unsubmit');
    if (ub) ub.onclick = () => {
      const s = sfGetStudent(); if (!s) return;
      const b = bindTerm(s, getActiveTerm());
      b[sfState.formKey === 'form1' ? 'm1' : 'm2'] = {};
      saveToStorage();
      rerenderTermViews();
    };

    const a1 = document.getElementById('tm-acc1');
    if (a1) a1.onclick = () => {
      const open = !isFormOpen('form1'); setFormAccess('form1', open);
      if (typeof showStatus === 'function') showStatus((open ? '🔓 เปิด' : '🔒 ปิด') + 'การกรอกแบบฟอร์มที่ 1 แล้ว', open ? 'success' : 'error');
    };
    const a2 = document.getElementById('tm-acc2');
    if (a2) a2.onclick = () => {
      const open = !isFormOpen('form2'); setFormAccess('form2', open);
      if (typeof showStatus === 'function') showStatus((open ? '🔓 เปิด' : '🔒 ปิด') + 'การกรอกแบบฟอร์มที่ 2 แล้ว', open ? 'success' : 'error');
    };
  }

  /* ══════════ กันนักเรียนกรอกแบบฟอร์มที่ถูกปิด + ซ่อนฟอร์มที่ปิดไม่ให้ขึ้น ══════════ */
  function applyFormAccessGate() {
    const root = document.getElementById('sf-root'); if (!root) return;
    if (isStaffUser()) return;                        // ครู/แอดมินเห็นครบทุกฟอร์ม
    const o1 = isFormOpen('form1'), o2 = isFormOpen('form2');

    // 1) ปิดทั้งสองฟอร์ม → ไม่แสดงตัวฟอร์มเลย แสดงข้อความแทน
    if (!o1 && !o2) {
      const editor = root.querySelector('.sf-editor');
      if (editor) {
        editor.innerHTML =
          '<div style="text-align:center;padding:56px 20px;color:#8A6D1B">'
          + '<div style="font-size:40px;margin-bottom:10px">🔒</div>'
          + '<div style="font-family:\'Noto Sans Thai\',sans-serif;font-size:18px;font-weight:700;color:#5A4A18">ขณะนี้ยังไม่เปิดรับการกรอกแบบฟอร์ม</div>'
          + '<div style="font-size:14px;color:#96876A;margin-top:6px">กรุณารอผู้ดูแลระบบเปิดสิทธิ์การกรอก</div>'
          + '<div style="margin-top:18px"><button type="button" class="sf-btn sf-btn-ghost" data-sf-action="go-picker">← กลับรายชื่อนักเรียน</button></div>'
          + '</div>';
      }
      return;
    }

    // 2) ซ่อน "แท็บ" ของฟอร์มที่ถูกปิด — นักเรียนจะไม่เห็นฟอร์มที่ปิดเลย
    const tabs = root.querySelector('.sf-tabs');
    if (tabs) {
      const t1 = tabs.querySelector('[data-sf-form="form1"]');
      const t2 = tabs.querySelector('[data-sf-form="form2"]');
      if (t1) t1.style.display = o1 ? '' : 'none';
      if (t2) t2.style.display = o2 ? '' : 'none';
      // เหลือเปิดฟอร์มเดียว → ซ่อนแถบแท็บทั้งแถบ กันสับสน
      if ((o1 && !o2) || (!o1 && o2)) tabs.style.display = 'none';
    }

    // 3) เผื่อกรณี formKey ยังชี้ฟอร์มที่ปิดอยู่ (ปกติถูกสลับไปแล้วใน sfRenderPage) — ล็อกไม่ให้แก้ไข
    if (!isFormOpen(sfState.formKey)) {
      const main = root.querySelector('.sf-editor main');
      if (main) {
        main.querySelectorAll('input,select,textarea').forEach(el => { el.disabled = true; });
        main.querySelectorAll('[data-sf-action="add-row"],[data-sf-action="del-row"],[data-sf-action="add-col"]')
          .forEach(b => { b.disabled = true; });
      }
      root.querySelectorAll('[data-sf-action="send-sheet"]').forEach(b => { b.disabled = true; });
    }
  }

  const _origSfRenderPage = window.sfRenderPage;
  window.sfRenderPage = function () {
    // ผูกเฉพาะนักเรียนที่กำลังเปิดฟอร์ม — ไม่สร้างถังเปล่าให้ครบ 72 คน (กันเขียนคลาวด์เกินจำเป็น)
    const cur = (sfState.studentIdx !== null) ? DB.students[sfState.studentIdx] : null;
    if (cur) bindTerm(cur, getActiveTerm());
    // นักเรียน: ถ้ากำลังอยู่บนฟอร์มที่ถูกปิด แต่มีอีกฟอร์มเปิดอยู่ → สลับไปฟอร์มที่เปิดก่อน render
    if (!isStaffUser() && sfState.studentIdx !== null) {
      const o1 = isFormOpen('form1'), o2 = isFormOpen('form2');
      if (sfState.formKey === 'form1' && !o1 && o2) { sfState.formKey = 'form2'; sfState.sectionIndex = 0; }
      else if (sfState.formKey === 'form2' && !o2 && o1) { sfState.formKey = 'form1'; sfState.sectionIndex = 0; }
    }
    _origSfRenderPage();
    injectTermBar();
    applyFormAccessGate();
  };

  // กันบันทึก/แก้ไขจากฝั่งนักเรียนเมื่อแบบฟอร์มถูกปิด (แม้จะพยายามข้าม input ที่ disable)
  const _origPersist2 = window.sfPersist;
  if (typeof _origPersist2 === 'function') {
    window.sfPersist = function () {
      if (!isStaffUser() && !isFormOpen(sfState.formKey)) return;
      return _origPersist2.apply(this, arguments);
    };
  }
  const _origSend2 = window.sfSendToSheet;
  if (typeof _origSend2 === 'function') {
    window.sfSendToSheet = function (btn) {
      if (!isStaffUser() && !isFormOpen(sfState.formKey)) {
        if (typeof showStatus === 'function') showStatus('🔒 แบบฟอร์มนี้ถูกปิดรับการกรอก', 'error');
        return;
      }
      return _origSend2.apply(this, arguments);
    };
  }

  function rerenderTermViews() {
    try { if (typeof sfRenderPage === 'function' && document.getElementById('page-scholarform')?.classList.contains('active')) sfRenderPage(); } catch (e) {}
    try { if (typeof renderFormTrack === 'function' && document.getElementById('page-formtrack')?.classList.contains('active')) renderFormTrack(); } catch (e) {}
    try { if (document.getElementById('page-termreport')?.classList.contains('active')) renderTermReport(); } catch (e) {}
  }

  /* ══════════ 6) หน้ารายงานรายภาคเรียน ══════════ */
  function gpaOfTerm(s, t) { return (s.semGpa || []).find(g => g.term === t) || null; }
  function payOfTerm(s, t) {
    const p = (s.semPayments || []).find(x => x.term === t);
    if (!p) return 0;
    let sum = 0; for (const k in p) if (/^p\d+$/.test(k)) sum += parseFloat(p[k]) || 0;
    return sum;
  }

  function termReportRows(t) {
    return (DB.students || []).map(s => {
      const g = gpaOfTerm(s, t);
      return {
        s, no: s.no, name: s.name || '', school: s.school_m1 || '',
        province: s.province || '',
        gpa: g && g.gpa ? g.gpa : null,
        risk: g ? (g.riskLevel || '') : '',
        obstacle: g ? (g.hasObstacle ? (g.obstacleType || 'มี') : '') : '',
        pay: payOfTerm(s, t),
        p1: Math.round(formProgress(s, 'form1', t) * 100),
        p2: Math.round(formProgress(s, 'form2', t) * 100),
        st1: formState(s, 'form1', t),
        st2: formState(s, 'form2', t),
        sub: formMeta(s, 'form1', t).submittedAt || formMeta(s, 'form2', t).submittedAt || ''
      };
    }).sort((a, b) => (a.no || 0) - (b.no || 0));
  }

  const ST_META = {
    none: { label: 'ยังไม่กรอก', cls: 'b-red' },
    partial: { label: 'กรอกบางส่วน', cls: 'b-amber' },
    filled: { label: 'กรอกครบ', cls: 'b-blue' },
    submitted: { label: 'ส่งแล้ว', cls: 'b-green' }
  };
  function stBadge(st, pct) {
    const m = ST_META[st] || ST_META.none;
    return `<span class="badge ${m.cls}" title="${pct}%">${m.label}${st === 'partial' ? ' ' + pct + '%' : ''}</span>`;
  }

  window.renderTermReport = function () {
    const host = document.getElementById('page-termreport');
    if (!host) return;
    const sel = document.getElementById('tr-term');
    if (sel) {
      const cur = sel.value && isValidTerm(sel.value) ? sel.value : getActiveTerm();
      sel.innerHTML = allTerms().map(x => `<option value="${x}" ${x === cur ? 'selected' : ''}>${termLabel(x)}</option>`).join('');
    }
    const t = (sel && sel.value) || getActiveTerm();
    const q = (document.getElementById('tr-search')?.value || '').trim().toLowerCase();
    let rows = termReportRows(t);
    if (q) rows = rows.filter(r => (r.name + r.school + r.province).toLowerCase().includes(q));

    const n = rows.length;
    const withGpa = rows.filter(r => r.gpa != null);
    const avg = withGpa.length ? (withGpa.reduce((a, r) => a + r.gpa, 0) / withGpa.length) : 0;
    const highRisk = rows.filter(r => r.risk === 'สูง' || r.risk === 'สูงมาก').length;
    const totalPay = rows.reduce((a, r) => a + r.pay, 0);
    const sub1 = rows.filter(r => r.st1 === 'submitted').length;
    const sub2 = rows.filter(r => r.st2 === 'submitted').length;
    const none = rows.filter(r => r.st1 === 'none' && r.st2 === 'none').length;

    const metric = (v, l, c) => `<div class="metric"><div class="metric-val" style="color:${c || 'var(--text)'}">${v}</div><div class="metric-lbl">${l}</div></div>`;
    document.getElementById('tr-metrics').innerHTML =
      metric(n, 'นักเรียนทั้งหมด') +
      metric(withGpa.length ? avg.toFixed(2) : '—', 'GPA เฉลี่ยภาคเรียนนี้', 'var(--blue)') +
      metric(highRisk, 'ความเสี่ยงสูง/สูงมาก', highRisk ? 'var(--red)' : 'var(--text)') +
      metric((typeof fmt === 'function' ? fmt(totalPay) : totalPay), 'เงินทุนที่เบิกจ่าย (บาท)', 'var(--teal)') +
      metric(`${sub1}/${n}`, 'ส่งแบบฟอร์ม 1', 'var(--green)') +
      metric(`${sub2}/${n}`, 'ส่งแบบฟอร์ม 2', 'var(--green)') +
      metric(none, 'ยังไม่เริ่มกรอกเลย', none ? 'var(--amber)' : 'var(--text)');

    document.getElementById('tr-tbody').innerHTML = rows.map(r => {
      const idx = DB.students.indexOf(r.s);
      const delta = (r.s.gpa_p6 && r.gpa) ? (r.gpa - r.s.gpa_p6).toFixed(2) : '';
      return `<tr>
        <td>${r.no ?? ''}</td>
        <td style="font-weight:600">${r.name}<div style="font-size:11px;color:var(--text3)">${r.s.nickname || ''}</div></td>
        <td style="font-size:12px">${r.school || '-'}</td>
        <td><span class="badge b-blue">${r.province || '-'}</span></td>
        <td style="font-weight:700;color:${typeof gpaColor === 'function' && r.gpa ? gpaColor(r.gpa) : 'var(--text3)'}">${r.gpa != null ? r.gpa.toFixed(2) : '—'}</td>
        <td style="font-size:12px">${delta ? (delta > 0 ? '▲ ' : '▼ ') + delta : '—'}</td>
        <td>${r.risk ? (typeof riskBadge === 'function' ? riskBadge(r.risk) : r.risk) : '—'}</td>
        <td style="font-size:12px;color:var(--text3)">${r.obstacle || '—'}</td>
        <td style="font-weight:600;color:var(--teal)">${typeof fmt === 'function' ? fmt(r.pay) : r.pay}</td>
        <td>${stBadge(r.st1, r.p1)}</td>
        <td>${stBadge(r.st2, r.p2)}</td>
        <td><button class="btn btn-sm" onclick="trOpenForm(${idx})">เปิดฟอร์ม</button></td>
      </tr>`;
    }).join('') || `<tr><td colspan="12" style="text-align:center;padding:24px;color:var(--text3)">ไม่มีข้อมูลในภาคเรียนนี้</td></tr>`;

    document.getElementById('tr-footer').textContent =
      `${termLabel(t)} • ${n} คน • เบิกจ่ายรวม ${typeof fmt === 'function' ? fmt(totalPay) : totalPay} บาท`;
  };

  window.trOpenForm = function (idx) {
    sfState.studentIdx = idx;
    sfState.sectionIndex = 0;
    const btn = [...document.querySelectorAll('#sidebar-nav .nav-btn')]
      .find(b => (b.getAttribute('onclick') || '').includes("'scholarform'"));
    showPage('scholarform', btn);
  };

  window.exportTermReport = function () {
    const t = document.getElementById('tr-term')?.value || getActiveTerm();
    const rows = termReportRows(t);
    const head = ['ภาคเรียน', 'ลำดับ', 'ชื่อ-สกุล', 'ชั้น', 'โรงเรียน', 'จังหวัด', 'GPA', 'GPA ป.6',
      'Δ vs ป.6', 'ความเสี่ยง', 'อุปสรรค', 'เงินทุนภาคเรียนนี้', 'ฟอร์ม1 (%)', 'สถานะฟอร์ม1',
      'ฟอร์ม2 (%)', 'สถานะฟอร์ม2', 'ส่งเมื่อ'];
    const esc = v => '"' + String(v ?? '').replace(/"/g, '""').replace(/^[=+\-@]/, "'$&") + '"';
    const body = rows.map(r => [
      t, r.no, r.name, (typeof gradeFromTerm === 'function' ? gradeFromTerm(t) : ''),
      r.school, r.province, r.gpa ?? '', r.s.gpa_p6 ?? '',
      (r.s.gpa_p6 && r.gpa) ? (r.gpa - r.s.gpa_p6).toFixed(2) : '',
      r.risk, r.obstacle, r.pay, r.p1, (ST_META[r.st1] || {}).label, r.p2, (ST_META[r.st2] || {}).label,
      r.sub ? new Date(r.sub).toLocaleString('th-TH') : ''
    ].map(esc).join(','));
    const csv = '\uFEFF' + [head.map(esc).join(','), ...body].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `รายงานภาคเรียน_${t.replace('/', '-')}.csv`;
    a.click();
  };

  /* ══════════ 7) เชื่อมเข้ากับระบบนำทางเดิม ══════════ */
  if (typeof PAGE_META === 'object') {
    PAGE_META.termreport = { title: 'รายงานรายภาคเรียน', sub: 'สรุปผลการเรียน การเบิกจ่าย และสถานะการกรอกแบบฟอร์ม แยกตามภาคเรียน' };
  }
  const _origShowPage = window.showPage;
  window.showPage = function (p, btn) {
    _origShowPage(p, btn);
    if (p === 'termreport') renderTermReport();
  };

  /* ══════════ 8) เปิดใช้งาน ══════════ */
  function boot() {
    pullActiveTermFromCloud();
    pullFormAccessFromCloud();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* ══════════ 9) เปิด API ให้ไฟล์อื่นเรียกใช้ ══════════ */
  window.Term = {
    parse: parseTerm, key: termKey, isValid: isValidTerm, cmp: cmpTerm,
    next: nextTerm, label: termLabel, all: allTerms,
    active: getActiveTerm, setActive: setActiveTerm,
    bind: bindTerm, bucket: bucketOf,
    progress: formProgress, state: formState, meta: formMeta,
    rerender: rerenderTermViews,
    formAccess: getFormAccess, isFormOpen: isFormOpen, setFormAccess: setFormAccess
  };
  console.log('📅 ระบบภาคเรียนพร้อมใช้งาน — ภาคเรียนปัจจุบัน: ' + getActiveTerm());
})();
