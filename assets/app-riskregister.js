// ============================================================
//  app-riskregister.js — โมดูล "ทะเบียนความเสี่ยง" (Risk Register + Heat Map)
//  ปีงบประมาณ พ.ศ. 2570
//
//  ★ ฟีเจอร์ใหม่ทั้งหมด แยกจากระบบ "บริหารความเสี่ยง" เดิม (app-auth-risk.js) โดยสิ้นเชิง
//    ตัวแปร/ฟังก์ชัน/HTML id/CSS class ทุกจุดขึ้นต้นด้วย "rrg" หรือ "RRG_" เพื่อไม่ให้ชนกับ
//    ของเดิม (ตรวจสอบแล้วไม่มีชื่อชนกันแม้แต่จุดเดียว ณ วันที่สร้างไฟล์นี้)
//  ★ ใช้ Sheet ใหม่ชื่อ "RiskRegister70" แยกจาก Sheet "Project70" เดิมโดยสิ้นเชิง
//  ★ ใช้ตัวช่วยเชื่อมต่อ GAS ที่มีอยู่แล้วในระบบ (gasPost/gasJsonp/GAS_ENABLED/_gasUrl
//    จาก app-core.js) ไม่ได้สร้างระบบเชื่อมต่อใหม่
// ============================================================

// ═══════════════════════════════════════════════════════
// RISK MANAGEMENT MODULE
// ═══════════════════════════════════════════════════════

const RRG_STORAGE_KEY = 'dltv_riskregister_70';
let rrgList = [];
let rrgEditingId = null;
let rrgDeleteId  = null;

// ── showSavePopup: popup แจ้งบันทึก/แก้ไขสำเร็จ (ใช้ระบบ toast ที่มีอยู่แล้วใน app-core.js) ──
// หมายเหตุ: ก่อนหน้านี้ไม่มีฟังก์ชันนี้อยู่จริง ทำให้ rrgSaveEntry() throw ReferenceError
// ทันทีที่กดบันทึก (หยุดก่อนถึง rrgSaveLocal/rrgCloseModal/rrgRenderTable) — กดบันทึกแล้ว
// จึงดูเหมือน "ไม่มีอะไรเกิดขึ้น" ทั้งที่จริง ๆ ยังไม่ได้บันทึกอะไรเลย
function showSavePopup(title, sub) {
  showToast(sub ? `✅ ${title} · ${sub}` : `✅ ${title}`);
}

// ── setStatus: แสดงข้อความสถานะ sync ในกล่อง #rrgGsStatus (รูปแบบเดียวกับ #gsStatus เดิม) ──
function setStatus(msg, cls) {
  const el = document.getElementById('rrgGsStatus');
  if (el) el.innerHTML = `<div class="status-msg ${cls || 'status-info'}">${msg}</div>`;
}
let rrgCurrentPage = 1;
const RRG_PAGE_SIZE = 15;
let rrgView = 'project';            // 'project' | 'flat'
let _rrgExpandedProjects = {};          // track which project cards are open

// ── Google Apps Script code for the Risks sheet (paste-able) ──
const RRG_GAS_CODE = `// ============================================================
//  RiskRegister70.gs — เพิ่มต่อท้าย Code.gs เดิมของปีงบประมาณ 2570
//  ระบบ "ทะเบียนความเสี่ยง" (Risk Register + Heat Map) — ฟีเจอร์ใหม่ แยกจากระบบ
//  บริหารความเสี่ยงเดิมโดยสิ้นเชิง (ไม่แตะ action/ฟังก์ชันเดิม เช่น saveRisk, deleteRisk,
//  getAllRisk ที่ระบบเดิมใช้อยู่) และไม่แตะ Sheet "Project70" เดิมเลย
//
//  ★ ตั้งชื่อฟังก์ชัน/Sheet/Action ให้มี suffix "70"/"rr70_" กำกับทุกจุด เพื่อไม่ให้ชนกับ
//    ของเดิมหรือของปีอื่นโดยเด็ดขาด — ก่อนวาง ให้ Ctrl+F หา "RiskRegister70" และ "rr70_"
//    ใน Code.gs เดิมก่อน ถ้าค้นไม่เจอเลย = ปลอดภัย 100% ที่จะวางต่อท้ายได้เลย
//
//  วิธีติดตั้ง:
//  1) เปิด Google Sheet ของระบบปี 2570 → เมนู Extensions > Apps Script
//  2) เลื่อนไปบรรทัดสุดท้ายของ Code.gs แล้ววางโค้ดทั้งหมดนี้ต่อท้าย (ไม่ต้องลบอะไรเดิม)
//  3) หา if/else ที่เช็ค action ใน doGet(e) เดิม แทรกบรรทัดนี้ "ก่อน" บรรทัด else/Unknown สุดท้าย:
//       if (action === 'getAllRiskRegister70') result = rr70_getAll();
//  4) หา if/else ที่เช็ค action ใน doPost(e) เดิม แทรก 3 บรรทัดนี้ "ก่อน" บรรทัด Unknown สุดท้าย:
//       if (action === 'saveRiskRegister70')      return ok(rr70_save(payload.data));
//       if (action === 'deleteRiskRegister70')    return ok(rr70_delete(payload.id));
//       if (action === 'bulkSaveRiskRegister70')  return ok(rr70_bulkSave(payload.data));
//     (ถ้า doPost เดิมของคุณใช้รูปแบบ jsonResponse(...) แทน ok(...) ให้ใช้ตามแบบเดิมที่มีอยู่)
//  5) Deploy > Manage deployments > แก้ deployment เดิม > Version: New version > Deploy
//     ⚠️ ห้ามกด "New deployment" เด็ดขาด เพราะจะได้ URL ใหม่ ทำให้ frontend เดิมเชื่อมต่อไม่ติด
//  6) เสร็จแล้ว Sheet ใหม่ชื่อ "RiskRegister70" จะถูกสร้างขึ้นอัตโนมัติในไฟล์เดียวกัน
//     ครั้งแรกที่มีการเรียกใช้งาน (ไม่กระทบ Sheet "Project70" เดิมแม้แต่นิดเดียว)
// ============================================================

const RR70_SHEET_NAME = 'RiskRegister70';
const RR70_HEADERS = [
  'id','project','name','category','strategy','likelihood','impact',
  'status','residual','control','contingency','dueDate','reviewDate',
  'owner','quarter','note','lastEditedBy','lastEditedByPosition','lastEditedAt'
];

// ── สร้าง/ดึง Sheet ทะเบียนความเสี่ยงของปี 2570 (ตั้งชื่อเฉพาะ ไม่ชนกับ Sheet อื่น) ──
function rr70_getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(RR70_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(RR70_SHEET_NAME);
    const h = sheet.getRange(1, 1, 1, RR70_HEADERS.length);
    h.setValues([RR70_HEADERS]);
    h.setBackground('#dc2626').setFontColor('#ffffff').setFontWeight('bold')
     .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 32);
    const widths = [50,220,260,110,80,90,90,110,90,260,240,100,100,140,80,200,140,140,160];
    widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
    return sheet;
  }
  const lastCol = sheet.getLastColumn();
  if (lastCol < RR70_HEADERS.length) {
    const missing = RR70_HEADERS.slice(lastCol);
    const range = sheet.getRange(1, lastCol + 1, 1, missing.length);
    range.setValues([missing]);
    range.setBackground('#dc2626').setFontColor('#ffffff').setFontWeight('bold');
  }
  return sheet;
}

function rr70_rowToObj(row) {
  return {
    id: parseInt(row[0]) || 0, project: row[1] || '', name: row[2] || '',
    category: row[3] || '', strategy: String(row[4] || ''),
    likelihood: parseInt(row[5]) || 1, impact: parseInt(row[6]) || 1,
    status: row[7] || 'open', residual: row[8] || '',
    control: row[9] || '', contingency: row[10] || '',
    dueDate: row[11] || '', reviewDate: row[12] || '',
    owner: row[13] || '', quarter: String(row[14] || 'all'),
    note: row[15] || '', lastEditedBy: row[16] || '',
    lastEditedByPosition: row[17] || '', lastEditedAt: row[18] || ''
  };
}

function rr70_objToRow(d) {
  return [
    d.id || 0, d.project || '', d.name || '', d.category || '',
    d.strategy || '', d.likelihood || 1, d.impact || 1,
    d.status || 'open', d.residual || '', d.control || '',
    d.contingency || '', d.dueDate || '', d.reviewDate || '',
    d.owner || '', d.quarter || 'all', d.note || '',
    d.lastEditedBy || '', d.lastEditedByPosition || '', d.lastEditedAt || ''
  ];
}

function rr70_getAll() {
  const sheet = rr70_getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, data: [], count: 0 };
  const values = sheet.getRange(2, 1, lastRow - 1, RR70_HEADERS.length).getValues();
  const data = values.filter(r => r[0] !== '' && r[0] !== null).map(rr70_rowToObj);
  return { success: true, data: data, count: data.length };
}

function rr70_save(data) {
  const sheet = rr70_getSheet();
  const lastRow = sheet.getLastRow();
  let newId = parseInt(data.id) || 0;
  if (newId === 0) {
    if (lastRow >= 2) {
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      const max = Math.max.apply(null, ids.map(function(r){ return parseInt(r[0]) || 0; }));
      newId = isFinite(max) && max > 0 ? max + 1 : 1;
    } else { newId = 1; }
  }
  data.id = newId;
  let targetRow = -1;
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (parseInt(ids[i][0]) === newId) { targetRow = i + 2; break; }
    }
  }
  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, RR70_HEADERS.length).setValues([rr70_objToRow(data)]);
  } else {
    sheet.appendRow(rr70_objToRow(data));
  }
  return { success: true, id: newId, message: 'บันทึกความเสี่ยง (Risk Register 70) สำเร็จ' };
}

function rr70_delete(id) {
  const sheet = rr70_getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: false, message: 'ไม่พบข้อมูล' };
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (parseInt(ids[i][0]) === parseInt(id)) { sheet.deleteRow(i + 2); return { success: true }; }
  }
  return { success: false, message: 'ไม่พบ ID: ' + id };
}

function rr70_bulkSave(dataArray) {
  const sheet = rr70_getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) sheet.deleteRows(2, lastRow - 1);
  if (!dataArray || !dataArray.length) return { success: true, count: 0 };
  const rows = dataArray.map(rr70_objToRow);
  sheet.getRange(2, 1, rows.length, RR70_HEADERS.length).setValues(rows);
  return { success: true, count: rows.length };
}

// ── เพิ่ม 1 บรรทัดนี้เข้าไปใน doGet(e) เดิม (ก่อนบรรทัด else/Unknown สุดท้าย) ──
//   if (action === 'getAllRiskRegister70') result = rr70_getAll();
//
// ── เพิ่ม 3 บรรทัดนี้เข้าไปใน doPost(e) เดิม (ก่อนบรรทัด Unknown สุดท้าย) ──
//   if (action === 'saveRiskRegister70')      return ok(rr70_save(payload.data));
//   if (action === 'deleteRiskRegister70')    return ok(rr70_delete(payload.id));
//   if (action === 'bulkSaveRiskRegister70')  return ok(rr70_bulkSave(payload.data));
`;

// ── Likelihood / Impact label maps ──
const RRG_LH_LABELS = {1:'น้อยมาก',2:'น้อย',3:'ปานกลาง',4:'มาก',5:'แน่นอน'};
const RRG_IM_LABELS = {1:'น้อยมาก',2:'น้อย',3:'ปานกลาง',4:'มาก',5:'สูงมาก'};
const RRG_CAT_NAMES = {
  strategic:'ด้านยุทธศาสตร์', operational:'ด้านปฏิบัติการ',
  financial:'ด้านการเงิน', compliance:'ด้านกฎระเบียบ',
  reputation:'ด้านชื่อเสียง', other:'อื่นๆ'
};
const RRG_STATUS = {
  open:'ยังไม่ดำเนินการ', inprogress:'กำลังดำเนินการ',
  controlled:'ควบคุมได้แล้ว', closed:'ปิดแล้ว'
};
const RRG_S_SHORT = {1:'ยทศ.1',2:'ยทศ.2',3:'ยทศ.3',4:'ยทศ.4',5:'งบ.สนก.'};

