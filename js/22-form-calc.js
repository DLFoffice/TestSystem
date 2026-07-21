/* ============================================================
   22-form-calc.js — คำนวณอัตโนมัติในแบบฟอร์ม
   1) ตารางผลการเรียน: แถว "คะแนนเฉลี่ย" และ "คะแนนเฉลี่ยสะสม" คิดให้อัตโนมัติ
   2) สรุปยอดเงินทุนการศึกษา: เบิกจ่ายรวม / ส่วนที่ 1-3 / ยอดคงเหลือ คิดจากตารางให้อัตโนมัติ
   3) แสดงตัวเลขเงินพร้อมเครื่องหมายจุลภาค (,)
   ============================================================ */
(function () {
  'use strict';

  // แถวที่เป็น "ค่าเฉลี่ย" ของแต่ละฟอร์ม (form1 ใช้ id 'avg', form2 ใช้ 'avg2')
  const AVG_ROW = { form1: 'avg', form2: 'avg2' };
  const CUM_ROW = 'cumavg';
  const SRC_ROWS = ['term1', 'term2'];

  // ช่องเงินที่ "คิดอัตโนมัติ" (อ่านอย่างเดียว) ในฟอร์ม 2
  //   - เบิกจ่ายไปแล้วรวมทั้งสิ้น = ส่วนที่ 1 + 2 + 3
  //   - ยอดคงเหลือ = ได้รับเงินทุนรวมทั้งสิ้น − เบิกจ่ายไปแล้วรวมทั้งสิ้น
  // ส่วนที่ 1-3 และ ได้รับเงินทุนรวมทั้งสิ้น = ครูพิมพ์เอง
  const MONEY_COMPUTED = ['total_disbursed', 'balance'];

  /* ---------- ตัวช่วยเรื่องตัวเลข ---------- */
  function num(v) {
    if (v == null) return NaN;
    const s = String(v).replace(/,/g, '').trim();
    if (s === '') return NaN;
    const n = Number(s);
    return isFinite(n) ? n : NaN;
  }
  function fmtMoney(v) {
    const n = (typeof v === 'number') ? v : num(v);
    if (!isFinite(n)) return '';
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  function fmtGpa(v) {
    const n = (typeof v === 'number') ? v : num(v);
    if (!isFinite(n)) return '';
    return n.toFixed(2);
  }
  window.sfFmtMoney = fmtMoney;
  window.sfFmtGpa = fmtGpa;
  window.sfNum = num;

  /* ---------- คำนวณลงใน store ---------- */
  // ตารางผลการเรียน: avg = เฉลี่ยของภาคเรียนที่ 1,2 ต่อคอลัมน์ · cumavg = เฉลี่ยสะสมของ avg จากคอลัมน์แรกถึงคอลัมน์นั้น
  function computeMatrix(store, field, avgRow) {
    const val = store && store[field.id];
    if (!val || !Array.isArray(val.cols)) return;
    if (!val.values) val.values = {};
    if (!val.values[avgRow]) val.values[avgRow] = {};
    if (!val.values[CUM_ROW]) val.values[CUM_ROW] = {};
    const t1 = val.values[SRC_ROWS[0]] || {};
    const t2 = val.values[SRC_ROWS[1]] || {};
    let cumSum = 0, cumCount = 0;
    val.cols.forEach(c => {
      const parts = [num(t1[c._id]), num(t2[c._id])].filter(isFinite);
      const avg = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : NaN;
      val.values[avgRow][c._id] = isFinite(avg) ? fmtGpa(avg) : '';
      if (isFinite(avg)) { cumSum += avg; cumCount++; }
      val.values[CUM_ROW][c._id] = cumCount ? fmtGpa(cumSum / cumCount) : '';
    });
  }

  // สรุปยอดเงิน: เบิกจ่ายรวม = ส่วนที่ 1+2+3 (ครูพิมพ์เอง) · ยอดคงเหลือ = ได้รับ − เบิกจ่าย
  function computeMoney(store) {
    const p1 = num(store.part1_amount), p2 = num(store.part2_amount), p3 = num(store.part3_amount);
    const parts = [p1, p2, p3].filter(isFinite);
    const disbursed = parts.length ? parts.reduce((a, b) => a + b, 0) : NaN;
    store.total_disbursed = isFinite(disbursed) ? String(disbursed) : '';
    const recv = num(store.total_received);
    store.balance = isFinite(recv) ? String(recv - (isFinite(disbursed) ? disbursed : 0)) : '';
  }

  // คำนวณค่าที่ derive ได้ทั้งหมดของฟอร์มลง store (ให้ทั้งหน้าจอและการพิมพ์ใช้ค่าเดียวกัน)
  window.sfRecomputeDerived = function (formKey) {
    formKey = formKey || (window.sfState && sfState.formKey) || 'form2';
    const student = (typeof sfGetStudent === 'function') ? sfGetStudent() : null;
    if (!student || !student[formKey]) return;
    const store = student[formKey];
    const field = (typeof sfFindField === 'function') ? sfFindField(formKey, 'grades_matrix') : null;
    if (field) computeMatrix(store, field, AVG_ROW[formKey] || 'avg2');
    if (formKey === 'form2') computeMoney(store);
  };

  /* ---------- แทนที่การเรนเดอร์ตาราง matrix ให้แถวค่าเฉลี่ยเป็นแบบอ่านอย่างเดียว ---------- */
  const _origRenderMatrix = window.sfRenderMatrix;
  window.sfRenderMatrix = function (formKey, field) {
    const value = sfGetValue(formKey, field.id, field);
    const isGrades = field.id === 'grades_matrix';
    if (isGrades) computeMatrix(value ? { [field.id]: value } : {}, field, AVG_ROW[formKey] || 'avg2');
    if (!isGrades || typeof _origRenderMatrix !== 'function') {
      // ฟิลด์ matrix อื่น ๆ ใช้ของเดิม
      return (typeof _origRenderMatrix === 'function') ? _origRenderMatrix(formKey, field) : '';
    }
    const cols = value.cols;
    const computedRows = { [AVG_ROW[formKey] || 'avg2']: 1, [CUM_ROW]: 1 };
    const thead = `<th class="sf-th-rowlabel">ภาคเรียน</th>`
      + cols.map(c => `<th><input class="sf-input sf-col-head" type="text" data-sf-matrix="${field.id}" data-sf-colhead="${c._id}" value="${sfEscapeHtml(c.label)}" placeholder="ระดับชั้น/ปี"></th>`).join('')
      + `<th class="sf-th-x"></th>`;
    const trs = field.rows.map(r => {
      const computed = !!computedRows[r.id];
      const tds = cols.map(c => {
        const v = (value.values[r.id] && value.values[r.id][c._id]) || '';
        if (computed) {
          return `<td><input class="sf-input sf-cell-input sf-computed" type="text" readonly tabindex="-1"
            data-sf-cmatrix="${field.id}" data-sf-crow="${r.id}" data-sf-ccol="${c._id}" value="${sfEscapeHtml(v)}"></td>`;
        }
        return `<td><input class="sf-input sf-cell-input" type="text" inputmode="decimal" data-sf-matrix="${field.id}" data-sf-mrow="${r.id}" data-sf-mcol="${c._id}" value="${sfEscapeHtml(v)}"></td>`;
      }).join('');
      const lblExtra = computed ? ' <span class="sf-auto-tag">คิดให้อัตโนมัติ</span>' : '';
      return `<tr class="${computed ? 'sf-row-computed' : ''}"><td class="sf-td-rowlabel">${sfEscapeHtml(r.label)}${lblExtra}</td>${tds}<td></td></tr>`;
    }).join('');
    return `<div class="sf-table-wrap" id="sf-matrix-${field.id}">
      <table class="sf-data-table"><thead><tr>${thead}</tr></thead><tbody>${trs}</tbody></table>
      <button type="button" class="sf-btn-add" data-sf-action="add-col" data-sf-matrix="${field.id}">+ เพิ่มคอลัมน์ระดับชั้น/ปี</button></div>`;
  };

  /* ---------- ทำให้ช่องเงินสรุปเป็นแบบอ่านอย่างเดียว + ใส่จุลภาค ---------- */
  function decorateMoneyInputs() {
    if (!window.sfState || sfState.formKey !== 'form2') return;
    const student = (typeof sfGetStudent === 'function') ? sfGetStudent() : null;
    if (!student || !student.form2) return;
    const store = student.form2;
    computeMoney(store);
    const TIP = {
      total_disbursed: 'คำนวณอัตโนมัติ = ส่วนที่ 1 + ส่วนที่ 2 + ส่วนที่ 3',
      balance: 'คำนวณอัตโนมัติ = ได้รับเงินทุนรวมทั้งสิ้น − เบิกจ่ายไปแล้วรวมทั้งสิ้น'
    };
    MONEY_COMPUTED.forEach(id => {
      const inp = document.querySelector(`.sf-editor [data-sf-field="${id}"]`);
      if (!inp) return;
      inp.type = 'text';
      inp.readOnly = true;
      inp.tabIndex = -1;
      inp.classList.add('sf-computed');
      inp.value = fmtMoney(store[id]);
      inp.title = TIP[id] || 'คำนวณให้อัตโนมัติ';
      const lbl = inp.closest('.sf-item') && inp.closest('.sf-item').querySelector('.sf-label');
      if (lbl && !lbl.querySelector('.sf-auto-tag')) {
        const tag = document.createElement('span');
        tag.className = 'sf-auto-tag';
        tag.textContent = 'คิดให้อัตโนมัติ';
        lbl.appendChild(tag);
      }
    });
    // ช่อง "ได้รับเงินทุนรวมทั้งสิ้น" ยังแก้ได้ แต่โชว์ตัวช่วยจุลภาคใต้ช่อง
    const recv = document.querySelector('.sf-editor [data-sf-field="total_received"]');
    if (recv) {
      const n = num(recv.value);
      recv.title = isFinite(n) ? ('= ' + fmtMoney(n) + ' บาท') : '';
    }
  }

  /* ---------- อัปเดตค่าที่คิดอัตโนมัติในหน้าจอแบบสด (ไม่รีเฟรชทั้งหน้า เพื่อไม่ให้เคอร์เซอร์หลุด) ---------- */
  function updateComputedDom() {
    const student = (typeof sfGetStudent === 'function') ? sfGetStudent() : null;
    if (!student) return;
    const fk = (window.sfState && sfState.formKey) || 'form2';
    if (window.sfRecomputeDerived) sfRecomputeDerived(fk);
    const store = student[fk];
    if (!store) return;
    // ตาราง matrix (คะแนนเฉลี่ย/สะสม)
    document.querySelectorAll('[data-sf-cmatrix]').forEach(inp => {
      const fid = inp.getAttribute('data-sf-cmatrix');
      const rid = inp.getAttribute('data-sf-crow');
      const cid = inp.getAttribute('data-sf-ccol');
      const val = store[fid];
      const v = (val && val.values && val.values[rid] && val.values[rid][cid]) || '';
      if (inp.value !== v) inp.value = v;
    });
    // ช่องเงินสรุป — ต้องเป็น type=text ก่อนใส่ค่าที่มีจุลภาค (number input รับจุลภาคไม่ได้)
    if (fk === 'form2') {
      MONEY_COMPUTED.forEach(id => {
        const inp = document.querySelector(`.sf-editor [data-sf-field="${id}"]`);
        if (!inp) return;
        if (inp.type !== 'text') inp.type = 'text';
        inp.readOnly = true;
        inp.classList.add('sf-computed');
        inp.value = fmtMoney(store[id]);
      });
      const recv = document.querySelector('.sf-editor [data-sf-field="total_received"]');
      if (recv) { const n = num(recv.value); recv.title = isFinite(n) ? ('= ' + fmtMoney(n) + ' บาท') : ''; }
    }
  }

  /* ---------- ครอบ sfPersist ให้คิดค่าใหม่ + อัปเดตหน้าจอทุกครั้งที่มีการแก้ไข ---------- */
  const _origPersist = window.sfPersist;
  if (typeof _origPersist === 'function') {
    window.sfPersist = function () {
      const r = _origPersist.apply(this, arguments);
      try { updateComputedDom(); } catch (e) {}
      return r;
    };
  }

  /* ---------- ครอบ sfRenderPage ให้ตกแต่งช่องเงินหลังเรนเดอร์ ---------- */
  const _origRenderPage = window.sfRenderPage;
  if (typeof _origRenderPage === 'function') {
    window.sfRenderPage = function () {
      const r = _origRenderPage.apply(this, arguments);
      try { decorateMoneyInputs(); } catch (e) {}
      return r;
    };
  }

  /* ---------- ก่อนเปิดพรีวิว/พิมพ์ ให้คิดค่าล่าสุดลง store ---------- */
  const _origOpenPreview = window.sfOpenPreview;
  if (typeof _origOpenPreview === 'function') {
    window.sfOpenPreview = function () {
      try { if (window.sfRecomputeDerived) sfRecomputeDerived(sfState.formKey); } catch (e) {}
      return _origOpenPreview.apply(this, arguments);
    };
  }

  /* ---------- สไตล์เล็ก ๆ สำหรับช่องคิดอัตโนมัติ ---------- */
  const st = document.createElement('style');
  st.textContent = `
    .sf-computed{ background:#F4F6FA !important; color:#243; font-weight:600; cursor:default; }
    .sf-row-computed .sf-td-rowlabel{ font-weight:600; color:#2b6; }
    .sf-auto-tag{ display:inline-block; margin-left:6px; font-size:10px; font-weight:600; color:#0a7d3b;
      background:#e6f7ec; border:1px solid #bfe6cd; border-radius:6px; padding:0 6px; vertical-align:middle; }
  `;
  (document.head || document.documentElement).appendChild(st);

  console.log('🧮 ระบบคำนวณแบบฟอร์มอัตโนมัติพร้อมใช้งาน');
})();
