/* ============================================================
   23-sdq-form.js — แบบประเมิน SDQ (ฉบับครูเป็นผู้ประเมิน)
   ------------------------------------------------------------
   เพิ่มเข้ามา:
   1. หน้ากรอกแบบประเมิน SDQ 25 ข้อ ต่อนักเรียน 1 คน / 1 ภาคเรียน
      (เก็บที่ student.sdq[term] = {...})
   2. คิดคะแนน + แปลผล 5 ด้าน (อารมณ์ / เกเร / ไม่อยู่นิ่ง-สมาธิสั้น /
      สัมพันธ์กับเพื่อน / สัมพันธภาพทางสังคม) + คะแนนรวม 4 ด้าน
      ตามเกณฑ์ "ฉบับครูหรือผู้ปกครองเป็นผู้ประเมิน"
   3. หน้า Dashboard สรุปผลรวมทั้งโรงเรียน/ระดับชั้น พร้อมกราฟ Chart.js
   4. Export PDF ต่อคน (จัดหน้าสวยงาม) ผ่าน window.print()
   5. แอดมิน/ครู เปิด-ปิด การใช้งานฟอร์มนี้ได้ (เหมือนฟอร์ม 1/2)
      เก็บที่ settings/sdqFormAccess บน Firestore + localStorage สำรอง

   โหลดหลัง 19-term-system.js (ใช้ Term.active() เป็นค่าเริ่มต้นของภาคเรียน)
   ============================================================ */