// ═══════════════════════════════════════════════════════
// รายงานผลการบริหารความเสี่ยง ← ดึงข้อมูลอัตโนมัติจาก "แผนบริหารความเสี่ยง" (PRM 01-04)
// ═══════════════════════════════════════════════════════
// หน้านี้เดิมชื่อ "ทะเบียนความเสี่ยง" และรับข้อมูลจากการกรอกฟอร์มในหน้านี้เท่านั้น (rrgList)
// แยกขาดจากระบบ "แผนบริหารความเสี่ยง (PRM)" (app-auth-risk.js) โดยสิ้นเชิง ทำให้ผู้บริหารต้อง
// มาคีย์ข้อมูลซ้ำสองที่ — ตอนนี้เปลี่ยนให้หน้านี้ทำหน้าที่เป็น "รายงานผล" คือดึงรายการความเสี่ยง
// ที่ผู้รับผิดชอบแต่ละโครงการกรอกไว้แล้วใน PRM 01 (ปัจจัยเสี่ยง) + PRM 02 (โอกาส/ผลกระทบ) +
// PRM 04 (แผนจัดการ/ผู้รับผิดชอบ) มาแสดงอัตโนมัติทุกครั้งที่เปิดหน้านี้ โดย:
//   • รายการที่ดึงมาจาก PRM จะมี source:'prm' กำกับ ให้ดูอย่างเดียว (แก้ไขที่หน้า PRM แทน)
//   • ไม่ถูกบันทึกซ้ำลง localStorage ของทะเบียนนี้ และไม่ถูก sync ขึ้น Google Sheet ของทะเบียนนี้
//     (เพราะข้อมูลจริงถูกเก็บและ sync อยู่ที่ระบบ PRM อยู่แล้ว) — คำนวณสดใหม่ทุกครั้งที่เข้าหน้า
//   • ยังคงเพิ่ม "ความเสี่ยงเพิ่มเติม" ที่ไม่ได้ผูกกับโครงการใน PRM ได้ตามปกติ (rrgList เดิม)

// แผนที่หมวดความเสี่ยงของ PRM (RISK_TYPES ใน app-auth-risk.js) → หมวดของรายงานนี้ (RRG_CAT_NAMES)
const RRG_PRM_CATEGORY_MAP = {
  'ความเสี่ยงด้านการปฏิบัติงาน':        'operational',
  'ความเสี่ยงด้านกฎหมายและระเบียบ':     'compliance',
  'ความเสี่ยงด้านการเงิน':              'financial',
  'ความเสี่ยงด้านชื่อเสียง':            'reputation',
  'ความเสี่ยงด้านเทคโนโลยีสารสนเทศ':    'operational',
  'ความเสี่ยงด้านทรัพยากรบุคคล':        'operational',
  'ความเสี่ยงด้านสิ่งแวดล้อม':          'other'
};
function _rrgMapPRMCategory(riskType) {
  return RRG_PRM_CATEGORY_MAP[riskType] || 'strategic';
}
// hash ข้อความสั้นๆ ให้เป็นเลขจำนวนเต็ม ใช้สร้าง id เฉพาะของแถวที่ดึงมาจาก PRM (ไม่ชนกับ rrgList เดิม)
function _rrgHashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return Math.abs(h) || 1;
}

// ── อ่านข้อมูลจาก PRM (riskData ใน app-auth-risk.js) แล้วแปลงเป็นรายการรูปแบบเดียวกับ rrgList ──
function rrgGetPRMDerivedItems() {
  if (typeof loadRiskStorage === 'function') { try { loadRiskStorage(); } catch(e) {} }
  const src = (typeof riskData !== 'undefined' && riskData) ? riskData : {};
  const out = [];
  Object.keys(src).forEach((recId) => {
    const rec  = src[recId] || {};
    const meta = rec.meta     || {};
    const rows = rec.rows     || [];
    const analysis = rec.analysis || {};
    const plan     = rec.plan     || {};
    const projectName = meta.projname || rec.name || recId;
    rows.forEach((row, idx) => {
      const a   = analysis[idx] || {};
      const lik = a.likelihood || 0, imp = a.impact || 0;
      if (!lik || !imp) return; // ยังประเมินโอกาส/ผลกระทบไม่ครบใน PRM 02 — ยังไม่นับเป็นรายการรายงาน
      const p = plan[idx] || {};
      out.push({
        id: -(_rrgHashStr(recId + '_' + idx)),   // เลขติดลบ กันชนกับ id ของ rrgList เดิม (เริ่มที่ 1)
        source: 'prm',
        prmRecordId: recId,
        prmRowIdx: idx,
        project: projectName,
        activity: row.activity || '', // ชื่อกิจกรรมของโครงการที่ปัจจัยเสี่ยงนี้อยู่ภายใต้ (PRM 01)
        name: row.riskFactor || row.activity || 'ความเสี่ยง (ไม่ระบุชื่อ)',
        category: _rrgMapPRMCategory(row.riskType),
        strategy: meta.strategy || '',
        quarter: 'all',
        owner: p.owner || '',
        likelihood: lik,
        impact: imp,
        control: p.management || '',
        // ผลการดำเนินงาน/หมายเหตุเพิ่มเติมที่กรอกจากฟอร์ม "บันทึกรายงานผล" แสดงในกรอบ
        // "ผลการดำเนินงาน / แผนเผชิญเหตุ" โดยตรง ไม่ปนไปกับหมายเหตุระยะเวลา/งบประมาณด้านล่าง
        contingency: p.reportNote || '',
        // ── ฟิลด์ "ผลการดำเนินงาน/รายงานผล" (status, residual, dueDate, reviewDate, reportNote) ──
        // เดิมไม่มีช่องกรอกจากหน้านี้เลย (ค่าเริ่มต้นตายตัว) ทำให้ผู้ใช้เข้ามาบันทึกรายงานผลไม่ได้
        // ตอนนี้เก็บฟิลด์เหล่านี้ไว้ใน riskData[recId].plan[idx] ชุดเดียวกับแผน PRM 04 เดิม (ผ่าน
        // saveRiskReportFields() ใน app-auth-risk.js) จึง sync ขึ้น Google Sheet ด้วย action 'saveRisk'
        // เดิมที่มีอยู่แล้วโดยอัตโนมัติ — ไม่ต้องเพิ่ม storage หรือ action GAS ใหม่เลย
        status: p.status || (p.management ? 'inprogress' : 'open'),
        residual: p.residual || '',
        dueDate: p.dueDate || '',
        reviewDate: p.reviewDate || '',
        note: [p.timeline ? ('ระยะเวลา: ' + p.timeline) : '', p.budget ? ('งบประมาณ: ' + (typeof formatMoneyText === 'function' ? formatMoneyText(p.budget) : p.budget) + ' บาท') : '']
                .filter(Boolean).join(' · '),
        lastEditedBy: '', lastEditedByPosition: '', lastEditedAt: ''
      });
    });
  });
  return out;
}

// ── ผสานรายการจาก PRM เข้ากับ rrgList สำหรับแสดงผล (ไม่กระทบข้อมูลที่บันทึกจริงในเครื่อง/Sheet) ──
function rrgApplyPRMMerge() {
  rrgList = (rrgList || []).filter(x => x.source !== 'prm');
  rrgList = rrgList.concat(rrgGetPRMDerivedItems());
}

// ═══════════════════════════════════════════════════════
// แบบฟอร์ม "บันทึกรายงานผลการบริหารความเสี่ยง" สำหรับรายการที่มาจาก PRM
// ═══════════════════════════════════════════════════════
// เดิมรายการที่มาจาก PRM ดูได้อย่างเดียว ไม่มีทางกรอก "ผลการดำเนินงาน" (สถานะ/ความเสี่ยงคงเหลือ/
// กำหนดวันแล้วเสร็จ/วันทบทวน/หมายเหตุ) จากหน้ารายงานนี้เลย ต้องไปกดที่ปุ่ม "ไปที่ PRM" ซึ่งพาไป
// หน้า PRM แต่ที่หน้า PRM ก็ไม่มีช่องกรอกฟิลด์เหล่านี้เช่นกัน (มีแต่แผนจัดการ/ระยะเวลา/งบประมาณ/
// ผู้รับผิดชอบ) ผู้ใช้จึงกรอกรายงานผลไม่ได้เลยไม่ว่าจะเข้าหน้าไหน — เพิ่มฟอร์มเล็กๆ นี้ขึ้นมาโดยเฉพาะ
// บันทึกฟิลด์เหล่านี้ลงใน riskData[recId].plan[idx] ชุดเดียวกับแผน PRM 04 (ผ่าน saveRiskReportFields()
// ที่เพิ่มไว้ใน app-auth-risk.js) จึง sync ขึ้น Google Sheet ด้วย action 'saveRisk' เดิมที่มีอยู่แล้ว
let _rrgReportTarget = null; // { recId, rowIdx }

function rrgOpenReportForm(recId, rowIdx) {
  if (typeof _isEditable === 'function' && !_isEditable()) {
    showToast('🔒 กรุณาเข้าสู่ระบบก่อนบันทึกรายงานผล');
    return;
  }
  if (typeof loadRiskStorage === 'function') { try { loadRiskStorage(); } catch(e) {} }
  const rec = (typeof riskData !== 'undefined' && riskData) ? riskData[recId] : null;
  if (!rec) { showToast('⚠️ ไม่พบข้อมูลแผนบริหารความเสี่ยงนี้แล้ว — อาจถูกลบหรือแก้ไขไปแล้ว'); return; }
  const row = (rec.rows || [])[rowIdx] || {};
  const p   = (rec.plan || {})[rowIdx] || {};
  _rrgReportTarget = { recId: recId, rowIdx: rowIdx };

  const nameEl = document.getElementById('rrgReportName');
  const projEl = document.getElementById('rrgReportProject');
  if (nameEl) nameEl.textContent = row.riskFactor || row.activity || 'ความเสี่ยง (ไม่ระบุชื่อ)';
  if (projEl) projEl.textContent = '📁 ' + ((rec.meta && rec.meta.projname) || rec.name || recId);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('rrgReportStatus',     p.status || (p.management ? 'inprogress' : 'open'));
  set('rrgReportResidual',   p.residual || '');
  set('rrgReportDueDate',    p.dueDate || '');
  set('rrgReportReviewDate', p.reviewDate || '');
  set('rrgReportNote',       p.reportNote || '');

  const modal = document.getElementById('rrgReportModal');
  if (modal) modal.style.display = 'flex';
}

function rrgCloseReportForm() {
  const modal = document.getElementById('rrgReportModal');
  if (modal) modal.style.display = 'none';
  _rrgReportTarget = null;
}

function rrgSaveReportForm() {
  if (!_rrgReportTarget) return;
  const { recId, rowIdx } = _rrgReportTarget;
  const fields = {
    status:     document.getElementById('rrgReportStatus')?.value || 'open',
    residual:   document.getElementById('rrgReportResidual')?.value || '',
    dueDate:    document.getElementById('rrgReportDueDate')?.value || '',
    reviewDate: document.getElementById('rrgReportReviewDate')?.value || '',
    reportNote: (document.getElementById('rrgReportNote')?.value || '').trim()
  };
  if (typeof saveRiskReportFields !== 'function') {
    showToast('❌ เกิดข้อผิดพลาด: ไม่พบฟังก์ชันบันทึกรายงานผล');
    return;
  }
  const ok = saveRiskReportFields(recId, rowIdx, fields);
  if (!ok) { showToast('⚠️ ไม่พบข้อมูลแผนบริหารความเสี่ยงนี้แล้ว — อาจถูกลบหรือแก้ไขไปแล้ว'); return; }

  rrgCloseReportForm();
  rrgApplyPRMMerge();
  rrgUpdateMetrics();
  rrgBuildMatrix();
  rrgBuildCategoryBreakdown();
  rrgRenderTable();
  showToast('✅ บันทึกรายงานผลสำเร็จ');
}

// ── Risk level helper ──
function rrgGetLevel(score) {
  if (score >= 16) return { key:'veryhigh', label:'🔴 สูงมาก', color:'#dc2626' };
  if (score >= 10) return { key:'high',     label:'🟠 สูง',    color:'#ea580c' };
  if (score >= 5)  return { key:'medium',   label:'🟡 ปานกลาง', color:'#d97706' };
  return               { key:'low',      label:'🟢 ต่ำ',    color:'#16a34a' };
}
function rrgGetCellClass(l, i) {
  const s = l * i;
  if (s >= 16) return 'rrg-cl-veryhigh';
  if (s >= 10) return 'rrg-cl-high';
  if (s >= 5)  return 'rrg-cl-medium';
  return 'rrg-cl-low';
}

// ── Storage ──
function rrgSaveLocal() {
  // บันทึกเฉพาะรายการที่กรอกเพิ่มเติมในหน้านี้เอง (source !== 'prm') — รายการที่ดึงมาจาก PRM
  // จะถูกคำนวณใหม่ทุกครั้งจาก rrgApplyPRMMerge() อยู่แล้ว ไม่ต้องเก็บซ้ำในเครื่อง
  try { localStorage.setItem(RRG_STORAGE_KEY, JSON.stringify(rrgList.filter(x => x.source !== 'prm'))); } catch(e) {}
}
function rrgLoadLocal() {
  try {
    const d = localStorage.getItem(RRG_STORAGE_KEY);
    if (d) { const r = JSON.parse(d); if (Array.isArray(r)) { rrgList = r; return; } }
  } catch(e) {}
  // ยังไม่มีข้อมูล — เริ่มต้นด้วยรายการว่างเปล่า (ไม่ใส่ข้อมูลตัวอย่าง)
  rrgList = [];
}

