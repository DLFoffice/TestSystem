/* ============================================================
   20-patches.js — แก้บั๊กที่พบจากการตรวจระบบ (ต้องโหลดท้ายสุด)
   ------------------------------------------------------------
   P1  ข้อมูลไม่ครบรูป → renderDashboard / renderPayment พังเมื่อ
       นักเรียนจากคลาวด์ไม่มีฟิลด์ payment (normalizeStudent สร้างให้เฉพาะ
       เมื่อมี semPayments) → ทั้งหน้าไม่แสดงผล
   P2  getLatestGpa ใช้ "ตัวสุดท้ายในอาร์เรย์" ไม่ใช่ "ภาคเรียนล่าสุด"
       → ถ้าครูเพิ่มภาคเรียนย้อนหลัง ทุกกราฟ/ตัวเลขบนแดชบอร์ดเพี้ยน
   P3  ตัวกรองภาคเรียน (การเงิน/ผลการเรียน) เติมครั้งเดียวและเรียงแบบข้อความ
       → '1/2569' มาก่อน '2/2568' และภาคเรียนใหม่ไม่โผล่ในตัวกรอง
   P4  เพิ่ม GPA ย้อนหลังแล้วทับ s.gpa (ตัวปัจจุบัน) เสมอ
   P5  ส่งออก CSV เสี่ยง CSV injection (=cmd|...) และไม่ escape
   P6  หน้าเพิ่ม GPA ไม่บันทึกขึ้นคลาวด์/Sheet ทันที
   P7  นักเรียนที่ยังไม่มีรายการเบิกจ่าย "หายทั้งคน" จากหน้าการเงิน
       renderPayment ใช้ `s.semPayments || [แถวสำรอง]` แต่ normalizeStudent
       ตั้งค่าเป็น [] (truthy) → ตัวสำรองไม่ทำงาน → ได้ 0 แถว ไม่มีอะไรบอกว่าหาย
       เช่นเดียวกันกับ renderAcademic ที่ข้ามคนไม่มี semGpa
   ============================================================ */
