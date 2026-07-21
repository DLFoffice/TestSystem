/* ============================================================
   21-detail-ui.js — จัดหมวดหมู่หน้ารายละเอียดนักเรียนใหม่
   ------------------------------------------------------------
   ปัญหาเดิม
     • 7 แท็บ แต่แท็บ "ที่อยู่" และ "ผู้ปกครอง" มีฟิลด์ซ้ำกับที่อยู่ใน
       แท็บ "ข้อมูลส่วนตัว" ทุกช่อง — แก้ที่หนึ่ง อีกที่ไม่อัปเดตตาม
     • แท็บแรกยาว 6 ส่วนรวด (ประวัติ · ภูมิลำเนา · โรงเรียน · พฤติกรรม · พี่เลี้ยง · รูป)
     • ไม่มีที่ไหนบอกภาพรวมของเด็ก 1 คน — ต้องไล่เปิดทีละแท็บ

   โครงใหม่ (5 แท็บ ไม่มีฟิลด์ซ้ำ)
     🧭 ภาพรวม            สรุป + ไทม์ไลน์ภาคเรียน + ข้อมูลที่ยังขาด
     👤 ประวัติ & ที่อยู่   ประวัติ · ผู้ปกครอง · ภูมิลำเนา · รูปภาพ
     🎓 การศึกษา          โรงเรียน · ประวัติ GPA · พฤติกรรม
     💰 การเงิน            บัญชีธนาคาร · ประวัติการเบิกจ่าย
     📋 พี่เลี้ยง & แบบฟอร์ม  พี่เลี้ยง · สถานะแบบฟอร์มรายภาคเรียน

   ใช้ซ้ำ renderSchoolPanel / renderGpaPanel / renderPaymentPanel เดิมทั้งดุ้น
   (แค่จัดกลุ่มการแสดงผลใหม่) → ความเสี่ยงต่ำ ไม่มีการย้ายตรรกะบันทึกข้อมูล

   ต้องโหลดหลัง 07-student-detail.js และ 19-term-system.js
   ============================================================ */