(function () {
  'use strict';

  /* ══════════ 1) โครงสร้างข้อคำถาม 25 ข้อ ══════════ */
  const SDQ_ITEMS = [
    { id: 1, text: 'ห่วงใยความรู้สึกของคนอื่น', domain: 'prosocial' },
    { id: 2, text: 'อยู่ไม่นิ่ง นั่งนิ่งๆ ไม่ได้', domain: 'hyper' },
    { id: 3, text: 'มักจะบ่นว่าปวดศีรษะ ปวดท้อง หรือไม่สบาย', domain: 'emotional' },
    { id: 4, text: 'เต็มใจแบ่งปันสิ่งของให้เพื่อน (ขนม, ของเล่น, ดินสอ เป็นต้น)', domain: 'prosocial' },
    { id: 5, text: 'มักจะอาละวาดหรือโมโหร้าย', domain: 'conduct' },
    { id: 6, text: 'ค่อนข้างแยกตัว ชอบเล่นคนเดียว', domain: 'peer' },
    { id: 7, text: 'เชื่อฟัง มักจะทำตามที่ผู้ใหญ่ต้องการ', domain: 'conduct', reverse: true },
    { id: 8, text: 'กังวลใจหลายเรื่อง ดูวิตกกังวลเสมอ', domain: 'emotional' },
    { id: 9, text: 'เป็นที่พึ่งได้เวลาที่คนอื่นเสียใจ อารมณ์ไม่ดี หรือไม่สบายใจ', domain: 'prosocial' },
    { id: 10, text: 'อยู่ไม่สุข วุ่นวายอย่างมาก', domain: 'hyper' },
    { id: 11, text: 'มีเพื่อนสนิท', domain: 'peer', reverse: true },
    { id: 12, text: 'มักมีเรื่องทะเลาะวิวาทกับเด็กอื่น หรือรังแกเด็กอื่น', domain: 'conduct' },
    { id: 13, text: 'ดูไม่มีความสุข ท้อแท้ ร้องไห้บ่อย', domain: 'emotional' },
    { id: 14, text: 'เป็นที่ชื่นชอบของเพื่อน', domain: 'peer', reverse: true },
    { id: 15, text: 'วอกแวกง่าย สมาธิสั้น', domain: 'hyper' },
    { id: 16, text: 'เครียด ไม่ยอมห่างเวลาอยู่ในสถานการณ์ที่ไม่คุ้น และขาดความเชื่อมั่นในตนเอง', domain: 'emotional' },
    { id: 17, text: 'ใจดีกับเด็กที่เล็กกว่า', domain: 'prosocial' },
    { id: 18, text: 'ชอบโกหกหรือขี้โกง', domain: 'conduct' },
    { id: 19, text: 'ถูกเด็กคนอื่นล้อเลียนหรือรังแก', domain: 'peer' },
    { id: 20, text: 'ชอบอาสาช่วยเหลือคนอื่น (พ่อ, แม่, ครู, เด็กคนอื่น)', domain: 'prosocial' },
    { id: 21, text: 'คิดก่อนทำ', domain: 'hyper', reverse: true },
    { id: 22, text: 'ขโมยของของที่บ้าน ที่โรงเรียน หรือที่อื่น', domain: 'conduct' },
    { id: 23, text: 'เข้ากับผู้ใหญ่ได้ดีกว่าเด็กวัยเดียวกัน', domain: 'peer' },
    { id: 24, text: 'ขี้กลัว รู้สึกหวาดกลัวได้ง่าย', domain: 'emotional' },
    { id: 25, text: 'ทำงานได้จนเสร็จ มีความตั้งใจในการทำงาน', domain: 'hyper', reverse: true }
  ];
  const CHOICES = ['ไม่จริง', 'ค่อนข้างจริง', 'จริง']; // index 0,1,2

  const DOMAIN_META = {
    emotional: { label: 'ด้านอารมณ์', short: 'อารมณ์', normal: [0, 3], risk: [4, 4], problem: [5, 10] },
    conduct: { label: 'ด้านความประพฤติ/เกเร', short: 'เกเร', normal: [0, 3], risk: [4, 4], problem: [5, 10] },
    hyper: { label: 'ด้านพฤติกรรมไม่อยู่นิ่ง/สมาธิสั้น', short: 'ไม่อยู่นิ่ง/สมาธิสั้น', normal: [0, 5], risk: [6, 6], problem: [7, 10] },
    peer: { label: 'ด้านความสัมพันธ์กับเพื่อน', short: 'สัมพันธ์เพื่อน', normal: [0, 5], risk: [6, 6], problem: [7, 10] },
    prosocial: { label: 'ด้านสัมพันธภาพทางสังคม (จุดแข็ง)', short: 'สัมพันธภาพทางสังคม', normal: [4, 10], risk: [3, 3], problem: [0, 2], isStrength: true }
  };
  const TOTAL_META = { normal: [0, 15], risk: [16, 17], problem: [18, 40] };
  const DIFF_DOMAINS = ['emotional', 'conduct', 'hyper', 'peer'];

  function inRange(v, r) { return v >= r[0] && v <= r[1]; }
  function classify(score, meta) {
    if (inRange(score, meta.normal)) return meta.isStrength ? 'จุดแข็ง' : 'ปกติ';
    if (inRange(score, meta.risk)) return 'เสี่ยง';
    return meta.isStrength ? 'ไม่มีจุดแข็ง' : 'มีปัญหา';
  }
  function classifyTotal(score) {
    if (inRange(score, TOTAL_META.normal)) return 'ปกติ';
    if (inRange(score, TOTAL_META.risk)) return 'เสี่ยง';
    return 'มีปัญหา';
  }
  function groupCls(g) {
    if (g === 'ปกติ' || g === 'จุดแข็ง') return 'b-green';
    if (g === 'เสี่ยง') return 'b-amber';
    return 'b-red';
  }

  /* ส่วนเสริมด้านหลัง (ผลกระทบ) — ไม่บังคับ */
  const IMPACT_SCALE = { 'ไม่เลย': 0, 'เล็กน้อย': 0, 'ค่อนข้างมาก': 1, 'มาก': 2 };
  function classifyImpact(score) {
    if (score <= 0) return 'ปกติ';
    if (score <= 2) return 'เสี่ยง';
    return 'มีปัญหา';
  }

  /** คิดคะแนนทั้งหมดจากคำตอบ */
  function sdqCompute(data) {
    const ans = (data && data.answers) || {};
    const domainScore = { emotional: 0, conduct: 0, hyper: 0, peer: 0, prosocial: 0 };
    const answeredCount = { emotional: 0, conduct: 0, hyper: 0, peer: 0, prosocial: 0 };
    SDQ_ITEMS.forEach(it => {
      const raw = ans[it.id];
      if (raw === undefined || raw === null || raw === '') return;
      const idx = Number(raw);
      if (!(idx >= 0 && idx <= 2)) return;
      const score = it.reverse ? (2 - idx) : idx;
      domainScore[it.domain] += score;
      answeredCount[it.domain]++;
    });
    const totalAnswered = Object.values(answeredCount).reduce((a, b) => a + b, 0);
    const totalDiff = DIFF_DOMAINS.reduce((a, d) => a + domainScore[d], 0);
    const groups = {};
    Object.keys(DOMAIN_META).forEach(d => { groups[d] = classify(domainScore[d], DOMAIN_META[d]); });
    const totalGroup = classifyTotal(totalDiff);

    // ผลกระทบ (ด้านหลัง) — ถ้าตอบ
    let impactScore = null, impactGroup = null;
    if (data && data.overall && data.overall !== '1') {
      const distress = IMPACT_SCALE[data.distress] || 0;
      const areas = ['home', 'friends', 'classroom', 'leisure'];
      let sum = distress;
      areas.forEach(a => { sum += IMPACT_SCALE[(data.impact || {})[a]] || 0; });
      impactScore = sum;
      impactGroup = classifyImpact(sum);
    }

    return {
      domainScore, answeredCount, totalAnswered, totalDiff, groups, totalGroup,
      complete: totalAnswered >= 25,
      impactScore, impactGroup
    };
  }

  /* ══════════ 2) เข้าถึง/บันทึกข้อมูล ══════════ */
  function sdqTerm() { return (typeof Term === 'object' && Term.active) ? Term.active() : '1/2568'; }
  function sdqGradeGuess(term) { return (typeof gradeFromTerm === 'function') ? (gradeFromTerm(term) || '') : ''; }

  function sdqBucket(student, term, create) {
    if (!student.sdq || typeof student.sdq !== 'object') student.sdq = {};
    if (!student.sdq[term]) {
      if (!create) return null;
      student.sdq[term] = { grade: sdqGradeGuess(term), term, evaluator: '', date: '', answers: {}, overall: '', duration: '', distress: '', impact: {}, __touched: false, submittedAt: '' };
    }
    return student.sdq[term];
  }

  const _sdqDebounced = (function () {
    let t = null;
    return function (fn, wait) {
      clearTimeout(t); t = setTimeout(fn, wait || 500);
    };
  })();
  function sdqPersist() {
    _sdqDebounced(function () {
      try { saveToStorage(); } catch (e) { console.warn('sdqPersist save error', e); }
    }, 500);
  }

  /* ══════════ 3) เปิด/ปิด การใช้งานฟอร์ม (ครู/แอดมิน) ══════════ */
  const SDQ_LS_ACCESS = 'dltv_sdq_form_access';
  let _sdqOpen = null;
  function sdqIsStaff() { return !window.STUDENT_MODE; }
  function sdqFsdb() {
    try { if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) return firebase.firestore(); } catch (e) {}
    return null;
  }
  function sdqGetOpen() {
    if (_sdqOpen !== null) return _sdqOpen;
    let v = null;
    try { v = localStorage.getItem(SDQ_LS_ACCESS); } catch (e) {}
    _sdqOpen = v !== 'closed';
    return _sdqOpen;
  }
  function sdqSetOpen(open) {
    if (!sdqIsStaff()) return;
    _sdqOpen = !!open;
    try { localStorage.setItem(SDQ_LS_ACCESS, open ? 'open' : 'closed'); } catch (e) {}
    const db = sdqFsdb();
    if (db) {
      db.collection('settings').doc('sdqFormAccess')
        .set({ open: !!open, at: new Date().toISOString() }, { merge: true })
        .catch(e => console.warn('ตั้งสิทธิ์ SDQ บนคลาวด์ไม่สำเร็จ:', e.message));
    }
    if (typeof showStatus === 'function') showStatus((open ? '🔓 เปิด' : '🔒 ปิด') + 'การใช้งานแบบประเมิน SDQ แล้ว', open ? 'success' : 'error');
    sdqRerender();
  }
  async function sdqPullOpen() {
    const db = sdqFsdb(); if (!db) return;
    try {
      const d = await db.collection('settings').doc('sdqFormAccess').get();
      if (d.exists) {
        _sdqOpen = d.data().open !== false;
        try { localStorage.setItem(SDQ_LS_ACCESS, _sdqOpen ? 'open' : 'closed'); } catch (e) {}
        sdqRerender();
      }
    } catch (e) { /* ยังไม่มี settings หรือไม่มีสิทธิ์ */ }
  }
  function sdqRerender() {
    const p1 = document.getElementById('page-sdqform');
    if (p1 && p1.classList.contains('active')) sdqRenderFormPage();
    const p2 = document.getElementById('page-sdqdashboard');
    if (p2 && p2.classList.contains('active')) sdqRenderDashboard();
  }

  /* ══════════ 4) STATE ของหน้ากรอก ══════════ */
  const sdqState = { studentIdx: null, term: null, search: '' };

  function sdqStudents() { return DB.students || []; }

  window.sdqRenderFormPage = function () {
    const host = document.getElementById('sdq-root');
    if (!host) return;
    if (!sdqState.term) sdqState.term = sdqTerm();

    if (sdqState.studentIdx === null) {
      host.innerHTML = sdqPickerHtml();
      sdqBindPickerEvents(host);
      return;
    }
    host.innerHTML = sdqEditorHtml();
    sdqBindEditorEvents(host);
  };

  function sdqPickerHtml() {
    const open = sdqGetOpen();
    const students = sdqStudents();
    const q = sdqState.search.trim().toLowerCase();
    const rows = students
      .map((s, idx) => ({ s, idx }))
      .filter(r => !q || (r.s.name || '').toLowerCase().includes(q) || (r.s.school_m1 || '').toLowerCase().includes(q))
      .sort((a, b) => (a.s.no || 0) - (b.s.no || 0));

    const banner = !open && sdqIsStaff()
      ? `<div class="sdq-banner sdq-banner-closed">🔒 ฟอร์ม SDQ ถูกปิดใช้งานอยู่ (นักเรียนหรือครูท่านอื่นจะกรอกไม่ได้ — คุณยังดู/แก้ไขได้ในฐานะผู้ดูแล)</div>` : '';
    const toggleBtn = sdqIsStaff()
      ? `<button class="btn ${open ? '' : 'btn-primary'}" id="sdq-toggle-btn">${open ? '🔒 ปิดการใช้งานฟอร์ม' : '🔓 เปิดการใช้งานฟอร์ม'}</button>`
      : '';

    return `
    <div class="toolbar">
      <div class="toolbar-title">📝 แบบประเมิน SDQ — เลือกนักเรียน</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select id="sdq-term-select" style="padding:7px 10px;border-radius:var(--rad);border:1px solid var(--border2);font-family:'Sarabun',sans-serif;font-size:13px;background:var(--bg4)">
          ${(typeof Term === 'object' ? Term.all() : [sdqState.term]).map(t => `<option value="${t}" ${t === sdqState.term ? 'selected' : ''}>${typeof Term === 'object' ? Term.label(t) : t}</option>`).join('')}
        </select>
        ${toggleBtn}
      </div>
    </div>
    ${banner}
    <div class="search-row">
      <input type="text" id="sdq-search" placeholder="🔍 ค้นหาชื่อนักเรียน / โรงเรียน..." value="${sdqEsc(sdqState.search)}">
    </div>
    <div class="tbl-wrap">
      <table>
        <thead><tr><th style="width:60px">ลำดับ</th><th>ชื่อ-สกุล</th><th>โรงเรียน</th><th>สถานะการประเมิน (${typeof Term === 'object' ? Term.label(sdqState.term) : sdqState.term})</th><th style="width:120px">จัดการ</th></tr></thead>
        <tbody>
          ${rows.map(r => sdqPickerRow(r.s, r.idx)).join('') || `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text3)">ไม่พบนักเรียน</td></tr>`}
        </tbody>
      </table>
    </div>`;
  }

  function sdqPickerRow(s, idx) {
    const bucket = (s.sdq && s.sdq[sdqState.term]) || null;
    const res = bucket ? sdqCompute(bucket) : null;
    let statusHtml = `<span class="badge b-gray">ยังไม่ประเมิน</span>`;
    if (bucket && bucket.__touched) {
      if (res.complete) {
        statusHtml = `<span class="badge ${groupCls(res.totalGroup)}">ประเมินครบ · ${res.totalGroup}</span>`;
      } else {
        statusHtml = `<span class="badge b-amber">กรอกบางส่วน (${res.totalAnswered}/25)</span>`;
      }
    }
    return `<tr>
      <td>${s.no ?? ''}</td>
      <td style="font-weight:600">${sdqEsc(s.name || '')}<div style="font-size:11px;color:var(--text3)">${sdqEsc(s.nickname || '')}</div></td>
      <td style="font-size:12px">${sdqEsc(s.school_m1 || '-')}</td>
      <td>${statusHtml}</td>
      <td><button class="btn btn-sm" data-sdq-open="${idx}">📝 ประเมิน</button></td>
    </tr>`;
  }

  function sdqBindPickerEvents(host) {
    const term = document.getElementById('sdq-term-select');
    if (term) term.onchange = () => { sdqState.term = term.value; sdqRenderFormPage(); };
    const search = document.getElementById('sdq-search');
    if (search) search.oninput = () => { sdqState.search = search.value; sdqRenderFormPage(); };
    const toggle = document.getElementById('sdq-toggle-btn');
    if (toggle) toggle.onclick = () => sdqSetOpen(!sdqGetOpen());
    host.querySelectorAll('[data-sdq-open]').forEach(btn => {
      btn.onclick = () => { sdqState.studentIdx = Number(btn.getAttribute('data-sdq-open')); sdqRenderFormPage(); };
    });
  }

  function sdqEditorHtml() {
    const student = sdqStudents()[sdqState.studentIdx];
    if (!student) { sdqState.studentIdx = null; return sdqPickerHtml(); }
    const open = sdqGetOpen();
    const locked = !open && sdqIsStaff() === false;
    const data = sdqBucket(student, sdqState.term, true);
    const res = sdqCompute(data);

    const itemsHtml = SDQ_ITEMS.map((it, rowIdx) => {
      const cur = data.answers[it.id];
      return `<tr class="sdq-row-anim" style="animation-delay:${Math.min(rowIdx * 18, 260)}ms">
        <td style="text-align:center;color:var(--text3)">${it.id}</td>
        <td>${sdqEsc(it.text)}</td>
        ${CHOICES.map((c, i) => `<td class="sdq-choice-cell ${Number(cur) === i ? 'sdq-choice-selected' : ''}" style="text-align:center">
          <label class="sdq-radio-wrap"><input type="radio" name="sdq-item-${it.id}" data-sdq-item="${it.id}" value="${i}" ${Number(cur) === i ? 'checked' : ''} ${locked ? 'disabled' : ''}></label>
        </td>`).join('')}
      </tr>`;
    }).join('');

    const showImpact = data.overall && data.overall !== '1';
    const impactAreas = [['home', 'ความเป็นอยู่ที่บ้าน'], ['friends', 'การคบเพื่อน'], ['classroom', 'การเรียนในห้องเรียน'], ['leisure', 'กิจกรรมยามว่าง']];

    return `
    <div class="sf-editor sdq-editor">
      <div class="sf-header" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">
        <button class="btn btn-sm" id="sdq-back-btn">← กลับรายชื่อ</button>
        <div style="font-weight:700;font-family:'Noto Sans Thai',sans-serif;flex:1">แบบประเมิน SDQ (ฉบับครูเป็นผู้ประเมิน) — ${sdqEsc(student.name || '')}</div>
        <button class="btn btn-sm" id="sdq-print-btn">🖨️ พิมพ์ / PDF</button>
      </div>
      ${locked ? `<div class="sdq-banner sdq-banner-closed">🔒 ฟอร์มนี้ถูกปิดใช้งานอยู่ ไม่สามารถกรอก/แก้ไขได้ในขณะนี้</div>` : ''}

      <div class="sdq-topfields">
        <label>ระดับชั้น <input type="text" id="sdq-f-grade" value="${sdqEsc(data.grade || '')}" placeholder="เช่น ม.1/1" ${locked ? 'disabled' : ''}></label>
        <label>ภาคเรียน <input type="text" id="sdq-f-term" value="${sdqEsc(data.term || sdqState.term)}" placeholder="เช่น 1/2568" ${locked ? 'disabled' : ''}></label>
        <label>ผู้ประเมิน (ครู) <input type="text" id="sdq-f-evaluator" value="${sdqEsc(data.evaluator || '')}" placeholder="ชื่อ-สกุลครูผู้ประเมิน" ${locked ? 'disabled' : ''}></label>
        <label>วันที่ประเมิน <input type="date" id="sdq-f-date" value="${sdqEsc(data.date || '')}" ${locked ? 'disabled' : ''}></label>
      </div>

      <table class="sdq-table">
        <colgroup>
          <col style="width:32px">
          <col>
          <col style="width:78px"><col style="width:78px"><col style="width:78px">
        </colgroup>
        <thead><tr><th></th><th style="text-align:left">รายการประเมิน</th>${CHOICES.map(c => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <div class="sdq-result-box">
        <div class="sdq-result-title">ผลการประเมิน (คำนวณอัตโนมัติ) ${res.totalAnswered < 25 ? `<span class="badge b-amber">กรอกแล้ว ${res.totalAnswered}/25 ข้อ</span>` : `<span class="badge ${groupCls(res.totalGroup)}">รวม 4 ด้าน: ${res.totalGroup} (${res.totalDiff} คะแนน)</span>`}</div>
        <div class="sdq-result-grid">
          ${Object.keys(DOMAIN_META).map(d => `
            <div class="sdq-result-card">
              <div class="sdq-result-card-lbl">${DOMAIN_META[d].short}</div>
              <div class="sdq-result-card-val">${res.domainScore[d]}</div>
              <span class="badge ${groupCls(res.groups[d])}">${res.groups[d]}</span>
            </div>`).join('')}
        </div>
      </div>

      <div class="sdq-impact-box">
        <div class="sdq-result-title">ส่วนเสริม: ผลกระทบต่อชีวิตประจำวัน (ไม่บังคับ)</div>
        <label>โดยรวมแล้ว นักเรียนมีปัญหาด้านอารมณ์ สมาธิ พฤติกรรม หรือความสามารถเข้ากับผู้อื่นหรือไม่
          <select id="sdq-f-overall" ${locked ? 'disabled' : ''}>
            <option value="">— ยังไม่ระบุ —</option>
            <option value="1" ${data.overall === '1' ? 'selected' : ''}>1. ไม่</option>
            <option value="2" ${data.overall === '2' ? 'selected' : ''}>2. ใช่ มีปัญหาเล็กน้อย</option>
            <option value="3" ${data.overall === '3' ? 'selected' : ''}>3. ใช่ มีปัญหาชัดเจน</option>
            <option value="4" ${data.overall === '4' ? 'selected' : ''}>4. ใช่ มีปัญหาอย่างมาก</option>
          </select>
        </label>
        <div id="sdq-impact-detail" style="display:${showImpact ? 'block' : 'none'}">
          <label>ปัญหานี้ทำให้นักเรียนรู้สึกไม่สบายใจหรือไม่
            <select id="sdq-f-distress" ${locked ? 'disabled' : ''}>
              ${['', 'ไม่เลย', 'เล็กน้อย', 'ค่อนข้างมาก', 'มาก'].map(o => `<option value="${o}" ${data.distress === o ? 'selected' : ''}>${o || '— ยังไม่ระบุ —'}</option>`).join('')}
            </select>
          </label>
          ${impactAreas.map(([k, lbl]) => `
            <label>รบกวนชีวิตประจำวันด้าน "${lbl}" หรือไม่
              <select data-sdq-impact="${k}" ${locked ? 'disabled' : ''}>
                ${['', 'ไม่เลย', 'เล็กน้อย', 'ค่อนข้างมาก', 'มาก'].map(o => `<option value="${o}" ${(data.impact || {})[k] === o ? 'selected' : ''}>${o || '— ยังไม่ระบุ —'}</option>`).join('')}
              </select>
            </label>`).join('')}
          ${res.impactGroup ? `<div style="margin-top:8px">สรุป: <span class="badge ${groupCls(res.impactGroup)}">${res.impactGroup}</span> (คะแนน ${res.impactScore})</div>` : ''}
        </div>
      </div>

      <div class="sdq-actions">
        <span class="sf-save-status" id="sdq-save-status">พร้อมบันทึกอัตโนมัติ</span>
        <button class="btn btn-primary" id="sdq-submit-btn" ${locked ? 'disabled' : ''}>✅ บันทึก / ส่งผลการประเมิน</button>
      </div>
    </div>`;
  }

  function sdqBindEditorEvents(host) {
    const student = sdqStudents()[sdqState.studentIdx];
    const back = document.getElementById('sdq-back-btn');
    if (back) back.onclick = () => { sdqState.studentIdx = null; sdqRenderFormPage(); };
    const printBtn = document.getElementById('sdq-print-btn');
    if (printBtn) printBtn.onclick = () => sdqPrintCurrent();

    function data() { return sdqBucket(student, sdqState.term, true); }
    function markTouched() { data().__touched = true; }

    ['grade', 'term', 'evaluator', 'date'].forEach(f => {
      const el = document.getElementById('sdq-f-' + f);
      if (el) el.oninput = () => { data()[f] = el.value; markTouched(); sdqPersist(); };
    });
    host.querySelectorAll('[data-sdq-item]').forEach(inp => {
      inp.onchange = () => {
        data().answers[Number(inp.getAttribute('data-sdq-item'))] = Number(inp.value);
        markTouched(); sdqPersist();
        const row = inp.closest('tr');
        if (row) {
          row.querySelectorAll('.sdq-choice-cell').forEach(td => td.classList.remove('sdq-choice-selected'));
          const cell = inp.closest('.sdq-choice-cell');
          if (cell) {
            cell.classList.add('sdq-choice-selected', 'sdq-pop');
            setTimeout(() => cell.classList.remove('sdq-pop'), 260);
          }
        }
        sdqRefreshResultInline(host, data());
      };
    });
    const overall = document.getElementById('sdq-f-overall');
    if (overall) overall.onchange = () => {
      data().overall = overall.value; markTouched(); sdqPersist();
      sdqRenderFormPage();
    };
    const distress = document.getElementById('sdq-f-distress');
    if (distress) distress.onchange = () => { data().distress = distress.value; markTouched(); sdqPersist(); sdqRefreshResultInline(host, data()); };
    host.querySelectorAll('[data-sdq-impact]').forEach(sel => {
      sel.onchange = () => {
        const d = data(); if (!d.impact) d.impact = {};
        d.impact[sel.getAttribute('data-sdq-impact')] = sel.value;
        markTouched(); sdqPersist();
        sdqRefreshResultInline(host, d);
      };
    });
    const submitBtn = document.getElementById('sdq-submit-btn');
    if (submitBtn) submitBtn.onclick = () => {
      const d = data();
      const res = sdqCompute(d);
      if (!res.complete) { if (typeof showStatus === 'function') showStatus('⚠️ กรุณาประเมินให้ครบทั้ง 25 ข้อก่อนบันทึกผล', 'error'); return; }
      d.submittedAt = new Date().toISOString();
      d.__touched = true;
      sdqPersist();
      if (typeof showStatus === 'function') showStatus('✅ บันทึกผลการประเมิน SDQ แล้ว', 'success');
      sdqRenderFormPage();
    };
  }

  function sdqRefreshResultInline(host, data) {
    const res = sdqCompute(data);
    const box = host.querySelector('.sdq-result-box');
    if (!box) return;
    box.querySelector('.sdq-result-title').innerHTML =
      `ผลการประเมิน (คำนวณอัตโนมัติ) ${res.totalAnswered < 25 ? `<span class="badge b-amber">กรอกแล้ว ${res.totalAnswered}/25 ข้อ</span>` : `<span class="badge ${groupCls(res.totalGroup)}">รวม 4 ด้าน: ${res.totalGroup} (${res.totalDiff} คะแนน)</span>`}`;
    box.querySelectorAll('.sdq-result-card').forEach((card, i) => {
      const d = Object.keys(DOMAIN_META)[i];
      const valEl = card.querySelector('.sdq-result-card-val');
      if (valEl.textContent !== String(res.domainScore[d])) {
        valEl.textContent = res.domainScore[d];
        card.classList.remove('sdq-pulse'); void card.offsetWidth; card.classList.add('sdq-pulse');
      }
      const b = card.querySelector('.badge');
      b.className = 'badge ' + groupCls(res.groups[d]);
      b.textContent = res.groups[d];
    });
  }

  function sdqEsc(s) { return (typeof sfEscapeHtml === 'function') ? sfEscapeHtml(s) : String(s == null ? '' : s); }

  /* ══════════ 5) Dashboard สรุปผล ══════════ */
  let _sdqCharts = {};
  window.sdqRenderDashboard = function () {
    const host = document.getElementById('page-sdqdashboard');
    if (!host) return;
    if (!sdqState.term) sdqState.term = sdqTerm();
    const sel = document.getElementById('sdq-dash-term');
    if (sel) {
      sel.innerHTML = (typeof Term === 'object' ? Term.all() : [sdqState.term])
        .map(t => `<option value="${t}" ${t === sdqState.term ? 'selected' : ''}>${typeof Term === 'object' ? Term.label(t) : t}</option>`).join('');
    }
    const term = (sel && sel.value) || sdqState.term;

    const rows = sdqStudents().map(s => {
      const bucket = s.sdq && s.sdq[term];
      const res = bucket ? sdqCompute(bucket) : null;
      return { s, bucket, res };
    });
    const evaluated = rows.filter(r => r.bucket && r.bucket.__touched && r.res.complete);
    const partial = rows.filter(r => r.bucket && r.bucket.__touched && !r.res.complete);
    const notDone = rows.length - evaluated.length - partial.length;

    const metric = (v, l, c) => `<div class="metric"><div class="metric-val" style="color:${c || 'var(--text)'}">${v}</div><div class="metric-lbl">${l}</div></div>`;
    const problemCount = evaluated.filter(r => r.res.totalGroup === 'มีปัญหา').length;
    const riskCount = evaluated.filter(r => r.res.totalGroup === 'เสี่ยง').length;
    document.getElementById('sdq-dash-metrics').innerHTML =
      metric(rows.length, 'นักเรียนทั้งหมด') +
      metric(evaluated.length, 'ประเมินครบแล้ว', 'var(--green)') +
      metric(partial.length, 'กรอกบางส่วน', partial.length ? 'var(--amber)' : 'var(--text)') +
      metric(notDone, 'ยังไม่ประเมิน', notDone ? 'var(--red)' : 'var(--text)') +
      metric(riskCount, 'กลุ่มเสี่ยง (รวม 4 ด้าน)', riskCount ? 'var(--amber)' : 'var(--text)') +
      metric(problemCount, 'กลุ่มมีปัญหา (รวม 4 ด้าน)', problemCount ? 'var(--red)' : 'var(--text)');

    // กราฟแท่ง: จำนวนนักเรียนแต่ละกลุ่ม แยกตามด้าน
    const domains = Object.keys(DOMAIN_META);
    const groupLabels = { normal: 'ปกติ/จุดแข็ง', risk: 'เสี่ยง', problem: 'มีปัญหา/ไม่มีจุดแข็ง' };
    const counts = { normal: [], risk: [], problem: [] };
    domains.forEach(d => {
      let n = 0, r = 0, p = 0;
      evaluated.forEach(row => {
        const g = row.res.groups[d];
        if (g === 'ปกติ' || g === 'จุดแข็ง') n++;
        else if (g === 'เสี่ยง') r++;
        else p++;
      });
      counts.normal.push(n); counts.risk.push(r); counts.problem.push(p);
    });
    const ctx = document.getElementById('sdq-chart-domains');
    if (ctx && typeof Chart !== 'undefined') {
      if (_sdqCharts.domains) _sdqCharts.domains.destroy();
      _sdqCharts.domains = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: domains.map(d => DOMAIN_META[d].short),
          datasets: [
            { label: groupLabels.normal, data: counts.normal, backgroundColor: '#16A34A' },
            { label: groupLabels.risk, data: counts.risk, backgroundColor: '#D97706' },
            { label: groupLabels.problem, data: counts.problem, backgroundColor: '#DC2626' }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'bottom' } } }
      });
    }

    // กราฟวงกลม: กลุ่มรวม 4 ด้าน
    const pieCtx = document.getElementById('sdq-chart-total');
    if (pieCtx && typeof Chart !== 'undefined') {
      const nOk = evaluated.filter(r => r.res.totalGroup === 'ปกติ').length;
      if (_sdqCharts.total) _sdqCharts.total.destroy();
      _sdqCharts.total = new Chart(pieCtx, {
        type: 'doughnut',
        data: { labels: ['ปกติ', 'เสี่ยง', 'มีปัญหา'], datasets: [{ data: [nOk, riskCount, problemCount], backgroundColor: ['#16A34A', '#D97706', '#DC2626'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }

    // ตารางรายคน
    const q = (document.getElementById('sdq-dash-search')?.value || '').trim().toLowerCase();
    const fg = document.getElementById('sdq-dash-filter')?.value || '';
    let tRows = rows.filter(r => !q || (r.s.name || '').toLowerCase().includes(q) || (r.s.school_m1 || '').toLowerCase().includes(q));
    if (fg) tRows = tRows.filter(r => r.res && r.res.totalGroup === fg);
    tRows = tRows.sort((a, b) => (a.s.no || 0) - (b.s.no || 0));

    document.getElementById('sdq-dash-tbody').innerHTML = tRows.map(r => {
      const idx = DB.students.indexOf(r.s);
      if (!r.bucket || !r.bucket.__touched) {
        return `<tr><td>${r.s.no ?? ''}</td><td style="font-weight:600">${sdqEsc(r.s.name || '')}</td><td style="font-size:12px">${sdqEsc(r.s.school_m1 || '-')}</td>
          <td colspan="6"><span class="badge b-gray">ยังไม่ประเมิน</span></td>
          <td><button class="btn btn-sm" data-sdq-dash-open="${idx}">📝 ประเมิน</button></td></tr>`;
      }
      const res = r.res;
      return `<tr>
        <td>${r.s.no ?? ''}</td>
        <td style="font-weight:600">${sdqEsc(r.s.name || '')}</td>
        <td style="font-size:12px">${sdqEsc(r.s.school_m1 || '-')}</td>
        ${domains.map(d => `<td><span class="badge ${groupCls(res.groups[d])}" title="${res.domainScore[d]} คะแนน">${res.groups[d]}</span></td>`).join('')}
        <td><span class="badge ${groupCls(res.totalGroup)}">${res.totalGroup} (${res.totalDiff})</span></td>
        <td><button class="btn btn-sm" data-sdq-dash-open="${idx}">แก้ไข</button> <button class="btn btn-sm" data-sdq-dash-print="${idx}">🖨️ PDF</button></td>
      </tr>`;
    }).join('') || `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text3)">ไม่มีข้อมูล</td></tr>`;

    host.querySelectorAll('[data-sdq-dash-open]').forEach(btn => {
      btn.onclick = () => {
        sdqState.studentIdx = Number(btn.getAttribute('data-sdq-dash-open'));
        sdqState.term = term;
        const navBtn = [...document.querySelectorAll('#sidebar-nav .nav-btn')].find(b => (b.getAttribute('onclick') || '').includes("'sdqform'"));
        showPage('sdqform', navBtn);
      };
    });
    host.querySelectorAll('[data-sdq-dash-print]').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.getAttribute('data-sdq-dash-print'));
        sdqPrintFor(DB.students[idx], term);
      };
    });
  };

  window.sdqExportDashboardCSV = function () {
    const term = document.getElementById('sdq-dash-term')?.value || sdqState.term;
    const domains = Object.keys(DOMAIN_META);
    const head = ['ลำดับ', 'ชื่อ-สกุล', 'โรงเรียน', ...domains.map(d => DOMAIN_META[d].short + ' (คะแนน)'), ...domains.map(d => DOMAIN_META[d].short + ' (กลุ่ม)'), 'รวม 4 ด้าน (คะแนน)', 'รวม 4 ด้าน (กลุ่ม)'];
    const esc = v => '"' + String(v ?? '').replace(/"/g, '""').replace(/^[=+\-@]/, "'$&") + '"';
    const body = sdqStudents().map(s => {
      const bucket = s.sdq && s.sdq[term];
      if (!bucket || !bucket.__touched) return null;
      const res = sdqCompute(bucket);
      return [s.no, s.name, s.school_m1 || '', ...domains.map(d => res.domainScore[d]), ...domains.map(d => res.groups[d]), res.totalDiff, res.totalGroup].map(esc).join(',');
    }).filter(Boolean);
    const csv = '\uFEFF' + [head.map(esc).join(','), ...body].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `สรุปผล_SDQ_${String(term).replace('/', '-')}.csv`;
    a.click();
  };

  /* ══════════ 6) พิมพ์ / PDF (ใช้ #sf-print-area ร่วมกับฟอร์มทุนฯ) ══════════ */
  function sdqPrintCurrent() {
    const student = sdqStudents()[sdqState.studentIdx];
    if (!student) return;
    sdqPrintFor(student, sdqState.term);
  }
  function sdqPrintFor(student, term) {
    const data = (student.sdq && student.sdq[term]) || {};
    const res = sdqCompute(data);
    let area = document.getElementById('sf-print-area');
    if (!area) { area = document.createElement('div'); area.id = 'sf-print-area'; document.body.appendChild(area); }
    area.innerHTML = sdqBuildPrintHtml(student, data, res);
    setTimeout(() => window.print(), 50);
  }

  function sdqBuildPrintHtml(student, data, res) {
    const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    const itemRows = SDQ_ITEMS.map(it => {
      const cur = data.answers ? data.answers[it.id] : undefined;
      return `<tr><td style="width:26px;text-align:center">${it.id}</td><td>${sdqEsc(it.text)}</td>
        ${CHOICES.map((c, i) => `<td style="text-align:center">${Number(cur) === i ? '✔' : ''}</td>`).join('')}
      </tr>`;
    }).join('');

    const domains = Object.keys(DOMAIN_META);
    const resultRows = domains.map(d => `<tr>
        <td>${DOMAIN_META[d].label}</td>
        <td style="text-align:center">${res.domainScore[d]}</td>
        <td style="text-align:center"><b>${res.groups[d]}</b></td>
      </tr>`).join('');

    return `
    <div class="sfp-page">
      <div class="sfp-brand">มูลนิธิการศึกษาทางไกลผ่านดาวเทียม ในพระบรมราชูปถัมภ์</div>
      <div class="sfp-pageno">แบบประเมิน SDQ (ฉบับครู)</div>
      <div class="sfp-center" style="margin-top:10mm">
        <div class="sfp-title">แบบประเมินพฤติกรรมเด็ก (SDQ) — ฉบับครูเป็นผู้ประเมิน</div>
        <div class="sfp-sub">คำชี้แจง โปรดทำเครื่องหมายให้ตรงกับพฤติกรรมของนักเรียนในช่วง 6 เดือนที่ผ่านมา</div>
      </div>
      <hr class="sfp-hr">
      <div class="sfp-field-line"><span>ชื่อ-สกุลนักเรียน</span>${sdqFill(student.name)}</div>
      <div class="sfp-field-line"><span>ระดับชั้น</span>${sdqFill(data.grade, 60)}<span style="margin-left:16px">ภาคเรียน</span>${sdqFill(data.term, 60)}</div>
      <div class="sfp-field-line"><span>โรงเรียน</span>${sdqFill(student.school_m1)}</div>
      <div class="sfp-field-line"><span>ผู้ประเมิน (ครู)</span>${sdqFill(data.evaluator, 100)}<span style="margin-left:16px">วันที่</span>${sdqFill(data.date, 60)}</div>

      <table class="sfp-table sdq-print-items" style="margin-top:12px;table-layout:fixed">
        <colgroup>
          <col style="width:5%">
          <col style="width:52%">
          <col style="width:14.33%"><col style="width:14.33%"><col style="width:14.34%">
        </colgroup>
        <thead><tr><th></th><th style="text-align:left">รายการประเมิน</th>${CHOICES.map(c => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    <div class="sfp-page">
      <div class="sfp-brand">มูลนิธิการศึกษาทางไกลผ่านดาวเทียม ในพระบรมราชูปถัมภ์</div>
      <div class="sfp-pageno">ผลการประเมิน SDQ</div>
      <div class="sfp-section-title">สรุปผลการประเมิน — ${sdqEsc(student.name || '')}</div>
      <table class="sfp-table">
        <thead><tr><th style="text-align:left">ด้าน</th><th>คะแนน</th><th>ผลการแปลผล</th></tr></thead>
        <tbody>
          ${resultRows}
          <tr style="background:#EFF6FB"><td><b>รวมคะแนน 4 ด้าน (อารมณ์ + เกเร + ไม่อยู่นิ่ง + เพื่อน)</b></td><td style="text-align:center"><b>${res.totalDiff}</b></td><td style="text-align:center"><b>${res.totalGroup}</b></td></tr>
        </tbody>
      </table>
      ${res.impactGroup ? `<div class="sfp-field-line" style="margin-top:10px"><span>ผลกระทบต่อชีวิตประจำวัน</span>${sdqFill(res.impactGroup + ' (คะแนน ' + res.impactScore + ')', 80)}</div>` : ''}
      <div class="sfp-sign-row">
        <div class="sfp-sign">${sdqFill(data.evaluator || '.......................................', 200)}<br>ผู้ประเมิน (ครู)<br>วันที่ ${sdqEsc(data.date || today)}</div>
      </div>
      <div class="sfp-sum-footer">พิมพ์เมื่อ ${today} — มูลนิธิการศึกษาทางไกลผ่านดาวเทียม ในพระบรมราชูปถัมภ์</div>
    </div>`;
  }
  function sdqFill(text, minWidth) {
    const t = sdqEsc(text || '');
    return `<span class="sfp-fill" style="min-width:${minWidth || 40}px">${t || '&nbsp;'}</span>`;
  }

  /* ══════════ 7) เชื่อมเข้าระบบนำทางเดิม ══════════ */
  if (typeof PAGE_META === 'object') {
    PAGE_META.sdqform = { title: 'แบบประเมิน SDQ', sub: 'แบบประเมินพฤติกรรมเด็ก (SDQ) ฉบับครูเป็นผู้ประเมิน — 25 ข้อ พร้อมแปลผลอัตโนมัติ' };
    PAGE_META.sdqdashboard = { title: 'สรุปผล SDQ', sub: 'ภาพรวมผลการประเมิน SDQ และการจัดกลุ่มนักเรียนทั้งหมด' };
  }
  const _origShowPage = window.showPage;
  window.showPage = function (p, btn) {
    _origShowPage(p, btn);
    if (p === 'sdqform') { sdqRenderFormPage(); }
    else if (p === 'sdqdashboard') sdqRenderDashboard();
  };

  /* ══════════ 8) แทรกเมนู sidebar + หน้า (ไม่ต้องแก้ index.html) ══════════ */
  function injectUI() {
    const nav = document.getElementById('sidebar-nav');
    if (nav && !document.getElementById('sdq-nav-form')) {
      const label = document.createElement('div');
      label.className = 'sidebar-section-label';
      label.textContent = 'พฤติกรรมนักเรียน';
      const btn1 = document.createElement('button');
      btn1.className = 'nav-btn'; btn1.id = 'sdq-nav-form';
      btn1.innerHTML = '<span class="nav-icon">🧠</span> แบบประเมิน SDQ';
      btn1.onclick = () => showPage('sdqform', btn1);
      const btn2 = document.createElement('button');
      btn2.className = 'nav-btn'; btn2.id = 'sdq-nav-dash';
      btn2.innerHTML = '<span class="nav-icon">📈</span> สรุปผล SDQ';
      btn2.onclick = () => showPage('sdqdashboard', btn2);
      nav.appendChild(label); nav.appendChild(btn1); nav.appendChild(btn2);
    }
    const main = document.querySelector('.main');
    if (main && !document.getElementById('page-sdqform')) {
      const p1 = document.createElement('div');
      p1.id = 'page-sdqform'; p1.className = 'page'; p1.style.display = 'none';
      p1.innerHTML = '<div id="sdq-root"></div>';
      const p2 = document.createElement('div');
      p2.id = 'page-sdqdashboard'; p2.className = 'page'; p2.style.display = 'none';
      p2.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-title">📈 สรุปผลการประเมิน SDQ</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <select id="sdq-dash-term" onchange="sdqRenderDashboard()" style="padding:7px 10px;border-radius:var(--rad);border:1px solid var(--border2);font-family:'Sarabun',sans-serif;font-size:13px;background:var(--bg4)"></select>
            <button class="btn btn-sm" onclick="sdqExportDashboardCSV()">⬇️ ส่งออก CSV</button>
          </div>
        </div>
        <div class="metrics" id="sdq-dash-metrics" style="margin-bottom:16px"></div>
        <div class="chart-grid" style="grid-template-columns:1.4fr 1fr">
          <div class="chart-card">
            <div class="chart-header"><div class="chart-title">จำนวนนักเรียนแยกตามด้าน</div></div>
            <div style="position:relative;height:220px"><canvas id="sdq-chart-domains"></canvas></div>
          </div>
          <div class="chart-card">
            <div class="chart-header"><div class="chart-title">กลุ่มโดยรวม (4 ด้าน)</div></div>
            <div style="position:relative;height:220px"><canvas id="sdq-chart-total"></canvas></div>
          </div>
        </div>
        <div class="search-row">
          <input type="text" id="sdq-dash-search" placeholder="🔍 ค้นหาชื่อนักเรียน / โรงเรียน..." oninput="sdqRenderDashboard()">
          <select id="sdq-dash-filter" onchange="sdqRenderDashboard()">
            <option value="">กลุ่ม (ทั้งหมด)</option>
            <option value="ปกติ">ปกติ</option>
            <option value="เสี่ยง">เสี่ยง</option>
            <option value="มีปัญหา">มีปัญหา</option>
          </select>
        </div>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>ลำดับ</th><th>ชื่อ-สกุล</th><th>โรงเรียน</th><th>อารมณ์</th><th>เกเร</th><th>ไม่อยู่นิ่ง</th><th>เพื่อน</th><th>สัมพันธภาพทางสังคม</th><th>รวม 4 ด้าน</th><th style="width:150px">จัดการ</th></tr></thead>
            <tbody id="sdq-dash-tbody"></tbody>
          </table>
        </div>`;
      main.appendChild(p1);
      main.appendChild(p2);
    }
  }

  function injectStyles() {
    if (document.getElementById('sdq-inline-style')) return;
    const style = document.createElement('style');
    style.id = 'sdq-inline-style';
    style.textContent = `
      .sdq-banner{padding:10px 16px;border-radius:var(--rad);margin-bottom:14px;font-size:13px;font-weight:600;animation:sdqSlideDown .35s ease}
      .sdq-banner-closed{background:#FEF3C7;color:#92400E;border:1px solid #FDE68A}
      .sdq-topfields{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
      .sdq-topfields label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:var(--text2)}
      .sdq-topfields input{padding:8px 10px;border-radius:var(--rad);border:1px solid var(--border2);font-family:'Sarabun',sans-serif;font-size:13px;transition:border-color .15s ease,box-shadow .15s ease}
      .sdq-topfields input:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-lt)}

      .sdq-editor{animation:sdqFadeIn .3s ease}
      .toolbar-title, #sdq-root .toolbar{animation:sdqFadeIn .25s ease}

      .sdq-table{width:100%;border-collapse:collapse;font-size:13px;background:var(--bg4);border:1px solid var(--border);border-radius:var(--rad-lg);overflow:hidden;margin-bottom:18px;table-layout:fixed}
      .sdq-table th,.sdq-table td{padding:8px 8px;border-bottom:1px solid var(--border);overflow-wrap:break-word}
      .sdq-table thead th{background:var(--bg2);font-size:10.5px;color:var(--text2);text-transform:uppercase;letter-spacing:.3px;text-align:center}
      .sdq-table thead th:nth-child(2){text-align:left}
      .sdq-table tbody tr{transition:background .15s ease}
      .sdq-table tbody tr:hover{background:var(--blue-lt)}
      .sdq-row-anim{animation:sdqRowIn .35s ease both}
      .sdq-choice-cell{transition:background-color .18s ease}
      .sdq-choice-cell.sdq-choice-selected{background:var(--blue-lt)}
      .sdq-choice-cell.sdq-pop{animation:sdqPop .26s cubic-bezier(.34,1.56,.64,1)}
      .sdq-radio-wrap{display:inline-flex;align-items:center;justify-content:center}
      .sdq-table input[type=radio]{width:17px;height:17px;accent-color:var(--blue);cursor:pointer;transition:transform .12s ease}
      .sdq-table input[type=radio]:hover{transform:scale(1.15)}
      .sdq-table input[type=radio]:checked{transform:scale(1.1)}

      .sdq-result-box,.sdq-impact-box{background:var(--bg4);border:1px solid var(--border);border-radius:var(--rad-lg);padding:16px;margin-bottom:16px;animation:sdqFadeIn .3s ease}
      .sdq-result-title{font-weight:700;margin-bottom:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .sdq-result-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
      .sdq-result-card{background:var(--bg2);border-radius:var(--rad);padding:10px;text-align:center;transition:transform .15s ease,box-shadow .15s ease}
      .sdq-result-card:hover{transform:translateY(-2px);box-shadow:0 4px 14px rgba(15,17,35,.08)}
      .sdq-result-card.sdq-pulse{animation:sdqPulse .45s ease}
      .sdq-result-card-lbl{font-size:11px;color:var(--text3);margin-bottom:4px}
      .sdq-result-card-val{font-size:22px;font-weight:800;margin-bottom:4px;transition:color .2s ease}
      .sdq-impact-box label{display:block;margin-bottom:10px;font-size:13px;font-weight:600;color:var(--text2)}
      .sdq-impact-box select{margin-top:4px;padding:7px 10px;border-radius:var(--rad);border:1px solid var(--border2);font-family:'Sarabun',sans-serif;font-size:13px;width:100%;max-width:360px;transition:border-color .15s ease}
      .sdq-impact-box select:focus{outline:none;border-color:var(--blue)}
      .sdq-actions{display:flex;align-items:center;gap:14px}

      .sdq-table + .sdq-actions .btn,#sdq-submit-btn,.sdq-actions .btn{transition:transform .12s ease,box-shadow .12s ease}
      .sdq-actions .btn:hover,.tbl-wrap .btn:hover{transform:translateY(-1px);box-shadow:0 4px 10px rgba(15,17,35,.12)}
      .tbl-wrap tbody tr{transition:background .15s ease}

      @keyframes sdqFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      @keyframes sdqSlideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
      @keyframes sdqRowIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
      @keyframes sdqPop{0%{transform:scale(1)}45%{transform:scale(1.12)}100%{transform:scale(1)}}
      @keyframes sdqPulse{0%{box-shadow:0 0 0 0 var(--blue-lt)}60%{box-shadow:0 0 0 8px rgba(93,135,255,0)}100%{box-shadow:0 0 0 0 rgba(93,135,255,0)}}

      @media (max-width:900px){.sdq-topfields{grid-template-columns:1fr 1fr}.sdq-result-grid{grid-template-columns:repeat(2,1fr)}}
      @media print{.sdq-table,.sdq-editor,.sdq-row-anim,.sdq-result-card{animation:none!important}}
    `;
    document.head.appendChild(style);
  }

  /* ══════════ 9) เปิดใช้งาน ══════════ */
  function boot() {
    injectStyles();
    injectUI();
    sdqPullOpen();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.SDQ = { compute: sdqCompute, items: SDQ_ITEMS, domainMeta: DOMAIN_META, isOpen: sdqGetOpen, setOpen: sdqSetOpen };
  console.log('🧠 แบบประเมิน SDQ (ฉบับครู) พร้อมใช้งาน');
})();
