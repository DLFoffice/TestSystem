// ══════════════════════════════════════════════════════════════════════════
// สรุปผลการดำเนินงานรวมทั้งปี (ไตรมาส 1–4) ของโครงการ
// - เทียบ "งบประมาณที่อนุมัติ" กับ "ผลการใช้งบประมาณ" ของแต่ละไตรมาส (รายไตรมาส + สะสม + ร้อยละ)
// - งบประมาณรายกิจกรรม แยกยอดใช้ไปรายไตรมาส
// - ตัวชี้วัด (KPI) แยกผลรายไตรมาส พร้อมผลล่าสุด
// - ผลการดำเนินงาน / ปัญหา / แนวทางแก้ไข ของแต่ละไตรมาส
// ใช้ได้ทั้งบนหน้าเว็บ (หน้าต่างพรีวิว) และ Export PDF (แนวนอน)
//
// ข้อมูลที่ใช้: p.reportsByQuarter = {1:{...},2:{...},3:{...},4:{...}} (ดู _applyReportsToProject)
// โดย r.spent = ยอด "ใช้ไปเพิ่มในไตรมาสนั้น" และยอดสะสม = ผลรวมไตรมาส 1 ถึงไตรมาสนั้น
// ไฟล์นี้ต้องโหลดหลัง app-core.js และ app-pdf-export.js (เรียกใช้ฟังก์ชันของสองไฟล์นั้นตอนกดปุ่มเท่านั้น)
// ══════════════════════════════════════════════════════════════════════════

const _AR_QUARTERS = ['1','2','3','4'];
const _AR_STATUS_TEXT = { done:'แล้วเสร็จ', progress:'อยู่ระหว่างดำเนินการ', pending:'ยังไม่เริ่ม' };
const _AR_STATUS_COLOR = { done:'#059669', progress:'#d97706', pending:'#6b7280' };