// ── Init page ──
function rrgInitPage() {
  rrgLoadLocal();
  rrgApplyPRMMerge(); // ดึงรายการล่าสุดจากแผนบริหารความเสี่ยง (PRM) มาผสานเข้ากับรายงานนี้เสมอ
  rrgPopulateProjectList();
  // Show add button only for logged-in members
  const btn = document.getElementById('rrgAddBtn');
  if (btn) btn.style.display = _isEditable() ? '' : 'none';
  rrgUpdateMetrics();
  rrgBuildMatrix();
  rrgBuildCategoryBreakdown();
  rrgRenderTable();
  // เดิม: หน้านี้อ่านข้อมูลจาก localStorage ของเครื่อง/เบราว์เซอร์นั้นๆ เท่านั้น ไม่เคยดึงจาก
  // Google Sheet อัตโนมัติเลย (ต้องกดปุ่ม "โหลดจาก Sheet" เองทุกครั้ง) ผลคือเปิดจากเครื่องอื่น/
  // เบราว์เซอร์อื่นแล้วเห็นค่าเป็น 0 หมด ทั้งที่ข้อมูลถูก sync ขึ้น Sheet จริงจากเครื่องเดิมแล้ว —
  // แก้โดยดึงข้อมูลล่าสุดจาก Sheet แบบเงียบๆ ทุกครั้งที่เข้าหน้านี้ แล้ว merge/re-render ทับ
  // ข้อมูลในเครื่อง (Sheet ถือเป็นข้อมูลจริงเสมอ เหมือนหน้า Dashboard หลัก)
  _rrgAutoLoadFromSheet();
  // ดึงข้อมูลล่าสุดจากแผนบริหารความเสี่ยง (PRM) บน Google Sheet มาแบบเงียบๆ ด้วยเช่นกัน (ใช้
  // ฟังก์ชัน/action "getAllRisk" ที่มีอยู่แล้วใน Code.gs ตัวเดียวกับที่หน้า "แผนบริหารความเสี่ยง"
  // ใช้อยู่ — ไม่ต้องเพิ่ม action ใหม่ฝั่ง GAS) เพื่อให้เปิดจากเครื่อง/เบราว์เซอร์ไหนก็เห็นรายการ
  // ที่คนอื่นกรอกไว้ใน PRM ครบ ไม่ใช่แค่ที่เคยเปิดหน้า PRM ไว้ในเครื่องนั้นมาก่อน
  _rrgAutoLoadPRMFromGAS();
}

// ── ดึงข้อมูล PRM ล่าสุดจาก Sheet แบบเงียบๆ แล้วผสานเข้ากับรายงานนี้ใหม่ ──
function _rrgAutoLoadPRMFromGAS() {
  if (typeof loadAllRiskFromGAS !== 'function') return; // เผื่อโหลดสคริปต์ไม่ครบ ไม่ให้หน้าพัง
  loadAllRiskFromGAS()
    .then(() => {
      rrgApplyPRMMerge();
      rrgUpdateMetrics();
      rrgBuildMatrix();
      rrgBuildCategoryBreakdown();
      rrgRenderTable();
    })
    .catch(() => {}); // เงียบไว้ — ถ้าดึงไม่สำเร็จ ยังคงเห็นข้อมูล PRM ที่มีอยู่ในเครื่องแทน
}

// ── ดึงความเสี่ยงล่าสุดจาก Sheet แบบเงียบๆ ตอนเปิดหน้า (ไม่รบกวนผู้ใช้ด้วย toast ถ้าสำเร็จ) ──
async function _rrgAutoLoadFromSheet() {
  if (!(GAS_ENABLED && _gasUrl && !_gasUrl.includes('YOUR_GAS'))) return;
  try {
    const res = await gasJsonp({ action: 'getAllRiskRegister70' });
    if (res && res.success && Array.isArray(res.data)) {
      rrgList = res.data;
      rrgApplyPRMMerge();
      rrgSaveLocal();
      rrgUpdateMetrics();
      rrgBuildMatrix();
      rrgBuildCategoryBreakdown();
      rrgRenderTable();
      setStatus('✅ ข้อมูลล่าสุดจาก Google Sheet ('+rrgList.length+' รายการ) · '+new Date().toLocaleTimeString('th-TH'), 'status-ok');
    }
  } catch (err) {
    // ไม่ต้อง throw/toast รบกวนผู้ใช้ทุกครั้งที่เข้าหน้า แต่ยังแจ้งในกล่องสถานะให้เห็นสาเหตุ
    setStatus('⚠️ โหลดข้อมูลล่าสุดจาก Sheet ไม่สำเร็จ (ใช้ข้อมูลที่เก็บไว้ในเครื่องนี้แทน): '+(err && err.message || err), 'status-err');
  }
}

// ── Populate project datalist from existing projects ──
// (เดิมใช้เติม <datalist> ของเบราว์เซอร์ ตอนนี้เปลี่ยนมาใช้ rrgRenderProjectPicker() แทน
// แต่คงฟังก์ชันนี้ไว้เผื่อโค้ดส่วนอื่นเรียกอยู่ — ทำงานเป็น no-op อย่างปลอดภัย)
function rrgPopulateProjectList() {}

// ── ตัวเลือกโครงการแบบค้นหา + จัดกลุ่มตามยุทธศาสตร์ (เหมือนหน้า "บริหารความเสี่ยง (PRM)") ──
function rrgShowProjectPicker() {
  const input = document.getElementById('rrgProject');
  rrgRenderProjectPicker(input ? input.value : '');
  const wrap = document.getElementById('rrgProjectPickerWrap');
  if (wrap) wrap.style.display = 'block';
}
function rrgOnProjectSearchInput(v) {
  rrgRenderProjectPicker(v);
  const wrap = document.getElementById('rrgProjectPickerWrap');
  if (wrap) wrap.style.display = 'block';
}
function rrgRenderProjectPicker(filterText) {
  const wrap = document.getElementById('rrgProjectPickerWrap');
  if (!wrap || typeof projects === 'undefined') return;
  const q = (filterText || '').trim().toLowerCase();
  const all = projects || [];
  const filtered = q ? all.filter(p => (p.name || '').toLowerCase().includes(q)) : all;
  const _esc     = typeof escapeHtml  === 'function' ? escapeHtml : (s) => String(s == null ? '' : s);
  const _S_NAMES = typeof S_NAMES !== 'undefined' ? S_NAMES : {};
  const _S_FULL  = typeof S_FULL  !== 'undefined' ? S_FULL  : {};
  const _S_BADGE = typeof S_BADGE !== 'undefined' ? S_BADGE : {};
  const _S_KEYS  = typeof S_KEYS  !== 'undefined' ? S_KEYS  : [...new Set(all.map(p => p.strategy))];

  if (!filtered.length) {
    wrap.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--text3);font-size:12.5px">ไม่พบโครงการที่ตรงกับคำค้นหา — พิมพ์ต่อเพื่อสร้างรายการอิสระได้เลย</div>';
    return;
  }
  const groupsHtml = _S_KEYS.map(s => {
    const ps = filtered.filter(p => String(p.strategy) === String(s));
    if (!ps.length) return '';
    const rows = ps.map(p => `
      <div class="risk-newproj-row" onclick="rrgPickProject('${String(p.id).replace(/'/g, "\\'")}')">
        <span class="badge ${_S_BADGE[p.strategy] || ''}" style="flex-shrink:0">${_S_NAMES[p.strategy] || ('ยุทธศาสตร์ที่ ' + p.strategy)}</span>
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(p.name)}</span>
        ${p.owner || p.dept ? `<span style="font-size:11px;color:var(--text3);flex-shrink:0">${_esc(p.owner || p.dept)}</span>` : ''}
      </div>`).join('');
    return `<div class="risk-newproj-group">
      <div class="risk-newproj-group-head">${_S_NAMES[s] || ('ยุทธศาสตร์ที่ ' + s)}${_S_FULL[s] ? ' — ' + _S_FULL[s] : ''}</div>
      ${rows}
    </div>`;
  }).join('');
  wrap.innerHTML = groupsHtml || '<div style="padding:1rem;text-align:center;color:var(--text3);font-size:12.5px">ยังไม่มีโครงการในระบบ</div>';
}
function rrgPickProject(id) {
  const proj = (projects || []).find(p => String(p.id) === String(id));
  if (!proj) return;
  const input = document.getElementById('rrgProject');
  if (input) input.value = proj.name || '';
  rrgOnProjectChange();
  const wrap = document.getElementById('rrgProjectPickerWrap');
  if (wrap) wrap.style.display = 'none';
}
// ปิด picker เมื่อคลิกนอกกรอบ (แต่ไม่ปิดถ้าคลิกที่ input หรือใน picker เอง)
document.addEventListener('click', e => {
  const wrap  = document.getElementById('rrgProjectPickerWrap');
  const input = document.getElementById('rrgProject');
  if (!wrap || wrap.style.display === 'none') return;
  if (e.target === input || wrap.contains(e.target)) return;
  wrap.style.display = 'none';
});

// ── Auto-fill strategy when a project is selected ──
function rrgOnProjectChange() {
  const input = document.getElementById('rrgProject');
  if (!input || typeof projects === 'undefined') return;
  const val = (input.value || '').trim();
  const match = projects.find(p => (p.name||'').trim() === val);
  if (match) {
    const strat = document.getElementById('rrgStrategy');
    if (strat && match.strategy) strat.value = String(match.strategy);
    // suggest owner if available and field is empty
    const ownerEl = document.getElementById('rrgOwner');
    if (ownerEl && !ownerEl.value && match.owner) ownerEl.value = match.owner;
  }
}

// ── Metrics ──
function rrgUpdateMetrics() {
  const total = rrgList.length;
  const high  = rrgList.filter(r => r.likelihood * r.impact >= 10).length;
  const med   = rrgList.filter(r => { const s = r.likelihood * r.impact; return s >= 5 && s < 10; }).length;
  const low   = rrgList.filter(r => r.likelihood * r.impact < 5).length;
  const done  = rrgList.filter(r => r.status === 'controlled' || r.status === 'closed').length;
  const setText = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  setText('rrgTotal', total);
  setText('rrgHigh',  high);
  setText('rrgMed',   med);
  setText('rrgLow',   low);
  setText('rrgDone',  done);
}

// ── Heat Map Matrix ──
function rrgBuildMatrix() {
  const grid = document.getElementById('rrgMatrixGrid');
  if (!grid) return;
  // Count rrgList per cell (only count rrgList that match current quarter filter)
  const qf = document.getElementById('rrgQuarterFilter')?.value || '';
  const cells = {};
  rrgList.forEach(r => {
    if (qf && r.quarter && r.quarter !== 'all' && r.quarter !== qf) return;
    const key = r.likelihood + '_' + r.impact;
    cells[key] = (cells[key] || 0) + 1;
  });
  const LH_SHORT = ['', 'น้อยมาก', 'น้อย', 'ปานกลาง', 'มาก', 'แน่นอน'];
  const IM_SHORT = ['', 'น้อยมาก', 'น้อย', 'ปานกลาง', 'มาก', 'สูงมาก'];
  let html = '';
  // Top-left empty corner
  html += '<div class="rrg-cell axis-label" style="min-height:auto;background:none"></div>';
  // X-axis header (Impact 1–5)
  for (let i = 1; i <= 5; i++) {
    html += `<div class="rrg-cell axis-label" style="min-height:auto;flex-direction:column;line-height:1.2">
      <div style="font-weight:700;color:var(--text2)">${i}</div>
      <div style="font-size:9px">${IM_SHORT[i]}</div>
    </div>`;
  }
  // Rows: likelihood 5 down to 1
  for (let l = 5; l >= 1; l--) {
    html += `<div class="rrg-cell axis-label" style="flex-direction:column;line-height:1.2">
      <div style="font-weight:700;color:var(--text2)">${l}</div>
      <div style="font-size:9px">${LH_SHORT[l]}</div>
    </div>`;
    for (let imp = 1; imp <= 5; imp++) {
      const score = l * imp;
      const cls = rrgGetCellClass(l, imp);
      const cnt = cells[l+'_'+imp] || 0;
      const tooltip = cnt > 0
        ? `โอกาส ${l} × ผลกระทบ ${imp} = ${score} คะแนน · มีความเสี่ยง ${cnt} รายการ`
        : `โอกาส ${l} × ผลกระทบ ${imp} = ${score} คะแนน`;
      html += `<div class="rrg-cell ${cls} ${cnt>0?'clickable':''}" title="${tooltip}" onclick="rrgFilterMatrixCell(${l},${imp})">
        <div class="rrg-cell-score">${score}</div>
        ${cnt > 0 ? `<div class="rrg-cell-badge">${cnt}</div>` : ''}
      </div>`;
    }
  }
  grid.innerHTML = html;
}