(function () {
  'use strict';

  /* ---------- ตัวช่วยเรียงภาคเรียน ---------- */
  const tkey = t => {
    const m = String(t || '').match(/(\d)\s*\/\s*(\d{4})/);
    return m ? (+m[2]) * 10 + (+m[1]) : -1;
  };
  const byTerm = (a, b) => tkey(a.term) - tkey(b.term);

  /* ---------- P1 : ทำให้ทุกระเบียนมีรูปร่างครบ ---------- */
  function ensureShape(s) {
    if (!s || typeof s !== 'object') return s;
    if (!Array.isArray(s.semPayments)) s.semPayments = [];
    if (!Array.isArray(s.semGpa)) s.semGpa = [];
    s.semPayments.sort(byTerm);
    s.semGpa.sort(byTerm);

    if (!s.gpa || typeof s.gpa !== 'object') s.gpa = {};
    if (!s.addr || typeof s.addr !== 'object') s.addr = {};
    if (!s.bank || typeof s.bank !== 'object') s.bank = {};
    if (!s.mentor || typeof s.mentor !== 'object') s.mentor = { firstName: '', lastName: '', phone: '', position: '' };
    if (!s.school_m1_addr || typeof s.school_m1_addr !== 'object') s.school_m1_addr = {};
    if (!s.hasOwnProperty('behavior')) s.behavior = '';

    // payment = ภาคเรียนล่าสุดที่มีการเบิกจ่าย (ไม่มีก็เป็นศูนย์ ไม่ใช่ undefined)
    const lp = s.semPayments[s.semPayments.length - 1];
    if (!s.payment || typeof s.payment !== 'object') s.payment = {};
    s.payment = lp
      ? { term: lp.term, p1: lp.p1 || 0, p2: lp.p2 || 0, item1: lp.item1 || '', item2: lp.item2 || '' }
      : { term: s.payment.term || '', p1: s.payment.p1 || 0, p2: s.payment.p2 || 0, item1: s.payment.item1 || '', item2: s.payment.item2 || '' };
    return s;
  }
  function ensureAll() { (DB.students || []).forEach(ensureShape); }
  window.ensureStudentShape = ensureShape;

  // เรียก ensureAll ก่อนทุกฟังก์ชันที่วาดหน้าจอ (ข้อมูลคลาวด์เข้ามาได้ตลอดเวลา)
  ['renderDashboard', 'renderStudents', 'renderPayment', 'renderAcademic',
    'renderGpaSheet', 'renderFormTrack', 'renderAddress', 'renderBanking',
    'populateFilters', 'populateTermFilter', 'populateGpaTerm', 'renderTermReport',
    'sfRenderPage'].forEach(fn => {
      const orig = window[fn];
      if (typeof orig !== 'function') return;
      window[fn] = function () { try { ensureAll(); } catch (e) { console.warn('ensureAll:', e); } return orig.apply(this, arguments); };
    });

  /* ---------- P2 : GPA ล่าสุด = ภาคเรียนล่าสุดจริง ---------- */
  window.getLatestGpa = function (s) {
    if (!s) return {};
    const arr = (s.semGpa || []).filter(g => g && g.term).slice().sort(byTerm);
    const withVal = arr.filter(g => Number(g.gpa) > 0);
    if (withVal.length) return withVal[withVal.length - 1];
    if (arr.length) return arr[arr.length - 1];
    return s.gpa || {};
  };

  /* ---------- P3 : ตัวกรองภาคเรียน สร้างใหม่ทุกครั้ง + เรียงถูกต้อง ---------- */
  function refillTermSelect(selectId, terms) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const cur = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    terms.slice().sort((a, b) => tkey(a) - tkey(b)).forEach(t => {
      const o = document.createElement('option');
      o.value = t; o.textContent = 'ภาคเรียน ' + t;
      sel.appendChild(o);
    });
    if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
  }
  window.populateTermFilter = function () {
    ensureAll();
    const set = new Set();
    (DB.students || []).forEach(s => (s.semPayments || []).forEach(p => p.term && set.add(p.term)));
    refillTermSelect('pay-filter-term', [...set]);
  };
  window.populateGpaTerm = function () {
    ensureAll();
    const set = new Set();
    (DB.students || []).forEach(s => (s.semGpa || []).forEach(g => g.term && set.add(g.term)));
    refillTermSelect('gpa-term-select', [...set]);
  };

  /* ---------- P4 + P6 : เพิ่ม/แก้ GPA ---------- */
  const _origSaveSem = window.saveSemData;
  window.saveSemData = function () {
    const wasAddMode = !!window._addGpaMode;
    const idxBefore = wasAddMode ? parseInt(document.getElementById('add-gpa-student')?.value) : NaN;
    const r = _origSaveSem.apply(this, arguments);
    if (wasAddMode && !window._addGpaMode && !isNaN(idxBefore) && DB.students[idxBefore]) {
      const s = DB.students[idxBefore];
      s.semGpa.sort(byTerm);
      // s.gpa ต้องสะท้อน "ภาคเรียนล่าสุด" เท่านั้น (เดิมถูกทับด้วยภาคเรียนที่เพิ่งกรอก แม้เป็นของเก่า)
      const latest = window.getLatestGpa(s);
      if (latest && latest.term) s.gpa = Object.assign({}, latest);
      // บันทึกขึ้นคลาวด์/Sheet ทันที (เดิมเรียกแค่ saveToStorage ในโหมดที่ไม่มี Firebase)
      try { if (typeof saveStudentToSheet === 'function' && !window.FIREBASE_CONFIG?.projectId) saveStudentToSheet(idxBefore); } catch (e) {}
      try { saveToStorage(); } catch (e) {}
      try { if (typeof Term !== 'undefined') Term.rerender(); } catch (e) {}
    }
    return r;
  };


  /* ---------- P7 : หน้าการเงิน ต้องไม่มีนักเรียนหายเงียบ ๆ ---------- */
  window.renderPayment = function () {
    ensureAll();
    const q = (document.getElementById('pay-search').value || '').toLowerCase();
    const ft = document.getElementById('pay-filter-term').value;

    const rows = [], noRec = [];
    DB.students.forEach(s => {
      if (q && !((s.name || '') + (s.school_m1 || '') + (s.province || '')).toLowerCase().includes(q)) return;
      const recs = (s.semPayments || []).filter(p => !ft || p.term === ft);
      if (recs.length) recs.forEach(p => rows.push({ s, p }));
      else if (!ft) noRec.push(s);      // เลือก "ทุกภาคเรียน" อยู่ → แสดงว่ายังไม่มีรายการ
    });

    const totalAll = rows.reduce((a, { p }) => a + (p.p1 || 0) + (p.p2 || 0), 0);
    const cell = (s, p) => {
      const idx = DB.students.indexOf(s);
      const total = (p.p1 || 0) + (p.p2 || 0);
      return `<tr><td>${s.no ?? ''}</td><td class="photo-cell">${photoEl(s)}</td>
        <td style="font-weight:600">${s.name || '-'}<div style="font-size:11px;color:var(--text3)">${s.nickname || ''}</div></td>
        <td style="font-size:12px">${s.school_m1 || '-'}</td>
        <td><span class="badge b-blue">${s.province || '-'}</span></td>
        <td><span class="badge b-gray">${p.term || '-'}</span></td>
        <td><div style="font-weight:600;color:var(--blue)">${fmt(p.p1 || 0)}</div><div style="font-size:11px;color:var(--text3)">${p.item1 || '-'}</div></td>
        <td><div style="font-weight:600;color:var(--teal)">${fmt(p.p2 || 0)}</div><div style="font-size:11px;color:var(--text3)">${p.item2 || '-'}</div></td>
        <td style="font-weight:700;color:var(--teal);font-size:15px">${fmt(total)}</td>
        <td><button class="btn btn-sm" onclick="openStudentDetail(${idx});switchTabByName('การเงิน')">แก้ไข</button></td></tr>`;
    };
    const emptyRow = s => {
      const idx = DB.students.indexOf(s);
      return `<tr class="pay-norec"><td>${s.no ?? ''}</td><td class="photo-cell">${photoEl(s)}</td>
        <td style="font-weight:600">${s.name || '-'}<div style="font-size:11px;color:var(--text3)">${s.nickname || ''}</div></td>
        <td style="font-size:12px">${s.school_m1 || '-'}</td>
        <td><span class="badge b-blue">${s.province || '-'}</span></td>
        <td colspan="4" style="color:var(--text3);font-size:12.5px">ยังไม่มีรายการเบิกจ่าย</td>
        <td><button class="btn btn-sm" onclick="openStudentDetail(${idx});switchTabByName('การเงิน')">เพิ่มรายการ</button></td></tr>`;
    };

    // เรียงรวมตามลำดับนักเรียน แล้วตามภาคเรียน — คนไม่มีรายการจึงอยู่ในตำแหน่งของตัวเอง ไม่ถูกดันไปท้ายตาราง
    const all = [
      ...rows.map(r => ({ no: r.s.no || 0, k: tkey(r.p.term), html: cell(r.s, r.p) })),
      ...noRec.map(s => ({ no: s.no || 0, k: -1, html: emptyRow(s) }))
    ].sort((x, y) => (x.no - y.no) || (x.k - y.k));
    document.getElementById('payment-tbody').innerHTML = all.map(r => r.html).join('');

    const paidStudents = new Set(rows.map(r => r.s)).size;
    document.getElementById('payment-footer').textContent =
      `${rows.length} รายการ จากนักเรียน ${paidStudents} คน • รวม ${fmt(totalAll)} บาท`
      + (noRec.length ? ` • ยังไม่มีรายการอีก ${noRec.length} คน` : '');
  };

  /* ---------- P5 : ส่งออก CSV อย่างปลอดภัย ---------- */
  const csvCell = v => '"' + String(v ?? '').replace(/"/g, '""').replace(/^[=+\-@\t\r]/, "'$&") + '"';
  window.csvCell = csvCell;

  const _origExportGpa = window.exportGpaSheet;
  window.exportGpaSheet = function () {
    ensureAll();
    const q = (document.getElementById('gps-search').value || '').toLowerCase();
    const fg = document.getElementById('gps-filter-grade').value;
    const ft = document.getElementById('gps-filter-term').value;
    const rows = [];
    DB.students.forEach(s => (s.semGpa || []).forEach(g => {
      const grade = gradeFromTerm(g.term);
      if (fg && grade !== fg) return;
      if (ft && g.term !== ft) return;
      if (q && !(s.name + (s.school_m1 || '') + (s.province || '')).toLowerCase().includes(q)) return;
      rows.push({ s, g, grade });
    }));
    const header = ['ลำดับ', 'ชื่อ-สกุล', 'ชั้น', 'โรงเรียน', 'จังหวัด', 'ภาคเรียน', 'GPA', 'GPA ป.6',
      'Δ vs ป.6', 'ความเสี่ยง', 'มีอุปสรรค', 'ประเภทอุปสรรค', 'วิชาที่อ่อน', 'การช่วยเหลือโรงเรียน'];
    const csv = '\uFEFF' + [header.map(csvCell).join(','),
      ...rows.map(({ s, g, grade }, i) => [
        i + 1, s.name, grade, s.school_m1 || '', s.province || '', g.term || '', g.gpa || '',
        s.gpa_p6 || '', (s.gpa_p6 && g.gpa) ? (g.gpa - s.gpa_p6).toFixed(2) : '',
        g.riskLevel || '', g.hasObstacle ? 'มี' : 'ไม่มี', g.obstacleType || '',
        g.weakSubjects || '', g.schoolSupport || ''
      ].map(csvCell).join(','))].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `GPA_Sheet_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };
  if (!_origExportGpa) console.warn('exportGpaSheet ไม่พบ — ข้ามแพตช์ P5');

  ensureAll();
  console.log('🩹 20-patches.js: แพตช์ P1–P7 ทำงานแล้ว');
})();