function _arEsc(s){ s = (s===null||s===undefined) ? '' : String(s); return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _arNl2br(s){ return _arEsc(s).replace(/\n/g,'<br>'); }
function _arNum(v){ const n = Number(v); return isFinite(n) ? n : 0; }
function _arFmt(n){ return _arNum(n).toLocaleString('th-TH'); }
function _arPct(part, whole){ return whole > 0 ? (part / whole * 100) : null; }
function _arPctText(v){ return v === null ? '–' : v.toLocaleString('th-TH',{minimumFractionDigits:1, maximumFractionDigits:1}) + '%'; }
function _arKey(s){ return String(s||'').trim().replace(/\s+/g,' ').toLowerCase(); }
function _arQLabel(q){
  return (typeof Q_LABEL !== 'undefined' && Q_LABEL && Q_LABEL[q]) ? Q_LABEL[q] : ('ไตรมาส ' + q);
}
function _arGetReport(p, q){
  if (typeof getQuarterReport === 'function') return getQuarterReport(p, q);
  return (p && p.reportsByQuarter) ? (p.reportsByQuarter[String(q)] || null) : null;
}
function _arKpiObj(k){
  if (k && typeof k === 'object') return { indicator:k.indicator||'', target:k.target||'', achieved:k.achieved||'' };
  return { indicator:k||'', target:'', achieved:'' };
}

// ── รวบรวมข้อมูลทั้งหมดของโครงการสำหรับรายงานสรุปทั้งปี ─────────────────────────────
function _arBuildData(p){
  const budget = _arNum(p.budget);

  // 1) งบประมาณรายไตรมาส
  let cumulative = 0;
  const quarters = _AR_QUARTERS.map(q => {
    const r = _arGetReport(p, q);
    const spent = r ? _arNum(r.spent) : 0;
    const po = r ? _arNum(r.po) : 0;
    cumulative += spent;
    return {
      q, r, reported: !!r, spent, po,
      cumulative,
      remaining: budget - cumulative,
      pctQuarter: _arPct(spent, budget),
      pctCumulative: _arPct(cumulative, budget),
      status: r ? (r.status || 'pending') : null
    };
  });
  const totalSpent = cumulative;
  const reportedCount = quarters.filter(x => x.reported).length;
  const latest = [...quarters].reverse().find(x => x.reported) || null;

  // 2) กิจกรรม: ตั้งต้นจากแผนโครงการ แล้วเติมยอดใช้ไปของแต่ละไตรมาส (จับคู่ด้วยชื่อกิจกรรม)
  const actMap = new Map();
  const actOrder = [];
  const addAct = (name, planBudget) => {
    const k = _arKey(name);
    if (!k) return null;
    if (!actMap.has(k)) {
      actMap.set(k, { name: String(name).trim(), budget: _arNum(planBudget), q: {1:null,2:null,3:null,4:null} });
      actOrder.push(k);
    }
    return actMap.get(k);
  };
  const planActs = (typeof _getProjectPlanActivities === 'function') ? _getProjectPlanActivities(p) : [];
  planActs.forEach(a => addAct(a.name, a.budget));
  quarters.forEach(x => {
    const acts = (x.r && Array.isArray(x.r.quarterActivities)) ? x.r.quarterActivities : [];
    acts.forEach(a => {
      const row = addAct(a.name, a.budget);
      if (!row) return;
      if (!row.budget && _arNum(a.budget)) row.budget = _arNum(a.budget); // ไม่มีในแผน ใช้งบที่กรอกในรายงาน
      row.q[x.q] = (row.q[x.q] || 0) + _arNum(a.spent);
    });
  });
  const activities = actOrder.map(k => {
    const a = actMap.get(k);
    const used = _AR_QUARTERS.reduce((s,q) => s + (a.q[q] || 0), 0);
    return { ...a, used, remaining: a.budget - used, pct: _arPct(used, a.budget) };
  });

  // 3) ตัวชี้วัด: ตั้งต้นจากแผนโครงการ แล้วเติมผลของแต่ละไตรมาส (จับคู่ด้วยชื่อตัวชี้วัด)
  const kpiMap = new Map();
  const kpiOrder = [];
  const addKpi = (name) => {
    const k = _arKey(name);
    if (!k) return null;
    if (!kpiMap.has(k)) { kpiMap.set(k, { indicator: String(name).trim(), q: {1:null,2:null,3:null,4:null} }); kpiOrder.push(k); }
    return kpiMap.get(k);
  };
  const planKpis = (typeof _getProjectPlanKpis === 'function') ? _getProjectPlanKpis(p) : [];
  planKpis.forEach(k => addKpi(k));
  quarters.forEach(x => {
    const ks = (x.r && Array.isArray(x.r.kpiResults)) ? x.r.kpiResults.map(_arKpiObj) : [];
    ks.forEach(k => {
      const row = addKpi(k.indicator);
      if (row) row.q[x.q] = { target: k.target, achieved: k.achieved };
    });
  });
  const kpis = kpiOrder.map(k => {
    const row = kpiMap.get(k);
    // ผลล่าสุด = ไตรมาสล่าสุดที่มีการประเมินแล้ว (บรรลุ/ไม่บรรลุ)
    let final = null;
    for (let i = _AR_QUARTERS.length - 1; i >= 0; i--) {
      const v = row.q[_AR_QUARTERS[i]];
      if (v && (v.achieved === 'yes' || v.achieved === 'no')) { final = { ...v, q:_AR_QUARTERS[i] }; break; }
    }
    return { ...row, final };
  });
  const kpiAchieved = kpis.filter(k => k.final && k.final.achieved === 'yes').length;

  return { budget, quarters, totalSpent, remaining: budget - totalSpent, pctTotal: _arPct(totalSpent, budget),
           reportedCount, latest, activities, kpis, kpiAchieved };
}

// ══════════════════════════════════════════════════════════════════════════
// หน้าต่างพรีวิวบนเว็บ
// ══════════════════════════════════════════════════════════════════════════
function _arEnsureOverlay(){
  let ov = document.getElementById('annualSummaryOverlay');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.id = 'annualSummaryOverlay';
  ov.innerHTML = `
    <div class="modal ar-modal">
      <div class="modal-header">
        <span class="modal-title" id="annualSummaryTitle">สรุปผลการดำเนินงาน ไตรมาส 1–4</span>
        <button class="btn btn-sm btn-icon" onclick="closeAnnualSummary()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body" id="annualSummaryBody"></div>
      <div class="modal-footer">
        <button class="btn" onclick="closeAnnualSummary()">ปิด</button>
        <button class="btn" id="arExportPdfBtn" style="background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;border-color:transparent">📄 Export PDF (สรุปรวม Q1–Q4)</button>
      </div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) closeAnnualSummary(); });
  document.body.appendChild(ov);
  return ov;
}
function closeAnnualSummary(){
  const ov = document.getElementById('annualSummaryOverlay');
  if (ov) ov.classList.remove('open');
}

function _arStatusBadge(status){
  if (!status) return '<span class="ar-muted">ยังไม่รายงาน</span>';
  const c = _AR_STATUS_COLOR[status] || '#6b7280';
  return `<span class="ar-badge" style="color:${c};border-color:${c}55;background:${c}12">${_arEsc(_AR_STATUS_TEXT[status] || status)}</span>`;
}
function _arKpiCellWeb(v, reported){
  if (!reported) return '<span class="ar-muted">ยังไม่รายงาน</span>';
  if (!v) return '<span class="ar-muted">–</span>';
  const res = v.achieved === 'yes' ? '<span class="ar-yes">✅ บรรลุ</span>'
            : v.achieved === 'no'  ? '<span class="ar-no">❌ ไม่บรรลุ</span>'
            : '<span class="ar-muted">ยังไม่ประเมิน</span>';
  return `${v.target ? `<div class="ar-kpi-target">${_arEsc(v.target)}</div>` : ''}<div>${res}</div>`;
}
function _arBar(pct){
  const w = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const over = pct !== null && pct > 100;
  return `<div class="ar-bar"><div class="ar-bar-fill${over?' ar-bar-over':''}" style="width:${w}%"></div></div>`;
}

function openAnnualSummary(projectId){
  if (projectId === null || projectId === undefined || projectId === '') {
    if (typeof showToast === 'function') showToast('กรุณาเลือกโครงการก่อน'); return;
  }
  const p = (typeof projects !== 'undefined' ? projects : []).find(x => x.id == projectId);
  if (!p) { alert('ไม่พบข้อมูลโครงการ'); return; }
  const d = _arBuildData(p);
  const ov = _arEnsureOverlay();
  document.getElementById('annualSummaryTitle').textContent = `สรุปผลการดำเนินงาน ไตรมาส 1–4 — ${p.name || ''}`;

  const sName = (typeof S_NAMES !== 'undefined' && S_NAMES[p.strategy]) ? S_NAMES[p.strategy] : '';
  const sBadge = (typeof S_BADGE !== 'undefined' && S_BADGE[p.strategy]) ? S_BADGE[p.strategy] : '';

  // การ์ดสรุป
  const cards = `
    <div class="ar-cards">
      <div class="ar-card"><div class="ar-card-label">งบประมาณที่อนุมัติ</div><div class="ar-card-value">${_arFmt(d.budget)} <small>บาท</small></div></div>
      <div class="ar-card"><div class="ar-card-label">ใช้ไปรวม ไตรมาส 1–4</div><div class="ar-card-value" style="color:var(--green)">${_arFmt(d.totalSpent)} <small>บาท</small></div></div>
      <div class="ar-card"><div class="ar-card-label">คงเหลือ</div><div class="ar-card-value" style="color:${d.remaining<0?'var(--red)':'inherit'}">${_arFmt(d.remaining)} <small>บาท</small></div></div>
      <div class="ar-card"><div class="ar-card-label">ร้อยละการใช้งบประมาณ</div><div class="ar-card-value">${_arPctText(d.pctTotal)}</div>${_arBar(d.pctTotal)}</div>
      <div class="ar-card"><div class="ar-card-label">รายงานแล้ว</div><div class="ar-card-value">${d.reportedCount} / 4 <small>ไตรมาส</small></div></div>
      <div class="ar-card"><div class="ar-card-label">ตัวชี้วัดที่บรรลุ</div><div class="ar-card-value">${d.kpiAchieved} / ${d.kpis.length} <small>ตัว</small></div></div>
    </div>`;

  // 1. งบประมาณรายไตรมาส
  const qRows = d.quarters.map(x => `
    <tr class="${x.reported?'':'ar-row-empty'}">
      <td><strong>${_arEsc(_arQLabel(x.q))}</strong></td>
      <td style="text-align:center">${_arStatusBadge(x.status)}</td>
      <td class="td-num">${x.reported ? _arFmt(x.spent) : '–'}</td>
      <td class="td-num">${x.reported ? _arPctText(x.pctQuarter) : '–'}</td>
      <td class="td-num"><strong>${_arFmt(x.cumulative)}</strong></td>
      <td style="min-width:120px">${_arPctText(x.pctCumulative)}${_arBar(x.pctCumulative)}</td>
      <td class="td-num" style="font-weight:700;color:${x.remaining<0?'var(--red)':'inherit'}">${_arFmt(x.remaining)}</td>
    </tr>`).join('');
  const budgetSection = `
    <div class="ar-section">
      <div class="ar-section-title">1. เปรียบเทียบงบประมาณที่อนุมัติกับผลการใช้งบประมาณรายไตรมาส</div>
      <div class="ar-note">งบประมาณที่อนุมัติทั้งโครงการ <strong>${_arFmt(d.budget)}</strong> บาท</div>
      <div class="mini-table-wrap"><table class="mini-table ar-table">
        <thead><tr>
          <th>ไตรมาส</th><th style="text-align:center">สถานะ</th>
          <th class="td-num">ใช้ไปในไตรมาส (บาท)</th><th class="td-num">% ของงบอนุมัติ</th>
          <th class="td-num">ใช้ไปสะสม (บาท)</th><th>% สะสม</th><th class="td-num">คงเหลือ (บาท)</th>
        </tr></thead>
        <tbody>${qRows}</tbody>
        <tfoot><tr>
          <td colspan="2" style="text-align:right"><strong>รวมทั้งปี</strong></td>
          <td class="td-num"><strong>${_arFmt(d.totalSpent)}</strong></td>
          <td class="td-num"><strong>${_arPctText(d.pctTotal)}</strong></td>
          <td class="td-num"><strong>${_arFmt(d.totalSpent)}</strong></td>
          <td><strong>${_arPctText(d.pctTotal)}</strong></td>
          <td class="td-num" style="color:${d.remaining<0?'var(--red)':'inherit'}"><strong>${_arFmt(d.remaining)}</strong></td>
        </tr></tfoot>
      </table></div>
    </div>`;

  // 2. งบประมาณรายกิจกรรม
  const actSection = d.activities.length ? (()=>{
    const tB = d.activities.reduce((s,a)=>s+a.budget,0);
    const tQ = _AR_QUARTERS.map(q => d.activities.reduce((s,a)=>s+(a.q[q]||0),0));
    const tU = d.activities.reduce((s,a)=>s+a.used,0);
    return `
    <div class="ar-section">
      <div class="ar-section-title">2. งบประมาณรายกิจกรรม เทียบผลการใช้จ่ายรายไตรมาส</div>
      <div class="mini-table-wrap"><table class="mini-table ar-table">
        <thead><tr>
          <th style="width:34px">ที่</th><th>กิจกรรม</th><th class="td-num">งบอนุมัติ</th>
          ${_AR_QUARTERS.map(q=>`<th class="td-num">Q${q}</th>`).join('')}
          <th class="td-num">รวมใช้ไป</th><th class="td-num">คงเหลือ</th><th class="td-num">%</th>
        </tr></thead>
        <tbody>${d.activities.map((a,i)=>`<tr>
          <td style="text-align:center;color:var(--text3)">${i+1}</td>
          <td>${_arEsc(a.name)}</td>
          <td class="td-num">${_arFmt(a.budget)}</td>
          ${_AR_QUARTERS.map(q=>`<td class="td-num">${a.q[q]===null?'<span class="ar-muted">–</span>':_arFmt(a.q[q])}</td>`).join('')}
          <td class="td-num"><strong>${_arFmt(a.used)}</strong></td>
          <td class="td-num" style="font-weight:700;color:${a.remaining<0?'var(--red)':'inherit'}">${_arFmt(a.remaining)}</td>
          <td class="td-num">${_arPctText(a.pct)}</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr>
          <td colspan="2" style="text-align:right"><strong>รวม</strong></td>
          <td class="td-num"><strong>${_arFmt(tB)}</strong></td>
          ${tQ.map(v=>`<td class="td-num"><strong>${_arFmt(v)}</strong></td>`).join('')}
          <td class="td-num"><strong>${_arFmt(tU)}</strong></td>
          <td class="td-num"><strong>${_arFmt(tB-tU)}</strong></td>
          <td class="td-num"><strong>${_arPctText(_arPct(tU,tB))}</strong></td>
        </tr></tfoot>
      </table></div>
    </div>`;
  })() : '';

  // 3. ตัวชี้วัด
  const kpiSection = `
    <div class="ar-section">
      <div class="ar-section-title">${d.activities.length?'3':'2'}. ตัวชี้วัดโครงการ — ผลรายไตรมาส</div>
      ${d.kpis.length ? `<div class="mini-table-wrap"><table class="mini-table ar-table">
        <thead><tr>
          <th style="width:34px">ที่</th><th>ตัวชี้วัด</th>
          ${_AR_QUARTERS.map(q=>`<th>ไตรมาส ${q}</th>`).join('')}
          <th>ผลล่าสุด</th>
        </tr></thead>
        <tbody>${d.kpis.map((k,i)=>`<tr>
          <td style="text-align:center;color:var(--text3)">${i+1}</td>
          <td><strong>${_arEsc(k.indicator)}</strong></td>
          ${d.quarters.map(x=>`<td style="font-size:11.5px">${_arKpiCellWeb(k.q[x.q], x.reported)}</td>`).join('')}
          <td style="font-size:11.5px">${k.final ? (k.final.achieved==='yes'?'<span class="ar-yes">✅ บรรลุ</span>':'<span class="ar-no">❌ ไม่บรรลุ</span>')+`<div class="ar-muted">(ไตรมาส ${k.final.q})</div>` : '<span class="ar-muted">ยังไม่ประเมิน</span>'}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<div class="ar-muted" style="padding:6px 2px">ยังไม่มีตัวชี้วัดในแผนโครงการหรือในรายงานผล</div>'}
    </div>`;

  // 4. ผลการดำเนินงานรายไตรมาส
  const narrNo = d.activities.length ? 4 : 3;
  const narrSection = `
    <div class="ar-section">
      <div class="ar-section-title">${narrNo}. ผลการดำเนินงาน ปัญหา และแนวทางแก้ไข รายไตรมาส</div>
      ${d.quarters.map(x => `
        <div class="ar-q-block${x.reported?'':' ar-q-empty'}">
          <div class="ar-q-head"><strong>${_arEsc(_arQLabel(x.q))}</strong> ${_arStatusBadge(x.status)}</div>
          ${!x.reported ? '<div class="ar-muted">ยังไม่มีการรายงานผลของไตรมาสนี้</div>' : `
            ${x.r.result ? `<div class="ar-q-row"><span class="ar-q-label">ผลการดำเนินงาน</span><div>${_arNl2br(x.r.result)}</div></div>` : ''}
            ${x.r.problems ? `<div class="ar-q-row"><span class="ar-q-label">ปัญหาและอุปสรรค</span><div>${_arNl2br(x.r.problems)}</div></div>` : ''}
            ${x.r.solutions ? `<div class="ar-q-row"><span class="ar-q-label">แนวทางแก้ไข</span><div>${_arNl2br(x.r.solutions)}</div></div>` : ''}
            ${(!x.r.result && !x.r.problems && !x.r.solutions) ? '<div class="ar-muted">— ไม่ได้ระบุรายละเอียด —</div>' : ''}
          `}
        </div>`).join('')}
    </div>`;

  document.getElementById('annualSummaryBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      ${sName ? `<span class="badge ${sBadge}">${_arEsc(sName)}</span>` : ''}
      ${p.owner||p.dept ? `<span style="font-size:12px;color:var(--text2)">ผู้รับผิดชอบ: ${_arEsc(p.owner||p.dept)}</span>` : ''}
      ${d.latest ? `<span style="margin-left:auto;font-size:12px;color:var(--text2)">สถานะล่าสุด (ไตรมาส ${d.latest.q}): ${_arStatusBadge(d.latest.status)}</span>` : ''}
    </div>
    ${cards}
    ${budgetSection}
    ${actSection}
    ${kpiSection}
    ${narrSection}`;

  document.getElementById('arExportPdfBtn').onclick = () => exportAnnualSummaryPDF(projectId);
  ov.classList.add('open');
}

// ══════════════════════════════════════════════════════════════════════════
// Export PDF (แนวนอน) — ใช้ _pdfCell / _runPdfExport จาก app-pdf-export.js
// ══════════════════════════════════════════════════════════════════════════
function _buildAnnualSummaryHTML(p){
  const d = _arBuildData(p);
  const S_FULL_NAMES = ['','การพัฒนาการจัดการศึกษาทางไกล','การพัฒนาครูและโรงเรียนต้นทาง','การพัฒนาครูและโรงเรียนปลายทาง','การพัฒนาระบบการบริหารจัดการ','งบบริหารสำนักงาน'];
  const s = parseInt(p.strategy) || 1;
  const H = _PDF_HEAD_BG, T = '#eef2ff';
  const zb = i => i % 2 === 1 ? _PDF_ZEBRA_BG : '#fff';
  const st = status => status ? `<span style="color:${_AR_STATUS_COLOR[status]||'#333'};font-weight:600">${_arEsc(_AR_STATUS_TEXT[status]||status)}</span>` : '<span style="color:#9aa3b2">ยังไม่รายงาน</span>';
  const title = t => `<div style="font-weight:700;font-size:11.5px;margin:4px 0 5px;color:#2c3e70">${t}</div>`;

  const info = `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:10px">
      <colgroup><col style="width:14%"><col style="width:46%"><col style="width:14%"><col style="width:26%"></colgroup>
      <tr>${_pdfCell('โครงการ',{bold:true,bg:H})}${_pdfCell(_arEsc(p.name||''),{bold:true,colspan:3})}</tr>
      <tr>${_pdfCell('ยุทธศาสตร์ที่',{bold:true,bg:H})}${_pdfCell(s+' — '+_arEsc(S_FULL_NAMES[s]||''),{})}${_pdfCell('ผู้รับผิดชอบ',{bold:true,bg:H})}${_pdfCell(_arEsc(p.owner||p.dept||'-'),{})}</tr>
      <tr>${_pdfCell('ช่วงรายงาน',{bold:true,bg:H})}${_pdfCell('ไตรมาส 1 – ไตรมาส 4 (รายงานแล้ว '+d.reportedCount+' / 4 ไตรมาส)',{})}${_pdfCell('สถานะล่าสุด',{bold:true,bg:H})}${_pdfCell(d.latest?st(d.latest.status)+' (ไตรมาส '+d.latest.q+')':'-',{})}</tr>
    </table>`;

  const summary = `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:12px">
      <tr>${_pdfCell('งบประมาณที่อนุมัติ (บาท)',{bold:true,center:true,bg:H})}${_pdfCell('ใช้ไปรวม ไตรมาส 1–4 (บาท)',{bold:true,center:true,bg:H})}${_pdfCell('คงเหลือ (บาท)',{bold:true,center:true,bg:H})}${_pdfCell('ร้อยละการใช้งบประมาณ',{bold:true,center:true,bg:H})}${_pdfCell('ตัวชี้วัดที่บรรลุ',{bold:true,center:true,bg:H})}</tr>
      <tr>${_pdfCell(_arFmt(d.budget),{right:true,bold:true})}${_pdfCell(_arFmt(d.totalSpent),{right:true,bold:true,color:'#059669'})}${_pdfCell(_arFmt(d.remaining),{right:true,bold:true,color:d.remaining<0?'#dc2626':'#111'})}${_pdfCell(_arPctText(d.pctTotal),{center:true,bold:true})}${_pdfCell(d.kpiAchieved+' / '+d.kpis.length+' ตัว',{center:true,bold:true})}</tr>
    </table>`;

  // 1. งบประมาณรายไตรมาส
  const budgetTable = `
    <div class="pdf-noBreak" style="margin-bottom:12px">
      ${title('1. เปรียบเทียบงบประมาณที่อนุมัติกับผลการใช้งบประมาณรายไตรมาส')}
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <colgroup><col style="width:21%"><col style="width:13%"><col style="width:14%"><col style="width:10%"><col style="width:14%"><col style="width:10%"><col style="width:18%"></colgroup>
        <tr class="pdf-headerRow">${_pdfCell('ไตรมาส',{bold:true,center:true,bg:H})}${_pdfCell('สถานะ',{bold:true,center:true,bg:H})}${_pdfCell('ใช้ไปในไตรมาส (บาท)',{bold:true,center:true,bg:H,small:true})}${_pdfCell('% ของงบอนุมัติ',{bold:true,center:true,bg:H,small:true})}${_pdfCell('ใช้ไปสะสม (บาท)',{bold:true,center:true,bg:H,small:true})}${_pdfCell('% สะสม',{bold:true,center:true,bg:H,small:true})}${_pdfCell('คงเหลือ (บาท)',{bold:true,center:true,bg:H,small:true})}</tr>
        ${d.quarters.map((x,i)=>`<tr>${_pdfCell(_arEsc(_arQLabel(x.q)),{bg:zb(i)})}${_pdfCell(st(x.status),{center:true,small:true,bg:zb(i)})}${_pdfCell(x.reported?_arFmt(x.spent):'–',{right:true,bg:zb(i)})}${_pdfCell(x.reported?_arPctText(x.pctQuarter):'–',{right:true,bg:zb(i)})}${_pdfCell(_arFmt(x.cumulative),{right:true,bold:true,bg:zb(i)})}${_pdfCell(_arPctText(x.pctCumulative),{right:true,bg:zb(i)})}${_pdfCell(_arFmt(x.remaining),{right:true,bold:true,color:x.remaining<0?'#dc2626':'#111',bg:zb(i)})}</tr>`).join('')}
        <tr>${_pdfCell('รวมทั้งปี (งบอนุมัติ '+_arFmt(d.budget)+' บาท)',{bold:true,center:true,bg:T,colspan:2})}${_pdfCell(_arFmt(d.totalSpent),{right:true,bold:true,bg:T})}${_pdfCell(_arPctText(d.pctTotal),{right:true,bold:true,bg:T})}${_pdfCell(_arFmt(d.totalSpent),{right:true,bold:true,bg:T})}${_pdfCell(_arPctText(d.pctTotal),{right:true,bold:true,bg:T})}${_pdfCell(_arFmt(d.remaining),{right:true,bold:true,bg:T,color:d.remaining<0?'#dc2626':'#059669'})}</tr>
      </table>
    </div>`;

  // 2. งบประมาณรายกิจกรรม
  let actTable = '';
  if (d.activities.length) {
    const tB = d.activities.reduce((s,a)=>s+a.budget,0);
    const tQ = _AR_QUARTERS.map(q => d.activities.reduce((s,a)=>s+(a.q[q]||0),0));
    const tU = d.activities.reduce((s,a)=>s+a.used,0);
    actTable = `
    <div style="margin-bottom:12px">
      ${title('2. งบประมาณรายกิจกรรม เทียบผลการใช้จ่ายรายไตรมาส')}
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <colgroup><col style="width:4%"><col style="width:26%"><col style="width:10%"><col style="width:8.5%"><col style="width:8.5%"><col style="width:8.5%"><col style="width:8.5%"><col style="width:10%"><col style="width:10%"><col style="width:6%"></colgroup>
        <tr class="pdf-headerRow">${_pdfCell('ที่',{bold:true,center:true,bg:H})}${_pdfCell('กิจกรรม',{bold:true,center:true,bg:H})}${_pdfCell('งบอนุมัติ',{bold:true,center:true,bg:H,small:true})}${_AR_QUARTERS.map(q=>_pdfCell('ไตรมาส '+q,{bold:true,center:true,bg:H,small:true})).join('')}${_pdfCell('รวมใช้ไป',{bold:true,center:true,bg:H,small:true})}${_pdfCell('คงเหลือ',{bold:true,center:true,bg:H,small:true})}${_pdfCell('%',{bold:true,center:true,bg:H,small:true})}</tr>
        ${d.activities.map((a,i)=>`<tr>${_pdfCell(i+1,{center:true,bg:zb(i)})}${_pdfCell(_arEsc(a.name),{bg:zb(i)})}${_pdfCell(_arFmt(a.budget),{right:true,bg:zb(i)})}${_AR_QUARTERS.map(q=>_pdfCell(a.q[q]===null?'–':_arFmt(a.q[q]),{right:true,bg:zb(i)})).join('')}${_pdfCell(_arFmt(a.used),{right:true,bold:true,bg:zb(i)})}${_pdfCell(_arFmt(a.remaining),{right:true,bold:true,color:a.remaining<0?'#dc2626':'#111',bg:zb(i)})}${_pdfCell(_arPctText(a.pct),{right:true,small:true,bg:zb(i)})}</tr>`).join('')}
        <tr>${_pdfCell('รวม',{bold:true,center:true,bg:T,colspan:2})}${_pdfCell(_arFmt(tB),{right:true,bold:true,bg:T})}${tQ.map(v=>_pdfCell(_arFmt(v),{right:true,bold:true,bg:T})).join('')}${_pdfCell(_arFmt(tU),{right:true,bold:true,bg:T})}${_pdfCell(_arFmt(tB-tU),{right:true,bold:true,bg:T,color:'#059669'})}${_pdfCell(_arPctText(_arPct(tU,tB)),{right:true,bold:true,small:true,bg:T})}</tr>
      </table>
    </div>`;
  }

  // 3. ตัวชี้วัด
  const kpiNo = d.activities.length ? 3 : 2;
  const kpiCell = (v, reported) => {
    if (!reported) return '<span style="color:#9aa3b2">ยังไม่รายงาน</span>';
    if (!v) return '<span style="color:#9aa3b2">–</span>';
    const res = v.achieved==='yes' ? '<span style="color:#059669;font-weight:700">บรรลุ</span>'
              : v.achieved==='no' ? '<span style="color:#dc2626;font-weight:700">ไม่บรรลุ</span>'
              : '<span style="color:#9aa3b2">ยังไม่ประเมิน</span>';
    return (v.target ? _arEsc(v.target)+'<br>' : '') + res;
  };
  const kpiTable = `
    <div style="margin-bottom:12px">
      ${title(kpiNo+'. ตัวชี้วัดโครงการ — ผลรายไตรมาส')}
      ${d.kpis.length ? `<table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <colgroup><col style="width:4%"><col style="width:24%"><col style="width:15%"><col style="width:15%"><col style="width:15%"><col style="width:15%"><col style="width:12%"></colgroup>
        <tr class="pdf-headerRow">${_pdfCell('ที่',{bold:true,center:true,bg:H})}${_pdfCell('ตัวชี้วัด',{bold:true,center:true,bg:H})}${_AR_QUARTERS.map(q=>_pdfCell('ไตรมาส '+q,{bold:true,center:true,bg:H,small:true})).join('')}${_pdfCell('ผลล่าสุด',{bold:true,center:true,bg:H,small:true})}</tr>
        ${d.kpis.map((k,i)=>`<tr>${_pdfCell(i+1,{center:true,bg:zb(i)})}${_pdfCell(_arEsc(k.indicator),{bold:true,bg:zb(i)})}${d.quarters.map(x=>_pdfCell(kpiCell(k.q[x.q], x.reported),{small:true,bg:zb(i)})).join('')}${_pdfCell(k.final?(k.final.achieved==='yes'?'<span style="color:#059669;font-weight:700">บรรลุ</span>':'<span style="color:#dc2626;font-weight:700">ไม่บรรลุ</span>')+'<br><span style="color:#777">(ไตรมาส '+k.final.q+')</span>':'<span style="color:#9aa3b2">ยังไม่ประเมิน</span>',{center:true,small:true,bg:zb(i)})}</tr>`).join('')}
      </table>` : '<div style="color:#888;font-size:10.5px">ยังไม่มีตัวชี้วัดในแผนโครงการหรือในรายงานผล</div>'}
    </div>`;

  // 4. ผลการดำเนินงานรายไตรมาส
  const narrNo = kpiNo + 1;
  const narr = `
    ${title(narrNo+'. ผลการดำเนินงาน ปัญหา และแนวทางแก้ไข รายไตรมาส')}
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <colgroup><col style="width:14%"><col style="width:36%"><col style="width:25%"><col style="width:25%"></colgroup>
      <tr class="pdf-headerRow">${_pdfCell('ไตรมาส',{bold:true,center:true,bg:H})}${_pdfCell('ผลการดำเนินงาน',{bold:true,center:true,bg:H})}${_pdfCell('ปัญหาและอุปสรรค',{bold:true,center:true,bg:H})}${_pdfCell('แนวทางแก้ไข / ข้อเสนอแนะ',{bold:true,center:true,bg:H})}</tr>
      ${d.quarters.map((x,i)=>`<tr style="page-break-inside:avoid">${_pdfCell('<strong>ไตรมาส '+x.q+'</strong><br>'+st(x.status),{center:true,small:true,bg:zb(i)})}${x.reported?(_pdfCell(_arNl2br(x.r.result||'-'),{small:true,bg:zb(i)})+_pdfCell(_arNl2br(x.r.problems||'-'),{small:true,bg:zb(i)})+_pdfCell(_arNl2br(x.r.solutions||'-'),{small:true,bg:zb(i)})):_pdfCell('<span style="color:#9aa3b2">ยังไม่มีการรายงานผลของไตรมาสนี้</span>',{colspan:3,center:true,small:true,bg:zb(i)})}</tr>`).join('')}
    </table>`;

  return `
<div id="pdf-annual-root" style="font-family:'Sarabun',sans-serif;width:100%;box-sizing:border-box;margin:0 auto;background:#fff;color:#111;font-size:11px;line-height:1.6;padding:6px 30px 24px;overflow-wrap:anywhere;word-break:normal">
  <div class="pdf-noBreak">${info}${summary}</div>
  ${budgetTable}
  ${actTable}
  ${kpiTable}
  ${narr}
</div>`;
}

async function exportAnnualSummaryPDF(projectId){
  const p = (typeof projects !== 'undefined' ? projects : []).find(x => x.id == projectId);
  if (!p) { alert('ไม่พบข้อมูลโครงการ'); return; }
  if (typeof _runPdfExport !== 'function' || typeof _pdfCell !== 'function') { alert('ไม่พบโมดูล Export PDF'); return; }
  const year = (typeof currentYear !== 'undefined') ? currentYear : '';
  const safeName = (p.name||'โครงการ').replace(/[\/\\:*?"<>|]/g,'').substring(0,60);
  const headerOpts = {
    logoSrc: (typeof _DLF_LOGO_SRC !== 'undefined') ? _DLF_LOGO_SRC : '',
    title: 'สรุปผลการดำเนินงานโครงการ ไตรมาส 1 – 4',
    subtitle: `ปีงบประมาณ พ.ศ. ${year} · มูลนิธิการศึกษาทางไกลผ่านดาวเทียม ในพระบรมราชูปถัมภ์`
  };
  await _runPdfExport(_buildAnnualSummaryHTML(p), `สรุปผลQ1-Q4_${year}_` + safeName, headerOpts, 'landscape');
}