function rrgFilterMatrixCell(l, imp) {
  const cnt = rrgList.filter(r => r.likelihood === l && r.impact === imp).length;
  if (cnt === 0) return;
  // Set level filter to match this cell's level, then scroll to table
  const score = l * imp;
  const lvKey = rrgGetLevel(score).key;
  const lf = document.getElementById('rrgFilterLevel');
  if (lf) { lf.value = lvKey; rrgRenderTable(); }
  showToast(`🔍 กรองระดับ "${rrgGetLevel(score).label}" (คะแนน ${score})`);
  document.querySelector('.rrg-table-wrap')?.scrollIntoView({ behavior:'smooth', block:'center' });
}

// ── Category Breakdown ──
function rrgBuildCategoryBreakdown() {
  const el = document.getElementById('rrgCategoryBreakdown');
  if (!el) return;
  const cats = ['strategic','operational','financial','compliance','reputation','other'];
  const catColors = {strategic:'var(--accent)',operational:'var(--purple)',financial:'var(--green)',compliance:'var(--amber)',reputation:'var(--red)',other:'var(--text3)'};
  const total = rrgList.length || 1;
  let html = '';
  cats.forEach(cat => {
    const count = rrgList.filter(r => r.category === cat).length;
    const pct = Math.round(count / total * 100);
    if (count === 0) return;
    html += `<div style="display:flex;align-items:center;gap:10px">
      <div style="width:100px;font-size:12px;color:var(--text2);flex-shrink:0">${RRG_CAT_NAMES[cat]||cat}</div>
      <div style="flex:1;background:var(--surface2);border-radius:99px;height:8px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${catColors[cat]||'var(--accent)'};border-radius:99px;transition:width .4s"></div>
      </div>
      <div style="font-size:12px;font-weight:700;color:var(--text);min-width:28px;text-align:right">${count}</div>
    </div>`;
  });
  if (!html) html = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:1rem">ยังไม่มีข้อมูลความเสี่ยง</div>';
  el.innerHTML = html;
}

// ── Table ──
function rrgSetView(view) {
  rrgView = view;
  document.getElementById('rrgViewProjectBtn')?.classList.toggle('active', view === 'project');
  document.getElementById('rrgViewFlatBtn')?.classList.toggle('active', view === 'flat');
  rrgCurrentPage = 1;
  rrgRenderTable();
}