(function () {
  'use strict';

  /* แต่ละแท็บ = ชุดของ panel เดิม (เรียงตามลำดับที่จะแสดง) */
  const GROUPS = [
    { icon: '🧭', label: 'ภาพรวม', panels: [7] },
    { icon: '👤', label: 'ประวัติ & ที่อยู่', panels: [0] },
    { icon: '🎓', label: 'การศึกษา', panels: [6, 5, 2] },
    { icon: '💰', label: 'การเงิน', panels: [3, 4] },
    { icon: '📋', label: 'พี่เลี้ยง & แบบฟอร์ม', panels: [1] }
  ];
  const ORDER = [7, 0, 6, 5, 2, 3, 4, 1];   // ลำดับ DOM ให้ตรงกับลำดับในกลุ่ม
  let activeGroup = 0;

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const money = n => (typeof fmt === 'function' ? fmt(n) : n);

  /* ══════════ โครงกระดูก: สร้างแท็บใหม่ + จัดลำดับ panel ══════════ */
  function buildShell() {
    const body = document.querySelector('#student-modal .modal-body');
    const tabs = $('modal-tabs');
    if (!body || !tabs) return;

    if (!$('st-panel-7')) {
      const p = document.createElement('div');
      p.id = 'st-panel-7'; p.className = 'detail-panel';
      body.appendChild(p);
    }
    ORDER.forEach(i => { const el = $('st-panel-' + i); if (el) body.appendChild(el); });

    tabs.innerHTML = GROUPS.map((g, i) =>
      `<button class="detail-tab${i === 0 ? ' active' : ''}" data-group="${i}">${g.icon} ${g.label}</button>`
    ).join('');
    tabs.querySelectorAll('.detail-tab').forEach(b =>
      b.onclick = () => showGroup(+b.dataset.group));
  }

  function showGroup(gi) {
    activeGroup = gi;
    const tabs = $('modal-tabs');
    if (!tabs) return;
    tabs.querySelectorAll('.detail-tab').forEach((b, i) => b.classList.toggle('active', i === gi));
    for (let i = 0; i <= 7; i++) {
      const el = $('st-panel-' + i);
      if (el) el.classList.toggle('active', GROUPS[gi].panels.includes(i));
    }
    const body = document.querySelector('#student-modal .modal-body');
    if (body) body.scrollTop = 0;
  }
  window.sdxShowGroup = showGroup;

  // ปุ่ม "แก้ไข" จาก GPA Sheet เคยส่งชื่อแท็บเก่ามา — แปลงเป็นกลุ่มใหม่
  window.switchTabByName = function (name) {
    const map = { 'GPA': 2, 'ผลการเรียน': 2, 'การศึกษา': 2, 'โรงเรียน': 2,
      'ที่อยู่': 1, 'ผู้ปกครอง': 1, 'ส่วนตัว': 1, 'ประวัติ': 1,
      'ธนาคาร': 3, 'การเงิน': 3, 'พี่เลี้ยง': 4, 'แบบฟอร์ม': 4 };
    for (const k in map) if (String(name).includes(k)) return showGroup(map[k]);
    showGroup(0);
  };
  window.switchTab = function (prefix, i, btn) {   // กันโค้ดเก่าที่ยังเรียกอยู่
    if (prefix === 'st') showGroup(0);
  };

  function secHead(icon, title, sub) {
    return `<div class="sdx-sec-head"><span class="sdx-sec-icon">${icon}</span>
      <span class="sdx-sec-title">${title}</span>
      ${sub ? `<span class="sdx-sec-sub">${sub}</span>` : ''}</div>`;
  }

  /* ══════════ ข้อมูลที่ยังขาด ══════════ */
  const CHECKS = [
    { g: 1, label: 'เลขบัตรประชาชน 13 หลัก', ok: s => String(s.id || '').replace(/\D/g, '').length === 13 },
    { g: 1, label: 'วันเดือนปีเกิด', ok: s => !!s.dob },
    { g: 1, label: 'ชื่อผู้ปกครอง', ok: s => !!s.parent },
    { g: 1, label: 'เบอร์ติดต่อ (นักเรียนหรือผู้ปกครอง)', ok: s => !!(s.phone || s.parentPhone) },
    { g: 1, label: 'ที่อยู่ (ตำบล · อำเภอ · จังหวัด)', ok: s => { const a = s.addr || {}; return !!(a.tambon && a.amphoe && a.province); } },
    { g: 2, label: 'โรงเรียนและ GPA ชั้น ป.6', ok: s => !!(s.school_p6 && s.gpa_p6) },
    { g: 2, label: 'โรงเรียนปัจจุบัน', ok: s => !!s.school_m1 },
    { g: 2, label: 'ผลการเรียนอย่างน้อย 1 ภาคเรียน', ok: s => (s.semGpa || []).length > 0 },
    { g: 3, label: 'เลขที่บัญชีนักเรียน', ok: s => !!(s.bank || {}).accNoSt },
    { g: 3, label: 'ชื่อบัญชีนักเรียน', ok: s => !!(s.bank || {}).accNameSt },
    { g: 4, label: 'ชื่อและเบอร์พี่เลี้ยง', ok: s => { const m = s.mentor || {}; return !!(m.firstName && m.phone); } }
  ];

  /* ══════════ ไทม์ไลน์ภาคเรียน (จุดเด่นของหน้านี้) ══════════ */
  function termsOf(s) {
    const set = new Set();
    (s.semGpa || []).forEach(g => g.term && set.add(g.term));
    (s.semPayments || []).forEach(p => p.term && set.add(p.term));
    if (s.forms) Object.keys(s.forms).forEach(t => set.add(t));
    const key = t => { const m = String(t).match(/(\d)\/(\d{4})/); return m ? +m[2] * 10 + +m[1] : -1; };
    return [...set].sort((a, b) => key(a) - key(b));
  }
  const FORM_ST = { none: ['ยังไม่กรอก', 'b-red'], partial: ['กรอกบางส่วน', 'b-amber'], filled: ['กรอกครบ', 'b-blue'], submitted: ['ส่งแล้ว', 'b-green'] };

  function termSpine(s, idx) {
    const terms = termsOf(s);
    if (!terms.length) return `<div class="sdx-empty">ยังไม่มีข้อมูลภาคเรียน — เพิ่มผลการเรียนได้ที่แท็บ
      <button class="sdx-link" onclick="sdxShowGroup(2)">🎓 การศึกษา</button></div>`;
    const active = (window.Term && Term.active()) || '';
    return `<div class="sdx-spine">${terms.map(t => {
      const g = (s.semGpa || []).find(x => x.term === t);
      const p = (s.semPayments || []).find(x => x.term === t);
      const pay = p ? (p.p1 || 0) + (p.p2 || 0) : 0;
      const st1 = window.Term ? Term.state(s, 'form1', t) : 'none';
      const st2 = window.Term ? Term.state(s, 'form2', t) : 'none';
      const gv = g && g.gpa > 0 ? g.gpa : null;
      return `<div class="sdx-term${t === active ? ' is-active' : ''}">
        <div class="sdx-term-head">${t}${t === active ? '<span class="sdx-now">กำลังใช้งาน</span>' : ''}</div>
        <div class="sdx-term-gpa" style="color:${gv && typeof gpaColor === 'function' ? gpaColor(gv) : 'var(--text3)'}">${gv ? gv.toFixed(2) : '—'}</div>
        <div class="sdx-term-row">${g && g.riskLevel ? `<span class="${riskBadge(g.riskLevel)}">${g.riskLevel}</span>` : '<span class="badge b-gray">ไม่มีข้อมูล</span>'}</div>
        <div class="sdx-term-pay">${pay ? money(pay) + ' บาท' : 'ยังไม่เบิกจ่าย'}</div>
        <div class="sdx-term-forms">
          <span class="badge ${FORM_ST[st1][1]}">ฟอร์ม 1 · ${FORM_ST[st1][0]}</span>
          <span class="badge ${FORM_ST[st2][1]}">ฟอร์ม 2 · ${FORM_ST[st2][0]}</span>
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  /* ══════════ แท็บภาพรวม ══════════ */
  function renderOverview(idx) {
    const s = DB.students[idx];
    const g = getLatestGpa(s) || {};
    if (g.gpa) g.gpa = Number(g.gpa);
    const totalPay = (s.semPayments || []).reduce((a, p) => a + (p.p1 || 0) + (p.p2 || 0), 0);
    const delta = (s.gpa_p6 && g.gpa) ? (g.gpa - s.gpa_p6) : null;
    const missing = CHECKS.filter(c => !c.ok(s));
    const done = CHECKS.length - missing.length;
    const pct = Math.round(done / CHECKS.length * 100);

    const tel = (label, num, who) => num
      ? `<a class="sdx-call" href="tel:${esc(String(num).replace(/[^\d+]/g, ''))}">
          <span class="sdx-call-who">${who}</span><span class="sdx-call-num">${esc(num)}</span></a>`
      : `<div class="sdx-call is-off"><span class="sdx-call-who">${who}</span><span class="sdx-call-num">ยังไม่มีเบอร์</span></div>`;

    const m = s.mentor || {};
    $('st-panel-7').innerHTML = `
      <div class="sdx-stats">
        <div class="sdx-stat">
          <div class="sdx-stat-lbl">GPA ล่าสุด${g.term ? ' · ' + g.term : ''}</div>
          <div class="sdx-stat-val" style="color:${g.gpa && typeof gpaColor === 'function' ? gpaColor(g.gpa) : 'var(--text3)'}">${g.gpa ? g.gpa.toFixed(2) : '—'}</div>
          <div class="sdx-stat-foot">${delta !== null
            ? `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(2)} เทียบ ป.6 (${s.gpa_p6})`
            : 'ยังไม่มี GPA ป.6 ให้เทียบ'}</div>
        </div>
        <div class="sdx-stat">
          <div class="sdx-stat-lbl">ระดับความเสี่ยง</div>
          <div class="sdx-stat-val" style="font-size:20px;padding-top:6px">${g.riskLevel ? `<span class="${riskBadge(g.riskLevel)}" style="font-size:14px">${g.riskLevel}</span>` : '<span class="badge b-gray">ยังไม่ประเมิน</span>'}</div>
          <div class="sdx-stat-foot">${g.hasObstacle ? '⚠️ ' + (g.obstacleType || 'มีอุปสรรค') : 'ไม่พบอุปสรรคที่บันทึกไว้'}</div>
        </div>
        <div class="sdx-stat">
          <div class="sdx-stat-lbl">เงินทุนสะสม</div>
          <div class="sdx-stat-val" style="color:var(--teal)">${money(totalPay)}</div>
          <div class="sdx-stat-foot">${(s.semPayments || []).length} ภาคเรียนที่เบิกจ่ายแล้ว</div>
        </div>
        <div class="sdx-stat">
          <div class="sdx-stat-lbl">ความครบถ้วนของข้อมูล</div>
          <div class="sdx-stat-val" style="color:${pct === 100 ? 'var(--green)' : pct >= 70 ? 'var(--blue)' : 'var(--red)'}">${pct}%</div>
          <div class="sdx-bar"><div class="sdx-bar-fill" style="width:${pct}%;background:${pct === 100 ? 'var(--green)' : pct >= 70 ? 'var(--blue)' : 'var(--red)'}"></div></div>
        </div>
      </div>

      ${secHead('📅', 'ไทม์ไลน์ภาคเรียน', 'ผลการเรียน · เงินทุน · สถานะแบบฟอร์ม เรียงตามเวลา')}
      ${termSpine(s, idx)}

      ${secHead('☎️', 'ติดต่อด่วน')}
      <div class="sdx-calls">
        ${tel('s', s.phone, 'นักเรียน')}
        ${tel('p', s.parentPhone, 'ผู้ปกครอง · ' + (s.parent || 'ไม่ระบุชื่อ'))}
        ${tel('m', m.phone, 'พี่เลี้ยง · ' + ([m.firstName, m.lastName].filter(Boolean).join(' ') || 'ไม่ระบุชื่อ'))}
      </div>

      ${secHead(missing.length ? '📌' : '✅', missing.length ? `ข้อมูลที่ยังขาด (${missing.length} รายการ)` : 'ข้อมูลครบถ้วนทุกรายการ')}
      ${missing.length
        ? `<div class="sdx-missing">${missing.map(c =>
            `<button class="sdx-miss" onclick="sdxShowGroup(${c.g})">
               <span class="sdx-miss-dot"></span>${c.label}
               <span class="sdx-miss-go">ไปกรอก →</span></button>`).join('')}</div>`
        : `<div class="sdx-empty" style="color:var(--green)">ครบทั้ง ${CHECKS.length} รายการ พร้อมใช้ทำรายงาน</div>`}`;
  }

  /* ══════════ แท็บประวัติ & ที่อยู่ (ยกฟิลด์เดิมมา ตัดที่ซ้ำออก) ══════════ */
  function renderProfile(idx) {
    const s = DB.students[idx], a = s.addr || {}, D = `DB.students[${idx}]`;
    $('st-panel-0').innerHTML = `
      ${secHead('👤', 'ประวัตินักเรียน')}
      <div class="form-grid">
        <div class="fg"><label>ชื่อ-สกุล</label><input value="${esc(s.name)}" onchange="${D}.name=this.value;refreshModalHeader(${idx})"></div>
        <div class="fg"><label>ชื่อเล่น</label><input value="${esc(s.nickname)}" onchange="${D}.nickname=this.value;refreshModalHeader(${idx})"></div>
        <div class="fg"><label>เลขบัตรประชาชน</label><input id="id-input-${idx}" value="${maskId(s.id)}" data-real-value="${esc(s.id)}"
          style="font-family:'Sarabun',monospace" title="คลิกเพื่อแก้ไข"
          onfocus="this.value=this.dataset.realValue;this.select()"
          onblur="this.dataset.realValue=this.value.replace(/\\D/g,'');this.value=maskId(this.value)"
          onchange="this.dataset.realValue=this.value.replace(/\\D/g,'')"></div>
        <div class="fg"><label>วันเดือนปีเกิด</label><input type="date" value="${esc(s.dob)}" onchange="${D}.dob=this.value;this.closest('.form-grid').querySelector('input[readonly]').value=calcAge(this.value)"></div>
        <div class="fg"><label>อายุ</label><input readonly value="${calcAge(s.dob)}" style="background:var(--bg2);color:var(--text2);cursor:default" title="คำนวณจากวันเกิด"></div>
        <div class="fg"><label>โทรศัพท์นักเรียน</label><input value="${esc(s.phone)}" onchange="${D}.phone=this.value"></div>
      </div>

      ${secHead('👨‍👩‍👧', 'ผู้ปกครอง')}
      <div class="form-grid">
        <div class="fg fg-full"><label>ชื่อ-สกุล ผู้ปกครอง</label><input value="${esc(s.parent)}" onchange="${D}.parent=this.value"></div>
        <div class="fg"><label>โทรศัพท์ผู้ปกครอง</label><input value="${esc(s.parentPhone)}" onchange="${D}.parentPhone=this.value"></div>
      </div>

      ${secHead('🏡', 'ภูมิลำเนา (บ้านเกิด)', 'ที่อยู่ตามทะเบียนบ้าน ใช้ในเอกสารสัญญาทุน')}
      <div class="form-grid">
        <div class="fg"><label>สัญชาติ</label><input value="${esc(a.nat)}" onchange="${D}.addr.nat=this.value"></div>
        <div class="fg"><label>ศาสนา</label><input value="${esc(a.rel)}" onchange="${D}.addr.rel=this.value"></div>
        <div class="fg"><label>บ้านเลขที่</label><input value="${esc(a.no)}" placeholder="เช่น 123" onchange="${D}.addr.no=this.value"></div>
        <div class="fg"><label>หมู่ที่</label><input value="${esc(a.moo)}" onchange="${D}.addr.moo=this.value"></div>
        <div class="fg"><label>ชื่อหมู่บ้าน</label><input value="${esc(a.village)}" onchange="${D}.addr.village=this.value"></div>
        <div class="fg"><label>ตำบล</label><input value="${esc(a.tambon)}" onchange="${D}.addr.tambon=this.value"></div>
        <div class="fg"><label>อำเภอ</label><input value="${esc(a.amphoe)}" onchange="${D}.addr.amphoe=this.value"></div>
        <div class="fg"><label>จังหวัด</label><input value="${esc(a.province)}" onchange="${D}.addr.province=this.value"></div>
        <div class="fg"><label>รหัสไปรษณีย์</label><input value="${esc(a.zip)}" onchange="${D}.addr.zip=this.value"></div>
      </div>

      ${secHead('📷', 'รูปภาพนักเรียน')}
      <div class="photo-section">
        <div class="photo-preview-box">
          <div id="photo-preview-${idx}">
            ${s.photoUrl
              ? `<img src="${fixDriveUrl(s.photoUrl)}" onerror="this.style.display='none';this.nextSibling.style.display='flex'" style="width:100px;height:100px;border-radius:var(--rad-lg);object-fit:cover;object-position:top center;border:2px solid var(--border2)"><div class="photo-avatar-lg" style="display:none">${initials(s.name)}</div>`
              : `<div class="photo-avatar-lg">${initials(s.name)}</div>`}
          </div>
          ${s.photoUrl ? `<button class="btn btn-sm btn-danger" style="margin-top:6px;width:100%" onclick="removePhoto(${idx})">🗑 ลบรูป</button>` : ''}
        </div>
        <div class="photo-controls">
          <div class="photo-source-tabs">
            <button class="photo-source-tab active" onclick="switchPhotoSource('upload',this,${idx})">📁 อัปโหลดไฟล์</button>
            <button class="photo-source-tab" onclick="switchPhotoSource('url',this,${idx})">🔗 URL</button>
          </div>
          <div id="photo-src-upload-${idx}">
            <div class="photo-upload-zone" ondragover="event.preventDefault();this.style.borderColor='var(--blue)'" ondragleave="this.style.borderColor=''" ondrop="handlePhotoDrop(event,${idx})">
              <input type="file" accept="image/*" onchange="handlePhotoFile(this,${idx})">
              <div class="upload-icon">📷</div>
              <div class="upload-text">คลิกหรือลากรูปภาพมาวาง</div>
              <div class="upload-sub">JPG, PNG, WEBP ขนาดไม่เกิน 5MB</div>
            </div>
          </div>
          <div id="photo-src-url-${idx}" style="display:none">
            <input style="width:100%;padding:8px 10px;border-radius:var(--rad);border:1px solid var(--border2);font-size:12px;font-family:'Sarabun',sans-serif"
              value="${esc(s.photoUrl)}" placeholder="https://drive.google.com/uc?export=view&id=..."
              onchange="setPhotoUrl(${idx},this.value)">
            <div class="photo-size-note" style="margin-top:4px">วาง URL จาก Google Drive หรือลิงก์รูปภาพโดยตรง</div>
          </div>
        </div>
      </div>`;
  }

  /* ══════════ แท็บพฤติกรรม (อยู่ในกลุ่มการศึกษา) ══════════ */
  function renderBehavior(idx) {
    const s = DB.students[idx];
    $('st-panel-2').innerHTML = `
      ${secHead('📝', 'พฤติกรรมนักเรียน / หมายเหตุ', 'บันทึกสิ่งที่ครูสังเกตเห็น ใช้ประกอบการประเมินความเสี่ยง')}
      <div class="form-grid"><div class="fg fg-full">
        <textarea placeholder="เช่น ขาดเรียนบ่อยช่วงต้นภาคเรียน · ตั้งใจเรียนวิชาคณิตศาสตร์ · ช่วยงานที่บ้านหลังเลิกเรียน"
          onchange="DB.students[${idx}].behavior=this.value">${esc(s.behavior)}</textarea>
      </div></div>`;
  }

  /* ══════════ แท็บพี่เลี้ยง & แบบฟอร์ม ══════════ */
  function renderMentorForms(idx) {
    const s = DB.students[idx], m = s.mentor || {}, D = `DB.students[${idx}]`;
    const mk = f => `if(!${D}.mentor)${D}.mentor={};${D}.mentor.${f}=this.value`;
    const terms = termsOf(s);
    const active = (window.Term && Term.active()) || '';

    const formRows = terms.length && window.Term
      ? terms.map(t => {
          const st1 = Term.state(s, 'form1', t), st2 = Term.state(s, 'form2', t);
          const p1 = Math.round(Term.progress(s, 'form1', t) * 100), p2 = Math.round(Term.progress(s, 'form2', t) * 100);
          return `<tr${t === active ? ' class="sdx-row-now"' : ''}>
            <td><b>${t}</b>${t === active ? ' <span class="sdx-now">กำลังใช้งาน</span>' : ''}</td>
            <td><span class="badge ${FORM_ST[st1][1]}">${FORM_ST[st1][0]}</span> <span class="sdx-pct">${p1}%</span></td>
            <td><span class="badge ${FORM_ST[st2][1]}">${FORM_ST[st2][0]}</span> <span class="sdx-pct">${p2}%</span></td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="3" class="sdx-empty">ยังไม่มีแบบฟอร์มของนักเรียนคนนี้</td></tr>`;

    $('st-panel-1').innerHTML = `
      ${secHead('👨‍🏫', 'พี่เลี้ยง', 'ครูผู้ดูแลนักเรียนทุนคนนี้โดยตรง')}
      <div class="form-grid">
        <div class="fg"><label>ชื่อ</label><input value="${esc(m.firstName)}" placeholder="ชื่อ" onchange="${mk('firstName')}"></div>
        <div class="fg"><label>สกุล</label><input value="${esc(m.lastName)}" placeholder="นามสกุล" onchange="${mk('lastName')}"></div>
        <div class="fg"><label>เบอร์โทร</label><input value="${esc(m.phone)}" placeholder="08x-xxx-xxxx" onchange="${mk('phone')}"></div>
        <div class="fg"><label>ตำแหน่ง</label><input value="${esc(m.position)}" placeholder="เช่น ครูที่ปรึกษา" onchange="${mk('position')}"></div>
      </div>

      ${secHead('📋', 'สถานะแบบฟอร์มรายภาคเรียน')}
      <div class="tbl-wrap"><table>
        <thead><tr><th>ภาคเรียน</th><th>แบบฟอร์ม 1</th><th>แบบฟอร์ม 2</th></tr></thead>
        <tbody>${formRows}</tbody>
      </table></div>
      <div style="margin-top:12px">
        <button class="btn btn-primary" onclick="sdxOpenForm(${idx})">📝 เปิดแบบฟอร์มของนักเรียนคนนี้</button>
      </div>`;
  }

  window.sdxOpenForm = function (idx) {
    closeModal('student-modal');
    if (typeof trOpenForm === 'function') trOpenForm(idx);
  };

  /* ══════════ แทนที่ openStudentDetail ══════════ */
  const _origOpen = window.openStudentDetail;
  window.openStudentDetail = function (idx) {
    const s = DB.students[idx];
    if (!s) return;
    if (typeof ensureStudentShape === 'function') ensureStudentShape(s);
    editingIndex = idx;
    buildShell();

    $('student-modal-title').textContent = `${s.name || '(ไม่มีชื่อ)'} ${s.nickname ? '(' + s.nickname + ')' : ''}`;
    refreshModalHeader(idx);

    renderOverview(idx);
    renderProfile(idx);
    renderBehavior(idx);
    renderMentorForms(idx);

    // แท็บการเงิน — บัญชีธนาคาร (panel 3) + ประวัติการเบิกจ่าย (panel 4)
    const b = s.bank || {}, D = `DB.students[${idx}]`;
    $('st-panel-3').innerHTML = `
      ${secHead('🏦', 'บัญชีนักเรียน', 'บัญชีที่ใช้รับเงินทุนโดยตรง')}
      <div class="form-grid">
        <div class="fg"><label>เลขสัญญา</label><input value="${esc(b.contract)}" onchange="${D}.bank.contract=this.value"></div>
        <div class="fg"><label>วันที่สัญญา</label><input value="${fmtThaiDate(b.contractDate)}" onchange="${D}.bank.contractDate=this.value"></div>
        <div class="fg"><label>ธนาคาร</label><input value="${esc(b.bankSt)}" onchange="${D}.bank.bankSt=this.value"></div>
        <div class="fg"><label>สาขา</label><input value="${esc(b.branchSt)}" onchange="${D}.bank.branchSt=this.value"></div>
        <div class="fg"><label>เลขที่บัญชี</label><input value="${esc(b.accNoSt)}" onchange="${D}.bank.accNoSt=this.value"></div>
        <div class="fg fg-full"><label>ชื่อบัญชี</label><input value="${esc(b.accNameSt)}" onchange="${D}.bank.accNameSt=this.value"></div>
      </div>
      ${secHead('🏛️', 'บัญชีโรงเรียน', 'ใช้เมื่อโครงการโอนผ่านโรงเรียน')}
      <div class="form-grid">
        <div class="fg"><label>ธนาคาร</label><input value="${esc(b.bankSch)}" onchange="${D}.bank.bankSch=this.value"></div>
        <div class="fg"><label>สาขา</label><input value="${esc(b.branchSch)}" onchange="${D}.bank.branchSch=this.value"></div>
        <div class="fg"><label>เลขที่บัญชี</label><input value="${esc(b.accNoSch)}" onchange="${D}.bank.accNoSch=this.value"></div>
        <div class="fg fg-full"><label>ชื่อบัญชี</label><input value="${esc(b.accNameSch)}" onchange="${D}.bank.accNameSch=this.value"></div>
      </div>`;

    renderPaymentPanel(idx);
    renderGpaPanel(idx);
    renderSchoolPanel(idx);

    // เติมหัวข้อให้ panel ที่ยืมมาจากไฟล์เดิม
    $('st-panel-4').insertAdjacentHTML('afterbegin', secHead('💵', 'ประวัติการเบิกจ่ายรายภาคเรียน'));
    $('st-panel-5').insertAdjacentHTML('afterbegin', secHead('📊', 'ผลการเรียนรายภาคเรียน', 'กดที่หัวข้อภาคเรียนเพื่อกางรายละเอียด'));
    $('st-panel-6').insertAdjacentHTML('afterbegin', secHead('🏫', 'โรงเรียนและที่ตั้ง'));

    $('student-modal').classList.add('open');
    showGroup(0);
  };
  if (!_origOpen) console.warn('21-detail-ui: ไม่พบ openStudentDetail เดิม');

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildShell);
  else buildShell();

  console.log('🎨 21-detail-ui.js: จัดหมวดหมู่หน้ารายละเอียดนักเรียนเป็น 5 แท็บ');
})();