// Group filtered rrgList by project name, render expandable cards
function rrgRenderProjectView(list) {
  const container = document.getElementById('rrgProjectView');
  if (!container) return;

  // Group by project (fallback to "(ไม่ระบุโครงการ)")
  const groups = {};
  list.forEach(r => {
    const key = (r.project && r.project.trim()) || '(ไม่ได้ระบุโครงการ)';
    (groups[key] = groups[key] || []).push(r);
  });

  // Sort groups: highest max-score first
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    const maxA = Math.max(...groups[a].map(r => r.likelihood * r.impact));
    const maxB = Math.max(...groups[b].map(r => r.likelihood * r.impact));
    return maxB - maxA;
  });

  const canEdit = _isEditable();
  const resMap = { low:'🟢', medium:'🟡', high:'🟠', veryhigh:'🔴' };
  const stMap  = { open:'ยังไม่ดำเนินการ', inprogress:'กำลังดำเนินการ', controlled:'ควบคุมได้แล้ว', closed:'ปิดแล้ว' };

  container.innerHTML = sortedKeys.map(proj => {
    const items = groups[proj].slice().sort((a,b) => (b.likelihood*b.impact) - (a.likelihood*a.impact));
    const scores = items.map(r => r.likelihood * r.impact);
    const maxScore = Math.max(...scores);
    const maxLv = rrgGetLevel(maxScore);
    const openCnt = items.filter(r => r.status !== 'controlled' && r.status !== 'closed').length;
    // strategy of first item (usually same across project)
    const strat = items[0].strategy ? (RRG_S_SHORT[items[0].strategy] || '') : '';

    // level distribution for the mini bar
    const dist = { low:0, medium:0, high:0, veryhigh:0 };
    items.forEach(r => { dist[rrgGetLevel(r.likelihood*r.impact).key]++; });
    const total = items.length;
    const segColors = { veryhigh:'#dc2626', high:'#ea580c', medium:'#d97706', low:'#16a34a' };
    const bar = ['veryhigh','high','medium','low'].map(k =>
      dist[k] ? `<div class="rrg-proj-bar-seg" style="width:${dist[k]/total*100}%;background:${segColors[k]}" title="${k}: ${dist[k]}"></div>` : ''
    ).join('');

    const isOpen = _rrgExpandedProjects[proj];

    // Factor rows
    const factors = items.map(r => {
      const sc = r.likelihood * r.impact;
      const lv = rrgGetLevel(sc);
      const overdue = r.dueDate && new Date(r.dueDate) < new Date(new Date().toDateString()) && r.status!=='controlled' && r.status!=='closed';
      return `<div class="rrg-factor" onclick="rrgOpenDetail(${r.id})">
        <div class="rrg-factor-left">
          <div class="rrg-factor-name">${r.name}${r.source==='prm' ? ' <span style="font-size:10px;font-weight:700;color:var(--accent);background:var(--accent-light);border-radius:99px;padding:1px 8px;vertical-align:middle">📋 จาก PRM</span>' : ''}</div>
          ${r.activity && r.activity !== r.name ? `<div style="font-size:10.5px;color:var(--text3);margin-top:1px">🗂️ ${r.activity}</div>` : ''}
          <div class="rrg-factor-meta">
            <span class="rrg-cat ${r.category||'other'}">${RRG_CAT_NAMES[r.category]||r.category||'-'}</span>
            <span class="rrg-status ${r.status||'open'}">${stMap[r.status]||'-'}</span>
            ${r.residual ? `<span style="font-size:11px;color:var(--text3)">คงเหลือ: ${resMap[r.residual]||''}</span>` : ''}
            ${r.dueDate ? `<span style="font-size:11px;color:${overdue?'var(--red)':'var(--text3)'};font-weight:${overdue?'700':'400'}">${overdue?'⚠️ ':'📅 '}${new Date(r.dueDate).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'})}</span>` : ''}
          </div>
          ${r.control ? `<div class="rrg-factor-control"><b>แผนรองรับ:</b><span>${r.control}</span></div>` : ''}
        </div>
        <div class="rrg-factor-right" onclick="event.stopPropagation()">
          <div class="rrg-factor-score">
            <div class="rrg-factor-score-num" style="color:${lv.color}">${sc}</div>
            <div style="font-size:9px;color:var(--text3)">L${r.likelihood}×I${r.impact}</div>
          </div>
          <span class="rrg-badge ${lv.key}" style="font-size:10px">${lv.label}</span>
          <div class="rrg-factor-actions">
            <button class="btn btn-sm" onclick="rrgOpenDetail(${r.id})" style="color:var(--s5);padding:3px 6px;font-size:12px" title="ดู">👁️</button>
            ${canEdit && r.source!=='prm' ? `<button class="btn btn-sm" onclick="rrgOpenForm(${r.id})" style="color:var(--accent);padding:3px 6px;font-size:12px" title="แก้ไข">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="rrgOpenDelete(${r.id})" style="padding:3px 6px;font-size:12px" title="ลบ">🗑️</button>` : ''}
            ${canEdit && r.source==='prm' ? `<button class="btn btn-sm" onclick="event.stopPropagation();rrgOpenReportForm('${r.prmRecordId}',${r.prmRowIdx})" style="color:var(--accent);padding:3px 6px;font-size:11px" title="บันทึกรายงานผล">📝 รายงานผล</button>
            <button class="btn btn-sm" onclick="showPage('risk')" style="color:var(--text2);padding:3px 6px;font-size:11px" title="แก้ไขข้อมูลแผนที่หน้าแผนบริหารความเสี่ยง (PRM)">🗂️ PRM</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    return `<div class="rrg-proj-card ${isOpen?'open':''}">
      <div class="rrg-proj-head lv-${maxLv.key}" onclick="rrgToggleProjectCard('${encodeURIComponent(proj)}')">
        <div class="rrg-proj-chevron">▶</div>
        <div style="min-width:0">
          <div class="rrg-proj-title">${proj}</div>
          <div class="rrg-proj-sub">${strat ? strat+' · ' : ''}คลิกเพื่อ${isOpen?'ย่อ':'ขยาย'}ดูปัจจัยเสี่ยง</div>
        </div>
        <div class="rrg-proj-stats">
          <div class="rrg-proj-stat"><div class="rrg-proj-stat-num" style="color:var(--accent)">${total}</div><div class="rrg-proj-stat-lbl">ปัจจัยเสี่ยง</div></div>
          <div class="rrg-proj-stat"><div class="rrg-proj-stat-num" style="color:${maxLv.color}">${maxScore}</div><div class="rrg-proj-stat-lbl">คะแนนสูงสุด</div></div>
          <div class="rrg-proj-stat"><div class="rrg-proj-stat-num" style="color:${openCnt>0?'var(--red)':'var(--green)'}">${openCnt}</div><div class="rrg-proj-stat-lbl">ยังไม่ควบคุม</div></div>
          <div style="text-align:center">
            <div class="rrg-proj-bar">${bar}</div>
            <div class="rrg-proj-stat-lbl" style="margin-top:3px">ระดับเสี่ยงรวม</div>
          </div>
          <button class="btn btn-sm" onclick="event.stopPropagation(); rrgExportProjectPDF('${encodeURIComponent(proj)}')"
            style="align-self:center;color:#dc2626;border-color:#f5a5a5;background:#fff0f0;font-size:11px;padding:5px 10px;white-space:nowrap"
            title="Export PDF รายโครงการ (รวมแผนบริหารความเสี่ยง PRM และผลการดำเนินการ)">📄 PDF รายโครงการ</button>
        </div>
      </div>
      <div class="rrg-proj-body">
        ${factors}
        ${canEdit ? `<button class="rrg-proj-addbtn" onclick="rrgOpenFormForProject('${encodeURIComponent(proj)}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          เพิ่มปัจจัยเสี่ยงในโครงการนี้
        </button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function rrgToggleProjectCard(encProj) {
  const proj = decodeURIComponent(encProj);
  _rrgExpandedProjects[proj] = !_rrgExpandedProjects[proj];
  rrgRenderTable();
}

// Open the add form with project pre-filled
function rrgOpenFormForProject(encProj) {
  const proj = decodeURIComponent(encProj);
  rrgOpenForm();
  setTimeout(() => {
    const pEl = document.getElementById('rrgProject');
    if (pEl && proj && proj !== '(ไม่ได้ระบุโครงการ)') {
      pEl.value = proj;
      rrgOnProjectChange();
    }
  }, 150);
}

function rrgGetFiltered() {
  const search   = (document.getElementById('rrgSearch')?.value || '').toLowerCase();
  const level    = document.getElementById('rrgFilterLevel')?.value   || '';
  const category = document.getElementById('rrgFilterCategory')?.value|| '';
  const status   = document.getElementById('rrgFilterStatus')?.value  || '';
  const strategy = document.getElementById('rrgFilterStrategy')?.value|| '';
  const quarter  = document.getElementById('rrgQuarterFilter')?.value|| '';
  return rrgList.filter(r => {
    const score = r.likelihood * r.impact;
    const lv = rrgGetLevel(score).key;
    if (search && !r.name.toLowerCase().includes(search) && !(r.owner||'').toLowerCase().includes(search)) return false;
    if (level && lv !== level) return false;
    if (category && r.category !== category) return false;
    if (status && r.status !== status) return false;
    if (strategy && r.strategy !== strategy) return false;
    if (quarter && r.quarter && r.quarter !== 'all' && r.quarter !== quarter) return false;
    return true;
  });
}

function rrgRenderTable() {
  rrgUpdateMetrics();
  rrgBuildMatrix();
  rrgBuildCategoryBreakdown();

  const filtered = rrgGetFiltered();
  const tbody    = document.getElementById('rrgTableBody');
  const empty    = document.getElementById('rrgEmptyState');
  const emptyMsg = document.getElementById('rrgEmptyMsg');
  const flatView = document.getElementById('rrgFlatView');
  const projView = document.getElementById('rrgProjectView');
  if (!tbody) return;

  // Toggle which view is visible
  const isProject = rrgView === 'project';
  if (flatView) flatView.style.display = isProject ? 'none' : 'block';
  if (projView) projView.style.display = isProject ? 'block' : 'none';

  // Empty handling
  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (projView) projView.innerHTML = '';
    if (empty) empty.style.display = '';
    if (emptyMsg) emptyMsg.textContent = rrgList.length === 0 ? 'ยังไม่มีข้อมูลความเสี่ยง · กดปุ่ม "บันทึกความเสี่ยงใหม่" เพื่อเริ่มต้น' : 'ไม่พบความเสี่ยงที่ตรงกับเงื่อนไขค้นหา';
    rrgRenderPagination(0);
    return;
  }
  if (empty) empty.style.display = 'none';

  if (isProject) {
    rrgRenderProjectView(filtered);
    rrgRenderPagination(0); // pagination hidden in project view
    return;
  }

  const start = (rrgCurrentPage - 1) * RRG_PAGE_SIZE;
  const page  = filtered.slice(start, start + RRG_PAGE_SIZE);

  tbody.innerHTML = page.map((r, idx) => {
    const score = r.likelihood * r.impact;
    const lv    = rrgGetLevel(score);
    const stCls = { open:'open', inprogress:'inprogress', controlled:'controlled', closed:'closed' }[r.status] || 'open';
    const catCls= r.category || 'other';
    const canEdit = _isEditable();
    // Residual badge
    const resMap = {low:'🟢 ต่ำ', medium:'🟡 ปานกลาง', high:'🟠 สูง', veryhigh:'🔴 สูงมาก'};
    const resTxt = r.residual ? `<span class="rrg-badge ${r.residual}">${resMap[r.residual]}</span>` : '<span style="color:var(--text3);font-size:11px">—</span>';
    // Due date with overdue highlight
    let dueTxt = '<span style="color:var(--text3);font-size:11px">—</span>';
    if (r.dueDate) {
      const due = new Date(r.dueDate);
      const today = new Date(); today.setHours(0,0,0,0);
      const overdue = due < today && r.status !== 'controlled' && r.status !== 'closed';
      const dueStr = due.toLocaleDateString('th-TH', {day:'numeric',month:'short',year:'2-digit'});
      dueTxt = `<span style="font-size:12px;color:${overdue?'var(--red)':'var(--text2)'};font-weight:${overdue?'700':'400'}">${overdue?'⚠️ ':''}${dueStr}</span>`;
    }
    return `<tr onclick="rrgOpenDetail(${r.id})" style="cursor:pointer">
      <td style="color:var(--text3);font-size:12px">${start + idx + 1}</td>
      <td>
        <div style="font-weight:600;font-size:13px;color:var(--text)">${r.name}${r.source==='prm' ? ' <span style="font-size:10px;font-weight:700;color:var(--accent);background:var(--accent-light);border-radius:99px;padding:1px 8px;vertical-align:middle">📋 จาก PRM</span>' : ''}</div>
        ${r.activity && r.activity !== r.name ? `<div style="font-size:10.5px;color:var(--text3);margin-top:1px">🗂️ ${r.activity}</div>` : ''}
        ${r.project ? `<div style="font-size:11px;color:var(--accent);margin-top:2px">📁 ${r.project}</div>` : ''}
        ${r.note ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">📝 ${r.note}</div>` : ''}
      </td>
      <td><span class="rrg-cat ${catCls}">${RRG_CAT_NAMES[r.category]||r.category}</span></td>
      <td style="font-size:12px;color:var(--text2)">${r.strategy ? (RRG_S_SHORT[r.strategy]||'-') : '—'}</td>
      <td style="text-align:center;font-size:14px;font-weight:700;color:var(--text2)">${r.likelihood}</td>
      <td style="text-align:center;font-size:14px;font-weight:700;color:var(--text2)">${r.impact}</td>
      <td class="rrg-td-score" style="color:${lv.color}">${score}</td>
      <td><span class="rrg-badge ${lv.key}">${lv.label}</span></td>
      <td>${resTxt}</td>
      <td><span class="rrg-status ${stCls}">${RRG_STATUS[r.status]||r.status}</span></td>
      <td style="font-size:12px;color:var(--text2);max-width:200px;white-space:pre-wrap;line-height:1.5">${r.control||'—'}</td>
      <td>${dueTxt}</td>
      <td style="font-size:12px;color:var(--text2)">${r.owner||'—'}</td>
      <td class="rrg-td-actions" onclick="event.stopPropagation()">
        <button class="btn btn-sm" onclick="rrgOpenDetail(${r.id})" style="color:var(--s5);padding:4px 8px;font-size:12px" title="ดูรายละเอียด">👁️</button>
        ${canEdit && r.source!=='prm' ? `
        <button class="btn btn-sm" onclick="rrgOpenForm(${r.id})" style="color:var(--accent);padding:4px 8px;font-size:12px" title="แก้ไข">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="rrgOpenDelete(${r.id})" style="padding:4px 8px;font-size:12px" title="ลบ">🗑️</button>
        ` : ''}
        ${canEdit && r.source==='prm' ? `
        <button class="btn btn-sm" onclick="rrgOpenReportForm('${r.prmRecordId}',${r.prmRowIdx})" style="color:var(--accent);padding:4px 8px;font-size:11px" title="บันทึกรายงานผล">📝 รายงานผล</button>
        <button class="btn btn-sm" onclick="showPage('risk')" style="color:var(--text2);padding:4px 8px;font-size:11px" title="แก้ไขข้อมูลแผนที่หน้าแผนบริหารความเสี่ยง (PRM)">🗂️ PRM</button>
        ` : ''}
      </td>
    </tr>`;
  }).join('');
  rrgRenderPagination(filtered.length);
}

function rrgRenderPagination(total) {
  const pag  = document.getElementById('rrgPagination');
  const info = document.getElementById('rrgPaginationInfo');
  const btns = document.getElementById('rrgPaginationBtns');
  if (!pag) return;
  const totalPages = Math.ceil(total / RRG_PAGE_SIZE);
  if (total <= RRG_PAGE_SIZE) { pag.style.display = 'none'; return; }
  pag.style.display = '';
  const start = (rrgCurrentPage - 1) * RRG_PAGE_SIZE + 1;
  const end   = Math.min(rrgCurrentPage * RRG_PAGE_SIZE, total);
  if (info) info.textContent = `แสดง ${start}–${end} จาก ${total} รายการ`;
  let html = '';
  for (let p = 1; p <= totalPages; p++) {
    html += `<button class="btn btn-sm${p===rrgCurrentPage?' btn-primary':''}" onclick="rrgGotoPage(${p})">${p}</button>`;
  }
  if (btns) btns.innerHTML = html;
}

function rrgGotoPage(p) {
  rrgCurrentPage = p;
  rrgRenderTable();
}

// ── Score preview in modal ──
function rrgUpdateScore() {
  const l = parseInt(document.getElementById('rrgLikelihood')?.value || 3);
  const i = parseInt(document.getElementById('rrgImpact')?.value || 3);
  const score = l * i;
  const lv = rrgGetLevel(score);
  const lhEl = document.getElementById('rrgLikelihoodVal');
  const imEl = document.getElementById('rrgImpactVal');
  const numEl = document.getElementById('rrgScoreNum');
  const lblEl = document.getElementById('rrgScoreLabel');
  if (lhEl) lhEl.textContent = `${l} – ${RRG_LH_LABELS[l]||l}`;
  if (imEl) imEl.textContent = `${i} – ${RRG_IM_LABELS[i]||i}`;
  if (numEl) { numEl.textContent = score; numEl.style.color = lv.color; }
  if (lblEl) { lblEl.textContent = lv.label; lblEl.style.color = lv.color; }
  // Update formula hint
  const preview = document.getElementById('rrgScorePreview');
  if (preview) {
    const hint = preview.querySelector('div:last-child');
    if (hint) hint.textContent = `โอกาส ${l} × ผลกระทบ ${i}`;
  }
  // Update slider gradient
  ['rrgLikelihood','rrgImpact'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const val = parseInt(el.value);
    const pct = (val - 1) / 4 * 100;
    el.style.background = `linear-gradient(to right, var(--accent) ${pct}%, var(--border2) ${pct}%)`;
  });
}

// ── Open/Close Form Modal ──
function rrgOpenForm(id) {
  if (id) {
    const existing = rrgList.find(x => x.id === id);
    if (existing && existing.source === 'prm') {
      showToast('📋 รายการนี้มาจากแผนบริหารความเสี่ยง (PRM) — กรุณาแก้ไขที่หน้า "แผนบริหารความเสี่ยง" แทน');
      return;
    }
  }
  rrgEditingId = id || null;
  rrgPopulateProjectList();
  const modal = document.getElementById('rrgModalOverlay');
  const title = document.getElementById('rrgModalTitle');
  if (!modal) return;
  if (id) {
    const r = rrgList.find(x => x.id === id);
    if (!r) return;
    title.textContent = '✏️ แก้ไขความเสี่ยง';
    document.getElementById('rrgProject').value    = r.project     || '';
    document.getElementById('rrgName').value        = r.name        || '';
    document.getElementById('rrgCategory').value    = r.category    || '';
    document.getElementById('rrgStrategy').value    = r.strategy    || '';
    document.getElementById('rrgQuarter').value     = r.quarter     || 'all';
    document.getElementById('rrgOwner').value       = r.owner       || '';
    document.getElementById('rrgLikelihood').value  = r.likelihood  || 3;
    document.getElementById('rrgImpact').value      = r.impact      || 3;
    document.getElementById('rrgControl').value     = r.control     || '';
    document.getElementById('rrgContingency').value = r.contingency || '';
    document.getElementById('rrgStatus').value      = r.status      || 'open';
    document.getElementById('rrgResidual').value    = r.residual    || '';
    document.getElementById('rrgDueDate').value     = r.dueDate     || '';
    document.getElementById('rrgReviewDate').value  = r.reviewDate  || '';
    document.getElementById('rrgNote').value        = r.note        || '';
  } else {
    title.textContent = '🛡️ บันทึกความเสี่ยงใหม่';
    document.getElementById('rrgProject').value     = '';
    document.getElementById('rrgName').value        = '';
    document.getElementById('rrgCategory').value    = '';
    document.getElementById('rrgStrategy').value    = '';
    document.getElementById('rrgQuarter').value     = 'all';
    document.getElementById('rrgOwner').value       = '';
    document.getElementById('rrgLikelihood').value  = 3;
    document.getElementById('rrgImpact').value      = 3;
    document.getElementById('rrgControl').value     = '';
    document.getElementById('rrgContingency').value = '';
    document.getElementById('rrgStatus').value      = 'open';
    document.getElementById('rrgResidual').value    = '';
    document.getElementById('rrgDueDate').value     = '';
    document.getElementById('rrgReviewDate').value  = '';
    document.getElementById('rrgNote').value        = '';
  }
  rrgUpdateScore();
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('rrgProject')?.focus(), 120);
}

function rrgCloseModal() {
  const modal = document.getElementById('rrgModalOverlay');
  if (modal) modal.style.display = 'none';
  rrgEditingId = null;
}

// ── Save Risk ──
function rrgSaveEntry() {
  const project  = (document.getElementById('rrgProject')?.value || '').trim();
  const name     = (document.getElementById('rrgName')?.value || '').trim();
  const category = document.getElementById('rrgCategory')?.value || '';
  const strategy = document.getElementById('rrgStrategy')?.value || '';
  const quarter  = document.getElementById('rrgQuarter')?.value  || 'all';
  const owner    = (document.getElementById('rrgOwner')?.value || '').trim();
  const likelihood = parseInt(document.getElementById('rrgLikelihood')?.value || 3);
  const impact     = parseInt(document.getElementById('rrgImpact')?.value     || 3);
  const control    = (document.getElementById('rrgControl')?.value     || '').trim();
  const contingency= (document.getElementById('rrgContingency')?.value || '').trim();
  const status   = document.getElementById('rrgStatus')?.value || 'open';
  const residual = document.getElementById('rrgResidual')?.value || '';
  const dueDate  = document.getElementById('rrgDueDate')?.value || '';
  const reviewDate = document.getElementById('rrgReviewDate')?.value || '';
  const note     = (document.getElementById('rrgNote')?.value || '').trim();

  if (!name)     { showToast('⚠️ กรุณากรอกชื่อ/รายละเอียดความเสี่ยง'); return; }
  if (!category) { showToast('⚠️ กรุณาเลือกประเภทความเสี่ยง'); return; }

  const obj = { project, name, category, strategy, quarter, owner, likelihood, impact,
    control, contingency, status, residual, dueDate, reviewDate, note,
    lastEditedBy: _currentUser?.name || 'ผู้ใช้',
    lastEditedByPosition: _currentUser?.position || '',
    lastEditedAt: new Date().toISOString()
  };

  if (rrgEditingId) {
    const idx = rrgList.findIndex(r => r.id === rrgEditingId);
    if (idx >= 0) rrgList[idx] = { ...rrgList[idx], ...obj };
    showSavePopup('แก้ไขความเสี่ยงสำเร็จ!', `"${name}" อัปเดตข้อมูลเรียบร้อยแล้ว`);
    _rrgAutoSync('saveRiskRegister70', { data: rrgList[idx] });
  } else {
    // คำนวณ id ใหม่จากรายการที่บันทึกเองในหน้านี้เท่านั้น (ไม่รวมรายการจาก PRM ซึ่งใช้เลขติดลบ)
    const manualIds = rrgList.filter(r => r.source !== 'prm').map(r => r.id);
    const newId = manualIds.length ? Math.max(...manualIds) + 1 : 1;
    const newRisk = { id: newId, ...obj };
    rrgList.push(newRisk);
    showSavePopup('บันทึกความเสี่ยงสำเร็จ!', `"${name}" ได้รับการบันทึกในระบบแล้ว`);
    _rrgAutoSync('saveRiskRegister70', { data: newRisk });
  }
  rrgSaveLocal();
  rrgCloseModal();
  rrgRenderTable();
}

// ── Delete ──
function rrgOpenDelete(id) {
  const target = rrgList.find(x => x.id === id);
  if (target && target.source === 'prm') {
    showToast('📋 รายการนี้มาจากแผนบริหารความเสี่ยง (PRM) — ไม่สามารถลบจากหน้านี้ได้');
    return;
  }
  rrgDeleteId = id;
  const r = rrgList.find(x => x.id === id);
  const nameEl = document.getElementById('rrgDeleteName');
  if (nameEl && r) nameEl.textContent = r.name;
  const ov = document.getElementById('rrgDeleteOverlay');
  if (ov) ov.style.display = 'flex';
}
function rrgCloseDelete() {
  const ov = document.getElementById('rrgDeleteOverlay');
  if (ov) ov.style.display = 'none';
  rrgDeleteId = null;
}
function rrgConfirmDelete() {
  if (!rrgDeleteId) return;
  const delId = rrgDeleteId;
  rrgList = rrgList.filter(r => r.id !== delId);
  rrgSaveLocal();
  _rrgAutoSync('deleteRiskRegister70', { id: delId });
  rrgCloseDelete();
  rrgRenderTable();
  showToast('🗑️ ลบรายการความเสี่ยงแล้ว');
}

// ═══════════════════════════════════════════════════════
// RISK DETAIL / PREVIEW
// ═══════════════════════════════════════════════════════
let _rrgDetailId = null;

function rrgOpenDetail(id) {
  const r = rrgList.find(x => x.id === id);
  if (!r) return;
  _rrgDetailId = id;
  const score = r.likelihood * r.impact;
  const lv = rrgGetLevel(score);
  const resMap = { low:'🟢 ต่ำ — ยอมรับได้', medium:'🟡 ปานกลาง — ต้องเฝ้าระวัง', high:'🟠 สูง — ต้องควบคุมเพิ่ม', veryhigh:'🔴 สูงมาก — ต้องเร่งจัดการ' };
  const stMap  = { open:'ยังไม่ดำเนินการ', inprogress:'กำลังดำเนินการ', controlled:'ควบคุมได้แล้ว', closed:'ปิดแล้ว' };
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'}) : '—';

  // Header
  document.getElementById('rrgDetailTitle').textContent = r.name || '—';
  const activityEl = document.getElementById('rrgDetailActivity');
  if (activityEl) {
    if (r.activity && r.activity !== r.name) {
      activityEl.textContent = '🗂️ กิจกรรม: ' + r.activity;
      activityEl.style.display = '';
    } else {
      activityEl.style.display = 'none';
    }
  }
  const projEl = document.getElementById('rrgDetailProject');
  projEl.textContent = r.project ? ('📁 ' + r.project) : '';
  if (r.source === 'prm') projEl.textContent += '  ·  📋 ข้อมูลจากแผนบริหารความเสี่ยง (PRM)';
  // Color header by level
  const hdr = document.getElementById('rrgDetailHeader');
  hdr.style.borderLeft = `5px solid ${lv.color}`;

  const sFull = { '1':'ยุทธศาสตร์ที่ 1', '2':'ยุทธศาสตร์ที่ 2', '3':'ยุทธศาสตร์ที่ 3', '4':'ยุทธศาสตร์ที่ 4', '5':'งบบริหารสำนักงาน' };

  document.getElementById('rrgDetailBody').innerHTML = `
    <!-- Score banner -->
    <div style="display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center;background:var(--surface2);border-radius:var(--radius-lg);padding:1rem 1.25rem;margin-bottom:1.25rem;border:1px solid var(--border)">
      <div style="text-align:center">
        <div style="font-size:42px;font-weight:800;line-height:1;color:${lv.color}">${score}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">คะแนนความเสี่ยง</div>
      </div>
      <div>
        <span class="rrg-badge ${lv.key}" style="font-size:13px;padding:5px 12px">${lv.label}</span>
        <div style="display:flex;gap:20px;margin-top:10px">
          <div><div style="font-size:11px;color:var(--text3)">โอกาส (Likelihood)</div><div style="font-size:18px;font-weight:700">${r.likelihood} / 5</div></div>
          <div style="border-left:1px solid var(--border);padding-left:20px"><div style="font-size:11px;color:var(--text3)">ผลกระทบ (Impact)</div><div style="font-size:18px;font-weight:700">${r.impact} / 5</div></div>
        </div>
      </div>
    </div>

    <!-- Info grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:1.25rem">
      <div><div style="font-size:12px;color:var(--text3);margin-bottom:2px">ประเภทความเสี่ยง</div><div><span class="rrg-cat ${r.category||'other'}">${RRG_CAT_NAMES[r.category]||r.category||'—'}</span></div></div>
      <div><div style="font-size:12px;color:var(--text3);margin-bottom:2px">ยุทธศาสตร์</div><div style="font-weight:600;font-size:14px">${r.strategy ? (sFull[r.strategy]||'—') : '—'}</div></div>
      <div><div style="font-size:12px;color:var(--text3);margin-bottom:2px">สถานะการจัดการ</div><div><span class="rrg-status ${r.status||'open'}">${stMap[r.status]||'—'}</span></div></div>
      <div><div style="font-size:12px;color:var(--text3);margin-bottom:2px">ความเสี่ยงคงเหลือหลังควบคุม</div><div style="font-weight:600;font-size:14px">${r.residual ? resMap[r.residual] : '—'}</div></div>
      <div><div style="font-size:12px;color:var(--text3);margin-bottom:2px">ผู้รับผิดชอบ</div><div style="font-weight:600;font-size:14px">${r.owner||'—'}</div></div>
      <div><div style="font-size:12px;color:var(--text3);margin-bottom:2px">ไตรมาส</div><div style="font-weight:600;font-size:14px">${r.quarter==='all'?'ตลอดทั้งปี':('ไตรมาส '+(r.quarter||'—'))}</div></div>
      <div><div style="font-size:12px;color:var(--text3);margin-bottom:2px">กำหนดวันแล้วเสร็จ</div><div style="font-weight:600;font-size:14px">${fmtDate(r.dueDate)}</div></div>
      <div><div style="font-size:12px;color:var(--text3);margin-bottom:2px">วันที่ทบทวนล่าสุด</div><div style="font-weight:600;font-size:14px">${fmtDate(r.reviewDate)}</div></div>
    </div>

    <!-- Control measures -->
    <div style="margin-bottom:1rem">
      <div style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:6px;display:flex;align-items:center;gap:6px">🛡️ มาตรการควบคุม / แผนรับมือ</div>
      <div style="background:var(--green-light);border:1px solid #86efac;border-radius:var(--radius);padding:.875rem 1rem;font-size:14px;line-height:1.7;white-space:pre-wrap;color:#14532d">${r.control || '— ยังไม่ได้ระบุ —'}</div>
    </div>
    <div style="margin-bottom:1rem">
      <div style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:6px;display:flex;align-items:center;gap:6px">🚨 ผลการดำเนินงาน / แผนเผชิญเหตุ</div>
      <div style="background:var(--amber-light);border:1px solid #f6cc70;border-radius:var(--radius);padding:.875rem 1rem;font-size:14px;line-height:1.7;white-space:pre-wrap;color:#92400e">${r.contingency || '— ยังไม่ได้ระบุ —'}</div>
    </div>
    ${r.note ? `<div style="margin-bottom:.5rem"><div style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:6px">📝 หมายเหตุ</div><div style="font-size:14px;color:var(--text2);line-height:1.6">${r.note}</div></div>` : ''}
    ${r.lastEditedBy ? `<div style="font-size:11px;color:var(--text3);margin-top:1rem;border-top:1px solid var(--border);padding-top:8px">แก้ไขล่าสุดโดย: ${r.lastEditedBy}${r.lastEditedByPosition ? ' ('+r.lastEditedByPosition+')' : ''}${r.lastEditedAt ? ' · '+new Date(r.lastEditedAt).toLocaleString('th-TH') : ''}</div>` : ''}
  `;

  // ปุ่ม "แก้ไข" สำหรับรายการที่บันทึกเองในหน้านี้ / ปุ่ม "บันทึกรายงานผล" สำหรับรายการที่มาจาก PRM
  // (แก้ไขข้อมูลแผน PRM หลัก เช่น ชื่อความเสี่ยง โอกาส/ผลกระทบ ยังต้องไปที่หน้า PRM ตามเดิม แต่ฟิลด์
  // รายงานผล เช่น สถานะ/ความเสี่ยงคงเหลือ/กำหนดวัน/หมายเหตุ กรอกจากหน้านี้ได้เลยผ่านปุ่มนี้)
  const editBtn = document.getElementById('rrgDetailEditBtn');
  if (editBtn) editBtn.style.display = (_isEditable() && r.source !== 'prm') ? '' : 'none';
  const reportBtn = document.getElementById('rrgDetailReportBtn');
  if (reportBtn) reportBtn.style.display = (_isEditable() && r.source === 'prm') ? '' : 'none';

  document.getElementById('rrgDetailOverlay').style.display = 'flex';
}

function rrgCloseDetail() {
  const ov = document.getElementById('rrgDetailOverlay');
  if (ov) ov.style.display = 'none';
  _rrgDetailId = null;
}

function rrgEditFromDetail() {
  const id = _rrgDetailId;
  rrgCloseDetail();
  if (id) rrgOpenForm(id);
}

function rrgOpenReportFormFromDetail() {
  const r = rrgList.find(x => x.id === _rrgDetailId);
  if (!r || r.source !== 'prm') return;
  rrgCloseDetail();
  rrgOpenReportForm(r.prmRecordId, r.prmRowIdx);
}

// ═══════════════════════════════════════════════════════
// RISK PDF EXPORT
// ═══════════════════════════════════════════════════════

// ── หัวกระดาษ/รูปแบบ PDF ของรายงานนี้ — ใช้ชุดเดียวกับ PDF อื่นๆ ทั้งระบบ (โลโก้ + กรอบ 36px
// ซ้าย-ขวา ตัว headerOpts จะถูกซ้ำหัวกระดาษให้อัตโนมัติทุกหน้าโดย _runPdfExport เอง) เดิมโมดูลนี้
// สร้างหัวกระดาษเองแบบไม่มีโลโก้ (ฟังก์ชัน _rrgReportHeader เดิม) และเนื้อหาไม่มีขอบซ้าย-ขวาเหมือน
// เอกสารอื่น ทำให้ PDF ที่ได้จัดหน้าไม่ตรงกับรูปแบบมาตรฐานของระบบ — แก้โดยใช้ headerOpts +
// กรอบเนื้อหา padding:6px 36px 28px เดียวกับทุกเอกสารในระบบ ──
function _rrgPdfHeaderOpts(subtitle2) {
  return {
    logoSrc: (typeof _DLF_LOGO_SRC !== 'undefined') ? _DLF_LOGO_SRC : '',
    title: 'รายงานผลการบริหารความเสี่ยง',
    subtitle: 'มูลนิธิการศึกษาทางไกลผ่านดาวเทียม ในพระบรมราชูปถัมภ์ · ปีงบประมาณ พ.ศ. 2570',
    subtitle2: subtitle2 || ''
  };
}
function _rrgPdfWrap(innerHtml) {
  return `<div style="font-family:'Sarabun',sans-serif;width:100%;box-sizing:border-box;margin:0 auto;background:#fff;color:#111;font-size:11px;line-height:1.7;padding:6px 36px 28px;overflow-wrap:anywhere;word-break:normal">${innerHtml}</div>`;
}

// Export the full risk report (matrix + table) to PDF
async function rrgExportReportPDF() {
  showToast('⏳ กำลังสร้าง PDF รายงานความเสี่ยง...');
  try {
    const filtered = rrgGetFiltered();
    const html = _rrgBuildReportHTML(filtered);
    const qf = document.getElementById('rrgQuarterFilter')?.value || '';
    await _runPdfExport(html, 'riskregister-70-report', _rrgPdfHeaderOpts(qf ? ('ไตรมาส ' + qf) : 'ทุกไตรมาส'));
  } catch(err) {
    console.error(err);
    showToast('❌ สร้าง PDF ไม่สำเร็จ: ' + err.message);
  }
}

// Export a single risk's detail to PDF
async function rrgExportSinglePDF() {
  const r = rrgList.find(x => x.id === _rrgDetailId);
  if (!r) return;
  showToast('⏳ กำลังสร้าง PDF...');
  try {
    const html = _rrgBuildSingleHTML(r);
    await _runPdfExport(html, 'riskregister-70-' + r.id, _rrgPdfHeaderOpts('แบบรายงานความเสี่ยงรายการ'));
  } catch(err) {
    console.error(err);
    showToast('❌ สร้าง PDF ไม่สำเร็จ: ' + err.message);
  }
}

// ── Export PDF รายโครงการ: รวมทั้งแผนบริหารความเสี่ยง (PRM 01-04) และการรายงานผลไว้ในฉบับเดียว ──
async function rrgExportProjectPDF(encProj) {
  const proj = decodeURIComponent(encProj);
  showToast('⏳ กำลังสร้าง PDF รายโครงการ...');
  try {
    const html = _rrgBuildProjectHTML(proj);
    const safeName = proj.replace(/[\/\\:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 40) || 'โครงการ';
    // ใช้กระดาษแนวนอน (landscape) เพราะตารางมีหลายคอลัมน์ (มาตรการควบคุม/ระยะเวลา/งบประมาณ/สถานะ/
    // ผู้รับผิดชอบ) แนวตั้งบีบพื้นที่ข้อความจนแคบเกินไป แนวนอนให้พื้นที่อ่านง่ายกว่ามาก
    await _runPdfExport(html, 'riskregister-70-project-' + safeName, _rrgPdfHeaderOpts('รายงานรายโครงการ (แผน + ผลการดำเนินการ)'), 'landscape');
  } catch(err) {
    console.error(err);
    showToast('❌ สร้าง PDF ไม่สำเร็จ: ' + err.message);
  }
}

function _rrgBuildProjectHTML(proj) {
  const items = rrgList
    .filter(r => ((r.project && r.project.trim()) || '(ไม่ได้ระบุโครงการ)') === proj)
    .slice()
    .sort((a, b) => (b.likelihood * b.impact) - (a.likelihood * a.impact));

  // ── ดึงข้อมูลหัวโครงการ (ยุทธศาสตร์ / กลุ่มงาน / วัตถุประสงค์) จากแผน PRM ของโครงการนี้ ถ้ามี ──
  if (typeof loadRiskStorage === 'function') { try { loadRiskStorage(); } catch(e) {} }
  const src = (typeof riskData !== 'undefined' && riskData) ? riskData : {};
  let meta = null, matchedRecId = null;
  Object.keys(src).forEach(recId => {
    const rec = src[recId] || {};
    const pname = (rec.meta && rec.meta.projname) || rec.name || '';
    if (pname === proj) { meta = rec.meta || {}; matchedRecId = recId; }
  });
  const sFull = { '1':'ยุทธศาสตร์ที่ 1', '2':'ยุทธศาสตร์ที่ 2', '3':'ยุทธศาสตร์ที่ 3', '4':'ยุทธศาสตร์ที่ 4', '5':'งบบริหารสำนักงาน' };
  const stMap = { open:'ยังไม่ดำเนินการ', inprogress:'กำลังดำเนินการ', controlled:'ควบคุมได้แล้ว', closed:'ปิดแล้ว' };

  const total = items.length;
  const high  = items.filter(r => r.likelihood*r.impact >= 10).length;
  const med   = items.filter(r => { const s=r.likelihood*r.impact; return s>=5&&s<10; }).length;
  const low   = items.filter(r => r.likelihood*r.impact < 5).length;

  const infoBox = meta ? `
    <div style="border:1px solid #e4e7ed;border-radius:8px;padding:10px 14px;margin-bottom:14px;background:#fafbff">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:11px">
        <div><b>ยุทธศาสตร์:</b> ${meta.strategy ? (sFull[meta.strategy]||'—') : '—'}</div>
        <div><b>กลุ่มงาน / ฝ่าย:</b> ${meta.dept || '—'}</div>
        <div style="grid-column:1/-1"><b>วัตถุประสงค์:</b> ${meta.objectives || '—'}</div>
      </div>
    </div>` : '';

  const rows = items.map((r, i) => {
    const score = r.likelihood * r.impact;
    const lv = rrgGetLevel(score);
    // รายการที่มาจาก PRM ดึงระยะเวลา/งบประมาณจากแผน PRM 04 ต้นฉบับโดยตรง (ครบถ้วนกว่าการอ่านจาก note)
    let timeline = '', budget = '';
    if (r.source === 'prm' && r.prmRecordId != null && src[r.prmRecordId]) {
      const p = (src[r.prmRecordId].plan || {})[r.prmRowIdx] || {};
      timeline = p.timeline || '';
      budget = p.budget ? (typeof formatMoneyText === 'function' ? formatMoneyText(p.budget) : p.budget) : '';
    }
    return `<tr style="border-bottom:1px solid #e4e7ed">
      <td style="padding:6px;font-size:10.5px;text-align:center">${i+1}</td>
      <td style="padding:6px;font-size:10.5px">${r.name||'—'}<br><span style="font-size:9.5px;color:#5a6477">${RRG_CAT_NAMES[r.category]||r.category||''}${r.source==='prm'?' · 📋 PRM':''}</span>${r.activity && r.activity !== r.name ? `<br><span style="font-size:9.5px;color:#3b72f0">🗂️ ${r.activity}</span>` : ''}</td>
      <td style="padding:6px;font-size:10.5px;text-align:center">${r.likelihood}×${r.impact}</td>
      <td style="padding:6px;font-size:12px;font-weight:800;text-align:center;color:${lv.color}">${score}</td>
      <td style="padding:6px;font-size:9.5px;text-align:center;color:${lv.color};font-weight:700">${lv.label}</td>
      <td style="padding:6px;font-size:10px">${r.control||'—'}</td>
      <td style="padding:6px;font-size:10px">${timeline||'—'}</td>
      <td style="padding:6px;font-size:10px">${budget?(budget+' บาท'):'—'}</td>
      <td style="padding:6px;font-size:10px">${stMap[r.status]||'—'}</td>
      <td style="padding:6px;font-size:10px">${r.owner||'—'}</td>
    </tr>`;
  }).join('');

  return _rrgPdfWrap(`
    <div style="font-size:15px;font-weight:800;color:#1c2333;margin-bottom:8px">📁 ${proj}</div>
    ${infoBox}
    <div style="display:flex;gap:10px;margin-bottom:14px">
      <div style="flex:1;background:#eef2fd;border:1px solid #bfcff8;border-radius:8px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:800;color:#3b72f0">${total}</div><div style="font-size:9.5px;color:#5a6477">ความเสี่ยงทั้งหมด</div></div>
      <div style="flex:1;background:#fff0f0;border:1px solid #f5a5a5;border-radius:8px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:800;color:#dc2626">${high}</div><div style="font-size:9.5px;color:#5a6477">สูง/สูงมาก</div></div>
      <div style="flex:1;background:#fff8e6;border:1px solid #f6cc70;border-radius:8px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:800;color:#d97706">${med}</div><div style="font-size:9.5px;color:#5a6477">ปานกลาง</div></div>
      <div style="flex:1;background:#e6f7ef;border:1px solid #86d9b0;border-radius:8px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:800;color:#1a9a5c">${low}</div><div style="font-size:9.5px;color:#5a6477">ต่ำ</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e4e7ed">
      <thead>
        <tr style="background:#dc2626;color:#fff">
          <th style="padding:7px 6px;font-size:10.5px;text-align:center">#</th>
          <th style="padding:7px 6px;font-size:10.5px;text-align:left">ปัจจัยความเสี่ยง / กิจกรรม / ประเภท</th>
          <th style="padding:7px 6px;font-size:10.5px;text-align:center">L×I</th>
          <th style="padding:7px 6px;font-size:10.5px;text-align:center">คะแนน</th>
          <th style="padding:7px 6px;font-size:10.5px;text-align:center">ระดับ</th>
          <th style="padding:7px 6px;font-size:10.5px;text-align:left">มาตรการควบคุม (PRM 04)</th>
          <th style="padding:7px 6px;font-size:10.5px;text-align:left">ระยะเวลา</th>
          <th style="padding:7px 6px;font-size:10.5px;text-align:left">งบประมาณ</th>
          <th style="padding:7px 6px;font-size:10.5px;text-align:left">สถานะ (รายงานผล)</th>
          <th style="padding:7px 6px;font-size:10.5px;text-align:left">ผู้รับผิดชอบ</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="10" style="padding:20px;text-align:center;color:#9aa3b2">ไม่มีข้อมูลความเสี่ยงของโครงการนี้</td></tr>'}</tbody>
    </table>`);
}

function _rrgBuildReportHTML(list) {
  const total = list.length;
  const high  = list.filter(r => r.likelihood*r.impact >= 10).length;
  const med   = list.filter(r => { const s=r.likelihood*r.impact; return s>=5&&s<10; }).length;
  const low   = list.filter(r => r.likelihood*r.impact < 5).length;
  const stMap = { open:'ยังไม่ดำเนินการ', inprogress:'กำลังดำเนินการ', controlled:'ควบคุมได้แล้ว', closed:'ปิดแล้ว' };
  const qf = document.getElementById('rrgQuarterFilter')?.value || '';
  const qLabel = qf ? ('ไตรมาส '+qf) : 'ทุกไตรมาส';

  let rows = list.map((r, i) => {
    const score = r.likelihood * r.impact;
    const lv = rrgGetLevel(score);
    return `<tr style="border-bottom:1px solid #e4e7ed">
      <td style="padding:7px 6px;font-size:11px;text-align:center">${i+1}</td>
      <td style="padding:7px 6px;font-size:11px">
        <b>${r.name||'—'}</b>${r.activity && r.activity !== r.name ? ('<br><span style="color:#5a6477;font-size:10px">🗂️ '+r.activity+'</span>') : ''}${r.project?('<br><span style="color:#3b72f0;font-size:10px">📁 '+r.project+'</span>'):''}
      </td>
      <td style="padding:7px 6px;font-size:11px">${RRG_CAT_NAMES[r.category]||r.category||'—'}</td>
      <td style="padding:7px 6px;font-size:11px;text-align:center">${r.likelihood}×${r.impact}</td>
      <td style="padding:7px 6px;font-size:13px;font-weight:800;text-align:center;color:${lv.color}">${score}</td>
      <td style="padding:7px 6px;font-size:10px;text-align:center;color:${lv.color};font-weight:700">${lv.label}</td>
      <td style="padding:7px 6px;font-size:10px">${stMap[r.status]||'—'}</td>
      <td style="padding:7px 6px;font-size:10px">${r.control||'—'}</td>
      <td style="padding:7px 6px;font-size:10px">${r.owner||'—'}</td>
    </tr>`;
  }).join('');

  return _rrgPdfWrap(`
    <!-- summary boxes -->
    <div style="display:flex;gap:10px;margin-bottom:18px">
      <div style="flex:1;background:#eef2fd;border:1px solid #bfcff8;border-radius:8px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:800;color:#3b72f0">${total}</div><div style="font-size:10px;color:#5a6477">ทั้งหมด</div></div>
      <div style="flex:1;background:#fff0f0;border:1px solid #f5a5a5;border-radius:8px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:800;color:#dc2626">${high}</div><div style="font-size:10px;color:#5a6477">สูง/สูงมาก</div></div>
      <div style="flex:1;background:#fff8e6;border:1px solid #f6cc70;border-radius:8px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:800;color:#d97706">${med}</div><div style="font-size:10px;color:#5a6477">ปานกลาง</div></div>
      <div style="flex:1;background:#e6f7ef;border:1px solid #86d9b0;border-radius:8px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:800;color:#1a9a5c">${low}</div><div style="font-size:10px;color:#5a6477">ต่ำ</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e4e7ed">
      <thead>
        <tr style="background:#dc2626;color:#fff">
          <th style="padding:8px 6px;font-size:11px;text-align:center">#</th>
          <th style="padding:8px 6px;font-size:11px;text-align:left">ความเสี่ยง / โครงการ</th>
          <th style="padding:8px 6px;font-size:11px;text-align:left">ประเภท</th>
          <th style="padding:8px 6px;font-size:11px;text-align:center">L×I</th>
          <th style="padding:8px 6px;font-size:11px;text-align:center">คะแนน</th>
          <th style="padding:8px 6px;font-size:11px;text-align:center">ระดับ</th>
          <th style="padding:8px 6px;font-size:11px;text-align:left">สถานะ</th>
          <th style="padding:8px 6px;font-size:11px;text-align:left">มาตรการควบคุม</th>
          <th style="padding:8px 6px;font-size:11px;text-align:left">ผู้รับผิดชอบ</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="9" style="padding:20px;text-align:center;color:#9aa3b2">ไม่มีข้อมูล</td></tr>'}</tbody>
    </table>`);
}

function _rrgBuildSingleHTML(r) {
  const score = r.likelihood * r.impact;
  const lv = rrgGetLevel(score);
  const resMap = { low:'ต่ำ — ยอมรับได้', medium:'ปานกลาง — ต้องเฝ้าระวัง', high:'สูง — ต้องควบคุมเพิ่ม', veryhigh:'สูงมาก — ต้องเร่งจัดการ' };
  const stMap  = { open:'ยังไม่ดำเนินการ', inprogress:'กำลังดำเนินการ', controlled:'ควบคุมได้แล้ว', closed:'ปิดแล้ว' };
  const sFull = { '1':'ยุทธศาสตร์ที่ 1', '2':'ยุทธศาสตร์ที่ 2', '3':'ยุทธศาสตร์ที่ 3', '4':'ยุทธศาสตร์ที่ 4', '5':'งบบริหารสำนักงาน' };
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'}) : '—';
  const cell = (label, val) => `<div style="padding:8px 0;border-bottom:1px solid #eef0f3"><div style="font-size:11px;color:#9aa3b2">${label}</div><div style="font-size:13px;font-weight:600;margin-top:2px">${val}</div></div>`;

  return _rrgPdfWrap(`
    <div style="background:${lv.color}15;border:2px solid ${lv.color};border-radius:10px;padding:16px;margin-bottom:18px">
      <div style="font-size:16px;font-weight:800;color:#1c2333;line-height:1.4">${r.name||'—'}</div>
      ${r.activity && r.activity !== r.name ? ('<div style="font-size:11.5px;color:#5a6477;margin-top:3px">🗂️ กิจกรรม: '+r.activity+'</div>') : ''}
      ${r.project?('<div style="font-size:12px;color:#3b72f0;margin-top:4px">📁 '+r.project+'</div>'):''}
      <div style="display:flex;align-items:center;gap:20px;margin-top:12px">
        <div style="text-align:center"><div style="font-size:34px;font-weight:800;color:${lv.color};line-height:1">${score}</div><div style="font-size:10px;color:#5a6477">คะแนน</div></div>
        <div style="font-size:14px;font-weight:700;color:${lv.color}">${lv.label}</div>
        <div style="font-size:12px;color:#5a6477">โอกาส ${r.likelihood}/5 × ผลกระทบ ${r.impact}/5</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-bottom:16px">
      ${cell('ประเภทความเสี่ยง', RRG_CAT_NAMES[r.category]||r.category||'—')}
      ${cell('ยุทธศาสตร์', r.strategy?(sFull[r.strategy]||'—'):'—')}
      ${cell('สถานะการจัดการ', stMap[r.status]||'—')}
      ${cell('ความเสี่ยงคงเหลือหลังควบคุม', r.residual?resMap[r.residual]:'—')}
      ${cell('ผู้รับผิดชอบ', r.owner||'—')}
      ${cell('ไตรมาส', r.quarter==='all'?'ตลอดทั้งปี':('ไตรมาส '+(r.quarter||'—')))}
      ${cell('กำหนดวันแล้วเสร็จ', fmtDate(r.dueDate))}
      ${cell('วันที่ทบทวนล่าสุด', fmtDate(r.reviewDate))}
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:#1a9a5c;margin-bottom:5px">🛡️ มาตรการควบคุม / แผนรับมือ</div>
      <div style="background:#e6f7ef;border:1px solid #86d9b0;border-radius:8px;padding:12px;font-size:13px;line-height:1.7;white-space:pre-wrap;color:#14532d">${r.control||'— ยังไม่ได้ระบุ —'}</div>
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:5px">🚨 ผลการดำเนินงาน / แผนเผชิญเหตุ</div>
      <div style="background:#fff8e6;border:1px solid #f6cc70;border-radius:8px;padding:12px;font-size:13px;line-height:1.7;white-space:pre-wrap;color:#92400e">${r.contingency||'— ยังไม่ได้ระบุ —'}</div>
    </div>
    ${r.note?('<div style="font-size:12px;color:#5a6477;line-height:1.6"><b>หมายเหตุ:</b> '+r.note+'</div>'):''}`);
}



// ═══════════════════════════════════════════════════════
// RISK ↔ GOOGLE SHEET SYNC
// ═══════════════════════════════════════════════════════

// ── Sync ความเสี่ยงทั้งหมดขึ้น Sheet (เขียนทับ) ──
async function rrgSyncToSheet() {
  const statusEl = document.getElementById('rrgGsStatus');
  const setStatus = (html, cls) => { if(statusEl){ statusEl.className='status-msg '+(cls||'status-info'); statusEl.innerHTML=html; } };
  if (!(GAS_ENABLED && _gasUrl && !_gasUrl.includes('YOUR_GAS'))) { setStatus('⚠️ ยังไม่ได้ตั้งค่า GAS URL — ไปที่หน้า "Google Sheets" เพื่อตั้งค่าก่อน', 'status-err'); return; }
  // ไม่ sync รายการที่ดึงมาจาก PRM (source==='prm') ขึ้น Sheet ของรายงานนี้ — ข้อมูลจริงถูก
  // sync อยู่ที่ระบบ PRM (dltv_risk_2570) อยู่แล้ว ป้องกันข้อมูลซ้ำซ้อนสองที่
  const manualList = rrgList.filter(x => x.source !== 'prm');
  if (!manualList.length) { setStatus('ℹ️ ยังไม่มีความเสี่ยงเพิ่มเติมที่บันทึกในหน้านี้ให้ Sync (รายการจาก PRM ไม่ต้อง sync ซ้ำ)', 'status-info'); return; }
  setStatus('⏳ กำลัง Sync ความเสี่ยง '+manualList.length+' รายการขึ้น Google Sheet...', 'status-info');
  try {
    // ส่งผ่าน POST (no-cors) — bulkSaveRisks เขียนทับทั้ง Sheet
    await gasPost('bulkSaveRiskRegister70', { data: manualList });
    setStatus('✅ Sync ความเสี่ยงสำเร็จ! ('+manualList.length+' รายการ) — ตรวจสอบที่ Sheet "Risks"', 'status-ok');
    showToast('☁ Sync ความเสี่ยงขึ้น Sheet แล้ว');
  } catch(err) {
    setStatus('❌ Sync ไม่สำเร็จ: '+err.message, 'status-err');
  }
}

// ── โหลดความเสี่ยงจาก Sheet ──
async function rrgLoadFromSheet() {
  const statusEl = document.getElementById('rrgGsStatus');
  const setStatus = (html, cls) => { if(statusEl){ statusEl.className='status-msg '+(cls||'status-info'); statusEl.innerHTML=html; } };
  if (!(GAS_ENABLED && _gasUrl && !_gasUrl.includes('YOUR_GAS'))) { setStatus('⚠️ ยังไม่ได้ตั้งค่า GAS URL — ไปที่หน้า "Google Sheets" เพื่อตั้งค่าก่อน', 'status-err'); return; }
  setStatus('⏳ กำลังโหลดความเสี่ยงจาก Google Sheet...', 'status-info');
  try {
    const res = await gasJsonp({ action: 'getAllRiskRegister70' });
    if (res && res.success && Array.isArray(res.data)) {
      rrgList = res.data;
      rrgApplyPRMMerge();
      rrgSaveLocal();
      rrgRenderTable();
      setStatus('✅ โหลดความเสี่ยง '+rrgList.length+' รายการจาก Sheet สำเร็จ', 'status-ok');
      showToast('⬇ โหลดความเสี่ยงจาก Sheet แล้ว ('+rrgList.length+' รายการ)');
    } else {
      setStatus('ℹ️ ยังไม่มีข้อมูลความเสี่ยงใน Sheet (หรือ Sheet "Risks" ยังไม่ถูกสร้าง)', 'status-info');
    }
  } catch(err) {
    setStatus('❌ โหลดไม่สำเร็จ: '+err.message, 'status-err');
  }
}

// ── Auto-sync ความเสี่ยงรายตัว (เรียกหลัง save/delete) ──
// หมายเหตุ: เดิม .catch(()=>{}) เงียบทุก error ทิ้งไปเฉยๆ — ถ้า GAS ตอบ {success:false,...}
// (เช่น deploy เวอร์ชันเก่าที่ยังไม่มี action นี้) โค้ดก็ไม่เคยเช็ค res.success เลย ผู้ใช้จึง
// ไม่มีทางรู้ว่า sync ขึ้น Sheet ไม่สำเร็จ ทั้งที่หน้าเว็บขึ้นว่า "บันทึกสำเร็จ" (เพราะบันทึกในเครื่อง
// สำเร็จจริง) — ตอนนี้เช็ค res.success และแจ้งเตือนผ่าน setStatus ถ้า sync ไม่สำเร็จ
function _rrgAutoSync(action, payload) {
  if (!(GAS_ENABLED && _gasUrl && !_gasUrl.includes('YOUR_GAS'))) return;
  try {
    gasPost(action, payload)
      .then(res => {
        if (!res || res.success === false) {
          setStatus('❌ บันทึกในเครื่องแล้ว แต่ Sync ขึ้น Google Sheet ไม่สำเร็จ: ' + ((res && res.message) || 'ไม่ทราบสาเหตุ — ลองกด "Sync ขึ้น Sheet" ด้านบน หรือตรวจสอบว่า Deploy โค้ด GAS เวอร์ชันล่าสุดแล้วหรือยัง'), 'status-err');
        }
      })
      .catch(err => {
        setStatus('❌ บันทึกในเครื่องแล้ว แต่ Sync ขึ้น Google Sheet ไม่สำเร็จ: ' + (err && err.message || err), 'status-err');
      });
  } catch(e) {}
}

// ── Export ความเสี่ยงเป็น CSV ──
function rrgExportCSV() {
  if (!rrgList.length) { showToast('ℹ️ ยังไม่มีข้อมูลความเสี่ยง'); return; }
  const headers = ['id','แหล่งที่มา','project','name','category','strategy','likelihood','impact','score','level','status','residual','control','contingency','dueDate','reviewDate','owner','quarter','note'];
  const rows = rrgList.map(r => {
    const score = r.likelihood * r.impact;
    return [r.id, r.source==='prm' ? 'แผนบริหารความเสี่ยง (PRM)' : 'บันทึกเพิ่มเติม', r.project||'', r.name||'', r.category||'', r.strategy||'',
            r.likelihood, r.impact, score, rrgGetLevel(score).key, r.status||'',
            r.residual||'', r.control||'', r.contingency||'', r.dueDate||'',
            r.reviewDate||'', r.owner||'', r.quarter||'', r.note||''];
  });
  const csv = [headers, ...rows].map(row =>
    row.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(',')
  ).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'riskregister_70_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('⬇ ดาวน์โหลด CSV ความเสี่ยงแล้ว');
}

// ── คัดลอกโค้ด GAS สำหรับ Risk Sheet ──
function rrgCopyGASTemplate() {
  const tpl = RRG_GAS_CODE;
  navigator.clipboard.writeText(tpl).then(() => {
    const st = document.getElementById('rrgGasCopyStatus');
    if (st) { st.textContent = '✅ คัดลอกโค้ด Risk GAS แล้ว — นำไปวางต่อท้าย Code.gs เดิม แล้ว Deploy ใหม่'; setTimeout(()=>st.textContent='',5000); }
    showToast('📋 คัดลอกโค้ด Risk GAS แล้ว');
  }).catch(() => showToast('❌ คัดลอกไม่สำเร็จ'));
}

// ── เปิด/ปิด กล่องช่วยเหลือ GAS + แสดงโค้ด ──
function rrgToggleGasHelp() {
  const box = document.getElementById('rrgGasHelp');
  if (!box) return;
  const open = box.style.display === 'none';
  box.style.display = open ? 'block' : 'none';
  if (open) {
    const codeEl = document.getElementById('rrgGasCodeBlock');
    if (codeEl && !codeEl.textContent) codeEl.textContent = RRG_GAS_CODE;
    box.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }
}

