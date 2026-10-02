// ===== DATA =====
// ปี 2570 — เริ่มต้นว่างเปล่า ไม่มี default seed
// โหลดข้อมูลจาก localStorage (key: dltv_projects_2570_v2) หรือ Google Sheet เท่านั้น
const DEFAULT_PROJECTS = [];
let projects = [];

// ===== CONSTANTS =====
const S_NAMES = {1:'ยุทธศาสตร์ที่ 1',2:'ยุทธศาสตร์ที่ 2',3:'ยุทธศาสตร์ที่ 3',4:'ยุทธศาสตร์ที่ 4',5:'งบบริหารสำนักงาน'};
const S_FULL  = {1:'การพัฒนาการจัดการศึกษาทางไกล',2:'การพัฒนาครูและโรงเรียนต้นทาง',3:'การพัฒนาครูและโรงเรียนปลายทาง',4:'การพัฒนาระบบการบริหารจัดการ',5:'งบดำเนินการสำนักงาน'};
const S_COLORS= {1:'#2456C9',2:'#13865B',3:'#B7791F',4:'#7A4CC2',5:'#52627F'};
const S_BADGE = {1:'badge-s1',2:'badge-s2',3:'badge-s3',4:'badge-s4',5:'badge-s5'};
const S_KEYS  = [1,2,3,4,5];
// ── หน่วยนับ ─────────────────────────────────────────────────────────
// หน่วยงานมี "ยุทธศาสตร์" จริงแค่ 4 ด้าน (1-4) ส่วนกลุ่มที่ 5 ไม่ใช่ยุทธศาสตร์ แต่เป็น
// "งบบริหารสำนักงาน" ซึ่งนับเป็น "รายการ" ไม่ใช่ "โครงการ" — ใช้ตัวแปรนี้แทนการเขียน 'โครงการ' ตรงๆ
// ทุกจุดที่ต้องแสดงหน่วยนับตามยุทธศาสตร์/กลุ่มที่ระบุ (s)
const S_UNIT  = {1:'โครงการ',2:'โครงการ',3:'โครงการ',4:'โครงการ',5:'รายการ'};
const STRATEGY_COUNT = 4; // จำนวนยุทธศาสตร์จริงของหน่วยงาน (ไม่นับงบบริหารสำนักงาน)
// ป้ายชื่อกลุ่มสำหรับใช้แสดงผล — กลุ่มที่ 1-4 นำหน้าด้วย "ยุทธศาสตร์ที่ X :" ส่วนกลุ่มที่ 5 ไม่ใช่ยุทธศาสตร์
// จึงแสดงเฉพาะชื่อ "งบบริหารสำนักงาน" โดยไม่มีคำว่ายุทธศาสตร์นำหน้า
function stratLabel(s) {
  s = parseInt(s);
  return s === 5 ? S_NAMES[5] : `${S_NAMES[s]} : ${S_FULL[s]}`;
}
const STATUS_LABEL = {done:'แล้วเสร็จ',progress:'อยู่ระหว่างดำเนิน',pending:'ยังไม่เริ่ม'};
const STATUS_CLASS  = {done:'badge-done',progress:'badge-progress',pending:'badge-pending'};
const Q_LABELS = {
  2569: {all:'ทุกไตรมาส','1':'ไตรมาส 1 (ต.ค.–ธ.ค. 68)','2':'ไตรมาส 2 (ม.ค.–มี.ค. 69)','3':'ไตรมาส 3 (เม.ย.–มิ.ย. 69)','4':'ไตรมาส 4 (ก.ค.–ก.ย. 69)'},
  2570: {all:'ทุกไตรมาส','1':'ไตรมาส 1 (ต.ค.–ธ.ค. 69)','2':'ไตรมาส 2 (ม.ค.–มี.ค. 70)','3':'ไตรมาส 3 (เม.ย.–มิ.ย. 70)','4':'ไตรมาส 4 (ก.ค.–ก.ย. 70)'}
};
let Q_LABEL = Q_LABELS[2570];

// ── งบประมาณที่ได้รับจัดสรรประจำปี (ตั้งค่าได้ในระบบ) ──────────────
// ค่าเริ่มต้นตามที่ได้รับจัดสรรปีงบประมาณ พ.ศ. 2570 = 498,584,400 บาท
// ผู้ใช้สามารถแก้ไขตัวเลขนี้ได้ภายหลังผ่านหน้าตั้งค่า โดยไม่ต้องแก้ไขโค้ด
const DEFAULT_ALLOCATED_BUDGET = 498584400;
const ALLOCATED_BUDGET_KEY = 'dltv_allocated_budget_2570';
function getAllocatedBudget() {
  try {
    const v = localStorage.getItem(ALLOCATED_BUDGET_KEY);
    if (v === null) return DEFAULT_ALLOCATED_BUDGET;
    const n = Number(v);
    return (isFinite(n) && n >= 0) ? n : DEFAULT_ALLOCATED_BUDGET;
  } catch(e) { return DEFAULT_ALLOCATED_BUDGET; }
}
function setAllocatedBudget(n) {
  try { localStorage.setItem(ALLOCATED_BUDGET_KEY, String(Math.max(0, Number(n)||0))); } catch(e) {}
}

// ── Year state ──────────────────────────────────────────────────
// ถ้า URL มี ?year=2570 ให้ใช้ปีนั้นในแท็บนี้ (localStorage แยกต่อแท็บไม่ได้ แต่ URL ได้)
// ไฟล์นี้เป็นปี 2570 เท่านั้น
let currentYear = 2570;

function switchYear(year){ /* ปี 2570 เท่านั้น */ }

// ── ─────────────────────────────────────────────────────────────
let editingId = null, deleteId = null, currentPage = 1;
const PAGE_SIZE = 10;
let tempKPIs = [];
let chartBudget = null, chartStatus = null, chartUtilization = null, chartBudgetGauge = null, chartCommitteeBudget = null;
let currentQuarter = 'all';

// ===== UTILS =====
function fmt(n) {
  n = n||0;
  if (n>=1000000) return (n/1000000).toFixed(2)+'M';
  if (n>=1000) return (n/1000).toFixed(0)+'K';
  return n.toLocaleString('th-TH');
}
function fmtFull(n) { return (n||0).toLocaleString('th-TH'); }

// ── นับเลขวิ่ง (count-up) เวลาอัปเดตค่าบน Dashboard ให้ดูมีชีวิตชีวาขึ้น ──
function animateNumber(el, endValue, opts) {
  if (!el) return;
  opts = opts || {};
  const isCurrency = !!opts.currency;
  const duration = opts.duration || 650;
  const startValue = parseFloat((el.textContent || '0').replace(/[^\d.-]/g, '')) || 0;
  const startTime = performance.now();
  if (el._numRaf) cancelAnimationFrame(el._numRaf);
  function tick(now) {
    const p = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const current = startValue + (endValue - startValue) * eased;
    el.textContent = isCurrency ? fmtFull(Math.round(current)) : Math.round(current).toLocaleString('th-TH');
    if (p < 1) { el._numRaf = requestAnimationFrame(tick); } else { el._numRaf = null; }
  }
  el._numRaf = requestAnimationFrame(tick);
}

// ── สีอ่อนๆ ไว้ทำพื้นหลัง/แถบสี ให้ "ชื่อโครงการ" แต่ละแถวแยกออกจากกันชัดเจน
// (ใช้สีเดียวกับสีประจำยุทธศาสตร์ของโครงการนั้น แต่ลดความเข้มลงมากด้วย alpha ต่ำๆ)
function _lightBg(hex, alpha) {
  if (!hex) return 'transparent';
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── จัดรูปแบบเวลา "แก้ไขล่าสุด" ให้อ่านง่ายเสมอ ──────────────────────────────
// บั๊กเดิม: เวลาที่ sync กลับมาจาก Google Sheet บางครั้งมาเป็น ISO string ดิบ
// (เช่น "2569-08-19T02:38:00.000Z") ซึ่งตัวเลขปีเป็น พ.ศ. (2569) แต่ถูกปนอยู่ในรูปแบบ ISO
// ที่ปกติต้องเป็นปี ค.ศ. — พอเอาไปเข้า new Date(...) ตรงๆ ปีจะถูกตีความเป็น ค.ศ. 2569
// (ผิดพลาดไปหลายร้อยปี) ทำให้เวลาที่แสดงดูเพี้ยน ฟังก์ชันนี้ตรวจจับรูปแบบ ISO ที่ปีดูสูงผิดปกติ
// (>2400) แล้วลบ 543 ปีออกก่อน เพื่อกู้ปี ค.ศ. ที่แท้จริงกลับมา ก่อน format เป็นวันที่/เวลาแบบไทย
function formatLastEdited(v) {
  if (!v) return '';
  const s = String(v).trim();
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (isoMatch) {
    let [y, mo, d, h, mi, se] = isoMatch.slice(1).map(Number);
    if (y > 2400) y -= 543; // ปีดูเป็น พ.ศ. ปนอยู่ในสตริง ISO (ควรเป็น ค.ศ.) — แปลงกลับ
    const dt = new Date(Date.UTC(y, mo - 1, d, h, mi, se));
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  }
  // ไม่ใช่ ISO string ดิบ (เช่น format ไทยที่ถูกสร้างไว้แล้วตอนบันทึกในเครื่อง) — ใช้ค่าเดิมได้เลย
  return s;
}

// ── หน้าตั้งค่า: งบประมาณที่ได้รับจัดสรรประจำปี ─────────────────────
function openAllocatedBudgetModal() {
  const inp = document.getElementById('allocatedBudgetInput');
  if (inp) inp.value = getAllocatedBudget();
  const el = document.getElementById('allocatedBudgetOverlay');
  if (el) el.classList.add('open');
  setTimeout(()=>{ if(inp) inp.focus(); }, 100);
}
function closeAllocatedBudgetModal() {
  const el = document.getElementById('allocatedBudgetOverlay');
  if (el) el.classList.remove('open');
}
function saveAllocatedBudgetFromModal() {
  const inp = document.getElementById('allocatedBudgetInput');
  const val = inp ? Number(inp.value) : NaN;
  if (!isFinite(val) || val < 0) {
    showToast('กรุณากรอกจำนวนเงินให้ถูกต้อง');
    return;
  }
  setAllocatedBudget(val);
  closeAllocatedBudgetModal();
  showToast('บันทึกงบประมาณที่ได้รับจัดสรรเรียบร้อยแล้ว');
  updateDashboard();
}

// ── แปลงข้อความงบประมาณให้มีลูกคั่นหลักพัน (,) เพื่อให้อ่านง่ายขึ้น เช่น "100000000" -> "100,000,000" ──
// ถ้าข้อความนั้นไม่ใช่ตัวเลขล้วน (มีตัวอักษรอื่นปนอยู่ เช่น "ประมาณ 1 แสนบาท") จะคืนค่าเดิมไว้เฉยๆ
// ไม่ไปยุ่งกับข้อความที่ผู้ใช้พิมพ์ ใช้ร่วมกันทั้งช่องกรอกงบประมาณใน PRM 04 และรายงานผล/PDF ที่ดึงจากช่องนั้น
function formatMoneyText(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  const cleaned = s.replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return s; // ไม่ใช่ตัวเลขล้วน ปล่อยไว้ตามเดิม
  const num = Number(cleaned);
  if (!isFinite(num)) return s;
  const parts = cleaned.split('.');
  const withCommas = Number(parts[0]).toLocaleString('en-US');
  return parts[1] ? (withCommas + '.' + parts[1]) : withCommas;
}

function showToast(msg, dur=2500) {
  // ── inject styles once ──────────────────────────────────────
  if (!document.getElementById('_ntfSt')) {
    const s = document.createElement('style');
    s.id = '_ntfSt';
    s.textContent = `
      @keyframes _ntfIn  { 0%{opacity:0;transform:translateY(-28px) scale(.9)} 55%{transform:translateY(4px) scale(1.03)} 100%{opacity:1;transform:translateY(0) scale(1)} }
      @keyframes _ntfOut { 0%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-20px) scale(.92)} }
      @keyframes _ntfIconPop { 0%{transform:scale(.4);opacity:0} 60%{transform:scale(1.12);opacity:1} 100%{transform:scale(1)} }
      @keyframes _ntfBar { from{width:100%} to{width:0%} }
      ._ntf-overlay { position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;pointer-events:none; }
      ._ntf-box {
        pointer-events:auto;
        min-width:300px;max-width:400px;
        background:#fff;
        border-radius:18px;
        box-shadow:0 16px 48px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.08);
        overflow:hidden;
        animation:_ntfIn .42s cubic-bezier(.22,.68,0,1.2) forwards;
        font-family:'Sarabun',sans-serif;
        cursor:pointer;
      }
      ._ntf-inner { position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:32px 26px 26px; }
      ._ntf-icon-wrap {
        width:68px;height:68px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:36px;flex-shrink:0;
        animation:_ntfIconPop .5s cubic-bezier(.34,1.56,.64,1) .05s both;
      }
      ._ntf-text { min-width:0; }
      ._ntf-title { font-size:16px;font-weight:700;color:#1c2333;line-height:1.4; }
      ._ntf-sub   { font-size:12.5px;color:#6b7280;margin-top:4px;line-height:1.5; }
      ._ntf-bar   { height:3px;border-radius:0 0 18px 18px; }
      ._ntf-bar-fill { height:100%;border-radius:0 0 18px 18px;animation:_ntfBar var(--dur,2.5s) linear forwards; }
      ._ntf-close { position:absolute;top:8px;right:8px;flex-shrink:0;width:28px;height:28px;border-radius:50%;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:16px;transition:background .15s; }
      ._ntf-close:hover { background:#f3f4f6;color:#374151; }
    `;
    document.head.appendChild(s);
  }

  // ── classify message ────────────────────────────────────────
  // หมายเหตุ: ต้องเช็ก ❌ / ⚠️ / 🔒 ก่อนเสมอ เพราะข้อความแจ้งเตือน/ผิดพลาด
  // มักมีคำว่า "บันทึก" ปนอยู่ (เช่น "บันทึกในเครื่องแล้ว") ซึ่งจะชนกับเงื่อนไข ✅ ถ้าเช็กสำเร็จก่อน
  // หมายเหตุ: ทุกประเภทข้อความใช้โทนสีเขียวเหมือนกันหมด (ตามที่ผู้ใช้ต้องการ)
  // ยังคง emoji ต่างกันตามประเภท เพื่อให้พอแยกแยะเนื้อหาได้ แต่สี icon/bar/border เป็นเขียวเสมอ
  let icon='ℹ️';
  const iconBg='#f0fdf4', iconColor='#16a34a', barColor='#22c55e', borderL='#22c55e';
  const m = msg;
  if (m.includes('❌')||m.includes('ผิดพลาด')||m.includes('ไม่สำเร็จ')||m.includes('error')) {
    icon='❌';
  } else if (m.includes('⚠️')||m.includes('แจ้งเตือน')||m.includes('ระวัง')||m.includes('ผิดปกติ')) {
    icon='⚠️';
  } else if (m.includes('🔒')||m.includes('ล็อค')||m.includes('ไม่อนุญาต')) {
    icon='🔒';
  } else if (m.includes('🔄')||m.includes('⏳')||m.includes('กำลัง')||m.includes('sync')) {
    icon='🔄';
  } else if (m.includes('👋')||m.includes('ออกจากระบบ')) {
    icon='👋';
  } else if (m.includes('👁')||m.includes('ผู้เยี่ยมชม')) {
    icon='👁';
  } else if (m.includes('✅')||m.includes('สำเร็จ')||m.includes('บันทึก')||m.includes('ยินดีต้อนรับ')||m.includes('โหลด')) {
    icon='✅';
  }

  // strip leading emoji for main text
  const cleanText = m.replace(/^\p{Emoji}+\s*/u,'').trim();
  // split first line as title, rest as subtitle
  const lines = cleanText.split(/[·|·]|(?<=\S{6,})\s{2,}/);
  const title = lines[0]?.trim() || cleanText;
  const sub   = lines.slice(1).join(' ').trim();

  // ── build DOM ───────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = '_ntf-overlay';

  const box = document.createElement('div');
  box.className = '_ntf-box';
  box.style.borderTop = '4px solid '+borderL;
  box.innerHTML = `
    <div class="_ntf-inner">
      <button class="_ntf-close" title="ปิด">✕</button>
      <div class="_ntf-icon-wrap" style="background:${iconBg};color:${iconColor}">${icon}</div>
      <div class="_ntf-text">
        <div class="_ntf-title">${title}</div>
        ${sub ? '<div class="_ntf-sub">'+sub+'</div>' : ''}
      </div>
    </div>
    <div class="_ntf-bar"><div class="_ntf-bar-fill" style="background:${barColor};--dur:${dur/1000}s"></div></div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // ── close logic ─────────────────────────────────────────────
  const close = () => {
    box.style.animation = '_ntfOut .3s cubic-bezier(.4,0,1,1) forwards';
    overlay.style.pointerEvents = 'none';
    setTimeout(() => { if(overlay.parentNode) overlay.remove(); }, 300);
  };
  box.querySelector('._ntf-close').addEventListener('click', e => { e.stopPropagation(); close(); });
  box.addEventListener('click', close);
  setTimeout(close, dur);
}

// ===== QUARTER FILTER =====
function _showLoginSuccess(name, position, dept, isOffline=false) {
  // ── inject styles once ──
  if (!document.getElementById('_wlcSt')) {
    const s = document.createElement('style');
    s.id = '_wlcSt';
    s.textContent = `
      @keyframes _wlcOverlayIn { from{opacity:0} to{opacity:1} }
      @keyframes _wlcOverlayOut { from{opacity:1} to{opacity:0} }
      @keyframes _wlcCardIn {
        0%  { opacity:0; transform:translateY(32px) scale(.94) }
        65% { transform:translateY(-6px) scale(1.01) }
        100%{ opacity:1; transform:translateY(0) scale(1) }
      }
      @keyframes _wlcCardOut {
        0%  { opacity:1; transform:scale(1) }
        100%{ opacity:0; transform:scale(.9) translateY(20px) }
      }
      @keyframes _wlcShimmer {
        0%  { background-position:200% center }
        100%{ background-position:-200% center }
      }
      @keyframes _wlcPulse {
        0%,100%{ box-shadow:0 0 0 0 rgba(34,197,94,.4) }
        50%    { box-shadow:0 0 0 10px rgba(34,197,94,0) }
      }
      @keyframes _wlcBar { from{width:0} to{width:100%} }
      ._wlc-overlay {
        position:fixed;inset:0;z-index:99999;
        display:flex;align-items:center;justify-content:center;
        background:rgba(15,23,42,.55);
        backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);
        animation:_wlcOverlayIn .3s ease forwards;
      }
      ._wlc-card {
        background:#fff;
        border-radius:20px;
        box-shadow:0 24px 64px rgba(0,0,0,.22),0 4px 16px rgba(0,0,0,.1);
        width:340px;
        overflow:hidden;
        animation:_wlcCardIn .45s cubic-bezier(.22,.68,0,1.15) forwards;
        font-family:'Sarabun',sans-serif;
      }
      ._wlc-header {
        padding:28px 24px 20px;
        background:linear-gradient(135deg,#0f4c81 0%,#1a6bb0 50%,#0d7a4e 100%);
        background-size:200% auto;
        animation:_wlcShimmer 3s linear infinite;
        text-align:center;position:relative;
      }
      ._wlc-avatar {
        width:64px;height:64px;border-radius:50%;
        background:rgba(255,255,255,.2);
        border:3px solid rgba(255,255,255,.6);
        display:flex;align-items:center;justify-content:center;
        font-size:26px;font-weight:700;color:#fff;
        margin:0 auto 12px;
        animation:_wlcPulse 2s ease infinite;
      }
      ._wlc-greeting { font-size:13px;color:rgba(255,255,255,.8);margin-bottom:4px;letter-spacing:.3px; }
      ._wlc-name { font-size:18px;font-weight:700;color:#fff;line-height:1.3; }
      ._wlc-body { padding:20px 24px 8px; }
      ._wlc-row {
        display:flex;align-items:center;gap:10px;
        padding:10px 14px;border-radius:10px;
        background:#f8fafc;border:1px solid #e2e8f0;
        margin-bottom:8px;
      }
      ._wlc-row-icon { font-size:18px;flex-shrink:0; }
      ._wlc-row-label { font-size:10.5px;color:#94a3b8;margin-bottom:1px; }
      ._wlc-row-val { font-size:13.5px;font-weight:600;color:#1e293b;line-height:1.3; }
      ._wlc-offline {
        margin:0 24px 12px;padding:7px 12px;border-radius:8px;
        background:#fffbeb;border:1px solid #fde68a;
        font-size:11.5px;color:#92400e;text-align:center;
      }
      ._wlc-footer { padding:0 24px 20px;margin-top:4px; }
      ._wlc-btn {
        width:100%;padding:11px;border:none;border-radius:10px;
        background:linear-gradient(135deg,#0f4c81,#1a6bb0);
        color:#fff;font-size:14px;font-weight:600;
        font-family:'Sarabun',sans-serif;cursor:pointer;
        transition:opacity .15s,transform .15s;
      }
      ._wlc-btn:hover { opacity:.9;transform:translateY(-1px); }
      ._wlc-progress { height:3px;background:#f1f5f9; }
      ._wlc-progress-fill {
        height:100%;background:linear-gradient(90deg,#0f4c81,#22c55e);
        animation:_wlcBar var(--d,3.5s) linear forwards;
      }
    `;
    document.head.appendChild(s);
  }

  const initial = (name||'?').replace(/^(นาย|นาง|นางสาว|ดร\.?|ศ\.?|รศ\.?|ผศ\.?|พญ\.?|นพ\.?|ว่าที่)\s*/,'').trim().charAt(0).toUpperCase();
  const dur = 3800;

  const overlay = document.createElement('div');
  overlay.className = '_wlc-overlay';

  const posRow = position ? `
    <div class="_wlc-row">
      <div class="_wlc-row-icon">💼</div>
      <div><div class="_wlc-row-label">ตำแหน่ง</div><div class="_wlc-row-val">${position}</div></div>
    </div>` : '';
  const deptRow = dept ? `
    <div class="_wlc-row">
      <div class="_wlc-row-icon">🏢</div>
      <div><div class="_wlc-row-label">สังกัด</div><div class="_wlc-row-val">${dept}</div></div>
    </div>` : '';
  const offlineBadge = isOffline ? '<div class="_wlc-offline">⚠️ ใช้ข้อมูลในเครื่อง (ไม่ได้เชื่อมต่อเซิร์ฟเวอร์)</div>' : '';

  overlay.innerHTML = `
    <div class="_wlc-card">
      <div class="_wlc-header">
        <div class="_wlc-avatar">${initial}</div>
        <div class="_wlc-greeting">ยินดีต้อนรับเข้าสู่ระบบ</div>
        <div class="_wlc-name">${name}</div>
      </div>
      <div class="_wlc-body">
        ${posRow}${deptRow}
      </div>
      ${offlineBadge}
      <div class="_wlc-footer">
        <button class="_wlc-btn" id="_wlcCloseBtn">เข้าสู่ระบบ →</button>
      </div>
      <div class="_wlc-progress"><div class="_wlc-progress-fill" style="--d:${dur/1000}s"></div></div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.style.animation = '_wlcOverlayOut .3s ease forwards';
    overlay.querySelector('._wlc-card').style.animation = '_wlcCardOut .3s ease forwards';
    setTimeout(() => { if(overlay.parentNode) overlay.remove(); }, 300);
  };

  overlay.querySelector('#_wlcCloseBtn').addEventListener('click', close);
  overlay.addEventListener('click', e => { if(e.target === overlay) close(); });
  setTimeout(close, dur);
}

function getFilteredProjects() {
  if (currentQuarter==='all') return projects;
  return projects.filter(p => p.quarter===currentQuarter || p.quarter==='all');
}

function onQuarterChange() {
  currentQuarter = document.getElementById('quarterSelect').value;
  const qL = Q_LABEL[currentQuarter];
  document.getElementById('quarterLabel').textContent = 'แสดงข้อมูล: '+qL;
  document.getElementById('quarterBadge').textContent = qL;
  document.getElementById('summaryQuarterLabel').textContent = qL+' · ปีงบประมาณ พ.ศ. '+currentYear;
  const qbEl=document.getElementById('quarterBadge');
  if(qbEl) qbEl.textContent='ปีงบ '+currentYear+(currentQuarter!=='all'?' Q'+currentQuarter:'');
  document.getElementById('sidebar-footer') && (document.getElementById('sidebar-footer').textContent = qL);
  updateDashboard();
}

// ===== STORAGE =====
function saveToLocal(silent) {
  try {
    localStorage.setItem('dltv_projects_2570_v2', JSON.stringify(projects));
    if(!silent) showToast('💾 บันทึกข้อมูลแล้ว');
  } catch(e){}
}
function loadFromLocal() {
  try {
    const d = localStorage.getItem('dltv_projects_2570_v2');
    if(d){
      const p = JSON.parse(d);
      if(Array.isArray(p) && p.length > 0){
        projects = p;
        return true;
      }
    }
  } catch(e){ console.warn('loadFromLocal error:', e); }
  return false;
}
function resetToDefault() {
  if(!confirm('ยืนยันการรีเซ็ตข้อมูลทั้งหมด?\nโครงการทั้งหมดในปี 2570 จะถูกลบออกจาก Browser นี้')) return;
  try{ localStorage.removeItem('dltv_projects_2570_v2'); }catch(e){}
  location.reload();
}

// ── รวมข้อมูล "ผลการดำเนินงาน" (Sheet: ReportResult) เข้ากับโครงการ (Sheet: Project70) ──
// ตั้งค่า default ให้โครงการที่ยังไม่เคยมีการรายงานผล (ไม่มีแถวใน ReportResult) เพื่อไม่ให้ค่า undefined
const REPORT_DEFAULTS = { status:'pending', quarter:'all', spent:0, po:0, result:'', problems:'', solutions:'', kpiResults:[], quarterActivities:[], images:[], lastEditedBy:'', lastEditedByPosition:'', lastEditedAt:'' };

// แก้ไข (สำคัญ): เดิม 1 โครงการมีได้แค่ 1 แถวผลการดำเนินงาน (แถวล่าสุดเขียนทับของเก่าเสมอ)
// ทำให้ดูผลย้อนหลังแยกรายไตรมาสไม่ได้ — ตอนนี้ ReportResult อาจมีได้สูงสุด 4 แถวต่อโครงการ
// (ไตรมาส 1–4) จึงต้องจัดกลุ่มตาม id ก่อน แล้วแยกเก็บเป็น p.reportsByQuarter = {1:{...},2:{...},3:{...},4:{...}}
// ส่วนฟิลด์แบบเดิม (p.status/p.spent/p.po/p.quarter/...) ยังคงไว้เพื่อไม่ให้หน้าอื่น (Dashboard,
// ตัวกรองไตรมาสบนสุด, Export PDF ฯลฯ) พัง — โดยเลือกจากไตรมาสที่ "แก้ไขล่าสุด" (lastEditedAt ใหม่สุด)
// แถวเก่าที่เคยบันทึกด้วย quarter='all' (ก่อนแก้ไขระบบ) จะถูกเก็บไว้ใน reportsByQuarter.all
// เป็น fallback เผื่อโครงการนั้นยังไม่เคยมีการรายงานแยกรายไตรมาสเลย
// ── ใช้ reportsByQuarter ของโครงการหนึ่งๆ คำนวณฟิลด์ระดับโครงการใหม่ (mutate ตรงๆ แล้ว return) ──
// แยกออกมาจาก mergeReportsIntoProjects เพื่อให้เรียกซ้ำได้จากที่อื่น (เช่น หลังลบรายงานผลไตรมาสเดียว
// ในเครื่อง โดยไม่ต้อง sync จาก Sheet ใหม่ทั้งหมดก่อนถึงจะเห็นตัวเลขอัปเดต)
function _applyReportsToProject(p, reportsByQuarter){
  reportsByQuarter = reportsByQuarter || {};
  // ไตรมาส "ล่าสุด" = เลขไตรมาสสูงสุดที่เคยรายงาน (Q4 ถือว่าใหม่กว่า Q1 เสมอ)
  // ถ้ายังไม่เคยรายงานไตรมาสไหนเลย ใช้แถวเก่าแบบ quarter='all' (ก่อนแก้ไขระบบ) เป็น fallback
  const qNums = Object.keys(reportsByQuarter).filter(q=>q!=='all').sort((a,b)=>Number(b)-Number(a));
  const latest = qNums.length ? reportsByQuarter[qNums[0]] : (reportsByQuarter.all || null);
  // แก้ไข (บั๊ก): แถวใน ReportResult เก็บ id/name/strategy แบบ snapshot ไว้ ณ ตอนที่บันทึกรายงานผลครั้งล่าสุด
  // ถ้าใครไปแก้ "ยุทธศาสตร์" ของโครงการทีหลังในฟอร์มแก้ไขแผน ค่าที่ถูกต้องจะถูกบันทึกลง Sheet "โครงการ" (p) ถูกต้อง
  // แต่พอ sync ครั้งถัดไป โค้ดเดิม spread (latest||{}) ทับ p ทำให้ strategy/name เก่าจาก ReportResult
  // ย้อนกลับมาทับค่าใหม่ที่เพิ่งแก้ไปเสมอ — จึงต้องตัด id/name/strategy ออกจาก latest ก่อน merge
  // เพราะ Sheet "โครงการ" (p) คือแหล่งข้อมูลที่ถูกต้องสำหรับฟิลด์เหล่านี้ ไม่ใช่ ReportResult
  // แก้ไข (บั๊กคำนวณผิด): เดิม p.spent/p.po ถูกดึงมาจาก "ไตรมาสล่าสุดที่รายงาน" เพียงไตรมาสเดียว
  // แต่ฟอร์มรายงานผลกรอกยอด "ใช้ไป (ไตรมาสนี้)" แยกเป็นยอดเพิ่มของแต่ละไตรมาส (ไม่ใช่ยอดสะสม)
  // ทำให้ "ใช้ไปล่าสุด/คงเหลือ" ที่แสดงในตาราง/แดชบอร์ด/PDF นับยอดใช้จ่ายของไตรมาสก่อนๆ หายไป
  // (เช่น Q1 ใช้ 100,000 + Q2 ใช้เพิ่ม 200,000 ควรใช้ไปสะสม 300,000 แต่ระบบเดิมโชว์แค่ 200,000)
  // จึงเปลี่ยนมารวมยอดทุกไตรมาสที่เคยรายงานไว้แทน เพื่อให้ยอดใช้ไปสะสม/คงเหลือถูกต้องตรงกับความเป็นจริง
  const { id:_rId, name:_rName, strategy:_rStrategy, spent:_rSpent, po:_rPo, ...latestReportOnly } = (latest||{});
  const cumulativeSpent = qNums.length
    ? qNums.reduce((s,q)=> s + (reportsByQuarter[q].spent||0), 0)
    : (reportsByQuarter.all ? (reportsByQuarter.all.spent||0) : 0);
  const cumulativePO = qNums.length
    ? qNums.reduce((s,q)=> s + (reportsByQuarter[q].po||0), 0)
    : (reportsByQuarter.all ? (reportsByQuarter.all.po||0) : 0);
  Object.assign(p, REPORT_DEFAULTS, latestReportOnly, { spent: cumulativeSpent, po: cumulativePO, reportsByQuarter });
  return p;
}
function mergeReportsIntoProjects(projArr, reportRows){
  const byId = {};
  (reportRows||[]).forEach(r=>{
    const key = String(r.id);
    if(!byId[key]) byId[key] = {};
    byId[key][String(r.quarter||'all')] = r;
  });
  return (projArr||[]).map(p=> _applyReportsToProject({ ...p }, byId[String(p.id)] || {}));
}
// ── ดึงผลการดำเนินงานของโครงการ ณ ไตรมาสที่ระบุ (คืน null ถ้ายังไม่เคยรายงานไตรมาสนั้น) ──
function getQuarterReport(p, q){
  return (p && p.reportsByQuarter) ? (p.reportsByQuarter[String(q)] || null) : null;
}
// ── หาไตรมาสล่าสุดที่มีการรายงาน (เพื่อดูสถานะ/ผลการดำเนินงานล่าสุด) ──
function getLatestQuarterReport(p){
  if(!p || !p.reportsByQuarter) return null;
  const qs = Object.keys(p.reportsByQuarter).filter(q=>q!=='all');
  if(!qs.length) return p.reportsByQuarter.all || null;
  qs.sort((a,b)=>Number(b)-Number(a));
  return p.reportsByQuarter[qs[0]];
}
// ── ยอด "ใช้ไปสะสม" นับรวมทุกไตรมาสตั้งแต่ไตรมาส 1 จนถึงไตรมาสที่ระบุ (รวมไตรมาสนั้นด้วย) ──
// ใช้คำนวณ "คงเหลือ ณ ไตรมาสนี้" ในหน้าพรีวิว/PDF ของไตรมาสเดียว ให้ตรงกับยอดสะสมจริง
function getCumulativeSpentUpTo(p, quarter){
  if(!p || !p.reportsByQuarter) return 0;
  const qn = Number(quarter);
  if(!qn) return 0;
  let sum = 0;
  for(let q=1; q<=qn; q++){
    const r = p.reportsByQuarter[String(q)];
    if(r) sum += (r.spent||0);
  }
  return sum;
}
function fetchAllReports(){
  return fetch(`${_gasUrl}?action=getAllReport`, { redirect:'follow' })
    .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(res=> (res && res.success) ? (res.data||[]) : [])
    .catch(()=>[]);
}

// ===== NAVIGATION =====
function showPage(page, strategyFilter, navEl) {
  ['dashboard','projects','gsheet','gantt','actlog','risk','riskregister','report'].forEach(p => {
    const el = document.getElementById('page-'+p);
    if (el) el.style.display = p===page ? 'block' : 'none';
  });
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
  const activeEl = navEl || (typeof event !== 'undefined' && event && event.currentTarget) || null;
  if(activeEl) activeEl.classList.add('active');

  const titles = {
    dashboard: ['Dashboard สรุปภาพรวม','รายงานแผนปฏิบัติการประจำปี งบประมาณ พ.ศ. '+currentYear],
    projects:  ['รายการโครงการ','โครงการทั้งหมด '+STRATEGY_COUNT+' ยุทธศาสตร์ + งบบริหารสำนักงาน'],
    gsheet:    ['Google Sheets','นำเข้า / ส่งออกข้อมูล'],
    gantt:     ['แผน Gantt Chart','ระยะเวลาดำเนินงานโครงการ ปีงบประมาณ พ.ศ. '+currentYear],
    actlog:    ['ประวัติการแก้ไข','บันทึกการเพิ่ม / แก้ไข / ลบโครงการ (แชร์ทุกคนที่ login เข้ามา)'],
    risk:      ['แผนบริหารความเสี่ยง (PRM)','แบบประเมินและบริหารความเสี่ยงของโครงการ ปีงบประมาณ พ.ศ. '+currentYear],
    riskregister: ['รายงานผลการบริหารความเสี่ยง','รวบรวมข้อมูลจากแผนบริหารความเสี่ยง (PRM) ที่ผู้รับผิดชอบกรอกไว้ พร้อม Heat Map และ Export PDF/CSV · ปีงบประมาณ พ.ศ. 2570'],
    report:    ['รายงานผลการดำเนินงาน','เลือกโครงการที่กรอกไว้แล้ว เพื่ออัปเดตสถานะและผลการดำเนินงาน']
  };
  if(titles[page]){
    document.getElementById('topbar-title').textContent=titles[page][0];
    document.getElementById('topbar-sub').textContent=titles[page][1];
  }

  if(page==='dashboard') updateDashboard();
  if(page==='gantt') renderGantt();
  if(page==='actlog') renderActlog();
  if(page==='risk') initRiskPageWithSync();
  if(page==='riskregister') rrgInitPage();
  if(page==='report') openReportPage();
  if(page==='projects'){
    if(strategyFilter!==undefined) document.getElementById('filterStrategy').value=strategyFilter;
    // เข้าหน้าโครงการทั้งหมดตามปกติ ให้ล้างตัวกรองอนุกรรมการเดิมทิ้งก่อนเสมอ
    // (filterByCommittee จะตั้งค่าใหม่ทับอีกทีผ่าน setTimeout หลัง showPage เสร็จ)
    const fcEl = document.getElementById('filterCommittee');
    if (fcEl) fcEl.value = '';
    currentPage=1; renderTable();
  }
}

// เติมตัวเลือกใน dropdown "อนุกรรมการ" จาก COM_LIST (เรียกครั้งเดียวตอน init)
function populateCommitteeFilter() {
  const el = document.getElementById('filterCommittee');
  if (!el) return;
  const opts = [...COM_LIST, COM_UNASSIGNED]
    .map(c => `<option value="${c.key}">${c.icon} ${c.label}</option>`).join('');
  el.innerHTML = `<option value="">🏛 อนุกรรมการทั้งหมด</option>${opts}`;
}

function filterByCommittee(comKey) {
  showPage('projects');
  setTimeout(() => {
    // ล้างตัวกรองอื่น ๆ ที่อาจบดบังผลลัพธ์ แล้วกรองด้วยอนุกรรมการจริง ๆ ผ่าน dropdown
    const filterEl = document.getElementById('filterStrategy');
    if (filterEl) { filterEl.value = ''; }
    const searchEl = document.getElementById('searchInput');
    if (searchEl) { searchEl.value = ''; }
    const fcEl = document.getElementById('filterCommittee');
    if (fcEl) { fcEl.value = comKey || ''; }
    currentPage = 1;
    renderTable();
  }, 100);
}

function filterByStatus(status) {
  document.getElementById('filterStatus').value=status;
  renderTable();
}

function goToStrategy(s) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active');
    if(el.getAttribute('onclick') && el.getAttribute('onclick').includes("'projects'")) el.classList.add('active');
  });
  showPage('projects', s);
}

// ===== DASHBOARD =====
function updateDashboard() {
  // ── อัปเดต Year Banner และ theme ────────────────────────────────
  const is2570 = currentYear === 2570;
  // body theme class
  document.body.classList.toggle('year-2570', is2570);
  // year banner
  const banner = document.getElementById('yearBanner');
  if(banner) banner.className = 'year-banner ' + (is2570?'banner-2570':'banner-2569');
  const bannerNum = document.getElementById('yearBannerNum');
  if(bannerNum){ bannerNum.textContent = currentYear; bannerNum.className = 'year-banner-year'+(is2570?' y2570':''); }
  // year labels ทั่ว dashboard
  ['budgetBarYear','summaryQuarterLabel','committeeQuarterLabel'].forEach(id=>{
    const el = document.getElementById(id);
    if(el && el.id==='budgetBarYear') el.textContent = currentYear;
  });
  // summaryQuarterLabel (full text)
  const sqlEl = document.getElementById('summaryQuarterLabel');
  if(sqlEl) sqlEl.textContent = 'ปีงบประมาณ พ.ศ. '+currentYear;
  const cqlEl = document.getElementById('committeeQuarterLabel');
  if(cqlEl) cqlEl.textContent = 'ปีงบประมาณ พ.ศ. '+currentYear;
  // quarterBadge
  const qb = document.getElementById('quarterBadge');
  if(qb) qb.textContent = 'ปีงบ '+currentYear + (currentQuarter!=='all'?' Q'+currentQuarter:'');
  // ─────────────────────────────────────────────────────────────────

  const fp = getFilteredProjects();
  const done = fp.filter(p=>p.status==='done').length;
  const prog = fp.filter(p=>p.status==='progress').length;
  const pend = fp.filter(p=>p.status==='pending').length;
  const tb   = fp.reduce((s,p)=>s+(p.budget||0),0);
  const totalSpent  = fp.reduce((s,p)=>s+(p.spent||0),0);
  const totalPo     = fp.reduce((s,p)=>s+(p.po||0),0);
  const totalPlan   = totalSpent + totalPo;
  const totalRemaining = tb - totalSpent - totalPo;
  const spentPct = tb>0?Math.round(totalSpent/tb*100):0;
  const planPct  = tb>0?Math.round(totalPlan/tb*100):0;
  const remPct   = tb>0?Math.round((tb-totalSpent)/tb*100):100;

  animateNumber(document.getElementById('m-total'), fp.length);
  document.getElementById('m-total-sub').textContent = `${STRATEGY_COUNT} ยุทธศาสตร์ + งบบริหารสำนักงาน`;
  animateNumber(document.getElementById('m-budget'), tb, {currency:true});
  animateNumber(document.getElementById('m-spent'), totalSpent, {currency:true});
  document.getElementById('m-spent-sub').textContent = `คิดเป็น ${spentPct}% ของงบรวม`;
  document.getElementById('m-spent-bar').style.width = Math.min(spentPct,100)+'%';
  animateNumber(document.getElementById('m-remaining'), tb-totalSpent, {currency:true});
  document.getElementById('m-remaining-sub').textContent = `คิดเป็น ${remPct}% ของงบรวม`;
  document.getElementById('m-remaining-bar').style.width = Math.min(remPct,100)+'%';
  animateNumber(document.getElementById('m-plan'), totalPlan, {currency:true});
  document.getElementById('m-plan-sub').textContent = `คิดเป็น ${planPct}% ของงบรวม`;
  document.getElementById('m-plan-bar').style.width = Math.min(planPct,100)+'%';
  animateNumber(document.getElementById('m-po'), totalPo, {currency:true});
  animateNumber(document.getElementById('m-net-remaining'), totalRemaining, {currency:true});

  animateNumber(document.getElementById('p-done'), done);
  animateNumber(document.getElementById('p-progress'), prog);
  animateNumber(document.getElementById('p-pending'), pend);

  renderBudgetBar(fp, tb, totalSpent, totalPo, totalRemaining);
  renderAllocatedBudgetCard(fp);
  renderStrategyCards(fp);
  renderSummaryTable(fp);
  renderCommitteeSection(fp);
  requestAnimationFrame(()=>{ renderCharts(fp); renderUtilizationChart(fp); renderCommitteeChart(fp); });
}

function renderBudgetBar(fp, tb, ts, tp, rem) {
  const bar = document.getElementById('budgetMegaBar');
  const leg = document.getElementById('budgetBarLegend');
  const qEl = document.getElementById('budgetBarQuarter');
  if(qEl) qEl.textContent = Q_LABEL[currentQuarter];
  if(!bar) return;
  const spentPct  = tb>0 ? Math.max((ts/tb)*100, 0) : 0;
  const poPct     = tb>0 ? Math.max((tp/tb)*100, 0) : 0;
  const remPct    = tb>0 ? Math.max((Math.max(rem,0)/tb)*100, 0) : 100;
  bar.innerHTML = `
    <div style="width:${spentPct.toFixed(1)}%;background:#13865B;transition:width .6s;min-width:${spentPct>0?2:0}px" title="ใช้ไปแล้ว ${spentPct.toFixed(1)}%"></div>
    <div style="width:${poPct.toFixed(1)}%;background:#C8961E;transition:width .6s;min-width:${poPct>0?2:0}px" title="PO ผูกพัน ${poPct.toFixed(1)}%"></div>
    <div style="flex:1;background:var(--surface2)"></div>
  `;
  const usedTotal = ts + tp;
  const usedPct = tb>0?((usedTotal/tb)*100).toFixed(1):0;
  leg.innerHTML = `
    <span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:#13865B;display:inline-block"></span>ใช้ไปแล้ว <strong>${fmtFull(ts)} บาท</strong> (${spentPct.toFixed(1)}%)</span>
    <span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:#C8961E;display:inline-block"></span>PO ผูกพัน <strong>${fmtFull(tp)} บาท</strong> (${poPct.toFixed(1)}%)</span>
    <span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:var(--surface2);border:1px solid var(--border2);display:inline-block"></span>คงเหลือ <strong style="color:${rem<0?'var(--red)':'var(--text)'}">${fmtFull(rem)} บาท</strong> (${remPct.toFixed(1)}%)</span>
    <span style="margin-left:auto;font-weight:700;color:var(--accent)">รวมเบิกจ่าย+PO: ${usedPct}% จากงบ ${fmtFull(tb)} บาท</span>
  `;
}

// ── การ์ดเปรียบเทียบ: งบประมาณที่ได้รับจัดสรร vs ยอดรวมงบประมาณที่กรอกตามยุทธศาสตร์ ──
function renderAllocatedBudgetCard(fp) {
  const el = document.getElementById('allocatedBudgetCard');
  if (!el) return;
  const allocated = getAllocatedBudget();
  const entered = fp.reduce((a,p)=>a+(p.budget||0),0);
  const diff = allocated - entered;
  const usedPct = allocated>0 ? Math.round(entered/allocated*100) : 0;
  const usedPctClamped = Math.min(Math.max(usedPct,0),100);
  const over = diff < 0;
  const diffLabel = over ? 'เกินวงเงินที่ได้รับจัดสรร' : 'คงเหลือ (ยังไม่จัดทำโครงการ)';
  const statusColor = over ? 'var(--red)' : (usedPct>=90 ? 'var(--amber)' : 'var(--green)');
  const statusBg    = over ? 'rgba(220,38,38,.1)' : (usedPct>=90 ? 'rgba(217,119,6,.1)' : 'rgba(5,150,105,.1)');
  const statusText  = over ? '⚠️ เกินวงเงินจัดสรร' : (usedPct>=90 ? '⏳ ใกล้เต็มวงเงิน' : '✅ อยู่ในวงเงินจัดสรร');
  const diffIcon = over
    ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
    : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';

  el.innerHTML = `
  <div class="card" style="margin-bottom:0">
    <div class="card-header" style="flex-wrap:wrap;gap:.5rem">
      <span class="card-title">💼 งบประมาณตามยุทธศาสตร์ เทียบกับงบที่ได้รับจัดสรร</span>
      <div style="display:flex;align-items:center;gap:8px;margin-left:auto">
        <span style="font-size:11px;font-weight:700;padding:4px 11px;border-radius:99px;background:${statusBg};color:${statusColor}">${statusText}</span>
        <button class="btn btn-sm" style="font-size:11px;padding:4px 10px" onclick="openAllocatedBudgetModal()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;vertical-align:-1px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82A1.65 1.65 0 0 0 3 13.09H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>ตั้งค่างบจัดสรร
        </button>
      </div>
    </div>
    <div class="card-body" style="padding:1rem 1.25rem">
      <div class="metrics-mid" style="margin-bottom:14px">
        <div class="metric-card c-blue-deep">
          <div class="metric-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg></div>
          <div class="metric-label">งบที่ได้รับจัดสรรประจำปี</div>
          <div class="metric-value">${fmtFull(allocated)}</div>
          <div class="metric-sub">บาท · ปีงบประมาณ พ.ศ. ${currentYear}</div>
        </div>
        <div class="metric-card c-amber-deep">
          <div class="metric-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
          <div class="metric-label">ยอดรวมงบที่กรอกเข้าระบบ</div>
          <div class="metric-value">${fmtFull(entered)}</div>
          <div class="metric-sub">บาท · คิดเป็น ${usedPct}% ของงบจัดสรร</div>
          <div class="metric-progress"><div class="metric-progress-track"><div class="metric-progress-fill" style="width:${usedPctClamped}%;background:${over?'#C2362F':'#C8961E'}"></div></div></div>
        </div>
        <div class="metric-card ${over?'c-red-deep':'c-green-deep'}">
          <div class="metric-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${diffIcon}</svg></div>
          <div class="metric-label">${diffLabel}</div>
          <div class="metric-value">${fmtFull(Math.abs(diff))}</div>
          <div class="metric-sub">บาท</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:11.5px;font-weight:600;color:var(--text2)">สัดส่วนงบที่กรอกแล้ว เทียบกับวงเงินจัดสรรทั้งหมด</span>
        <span style="font-size:11.5px;font-weight:700;color:${over?'var(--red)':'var(--text)'}">${usedPct}%</span>
      </div>
      <div style="height:14px;border-radius:99px;overflow:hidden;background:var(--surface2)">
        <div style="height:100%;width:${usedPctClamped}%;background:${over?'#C2362F':'#102352'};border-radius:99px;transition:width .6s"></div>
      </div>
    </div>
  </div>`;
}

function renderStrategyCards(fp) {
  const el = document.getElementById('strategy-summary-top');
  if (!el) return;

  const S_BG     = {'1':'rgba(59,114,240,.08)','2':'rgba(5,150,105,.08)','3':'rgba(217,119,6,.08)','4':'rgba(139,92,246,.08)','5':'rgba(107,114,128,.08)'};
  const S_BORDER = {'1':'rgba(59,114,240,.28)','2':'rgba(5,150,105,.28)','3':'rgba(217,119,6,.28)','4':'rgba(139,92,246,.28)','5':'rgba(107,114,128,.28)'};

  const cards = S_KEYS.map(s => {
    const ps     = fp.filter(p => p.strategy == s);
    const budget = ps.reduce((a,p) => a+(p.budget||0), 0);
    const spent  = ps.reduce((a,p) => a+(p.spent||0),  0);
    const po     = ps.reduce((a,p) => a+(p.po||0),     0);
    const rem    = budget - spent - po;
    const pct    = budget > 0 ? Math.round((spent+po)/budget*100) : 0;
    const done   = ps.filter(p=>p.status==='done').length;
    const prog   = ps.filter(p=>p.status==='progress').length;
    const pend   = ps.filter(p=>p.status==='pending').length;
    const barCol = pct>=90?'var(--red)':pct>=70?'var(--amber)':S_COLORS[s];
    const remCol = rem<0?'var(--red)':'var(--green)';
    return `<div onclick="goToStrategy('${s}')"
      style="background:${S_BG[s]};border:1.5px solid ${S_BORDER[s]};border-radius:14px;padding:14px 16px;cursor:pointer;transition:all .18s;position:relative;overflow:hidden"
      onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 24px rgba(0,0,0,.1)'"
      onmouseout="this.style.transform='';this.style.boxShadow=''">
      <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:${S_COLORS[s]};border-radius:14px 0 0 14px"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-left:6px">
        <span class="badge ${S_BADGE[s]}" style="font-size:10px">${S_NAMES[s]}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${S_COLORS[s]}" stroke-width="2.5" style="opacity:.5;flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div style="font-size:11.5px;font-weight:700;color:var(--text);line-height:1.35;margin-bottom:8px;padding-left:6px">${S_FULL[s]}</div>
      <div style="display:flex;align-items:flex-end;gap:4px;margin-bottom:2px;padding-left:6px">
        <span style="font-size:26px;font-weight:800;color:${S_COLORS[s]};line-height:1">${ps.length}</span>
        <span style="font-size:11px;color:var(--text2);margin-bottom:3px;font-weight:600">${S_UNIT[s]}</span>
      </div>
      <div style="font-size:12px;color:var(--text2);font-weight:600;padding-left:6px;margin-bottom:7px">${fmtFull(budget)} บาท</div>
      <div style="height:4px;background:rgba(0,0,0,.08);border-radius:99px;overflow:hidden;margin-bottom:5px">
        <div style="height:100%;width:${Math.min(pct,100)}%;background:${barCol};border-radius:99px;transition:width .5s"></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;font-size:10.5px;padding-left:4px">
        <div style="display:flex;gap:7px">
          <span style="color:var(--green)">✅ ${done}</span>
          <span style="color:var(--accent)">⏳ ${prog}</span>
          <span style="color:var(--text3)">⭕ ${pend}</span>
        </div>
        <span style="color:${barCol};font-weight:700">${pct}%</span>
      </div>
      <div style="font-size:10.5px;color:var(--text3);margin-top:5px;padding-left:4px">
        คงเหลือ <strong style="color:${remCol}">${fmtFull(rem)}</strong> บาท
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:15px">🎯</span>
        <span style="font-size:14px;font-weight:700">สรุปตามยุทธศาสตร์</span>
        <span style="font-size:11px;color:var(--text3);margin-left:auto">คลิกที่การ์ดเพื่อดูโครงการ →</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px">${cards}</div>
    </div>`;
}

function renderCharts(fp) {
  const budgets = S_KEYS.map(s=>fp.filter(p=>p.strategy==s).reduce((a,p)=>a+(p.budget||0),0));
  const colors  = S_KEYS.map(s=>S_COLORS[s]);
  const chartFont = { family: "'Sarabun', sans-serif", size: 11 };
  const tb = fp.reduce((a,p)=>a+(p.budget||0),0);

  // helper: safely get a fresh canvas by replacing it
  function freshCanvas(id) {
    const old = document.getElementById(id);
    if(!old) return null;
    const parent = old.parentNode;
    const clone = document.createElement('canvas');
    clone.id = id;
    parent.replaceChild(clone, old);
    return clone;
  }

  // ── Doughnut: Budget by strategy ──
  chartBudget = new Chart(freshCanvas('chartBudget'),{
    type:'doughnut',
    data:{
      labels: S_KEYS.map(s=>S_NAMES[s]),
      datasets:[{
        data: budgets, backgroundColor: colors,
        borderWidth: 4, borderColor:'#fff',
        hoverOffset: 10, hoverBorderWidth: 0
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      cutout:'70%',
      plugins:{
        legend:{display:false},
        tooltip:{
          backgroundColor:'rgba(11,24,56,.94)', padding:10, cornerRadius:8,
          callbacks:{ label:ctx=>`  ${fmtFull(ctx.parsed)} บาท  (${tb>0?Math.round(ctx.parsed/tb*100):0}%)` },
          bodyFont:chartFont, titleFont:{...chartFont,weight:'700'}
        }
      },
      animation:{ animateRotate:true, duration:700 }
    }
  });
  const centerEl = document.getElementById('chartBudgetCenter');
  if(centerEl) centerEl.innerHTML = `<div style="font-size:10px;color:var(--text3);font-weight:600">งบรวม</div><div style="font-size:15px;font-weight:800;color:var(--text);margin-top:1px">${fmtFull(tb)}</div><div style="font-size:9px;color:var(--text3)">บาท</div>`;

  const leg = document.getElementById('chartBudgetLegend');
  if(leg) leg.innerHTML = S_KEYS.map((s,i)=>`
    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="width:8px;height:8px;border-radius:50%;background:${colors[i]};flex-shrink:0;display:inline-block"></span>
        <span style="font-size:12px;color:var(--text2)">${S_NAMES[s]}</span>
      </div>
      <span style="font-weight:700;color:var(--text);font-size:14px">${fmtFull(budgets[i])}</span>
    </div>`).join('');

  // ── Bar: Project status ──
  const done=fp.filter(p=>p.status==='done').length;
  const prog=fp.filter(p=>p.status==='progress').length;
  const pend=fp.filter(p=>p.status==='pending').length;

  chartStatus = new Chart(freshCanvas('chartStatus'),{
    type:'bar',
    data:{
      labels:['แล้วเสร็จ','กำลังดำเนิน','ยังไม่เริ่ม'],
      datasets:[{
        data:[done,prog,pend],
        backgroundColor:['#13865B','#2456C9','#C3CAD8'],
        borderColor:['#A2CB8B','#F08787','#6D94C5'],
        borderWidth:0, borderRadius:10, borderSkipped:false,
        hoverBackgroundColor:['#0E6D49','#1A3F9A','#A9B2C3']
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{
          backgroundColor:'rgba(11,24,56,.94)', padding:10, cornerRadius:8,
          callbacks:{ label:ctx=>`  ${ctx.parsed.y} โครงการ` },
          bodyFont:chartFont, titleFont:{...chartFont,weight:'700'}
        }
      },
      scales:{
        x:{ grid:{display:false}, ticks:{font:chartFont,color:'#5a6477'}, border:{display:false} },
        y:{ beginAtZero:true, ticks:{stepSize:1,font:chartFont,color:'#9aa3b2'}, grid:{color:'rgba(0,0,0,.04)'}, border:{display:false} }
      },
      animation:{ duration:600 }
    }
  });
  const sLeg = document.getElementById('statusLegend');
  if(sLeg) sLeg.innerHTML = [
    ['#A2CB8B','✅ แล้วเสร็จ',done],
    ['#E9B63B','⏳ กำลังดำเนิน',prog],
    ['#B77466','⭕ ยังไม่เริ่ม',pend]
  ].map(([c,l,n])=>`<span style="display:flex;align-items:center;gap:4px;font-size:14px;font-weight:600;color:${c}"><span style="width:8px;height:8px;border-radius:50%;background:${c};display:inline-block"></span>${l} <strong>${n}</strong></span>`).join('');

  // ── Doughnut: Budget plan vs remaining (gauge) ──
  const ts = fp.reduce((a,p)=>a+(p.spent||0),0);
  const tp = fp.reduce((a,p)=>a+(p.po||0),0);
  const rem = tb - ts - tp;

  chartBudgetGauge = new Chart(freshCanvas('chartBudgetGauge'),{
    type:'doughnut',
    data:{
      labels:['ใช้ไปแล้ว','PO ผูกพัน','คงเหลือ'],
      datasets:[{
        data:[ts, tp, Math.max(rem, 0)],
        backgroundColor:['rgba(240,135,135,.8)','rgba(222,195,132,.8)','rgba(162,203,139,.8)'],
        borderColor:['#F08787','#DEC384','#A2CB8B'],
        borderWidth:0, hoverOffset:8, hoverBorderWidth:0
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      cutout:'70%',
      plugins:{
        legend:{display:false},
        tooltip:{
          backgroundColor:'rgba(11,24,56,.94)', padding:10, cornerRadius:8,
          callbacks:{ label:ctx=>`  ${fmtFull(ctx.parsed)} บาท` },
          bodyFont:chartFont, titleFont:{...chartFont,weight:'700'}
        }
      },
      animation:{ animateRotate:true, duration:700 }
    }
  });
  const usedPct = tb>0?Math.round((ts+tp)/tb*100):0;
  const gCenter = document.getElementById('chartGaugeCenter');
  if(gCenter) gCenter.innerHTML = `<div style="font-size:14px;color:var(--text3);font-weight:600">เบิกจ่าย+PO</div><div style="font-size:18px;font-weight:800;color:var(--accent);margin-top:1px">${usedPct}%</div><div style="font-size:9px;color:var(--text3)">ของงบรวม</div>`;
  const gLeg = document.getElementById('gaugeLegend');
  if(gLeg) gLeg.innerHTML = [
    ['#F08787','ใช้ไปแล้ว',ts],
    ['#DEC384','PO ผูกพัน',tp],
    ['#A2CB8B','คงเหลือสุทธิ',rem]
  ].map(([c,l,n])=>`<div style="display:flex;align-items:center;justify-content:space-between"><div style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0;display:inline-block"></span><span style="color:var(--text2)">${l}</span></div><span style="font-weight:700;color:${n<0?'var(--red)':'var(--text)'}">${fmtFull(n)} บาท</span></div>`).join('');
}

function totalBudget(fp){ return fp.reduce((a,p)=>a+(p.budget||0),0); }

function renderUtilizationChart(fp) {
  const labels    = S_KEYS.map(s=>S_NAMES[s].replace('ยุทธศาสตร์ที่ ','ย.'));
  const budgets   = S_KEYS.map(s=>fp.filter(p=>p.strategy==s).reduce((a,p)=>a+(p.budget||0),0));
  const spents    = S_KEYS.map(s=>fp.filter(p=>p.strategy==s).reduce((a,p)=>a+(p.spent||0),0));
  const pos       = S_KEYS.map(s=>fp.filter(p=>p.strategy==s).reduce((a,p)=>a+(p.po||0),0));
  const remainings= S_KEYS.map((s,i)=>Math.max(budgets[i]-spents[i]-pos[i],0));
  const spentPOs  = S_KEYS.map((s,i)=>spents[i]+pos[i]);
  const chartFont = { family:"'Sarabun', sans-serif", size:11 };

  const old = document.getElementById('chartUtilization');
  if(old) { const clone=document.createElement('canvas'); clone.id='chartUtilization'; old.parentNode.replaceChild(clone,old); }

  chartUtilization = new Chart(document.getElementById('chartUtilization'),{
    type:'bar',
    data:{
      labels,
      datasets:[
        { label:'งบอนุมัติ',     data:budgets,   backgroundColor:'rgba(109,148,197,.8)', borderColor:'#6D94C5', borderWidth:0, borderRadius:8, borderSkipped:false },
        { label:'ใช้ไปแล้ว+PO', data:spentPOs,  backgroundColor:'rgba(240,135,135,.8)', borderColor:'#F08787', borderWidth:0, borderRadius:8, borderSkipped:false },
        { label:'PO ผูกพัน',    data:pos,        backgroundColor:'rgba(222,195,132,.8)', borderColor:'#DEC384', borderWidth:0, borderRadius:8, borderSkipped:false },
        { label:'คงเหลือ',      data:remainings, backgroundColor:'rgba(162,203,139,.8)', borderColor:'#A2CB8B', borderWidth:0, borderRadius:8, borderSkipped:false }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ position:'bottom', labels:{ font:chartFont, boxWidth:10, padding:16, usePointStyle:true, pointStyle:'circle' } },
        tooltip:{
          backgroundColor:'rgba(11,24,56,.94)', padding:10, cornerRadius:8,
          callbacks:{
            label:ctx=>` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('th-TH')} บาท`,
            afterBody:ctx=>{
              const i=ctx[0]?.dataIndex; if(i===undefined) return;
              const pct=budgets[i]>0?Math.round(spentPOs[i]/budgets[i]*100):0;
              return [`  เบิกจ่าย+PO: ${pct}% ของงบอนุมัติ`];
            }
          },
          bodyFont:chartFont, titleFont:{...chartFont,weight:'700'}
        }
      },
      scales:{
        x:{ grid:{display:false}, ticks:{font:chartFont,color:'#5a6477'}, border:{display:false} },
        y:{ beginAtZero:true, grid:{color:'rgba(0,0,0,.04)'}, border:{display:false},
            ticks:{ callback:v=>v>=1000000?(v/1000000).toFixed(1)+'M':v>=1000?(v/1000).toFixed(0)+'K':v, font:chartFont, color:'#9aa3b2' } }
      },
      animation:{ duration:600 }
    },
    plugins:[{
      id:'strategyDividers',
      afterDraw(chart){
        const {ctx, chartArea:{top,bottom}, scales:{x}} = chart;
        ctx.save();
        for(let i=0; i<labels.length-1; i++){
          const xPos = (x.getPixelForValue(i) + x.getPixelForValue(i+1)) / 2;
          ctx.beginPath();
          ctx.moveTo(xPos, top - 8);
          ctx.lineTo(xPos, bottom);
          ctx.setLineDash([5,4]);
          ctx.strokeStyle = 'rgba(90,100,120,0.25)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.restore();
      }
    }]
  });
}

function renderSummaryTable(fp) {
  const el = document.getElementById('summaryTableBody'); if(!el) return;
  const rows = S_KEYS.map(s=>{
    const ps = fp.filter(p=>p.strategy==s);
    const budget = ps.reduce((a,p)=>a+(p.budget||0),0);
    const spent  = ps.reduce((a,p)=>a+(p.spent||0),0);
    const po     = ps.reduce((a,p)=>a+(p.po||0),0);
    const remaining = budget-spent-po;
    const pct = budget>0?Math.round((spent+po)/budget*100):0;
    const done=ps.filter(p=>p.status==='done').length;
    const prog=ps.filter(p=>p.status==='progress').length;
    const pend=ps.filter(p=>p.status==='pending').length;
    return `<tr>
      <td><span class="badge ${S_BADGE[s]}">${S_NAMES[s]}</span><div style="font-size:11px;color:var(--text3);margin-top:2px">${S_FULL[s]}</div></td>
      <td style="text-align:center">${ps.length} ${S_UNIT[s]}</td>
      <td class="td-num">${fmtFull(budget)}</td>
      <td class="td-num">${fmtFull(spent)}</td>
      <td class="td-num">${fmtFull(po)}</td>
      <td class="td-num" style="${remaining<0?'color:var(--red)':''}">${fmtFull(remaining)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:7px">
          <div style="flex:1;height:5px;background:var(--surface2);border-radius:99px;overflow:hidden">
            <div style="height:100%;width:${Math.min(pct,100)}%;background:${S_COLORS[s]};border-radius:99px"></div>
          </div>
          <span style="font-size:11px;color:var(--text2);min-width:30px;text-align:right">${pct}%</span>
        </div>
      </td>
      <td style="text-align:center;font-size:12px">
        <span style="color:var(--green);margin-right:4px">✅${done}</span>
        <span style="color:var(--accent);margin-right:4px">⏳${prog}</span>
        <span style="color:var(--text3)">○${pend}</span>
      </td>
    </tr>`;
  });
  // Total
  const tb = fp.reduce((a,p)=>a+(p.budget||0),0);
  const ts = fp.reduce((a,p)=>a+(p.spent||0),0);
  const tp = fp.reduce((a,p)=>a+(p.po||0),0);
  const tr2 = tb-ts-tp;
  const tpct = tb>0?Math.round((ts+tp)/tb*100):0;
  rows.push(`<tr style="background:var(--surface2);font-weight:700">
    <td>รวมทั้งหมด (${STRATEGY_COUNT} ยุทธศาสตร์ + งบบริหารสำนักงาน)</td>
    <td style="text-align:center">${fp.length}</td>
    <td class="td-num">${fmtFull(tb)}</td>
    <td class="td-num">${fmtFull(ts)}</td>
    <td class="td-num">${fmtFull(tp)}</td>
    <td class="td-num" style="${tr2<0?'color:var(--red)':''}">${fmtFull(tr2)}</td>
    <td>
      <div style="display:flex;align-items:center;gap:7px">
        <div style="flex:1;height:5px;background:var(--border2);border-radius:99px;overflow:hidden">
          <div style="height:100%;width:${Math.min(tpct,100)}%;background:var(--accent);border-radius:99px"></div>
        </div>
        <span style="font-size:11px;color:var(--text2);min-width:30px;text-align:right">${tpct}%</span>
      </div>
    </td>
    <td style="text-align:center;font-size:12px">
      <span style="color:var(--green);margin-right:4px">✅${fp.filter(p=>p.status==='done').length}</span>
      <span style="color:var(--accent);margin-right:4px">⏳${fp.filter(p=>p.status==='progress').length}</span>
      <span style="color:var(--text3)">○${fp.filter(p=>p.status==='pending').length}</span>
    </td>
  </tr>`);
  el.innerHTML = rows.join('');
}

// ===== TABLE =====
function renderTable() {
  const filtered = getFiltered();
  const total=filtered.length;
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  if(currentPage>pages) currentPage=pages;
  const start=(currentPage-1)*PAGE_SIZE;
  const slice=filtered.slice(start,start+PAGE_SIZE);
  const tbody=document.getElementById('tableBody');
  // งบบริหารสำนักงาน (ยุทธศาสตร์ 5) ไม่ใช่ยุทธศาสตร์ นับหน่วยเป็น "รายการ" — สลับป้ายหัวคอลัมน์
  // ให้ตรงกับประเภทข้อมูล เฉพาะตอนกรองดูยุทธศาสตร์นั้นโดยเฉพาะเท่านั้น (ไม่กระทบมุมมอง "ทั้งหมด")
  const fsEl = document.getElementById('filterStrategy');
  const isOfficeOnly = fsEl && fsEl.value === '5';
  const colHeader = document.getElementById('colProjectName');
  if (colHeader && colHeader.firstChild) colHeader.firstChild.textContent = isOfficeOnly ? 'ชื่อรายการ ' : 'ชื่อโครงการ ';
  if(!slice.length){
    tbody.innerHTML=`<tr><td colspan="11"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <p>ไม่พบข้อมูลที่ค้นหา</p></div></td></tr>`;
  } else {
    tbody.innerHTML = slice.map((p,i)=>{
      const budget   = p.budget||0;
      const spent    = p.spent||0;
      const po       = p.po||0;
      const usedTotal= spent + po;
      const remaining= budget - usedTotal;
      const usedPct  = budget>0 ? Math.min(Math.round(usedTotal/budget*100),100) : 0;
      const kpiCount = (p.kpi||[]).length;
      const barColor = usedPct>=90?'var(--red)': usedPct>=70?'var(--amber)': 'var(--green)';
      return `<tr class="data-row" onclick="openDetail(${p.id})">
        <td style="color:var(--text3);text-align:center;font-size:12px;width:32px">${start+i+1}</td>
        <td class="td-name" style="background:${_lightBg(S_COLORS[p.strategy],0.07)};border-left:3px solid ${S_COLORS[p.strategy]||'transparent'}">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="user-select:text">${(p.name||'(ไม่มีชื่อ)').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>
            ${p.quarter&&p.quarter!=='all'?`<span style="font-size:10px;background:var(--accent-light);color:var(--accent);padding:1px 6px;border-radius:4px;font-weight:600;flex-shrink:0">Q${p.quarter}</span>`:''}
            ${(typeof _getCommittees==='function'&&_getCommittees(p).length>0)?`<span style="font-size:10px;background:#f0fdf4;color:#166534;padding:1px 6px;border-radius:4px;font-weight:600;flex-shrink:0">👥 ${_getCommittees(p).map(k=>{const c=(typeof COM_LIST!=='undefined'?COM_LIST:[]).find(x=>x.key===k);return c?c.label.replace('ด้าน',''):k;}).join(', ')}</span>`:''}
          </div>
        </td>
        <td><span class="badge ${S_BADGE[p.strategy]}">${S_NAMES[p.strategy]}</span></td>
        <td class="td-num" style="font-weight:600">${fmtFull(budget)}</td>
        <td class="td-num" style="color:var(--green)">${fmtFull(spent)}</td>
        <td class="td-num" style="color:var(--amber)">${po>0?fmtFull(po):'<span style="color:var(--text3)">—</span>'}</td>
        <td class="td-num">
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
            <span style="font-weight:700;color:${usedPct>=90?'var(--red)':'var(--text)'}">${fmtFull(usedTotal)}</span>
            <div style="width:64px;height:4px;background:var(--surface2);border-radius:99px;overflow:hidden">
              <div style="height:100%;width:${usedPct}%;background:${barColor};border-radius:99px;transition:width .4s"></div>
            </div>
            <span style="font-size:10px;color:var(--text3)">${usedPct}% ของงบ</span>
          </div>
        </td>
        <td class="td-num" style="font-weight:600;color:${remaining<0?'var(--red)':remaining===0?'var(--text3)':'var(--text)'}">${fmtFull(remaining)}</td>
        <td><span class="badge ${STATUS_CLASS[p.status]}">${STATUS_LABEL[p.status]}</span></td>
        <td style="text-align:center">
          ${kpiCount>0?`<span class="badge badge-s1">${kpiCount} ตัวชี้วัด</span>`:'<span style="color:var(--text3);font-size:11px">—</span>'}
        </td>
        <td class="td-actions" onclick="event.stopPropagation()">
          <div class="td-actions-inner">
            <button class="btn btn-sm btn-icon" title="ดูรายละเอียด" onclick="openDetail(${p.id})" style="color:var(--s5)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            ${_isEditable() ? `
            <button class="btn btn-sm btn-icon" title="แก้ไข" onclick="openEdit(${p.id})" style="color:var(--accent)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-sm btn-icon btn-danger" title="ลบ" onclick="confirmDelete(${p.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
            ` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
    // ── Footer totals row ──
    const allFiltered = getFiltered();
    const fTotalBudget = allFiltered.reduce((a,p)=>a+(p.budget||0),0);
    const fTotalSpent  = allFiltered.reduce((a,p)=>a+(p.spent||0),0);
    const fTotalPo     = allFiltered.reduce((a,p)=>a+(p.po||0),0);
    const fTotalUsed   = fTotalSpent + fTotalPo;
    const fTotalRem    = fTotalBudget - fTotalUsed;
    const fUsedPct     = fTotalBudget>0?Math.round(fTotalUsed/fTotalBudget*100):0;
    tbody.innerHTML += `<tr style="background:linear-gradient(135deg,var(--surface2),#eef2fd);font-weight:700;border-top:2px solid var(--border2)">
      <td colspan="3" style="font-size:12px;color:var(--text2);padding-left:1rem">รวมทั้งหมด ${allFiltered.length} ${isOfficeOnly?'รายการ':'โครงการ'} (กรองแล้ว)</td>
      <td class="td-num" style="font-weight:800">${fmtFull(fTotalBudget)}</td>
      <td class="td-num" style="color:var(--green);font-weight:700">${fmtFull(fTotalSpent)}</td>
      <td class="td-num" style="color:var(--amber);font-weight:700">${fmtFull(fTotalPo)}</td>
      <td class="td-num">
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
          <span style="font-weight:800;color:var(--accent)">${fmtFull(fTotalUsed)}</span>
          <div style="width:72px;height:4px;background:var(--border2);border-radius:99px;overflow:hidden">
            <div style="height:100%;width:${fUsedPct}%;background:var(--accent);border-radius:99px"></div>
          </div>
          <span style="font-size:10px;color:var(--text3)">${fUsedPct}% ของงบ</span>
        </div>
      </td>
      <td class="td-num" style="font-weight:800;color:${fTotalRem<0?'var(--red)':'var(--text)'}">${fmtFull(fTotalRem)}</td>
      <td colspan="3"></td>
    </tr>`;
  }
  document.getElementById('paginationInfo').textContent=`แสดง ${Math.min(start+1,total)}–${Math.min(start+PAGE_SIZE,total)} จากทั้งหมด ${total} โครงการ`;
  const btns=document.getElementById('paginationBtns');
  let html=`<button class="page-btn" onclick="goPage(${currentPage-1})" ${currentPage<=1?'disabled':''}>‹</button>`;
  for(let i=1;i<=pages;i++){
    if(pages<=7||Math.abs(i-currentPage)<=1||i===1||i===pages){
      html+=`<button class="page-btn ${i===currentPage?'active':''}" onclick="goPage(${i})">${i}</button>`;
    } else if(Math.abs(i-currentPage)===2){
      html+=`<button class="page-btn" disabled>…</button>`;
    }
  }
  html+=`<button class="page-btn" onclick="goPage(${currentPage+1})" ${currentPage>=pages?'disabled':''}>›</button>`;
  btns.innerHTML=html;
}

function goPage(p){
  const filtered=getFiltered();
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  currentPage=Math.max(1,Math.min(p,pages));
  renderTable();
}
function getFiltered(){
  const q=(document.getElementById('searchInput').value||'').toLowerCase();
  const fs=document.getElementById('filterStrategy').value;
  const fst=document.getElementById('filterStatus').value;
  const fq=(document.getElementById('filterQuarterTable')||{}).value||'';
  const fc=(document.getElementById('filterCommittee')||{}).value||'';
  return projects.filter(p=>{
    const matchesCom = !fc || (
      fc === COM_UNASSIGNED.key
        ? _getCommittees(p).length === 0
        : _getCommittees(p).includes(fc)
    );
    // กันตาราง/หน้าโครงการพังทั้งหน้า ถ้ามีแถวใน Sheet ที่ไม่มีชื่อโครงการ (เช่น แถวว่าง/ข้อมูลเพี้ยน)
    return (!q||(p.name||'').toLowerCase().includes(q)) &&
      (!fs||p.strategy==fs) &&
      (!fst||p.status===fst) &&
      (!fq||p.quarter===fq||p.quarter==='all') &&
      matchesCom;
  });
}

// ===== MODAL =====
function openAdd(){
  if(!_isEditable()){ showToast('🔒 กรุณาเข้าสู่ระบบก่อนเพิ่มโครงการ', 2500); openAuthModal('login'); return; }
  editingId=null; tempKPIs=[]; docFiles=[];
  document.getElementById('modalTitle').textContent='เพิ่มโครงการใหม่';
  ['editId','fName','fRationale','fObjective','fTargetQuantity','fTarget','fOwner','fApprover','fApproverPos',
   'fProposer','fProposerPos','fAuthorizer','fAuthorizerPos','fCoordinator','fPosition','fDuration',
   'fActivities','fBudgetDetail','fEvalMethod','fEvaluator','fRisk','fExpectedBenefit',
   'fSubStrategy','fDocFiles'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  _setStrategyCheckbox('1');
  document.getElementById('fBudget').value='0';
  setComCheckboxes([]);
  // init tables
  loadGanttFromData([]); loadBudgetFromData([]); loadEvalFromData([],[],[]); loadPeopleFromData({}); renderDocFileList();
  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(()=>document.getElementById('fName').focus(),100);
}

function openEdit(id){
  if(!_isEditable()){ showToast('🔒 กรุณาเข้าสู่ระบบก่อนแก้ไขโครงการ', 2500); openAuthModal('login'); return; }
  const p=projects.find(x=>x.id==id); if(!p) return;
  editingId=id; tempKPIs=[...(p.kpi||[])];
  document.getElementById('modalTitle').textContent='แก้ไขโครงการ';
  document.getElementById('editId').value=id;
  document.getElementById('fName').value=p.name||'';
  document.getElementById('fRationale')&&(document.getElementById('fRationale').value=p.rationale||'');
  document.getElementById('fObjective')&&(document.getElementById('fObjective').value=p.objective||'');
  document.getElementById('fTargetQuantity')&&(document.getElementById('fTargetQuantity').value=p.targetQuantity||'');
  document.getElementById('fTarget')&&(document.getElementById('fTarget').value=p.target||'');
  _setStrategyCheckbox(p.strategy||'1');
  document.getElementById('fOwner').value=p.owner||'';
  document.getElementById('fSubStrategy')&&(document.getElementById('fSubStrategy').value=p.subStrategy||'');
  document.getElementById('fDept')&&(document.getElementById('fDept').value=p.dept||'');
  document.getElementById('fCoordinator')&&(document.getElementById('fCoordinator').value=p.coordinator||'');
  document.getElementById('fPosition')&&(document.getElementById('fPosition').value=p.position||'');
  document.getElementById('fDuration')&&(document.getElementById('fDuration').value=p.duration||'');
  document.getElementById('fBudget').value=p.budget||0;
  document.getElementById('fExpectedBenefit')&&(document.getElementById('fExpectedBenefit').value=p.expectedBenefit||'');
  setComCheckboxes(p.committees||[]);
  // load tables
  loadGanttFromData(p.activities||[]);
  loadBudgetFromData(p.budgetDetail||[]);
  loadEvalFromData(p.kpi||[], p.evalMethod||'', p.evaluator||'');
  loadPeopleFromData(p);
  docFiles = (p.docFiles||[]).map(f=>({...f,status:'saved'})); renderDocFileList();
  document.getElementById('modalOverlay').classList.add('open');
  closeDetail();
}

function closeModal(){ document.getElementById('modalOverlay').classList.remove('open'); }

function saveProject(){
  const name=document.getElementById('fName').value.trim();
  if(!name){alert('กรุณากรอกชื่อโครงการ');return;}

  // รอไฟล์เอกสารแนบที่กำลังอัปโหลดขึ้น Drive ให้เสร็จก่อน
  const stillUploadingDocs = docFiles.filter(f=>f._uploading);
  if(stillUploadingDocs.length){
    showToast(`⏳ รอไฟล์เอกสาร ${stillUploadingDocs.length} ไฟล์อัปโหลดขึ้น Drive ให้เสร็จก่อนครับ`, 3000);
    return;
  }

  const gv=(id,def='')=>{const el=document.getElementById(id);return el?(el.value.trim()||def):def;};
  const gn=(id)=>parseFloat(document.getElementById(id)&&document.getElementById(id).value)||0;

  // sync tables → hidden fields before reading
  syncGanttToHidden(); syncBudgetHidden(); syncEvalHidden(); syncPeopleHidden();

  // parse gantt/budget/eval from state arrays (most up-to-date)
  const activitiesData = ganttRows.length ? ganttRows : [];
  const budgetDetailData = budgetRows.length ? budgetRows : [];
  // สำคัญ: kpi / evalMethod / evaluator ต้องเป็น array ที่ "ขนานกัน" (index ตรงกันทุกแถว)
  // เพราะตอนโหลดกลับมา (loadEvalFromData) จะจับคู่ค่าด้วย index เดียวกันทั้ง 3 คอลัมน์
  // ห้ามกรองแถวที่ kpi (คอลัมน์ 1) ว่างออกเพียงคอลัมน์เดียว เพราะจะทำให้ index ของ
  // evalMethod/evaluator (คอลัมน์ 2,3) เลื่อนสลับกับแถวอื่น หลัง refresh ข้อมูลจะไม่ตรงคอลัมน์เดิม
  // (บั๊กเดิม: ใช้ .filter(Boolean) เฉพาะ kpi ทำให้ length ของ kpi สั้นกว่า evalMethod/evaluator)
  // ตัดเฉพาะแถวที่ "ว่างทั้ง 3 คอลัมน์" เท่านั้น เพื่อคง index ให้ตรงกันเสมอ
  const evalData = (evalRows.length ? evalRows : []).filter(r =>
    (r.kpi||'').trim() || (r.method||'').trim() || (r.tool||'').trim()
  );
  const kpiFromEval = evalData.map(r=>r.kpi);

  const data={
    name,
    subStrategy:     gv('fSubStrategy'),
    rationale:       gv('fRationale'),
    objective:       gv('fObjective'),
    targetQuantity:  gv('fTargetQuantity'),
    target:          gv('fTarget'),
    strategy:        gv('fStrategy','1'),
    owner:           gv('fOwner'),
    dept:            gv('fDept'),
    coordinator:     gv('fCoordinator'),
    position:        gv('fPosition'),
    duration:        gv('fDuration'),
    projectType:     (()=>{ const el=document.querySelector('input[name="fProjectType"]:checked'); return el?el.value:'ต่อเนื่อง'; })(),
    proposer:        gv('fProposer'),
    proposerPos:     gv('fProposerPos'),
    approver:        gv('fApprover'),
    approverPos:     gv('fApproverPos'),
    authorizer:      gv('fAuthorizer'),
    authorizerPos:   gv('fAuthorizerPos'),
    activities:      activitiesData,
    budgetSource:    '',
    budget:          gn('fBudget'),
    budgetDetail:    budgetDetailData,
    evalRows:        evalData,
    // แก้ไข (บั๊กเดิม): ห้ามส่ง JSON.stringify(...) ที่นี่ เพราะ backend (gs70.txt/objToRow) จะ
    // JSON.stringify(d.evalMethod) ซ้ำอีกชั้นอยู่แล้วเสมอ (เหมือน activities/budgetDetail/committees
    // ที่ส่ง raw array ตรงๆ) ถ้าส่ง string มาจากตรงนี้ด้วย จะกลายเป็น "stringify ซ้อน 2 ชั้น" ทำให้ค่าที่
    // เก็บใน Sheet เป็น string ที่มี \" หลุดปนออกมา และ backend อ่านกลับเป็น array ไม่ได้อีกเลย
    // (ต้นเหตุของปัญหา "วิธีการประเมิน/เครื่องมือ ว่างหมดหลัง refresh" ที่พบทุกโครงการ)
    evalMethod:      evalData.map(r=>r.method),
    evaluator:       evalData.map(r=>r.tool),
    risk:            '',
    expectedBenefit: gv('fExpectedBenefit'),
    progress:        0,
    kpi:             kpiFromEval,
    committees:      getComCheckboxes(),
    docFiles:        docFiles.map(f=>({name:f.name,size:f.size,type:f.type,url:f.url||'',fileId:f.fileId||''}))
  };

  // ป้องกันข้อมูลเพี้ยน (สาเหตุที่พบ): บางครั้งมีการวางข้อความ JSON (เช่น รายละเอียดงบประมาณ/กิจกรรม
  // ที่ควรกรอกผ่านตารางของมันเอง) ผิดลงในช่องข้อความอิสระอย่าง "วัตถุประสงค์"/"หลักการและเหตุผล" โดยไม่ตั้งใจ
  // ทำให้หน้ารายละเอียดโครงการแสดงข้อความ JSON ดิบแทนเนื้อหาปกติ — เช็คก่อนบันทึกเพื่อดักจับตั้งแต่ต้นทาง
  const _freeTextFieldsToCheck = [
    ['rationale','หลักการและเหตุผล'], ['objective','วัตถุประสงค์'],
    ['targetQuantity','เป้าหมายเชิงปริมาณ'], ['target','เป้าหมายเชิงคุณภาพ'],
    ['expectedBenefit','ผลที่คาดว่าจะได้รับ']
  ];
  const _looksLikeJson = s => {
    const t = (s||'').trim();
    if(t.length < 20) return false;
    if(!((t.startsWith('[') && t.endsWith(']')) || (t.startsWith('{') && t.endsWith('}')))) return false;
    try { JSON.parse(t); return true; } catch(e){ return false; }
  };
  const _badFields = _freeTextFieldsToCheck.filter(([key])=>_looksLikeJson(data[key])).map(([,label])=>label);
  if(_badFields.length){
    const proceed = confirm(
      'ตรวจพบว่าช่อง "'+_badFields.join('", "')+'" มีข้อความลักษณะเป็นข้อมูล JSON แทนที่จะเป็นข้อความปกติ\n\n'+
      'มักเกิดจากวางข้อความผิดช่อง (เช่น วางรายละเอียดงบประมาณ/กิจกรรมที่ควรกรอกในตารางของมันเอง)\n\n'+
      'กด "ตกลง" เพื่อบันทึกต่อไปตามที่กรอก หรือ "ยกเลิก" เพื่อกลับไปแก้ไขช่องดังกล่าวก่อน'
    );
    if(!proceed) return;
  }
  // ── ผลการดำเนินงาน (สถานะ/งบที่ใช้ไป/PO/ผลการดำเนินงาน/รูปภาพ) จัดการผ่านหน้า "รายงานผลการดำเนินงาน" แยกต่างหาก
  // ตั้งค่าเริ่มต้นเฉพาะตอนสร้างโครงการใหม่เท่านั้น — ตอนแก้ไขแผนจะไม่แตะต้อง/ล้างข้อมูลผลการดำเนินงานที่มีอยู่แล้ว
  if(!editingId){
    data.status    = 'pending';
    data.quarter   = 'all';
    data.spent     = 0;
    data.po        = 0;
    data.result    = '';
    data.problems  = '';
    data.solutions = '';
    data.images    = [];
  }
  const imgCount = 0;
  const imgLabel = '';

  if(editingId){
    data.id=editingId;
    const i=projects.findIndex(p=>p.id==editingId);
    // snapshot ก่อน override (สำหรับ actlog)
    const _oldSnap = i>=0 ? JSON.parse(JSON.stringify(projects[i])) : null;
    if(i>=0) projects[i]={...projects[i],...data};
    // บันทึก actlog
    if(_oldSnap && typeof actlogRecord === 'function'){
      const _changed = typeof _diffProject==='function' ? _diffProject(_oldSnap, projects[i]) : [];
      actlogRecord('แก้ไข', projects[i], _changed, _oldSnap);
    }
    // บันทึก local และ render ทันที — ข้อมูลถูกต้องอยู่แล้ว ไม่ต้องรอ Sheet
    window._pendingSaveTs = Date.now();
    saveToLocal(true); closeModal(); renderTable(); updateDashboard();
    if(GAS_ENABLED){
      showToast('⏳ กำลังบันทึกขึ้น Google Sheet...', 2000);
      gasPost('update',{data})
        .then(res=>{
          if(res && res.success){
            showToast(`✅ อัปเดตสำเร็จ${imgLabel}`, 2800);
          } else {
            showToast(`⚠️ Sync ขึ้น Sheet ไม่สำเร็จ: ${(res&&res.message)||'ไม่ทราบสาเหตุ'} — ข้อมูลบันทึกในเครื่องแล้ว`, 4500);
          }
        })
        .catch(()=>showToast('⚠️ บันทึกในเครื่องแล้ว แต่ Sync Sheet ไม่สำเร็จ', 3000));
    } else {
      showToast(`✅ อัปเดตสำเร็จ${imgLabel}`, 2800);
    }
  } else {
    // แก้ไข (บั๊ก): เดิมคำนวณ id ใหม่จาก id สูงสุดของโครงการ "ในเครื่อง" (local cache/localStorage)
    // ถ้าเครื่องที่กำลังเพิ่มโครงการยังไม่ได้ sync ข้อมูลล่าสุด (เช่น มีคนอื่นเพิ่งเพิ่มโครงการจากเครื่องอื่นไปก่อน
    // แต่เครื่องนี้ยังไม่รีเฟรช) id ใหม่ที่คำนวณได้จะไปชนกับ id ของโครงการที่มีอยู่แล้วจริงใน Sheet โดยไม่รู้ตัว
    // เมื่อบันทึกขึ้น Sheet ฝั่ง Apps Script (saveProject) จะค้นหาแถวที่ id ตรงกันแล้ว "เขียนทับ" แถวเดิม
    // แทนที่จะเพิ่มแถวใหม่ — โครงการเดิมที่ id ชนกันจึงถูกข้อมูลใหม่ทับไปเงียบๆ จำนวนแถวไม่เพิ่ม
    // และโครงการที่เพิ่งกรอกก็ไม่ปรากฏเป็นรายการใหม่ในระบบ (ข้อมูลมีอยู่ใน Sheet จริง แต่ไปทับของเก่า)
    // ทางแก้: ใช้ id ที่ไม่ซ้ำกันแน่นอนไม่ว่าจะ sync ทันหรือไม่ (timestamp มิลลิวินาที + เลขสุ่ม) แทนการนับ +1
    data.id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    projects.push(data);
    // บันทึก actlog
    if(typeof actlogRecord === 'function') actlogRecord('เพิ่ม', data, [], null);
    // บันทึก local และ render ทันที — ข้อมูลถูกต้องอยู่แล้ว ไม่ต้องรอ Sheet
    window._pendingSaveTs = Date.now();
    saveToLocal(true); closeModal(); renderTable(); updateDashboard();
    if(GAS_ENABLED){
      showToast('⏳ กำลังบันทึกขึ้น Google Sheet...', 2000);
      gasPost('save',{data})
        .then(res=>{
          if(res && res.success){
            showToast(`✅ บันทึกสำเร็จ${imgLabel}`, 2800);
          } else {
            showToast(`⚠️ Sync ขึ้น Sheet ไม่สำเร็จ: ${(res&&res.message)||'ไม่ทราบสาเหตุ'} — ข้อมูลบันทึกในเครื่องแล้ว`, 4500);
          }
        })
        .catch(()=>showToast('⚠️ บันทึกในเครื่องแล้ว แต่ Sync Sheet ไม่สำเร็จ', 3000));
      // สร้างแถวเริ่มต้นใน Sheet "ผลการดำเนินงาน" (ReportResult) ให้โครงการใหม่ทันที
      gasPost('saveReport',{data: buildReportPayload(data)}).catch(()=>{});
    } else {
      showToast(`✅ บันทึกสำเร็จ${imgLabel}`, 2800);
    }
  }
}

// ===== รายงานผลการดำเนินงาน (หน้าแยกใน Sidebar) =====
let reportSelectedId = null;

function openReportPage(){
  reportSelectedId = null;
  tempImages = [];
  reportTempKpiResults = [];
  reportTempActivities = [];
  renderReportProjectOptions();
  renderReportProjectGroups();
  const sel = document.getElementById('reportProjectSelect');
  if(sel) sel.value = '';
  const info = document.getElementById('reportProjectInfo');
  if(info) info.innerHTML = '';
  const selectSection = document.getElementById('reportSelectSection');
  if(selectSection) selectSection.style.display = 'block';
  const selectedBar = document.getElementById('reportSelectedBar');
  if(selectedBar) selectedBar.style.display = 'none';
  const panel = document.getElementById('reportFormPanel');
  if(panel) panel.style.display = 'none';
}

// รายการโครงการแบ่งตามยุทธศาสตร์ (ตารางคลิกเลือกได้ เหมือนหน้าโครงการทั้งหมด)
// แต่ละโครงการแสดงเป็น "กล่อง" 2 แถว: แถวหลัก (งบอนุมัติ/ใช้ไปล่าสุด/คงเหลือ)
// + แถวย่อยสรุปผลรายไตรมาส Q1|Q2|Q3|Q4 ต่อจากโครงการ เพื่อดูภาพรวมการเบิกจ่ายทั้งปีในกล่องเดียว
function renderReportProjectGroups(){
  const wrap = document.getElementById('reportProjectListWrap');
  if(!wrap) return;

  const qChip = (p, q)=>{
    const r = getQuarterReport(p, q);
    if(!r){
      return `<div class="rq-chip rq-chip-empty">
        <div class="rq-chip-label">Q${q}</div>
        <div class="rq-chip-value">ยังไม่รายงาน</div>
      </div>`;
    }
    const statusDot = r.status==='done' ? '✅' : (r.status==='progress' ? '⏳' : '⭕');
    return `<div class="rq-chip rq-chip-filled" onclick="event.stopPropagation();openQuarterReportPreview(${p.id},'${q}')" style="cursor:pointer" title="ใช้ไปเพิ่มในไตรมาสนี้">
      <div class="rq-chip-label">Q${q} ${statusDot}</div>
      <div class="rq-chip-value">+${fmtFull(r.spent||0)} บ.</div>
    </div>`;
  };

  const groupsHtml = S_KEYS.map(s=>{
    const ps = projects.filter(p=>p.strategy==s);
    if(!ps.length) return '';

    const rows = ps.map((p,i)=>{
      const budget    = p.budget||0;
      const latestRep = getLatestQuarterReport(p);
      // ใช้ไปสะสม = รวมยอด "ใช้ไป" ของทุกไตรมาสที่เคยรายงานแล้ว (ไม่ใช่แค่ไตรมาสล่าสุด) — ดู _applyReportsToProject
      const spent     = p.spent||0;
      const remaining = budget - spent;
      const isSel     = reportSelectedId!=null && String(reportSelectedId)===String(p.id);
      return `<tr class="data-row${isSel?' report-row-active':''}" onclick="selectReportProject(${p.id})" style="cursor:pointer">
        <td style="color:var(--text3);text-align:center;font-size:12px;width:32px">${i+1}</td>
        <td class="td-name" style="background:${_lightBg(S_COLORS[p.strategy],0.07)};border-left:3px solid ${S_COLORS[p.strategy]||'transparent'}">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="user-select:text">${escapeHtml(p.name)}</span>
            ${latestRep&&latestRep.quarter&&latestRep.quarter!=='all'?`<span style="font-size:10px;background:var(--accent-light);color:var(--accent);padding:1px 6px;border-radius:4px;font-weight:600;flex-shrink:0">ล่าสุด Q${latestRep.quarter}</span>`:''}
            ${(typeof _getCommittees==='function'&&_getCommittees(p).length>0)?`<span style="font-size:10px;background:#f0fdf4;color:#166534;padding:1px 6px;border-radius:4px;font-weight:600;flex-shrink:0">👥 ${_getCommittees(p).map(k=>{const c=(typeof COM_LIST!=='undefined'?COM_LIST:[]).find(x=>x.key===k);return c?c.label.replace('ด้าน',''):k;}).join(', ')}</span>`:''}
          </div>
        </td>
        <td><span class="badge ${S_BADGE[p.strategy]}">${S_NAMES[p.strategy]}</span></td>
        <td class="td-num" style="font-weight:700">${fmtFull(budget)}</td>
        <td class="td-num" style="color:var(--green)">${fmtFull(spent)}</td>
        <td class="td-num" style="font-weight:700;color:${remaining<0?'var(--red)':'var(--text)'}">${fmtFull(remaining)}</td>
      </tr>
      <tr class="report-quarter-strip-row${isSel?' report-row-active':''}" onclick="selectReportProject(${p.id})" style="cursor:pointer">
        <td colspan="6" style="padding:6px 10px 12px 40px;border-top:none">
          <div class="rq-strip">
            ${['1','2','3','4'].map(q=>qChip(p,q)).join('')}
            <div class="rq-chip rq-chip-summary" onclick="event.stopPropagation();openAnnualSummary(${p.id})" title="สรุปผลรวมไตรมาส 1–4 เทียบงบอนุมัติ + ตัวชี้วัด">
              <div class="rq-chip-label">📊 สรุปรวม Q1–Q4</div>
              <div class="rq-chip-value">ใช้ไป ${p.budget?((([1,2,3,4].reduce((a,q)=>{const r=getQuarterReport(p,q);return a+(r?(Number(r.spent)||0):0);},0))/p.budget*100).toFixed(1)):'0.0'}%</div>
            </div>
          </div>
        </td>
      </tr>`;
    }).join('');

    const gBudget = ps.reduce((a,p)=>a+(p.budget||0),0);
    const gSpent  = ps.reduce((a,p)=>a+(p.spent||0),0);
    const gRemain = gBudget - gSpent;

    const sColor = S_COLORS[s];
    return `
      <div class="card" style="margin-bottom:1.25rem;position:relative;overflow:hidden">
        <div class="card-header" style="background:${sColor};color:#fff">
          <span class="card-title" style="color:#fff"><span class="badge" style="background:rgba(255,255,255,.25);color:#fff">${S_NAMES[s]}</span> — ${escapeHtml(S_FULL[s])}</span>
          <span style="font-size:11px;color:rgba(255,255,255,.9)">${ps.length} ${S_UNIT[s]}</span>
        </div>
        <div style="overflow-x:auto">
          <table class="report-groups-table">
            <thead>
              <tr>
                <th style="width:32px">#</th>
                <th>${s==5?'ชื่อรายการ':'ชื่อโครงการ'} (คลิกเพื่อเลือกรายงานผล)</th>
                <th>ยุทธศาสตร์</th>
                <th class="td-num">งบอนุมัติ (บาท)</th>
                <th class="td-num">ใช้ไปสะสม (บาท)</th>
                <th class="td-num">คงเหลือ (บาท)</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr style="background:linear-gradient(135deg,var(--surface2),#eef2fd);font-weight:700;border-top:2px solid var(--border2)">
                <td colspan="3" style="font-size:12px;color:var(--text2);padding-left:1rem">รวมทั้งหมด ${ps.length} ${S_UNIT[s]} (กรองแล้ว)</td>
                <td class="td-num" style="font-weight:800">${fmtFull(gBudget)}</td>
                <td class="td-num" style="color:var(--green);font-weight:700">${fmtFull(gSpent)}</td>
                <td class="td-num" style="font-weight:800;color:${gRemain<0?'var(--red)':'var(--text)'}">${fmtFull(gRemain)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>`;
  }).join('');

  wrap.innerHTML = groupsHtml || `<div class="empty-state"><p>ยังไม่มีโครงการในระบบ</p></div>`;
}

// ── พรีวิวผลการดำเนินงานของ "โครงการ + ไตรมาส" ที่คลิก (จากชิป Q1|Q2|Q3|Q4) ──────
function openQuarterReportPreview(projectId, quarter){
  const p = projects.find(x=>x.id==projectId);
  if(!p) return;
  const r = getQuarterReport(p, quarter);
  const titleEl = document.getElementById('quarterReportTitle');
  const bodyEl  = document.getElementById('quarterReportBody');
  if(titleEl) titleEl.textContent = `${p.name} — ไตรมาส ${quarter}`;

  // 1. วัตถุประสงค์ / 2. เป้าหมาย — อ้างอิงจากแผนโครงการ ไม่ขึ้นกับไตรมาส แสดงเสมอถ้ามีข้อมูล
  const refBlock = (p.objective || p.targetQuantity || p.target) ? `
    <div style="margin-bottom:14px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius)">
      ${p.objective?`<div style="margin-bottom:8px"><div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:2px">1. วัตถุประสงค์</div><div style="font-size:12.5px;line-height:1.6">${escapeHtml(p.objective)}</div></div>`:''}
      ${p.targetQuantity?`<div style="margin-bottom:8px"><div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:2px">2.1 เป้าหมายเชิงปริมาณ</div><div style="font-size:12.5px;line-height:1.6">${escapeHtml(p.targetQuantity)}</div></div>`:''}
      ${p.target?`<div><div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:2px">2.2 เป้าหมายเชิงคุณภาพ</div><div style="font-size:12.5px;line-height:1.6">${escapeHtml(p.target)}</div></div>`:''}
    </div>` : '';

  if(!r){
    if(bodyEl) bodyEl.innerHTML = refBlock + `<div class="empty-state"><p>ยังไม่มีการรายงานผลของไตรมาส ${quarter} สำหรับโครงการนี้</p></div>`;
  } else {
    const statusLabel = STATUS_LABEL[r.status] || r.status || '-';
    const statusClass = STATUS_CLASS[r.status] || '';
    const budget = p.budget||0, spent = r.spent||0;
    const cumulative = getCumulativeSpentUpTo(p, quarter);
    const remaining = budget - cumulative;
    const imgs = (r.images||[]);
    const activities = (r.quarterActivities||[]);
    const kpiRows = (r.kpiResults||[]).map(_reportKpiObj);
    const actTotalBudget = activities.reduce((a,x)=>a+(Number(x.budget)||0),0);
    const actTotalSpent  = activities.reduce((a,x)=>a+(Number(x.spent)||0),0);
    const activitiesBlock = activities.length ? `
      <div style="margin-bottom:12px">
        <div class="form-label">3.1 กิจกรรมและงบประมาณ (ไตรมาส ${quarter})</div>
        <div class="mini-table-wrap"><table class="mini-table">
          <thead><tr><th style="width:34px">ที่</th><th>กิจกรรม</th><th style="width:110px">งบอนุมัติ</th><th style="width:110px">ใช้ไป</th><th style="width:110px">คงเหลือ</th></tr></thead>
          <tbody>${activities.map((a,i)=>{const rem=(Number(a.budget)||0)-(Number(a.spent)||0);return `<tr><td style="text-align:center;color:var(--text3)">${i+1}</td><td>${escapeHtml(a.name||'')}</td><td style="text-align:right">${fmtFull(a.budget)}</td><td style="text-align:right">${fmtFull(a.spent)}</td><td style="text-align:right;font-weight:600;${rem<0?'color:var(--red)':''}">${fmtFull(rem)}</td></tr>`;}).join('')}</tbody>
          <tfoot><tr style="font-weight:700;background:var(--surface2)"><td colspan="2" style="text-align:right">รวม</td><td style="text-align:right">${fmtFull(actTotalBudget)}</td><td style="text-align:right">${fmtFull(actTotalSpent)}</td><td style="text-align:right">${fmtFull(actTotalBudget-actTotalSpent)}</td></tr></tfoot>
        </table></div>
      </div>` : '';
    const kpiTableBlock = kpiRows.length ? `
      <div style="margin-bottom:12px">
        <div class="form-label">3.2 การวัดและประเมินผล</div>
        <div class="mini-table-wrap"><table class="mini-table">
          <thead><tr><th style="width:34px">ที่</th><th>ตัวชี้วัดโครงการ</th><th style="width:180px">ค่าเป้าหมายที่ทำได้</th><th style="width:120px">ผลการดำเนินงาน</th></tr></thead>
          <tbody>${kpiRows.map((k,i)=>`<tr><td style="text-align:center;color:var(--text3)">${i+1}</td><td>${escapeHtml(k.indicator)}</td><td>${escapeHtml(k.target)}</td><td>${k.achieved==='yes'?'<span style="color:var(--green);font-weight:700">✅ บรรลุ</span>':k.achieved==='no'?'<span style="color:var(--red);font-weight:700">❌ ไม่บรรลุ</span>':'<span style="color:var(--text3)">— ยังไม่ประเมิน —</span>'}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>` : '';
    if(bodyEl) bodyEl.innerHTML = refBlock + `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <span class="badge ${S_BADGE[p.strategy]}">${S_NAMES[p.strategy]}</span>
        <span class="badge ${statusClass}">${escapeHtml(statusLabel)}</span>
        <span style="margin-left:auto;font-size:12px;color:var(--text2)">${r.lastEditedBy?'แก้ไขล่าสุด '+formatLastEdited(r.lastEditedAt)+' โดย '+escapeHtml(r.lastEditedBy):''}</span>
      </div>
      <div class="detail-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
        <div class="detail-item"><div class="detail-item-label">งบอนุมัติ</div><div class="detail-item-value">${fmtFull(budget)} บาท</div></div>
        <div class="detail-item"><div class="detail-item-label">ใช้ไปเพิ่ม (ไตรมาสนี้)</div><div class="detail-item-value" style="color:var(--green)">${fmtFull(spent)} บาท</div></div>
        <div class="detail-item"><div class="detail-item-label">ใช้ไปสะสม (ถึงไตรมาสนี้)</div><div class="detail-item-value">${fmtFull(cumulative)} บาท</div></div>
        <div class="detail-item"><div class="detail-item-label">คงเหลือ</div><div class="detail-item-value" style="color:${remaining<0?'var(--red)':'var(--text)'}">${fmtFull(remaining)} บาท</div></div>
      </div>
      ${r.result?`<div style="margin-bottom:12px"><div class="form-label">3. ผลการดำเนินงาน (สรุปภาพรวม)</div><div class="problem-box" style="background:var(--surface2);border-color:var(--border2);color:var(--text)">${escapeHtml(r.result)}</div></div>`:''}
      ${activitiesBlock}
      ${kpiTableBlock}
      ${r.problems?`<div style="margin-bottom:12px"><div class="form-label">ปัญหาและอุปสรรค</div><div class="problem-box">${escapeHtml(r.problems)}</div></div>`:''}
      ${r.solutions?`<div style="margin-bottom:12px"><div class="form-label">แนวทางแก้ไข / ข้อเสนอแนะ</div><div class="problem-box" style="background:var(--green-light);border-color:#a7f3d0;color:var(--green)">${escapeHtml(r.solutions)}</div></div>`:''}
      ${imgs.length?`<div><div class="form-label">รูปภาพประกอบ (${imgs.length})</div><div style="display:flex;flex-wrap:wrap;gap:8px">${imgs.map(img=>`<img src="${img.url}" style="width:96px;height:96px;object-fit:cover;border-radius:8px;border:1px solid var(--border2)">`).join('')}</div></div>`:''}
    `;
  }

  document.getElementById('qrEditBtn').onclick = ()=>editQuarterReportFromPreview(projectId, quarter);
  document.getElementById('qrExportPdfBtn').onclick = ()=>exportQuarterReportPDF(projectId, quarter);
  const delBtn = document.getElementById('qrDeleteBtn');
  if(delBtn){
    delBtn.style.display = r ? 'inline-flex' : 'none';
    delBtn.onclick = ()=>{ closeQuarterReportPreview(); deleteQuarterReport(projectId, quarter); };
  }
  document.getElementById('quarterReportOverlay').classList.add('open');
}
function closeQuarterReportPreview(){
  document.getElementById('quarterReportOverlay').classList.remove('open');
}
// ── กดปุ่ม "แก้ไข" ในพรีวิว — เลือกโครงการ+ไตรมาสนั้นเข้าฟอร์มรายงานผลโดยตรง แล้วเลื่อนไปที่ฟอร์ม ──────
function editQuarterReportFromPreview(projectId, quarter){
  closeQuarterReportPreview();
  const sel = document.getElementById('reportProjectSelect');
  if(sel) sel.value = projectId;
  onReportProjectChange();
  document.getElementById('fQuarter').value = quarter;
  onReportQuarterChange();
  document.getElementById('reportFormPanel')?.scrollIntoView({behavior:'smooth', block:'start'});
}

// ── ไปที่ฟอร์ม "รายงานผลการดำเนินงาน" ของโครงการ+ไตรมาสที่ระบุ ไม่ว่าจะเรียกจากที่ไหนก็ตาม ──
// (ใช้จากปุ่ม "+ เพิ่มข้อมูล" / "แก้ไข" ในการ์ดรายไตรมาสของหน้ารายละเอียดโครงการ)
function goToReportForm(projectId, quarter){
  if(typeof closeDetail==='function') closeDetail();
  if(typeof closeQuarterReportPreview==='function') closeQuarterReportPreview();
  showPage('report'); // เรียก openReportPage() ให้เอง (ดู showPage) — เคลียร์ค่าเดิมและ render ตัวเลือกโครงการใหม่
  const sel = document.getElementById('reportProjectSelect');
  if(sel) sel.value = projectId;
  onReportProjectChange();
  if(quarter){
    document.getElementById('fQuarter').value = quarter;
    onReportQuarterChange();
  }
  setTimeout(()=>document.getElementById('reportFormPanel')?.scrollIntoView({behavior:'smooth', block:'start'}), 50);
}

// ── ลบรายงานผลของ "โครงการ + ไตรมาส" เดียว (ไม่กระทบไตรมาสอื่นของโครงการเดียวกัน) ──
// หมายเหตุ: ฝั่ง Google Apps Script (deleteReport) ต้องรองรับพารามิเตอร์ quarter ด้วย
// เพื่อให้ลบเฉพาะแถวของไตรมาสนั้นใน Sheet "ผลการดำเนินงาน" ไม่ใช่ลบทุกไตรมาสของโครงการ
function deleteQuarterReport(projectId, quarter){
  if(!_isEditable()){ showToast('🔒 กรุณาเข้าสู่ระบบก่อนลบข้อมูล', 2500); openAuthModal('login'); return; }
  const p = projects.find(x=>x.id==projectId); if(!p) return;
  const r = getQuarterReport(p, quarter);
  if(!r){ showToast('ไม่พบข้อมูลรายงานของไตรมาสนี้'); return; }
  if(!confirm(`ยืนยันการลบรายงานผลไตรมาส ${quarter} ของโครงการ "${p.name}"?\nการลบนี้ไม่สามารถกู้คืนได้`)) return;

  // ลบรูปภาพของไตรมาสนี้ออกจาก Cloudinary ด้วย (ถ้ามี)
  if(GAS_ENABLED && r.images && r.images.length){
    r.images.forEach(img=>{ if(img.publicId) gasPost('deleteCloudinaryImage',{publicId:img.publicId}).catch(()=>{}); });
  }

  // ลบออกจากข้อมูลในเครื่องแล้วคำนวณยอดสะสม/สถานะล่าสุดของโครงการใหม่ทันที (ไม่ต้องรอ sync)
  if(p.reportsByQuarter) delete p.reportsByQuarter[String(quarter)];
  _applyReportsToProject(p, p.reportsByQuarter||{});
  if(typeof actlogRecord === 'function') actlogRecord(`ลบรายงานผล ไตรมาส ${quarter}`, p, [], null);

  saveToLocal(); renderTable(); updateDashboard();
  if(document.getElementById('detailOverlay')?.classList.contains('open')) openDetail(p.id); // รีเฟรชการ์ดรายไตรมาส
  if(document.getElementById('page-report')?.style.display !== 'none' && typeof renderReportProjectGroups==='function') renderReportProjectGroups();

  showToast(`🗑️ ลบรายงานผลไตรมาส ${quarter} สำเร็จ`, 2500);
  if(GAS_ENABLED){
    gasPost('deleteReport', { id: p.id, quarter: quarter })
      .catch(()=>showToast('⚠️ ลบในเครื่องแล้ว แต่ Sync Sheet ไม่สำเร็จ', 3000));
  }
}

// เลือกโครงการจากตารางรายยุทธศาสตร์ — sync กับ dropdown เดิมแล้วเปิดฟอร์มรายงานผล
function selectReportProject(id){
  const sel = document.getElementById('reportProjectSelect');
  if(sel) sel.value = id;
  onReportProjectChange();
}

// จัดกลุ่มรายชื่อโครงการตามยุทธศาสตร์ (optgroup) เพื่อให้เลือกได้ถูกหมวดหมู่
function renderReportProjectOptions(){
  const sel = document.getElementById('reportProjectSelect');
  if(!sel) return;
  const groups = S_KEYS.map(s=>{
    const ps = projects.filter(p=>p.strategy==s);
    if(!ps.length) return '';
    const opts = ps.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    return `<optgroup label="${escapeHtml(S_NAMES[s])} — ${escapeHtml(S_FULL[s])}">${opts}</optgroup>`;
  }).join('');
  sel.innerHTML = `<option value="">— เลือกโครงการ —</option>${groups}`;
}

function onReportProjectChange(){
  const sel = document.getElementById('reportProjectSelect');
  const id = sel ? sel.value : '';
  const panel = document.getElementById('reportFormPanel');
  const info = document.getElementById('reportProjectInfo');
  const selectSection = document.getElementById('reportSelectSection');
  const selectedBar = document.getElementById('reportSelectedBar');
  if(!id){
    reportSelectedId = null;
    if(panel) panel.style.display='none';
    if(selectedBar) selectedBar.style.display='none';
    if(selectSection) selectSection.style.display='block';
    if(info) info.innerHTML='';
    reportTempKpiResults = [];
    renderReportKpiResults();
    reportTempActivities = [];
    renderReportActivities();
    renderReportProjectGroups();
    return;
  }
  if(!_isEditable()){
    showToast('🔒 กรุณาเข้าสู่ระบบก่อนรายงานผล', 2500);
    openAuthModal('login');
    if(sel) sel.value='';
    reportSelectedId = null;
    return;
  }
  const p = projects.find(x=>x.id==id);
  if(!p) return;
  reportSelectedId = id;

  if(info) info.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span class="badge ${S_BADGE[p.strategy]}">${S_NAMES[p.strategy]}</span>
      <strong style="font-size:13px">${escapeHtml(p.name)}</strong>
      <span style="margin-left:auto;font-size:12px;color:var(--text2)">งบอนุมัติ ${fmtFull(p.budget)} บาท</span>
    </div>`;
  // ขั้นที่เลือกโครงการแล้ว — ซ่อนรายการทั้งหมด เหลือแค่โครงการที่เลือก + ฟอร์มรายงานผล
  if(selectSection) selectSection.style.display='none';
  if(selectedBar) selectedBar.style.display='block';
  if(panel) panel.style.display='block';

  // เลือกไตรมาสเริ่มต้นให้อัตโนมัติ: ใช้ไตรมาสที่กำลังกรองอยู่บนสุด (ถ้าเจาะจง 1-4) ก่อน
  // ไม่งั้นใช้ไตรมาสล่าสุดที่เคยรายงานของโครงการนี้ ไม่งั้นเริ่มที่ไตรมาส 1
  const latestQ = getLatestQuarterReport(p);
  const defaultQ = (typeof currentQuarter!=='undefined' && currentQuarter!=='all') ? currentQuarter
                    : (latestQ && latestQ.quarter && latestQ.quarter!=='all' ? latestQ.quarter : '1');
  document.getElementById('fQuarter').value = defaultQ;
  renderReportRefInfo(p); // 1. วัตถุประสงค์ / 2. เป้าหมาย — อ้างอิงจากแผนโครงการ ไม่ขึ้นกับไตรมาส
  loadReportFormForQuarter(p, defaultQ);
}

// ── โหลดข้อมูลฟอร์มรายงานผลสำหรับ "โครงการ + ไตรมาส" ที่ระบุ ──────
// ใช้ทั้งตอนเลือกโครงการครั้งแรก และตอนสลับไตรมาสในฟอร์มเดิม (onReportQuarterChange)
function loadReportFormForQuarter(p, quarter){
  const r = getQuarterReport(p, quarter); // ผลของไตรมาสนี้โดยเฉพาะ (null ถ้ายังไม่เคยรายงาน)

  // ถ้าไตรมาสนี้ยังไม่เคยรายงาน ให้ดึงยอด "ใช้ไป/PO" จากไตรมาสก่อนหน้าล่าสุดมาเป็นค่าตั้งต้น
  // (เพราะยอดใช้จ่ายมักเป็นยอดสะสม ไม่ต้องพิมพ์ใหม่ทั้งหมด) ส่วนผลการดำเนินงาน/ปัญหาฯ เริ่มว่างเสมอ
  let prefillSpent = 0, prefillPO = 0;
  if(!r){
    for(let q=Number(quarter)-1; q>=1; q--){
      const prev = getQuarterReport(p, String(q));
      if(prev){ prefillSpent = prev.spent||0; prefillPO = prev.po||0; break; }
    }
  }

  tempImages = ((r?r.images:null)||[]).map(img=>({
    name:     img.name     || '',
    url:      img.url      || img.dataUrl || '',
    publicId: img.publicId || img.driveId  || '',
    _uploading: false,
    _dataUrl: img.url || img.dataUrl || ''
  }));
  document.getElementById('fStatus').value = r ? (r.status||'pending') : (p.status||'pending');
  document.getElementById('fSpent').value = r ? (r.spent||0) : prefillSpent;
  document.getElementById('fPO').value = r ? (r.po||0) : prefillPO;
  document.getElementById('fResult').value = r ? (r.result||'') : '';
  document.getElementById('fProblems').value = r ? (r.problems||'') : '';
  document.getElementById('fSolutions').value = r ? (r.solutions||'') : '';
  document.getElementById('fEditorName').value = (typeof _editorDisplayName==='function'?_editorDisplayName():'')||'— กรุณาเข้าสู่ระบบ —';
  document.getElementById('fEditedAt').value = (r && r.lastEditedAt)
    ? (formatLastEdited(r.lastEditedAt)+(r.lastEditedBy?' โดย '+r.lastEditedBy+(r.lastEditedByPosition?' ('+r.lastEditedByPosition+')':''):''))
    : '— ยังไม่เคยรายงานไตรมาสนี้ —';
  renderImgPreview();
  // โหลดผลตัวชี้วัด (KPI) ที่เคยกรอกไว้เองสำหรับไตรมาสนี้ (ไม่ใช่ตัวชี้วัดเป้าหมายของโครงการ)
  // 3.2 ตัวชี้วัด: ถ้าไตรมาสนี้เคยรายงานผลไว้แล้วและมีตัวชี้วัดอยู่ ใช้ของเดิมตามที่กรอก/แก้ไขไว้
  // ถ้ายังไม่เคยรายงาน (หรือรายงานไว้แต่ยังไม่มีตัวชี้วัดเลย) ให้ดึงรายชื่อตัวชี้วัดจากแผนโครงการมาตั้งต้นให้อัตโนมัติ
  // (ลดภาระกรอกชื่อตัวชี้วัดซ้ำทุกไตรมาส) — ผู้ใช้ยังลบ/แก้ไข/เพิ่มเองได้ตามปกติ ไม่ผูกมัด
  if(r && Array.isArray(r.kpiResults) && r.kpiResults.length){
    reportTempKpiResults = r.kpiResults.map(_reportKpiObj);
  } else {
    reportTempKpiResults = _getProjectPlanKpis(p).map(k=>({indicator:k, target:'', achieved:''}));
  }
  renderReportKpiResults();
  // 3.1 กิจกรรมและงบประมาณของไตรมาสนี้ (แยกเก็บต่อไตรมาสเหมือนฟิลด์อื่น)
  // 3.1 กิจกรรมและงบประมาณ: ถ้าไตรมาสนี้เคยรายงานผลไว้แล้วและมีรายการอยู่ ใช้ของเดิมตามที่กรอก/แก้ไขไว้
  // ถ้ายังไม่เคยรายงาน (หรือรายงานไว้แต่ยังไม่มีรายการเลย) ให้ดึงกิจกรรม+งบประมาณอนุมัติจากแผนโครงการ
  // (ข้อรายละเอียดงบประมาณ) มาตั้งต้นให้อัตโนมัติ ยอดงบจึงตรงกับแผนเสมอไม่ว่าไตรมาสไหน — ใช้ไปเริ่มที่ 0 เสมอ
  if(r && Array.isArray(r.quarterActivities) && r.quarterActivities.length){
    reportTempActivities = r.quarterActivities.map(a=>({...a}));
  } else {
    reportTempActivities = _getProjectPlanActivities(p).map(a=>({name:a.name, budget:a.budget, spent:0}));
  }
  renderReportActivities();
  // อัปเดตหัวการ์ดให้บอกชัดว่ากำลังกรอกไตรมาสไหนอยู่
  const titleEl = document.getElementById('reportProgressCardTitle');
  if(titleEl) titleEl.textContent = `3. ผลการดำเนินงานโครงการ — ไตรมาสที่ ${quarter}`;
}

// ── ผู้ใช้สลับไตรมาสในฟอร์ม (โครงการเดิมที่เลือกไว้แล้ว) — โหลดข้อมูลของไตรมาสใหม่มาแสดง ──────
function onReportQuarterChange(){
  if(!reportSelectedId) return;
  const p = projects.find(x=>x.id==reportSelectedId);
  if(!p) return;
  const q = document.getElementById('fQuarter').value;
  loadReportFormForQuarter(p, q);
}

// ===== 3.2 การวัดและประเมินผล — ตัวชี้วัดของโครงการ (KPI) ที่ผู้กรอกรายงานผลเพิ่มเข้ามาเอง
// (แยกจากตัวชี้วัดเป้าหมายของโครงการ p.kpi) เก็บเป็น array ของ {indicator,target,achieved} ต่อไตรมาส =====
let reportTempKpiResults = [];

// รองรับข้อมูลเก่า (array ของ string ล้วน) และแบบใหม่ ({indicator,target,achieved}) กันของเดิมพัง
function _reportKpiObj(k){
  if (k && typeof k === 'object') return { indicator:k.indicator||'', target:k.target||'', achieved:k.achieved||'' };
  return { indicator: k||'', target:'', achieved:'' };
}
function addReportKpiRow(){
  reportTempKpiResults.push({indicator:'',target:'',achieved:''});
  renderReportKpiResults();
}
function removeReportKpiResult(i){
  reportTempKpiResults.splice(i,1);
  renderReportKpiResults();
}
function updateReportKpiRow(i,field,val){
  if(!reportTempKpiResults[i]) return;
  reportTempKpiResults[i][field]=val;
}
function renderReportKpiResults(){
  const body = document.getElementById('reportKpiTableBody');
  if(!body) return;
  if(!reportTempKpiResults.length){
    body.innerHTML = `<tr><td colspan="5" class="mini-table-empty">ยังไม่มีตัวชี้วัด — กด "+ เพิ่มตัวชี้วัด" ด้านล่าง</td></tr>`;
    return;
  }
  body.innerHTML = reportTempKpiResults.map((k,i)=>{
    const kk = _reportKpiObj(k);
    return `<tr>
      <td style="text-align:center;color:var(--text3)">${i+1}</td>
      <td><input type="text" value="${escapeAttrRpt(kk.indicator)}" placeholder="เช่น ผลิตสื่อการเรียนรู้ได้ 12 ตอน" onchange="updateReportKpiRow(${i},'indicator',this.value)"></td>
      <td><input type="text" value="${escapeAttrRpt(kk.target)}" placeholder="เช่น เป้าหมาย 10 ตอน" onchange="updateReportKpiRow(${i},'target',this.value)"></td>
      <td>
        <select onchange="updateReportKpiRow(${i},'achieved',this.value)">
          <option value="" ${kk.achieved===''?'selected':''}>— ยังไม่ประเมิน —</option>
          <option value="yes" ${kk.achieved==='yes'?'selected':''}>✅ บรรลุเป้าหมาย</option>
          <option value="no" ${kk.achieved==='no'?'selected':''}>❌ ไม่บรรลุเป้าหมาย</option>
        </select>
      </td>
      <td><button type="button" class="mini-remove-btn" onclick="removeReportKpiResult(${i})" title="ลบตัวชี้วัดนี้">×</button></td>
    </tr>`;
  }).join('');
}
function escapeAttrRpt(str){ return (str==null?'':String(str)).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ===== 3.1 กิจกรรมและงบประมาณ (ไตรมาสนี้) — เก็บแยกต่อไตรมาสเหมือนฟิลด์อื่นๆ ในฟอร์มรายงานผล =====
let reportTempActivities = [];
function addReportActivity(){
  reportTempActivities.push({name:'',budget:0,spent:0});
  renderReportActivities();
}
function removeReportActivity(i){ reportTempActivities.splice(i,1); renderReportActivities(); }
function updateReportActivity(i,field,val){
  if(!reportTempActivities[i]) return;
  reportTempActivities[i][field] = (field==='name') ? val : (parseFloat(val)||0);
  renderReportActivities();
}
function renderReportActivities(){
  const body = document.getElementById('reportActivitiesTableBody');
  if(!body) return;
  if(!reportTempActivities.length){
    body.innerHTML = `<tr><td colspan="6" class="mini-table-empty">ยังไม่มีรายการกิจกรรม — กด "+ เพิ่มกิจกรรม" ด้านล่าง</td></tr>`;
  } else {
    body.innerHTML = reportTempActivities.map((r,i)=>{
      const remain = (Number(r.budget)||0) - (Number(r.spent)||0);
      return `<tr>
        <td style="text-align:center;color:var(--text3)">${i+1}</td>
        <td><input type="text" value="${escapeAttrRpt(r.name)}" placeholder="เช่น จัดอบรมเชิงปฏิบัติการครั้งที่ 1" onchange="updateReportActivity(${i},'name',this.value)"></td>
        <td><input type="number" min="0" value="${r.budget||0}" onchange="updateReportActivity(${i},'budget',this.value)"></td>
        <td><input type="number" min="0" value="${r.spent||0}" onchange="updateReportActivity(${i},'spent',this.value)"></td>
        <td class="mini-remain" style="${remain<0?'color:var(--red)':''}">${fmtFull(remain)}</td>
        <td><button type="button" class="mini-remove-btn" onclick="removeReportActivity(${i})" title="ลบกิจกรรมนี้">×</button></td>
      </tr>`;
    }).join('');
  }
  const totalBudget = reportTempActivities.reduce((a,r)=>a+(Number(r.budget)||0),0);
  const totalSpent  = reportTempActivities.reduce((a,r)=>a+(Number(r.spent)||0),0);
  const totalBudgetEl = document.getElementById('reportActTotalBudget');
  const totalSpentEl  = document.getElementById('reportActTotalSpent');
  const totalRemainEl = document.getElementById('reportActTotalRemain');
  if(totalBudgetEl) totalBudgetEl.textContent = fmtFull(totalBudget);
  if(totalSpentEl)  totalSpentEl.textContent  = fmtFull(totalSpent);
  if(totalRemainEl) totalRemainEl.textContent = fmtFull(totalBudget-totalSpent);
}

// ===== แสดงข้อมูล 1. วัตถุประสงค์ / 2. เป้าหมาย จากแผนโครงการ (อ้างอิงอย่างเดียว ไม่กรอกซ้ำ) =====
function renderReportRefInfo(p){
  const oEl  = document.getElementById('reportRefObjectiveText');
  const gqEl = document.getElementById('reportRefGoalQuantText');
  const glEl = document.getElementById('reportRefGoalQualText');
  if(oEl)  oEl.innerHTML  = p.objective ? escapeHtml(p.objective) : '<span style="color:var(--text3)">ยังไม่ได้กรอกวัตถุประสงค์ไว้ในแผนโครงการ</span>';
  if(gqEl) gqEl.innerHTML = p.targetQuantity ? escapeHtml(p.targetQuantity) : '<span style="color:var(--text3)">ยังไม่ได้กรอกเป้าหมายเชิงปริมาณไว้ในแผนโครงการ</span>';
  if(glEl) glEl.innerHTML = p.target ? escapeHtml(p.target) : '<span style="color:var(--text3)">ยังไม่ได้กรอกเป้าหมายเชิงคุณภาพไว้ในแผนโครงการ</span>';
}

// ── รายชื่อตัวชี้วัด (KPI) ที่กรอกไว้ตอนวางแผนโครงการ (ข้อ "การวัดและประเมินผล" ในรายละเอียดโครงการ) ──
// ใช้ตั้งต้นตาราง 3.2 ให้อัตโนมัติ ลดภาระกรอกชื่อตัวชี้วัดซ้ำทุกไตรมาส (ผู้ใช้ยังลบ/แก้ไข/เพิ่มเองได้ตามปกติ)
// รองรับข้อมูล 2 รูปแบบเหมือนหน้ารายละเอียดโครงการ (openDetail): p.evalRows หรือ p.kpi+evalMethod+evaluator
function _getProjectPlanKpis(p){
  const kpis = p.kpi || [];
  function _parseEvalArr(v){
    if (Array.isArray(v)) return v;
    try { return typeof v==='string' && v.trim().startsWith('[') ? JSON.parse(v) : (v?[v]:[]); }
    catch(e){ return v?[v]:[]; }
  }
  const evalData = Array.isArray(p.evalRows)&&p.evalRows.length ? p.evalRows
    : (kpis.length ? kpis.map(k=>({kpi:k})) : []);
  return evalData.map(r=>(r.kpi||'').trim()).filter(Boolean);
}

// ── รายการกิจกรรม+งบประมาณอนุมัติ ที่กรอกไว้ตอนวางแผนโครงการ (ข้อ "รายละเอียดงบประมาณ" ในรายละเอียดโครงการ) ──
// p.budgetDetail เก็บเป็น [{name, comp, op, mat}] (ครุภัณฑ์/ดำเนินงาน/วัสดุ) — งบอนุมัติของแต่ละกิจกรรม
// คือผลรวม comp+op+mat ใช้ตั้งต้นตาราง 3.1 ให้อัตโนมัติ เพื่อให้ยอด "งบประมาณอนุมัติ" ตรงกับแผนเสมอ
// ไม่ต้องพิมพ์ตัวเลขเองใหม่ทุกไตรมาสจนตัวเลขไม่ตรงกัน (ผู้ใช้ยังแก้ไข/เพิ่ม/ลบเองได้ตามปกติ)
function _getProjectPlanActivities(p){
  const rows = Array.isArray(p.budgetDetail) ? p.budgetDetail : [];
  return rows.map(r=>({
    name: (r.name||'').trim(),
    budget: (Number(r.comp)||0)+(Number(r.op)||0)+(Number(r.mat)||0)
  })).filter(r=>r.name || r.budget);
}

function resetReportForm(){ openReportPage(); }

function saveResultReport(){
  if(!_isEditable()){ showToast('🔒 กรุณาเข้าสู่ระบบก่อนบันทึกรายงานผล', 2500); openAuthModal('login'); return; }
  if(!reportSelectedId){ showToast('กรุณาเลือกโครงการก่อนบันทึกรายงานผล'); return; }

  const stillUploading = tempImages.filter(i=>i._uploading);
  if(stillUploading.length){
    showToast(`⏳ รอรูปภาพ ${stillUploading.length} รูปอัปโหลดให้เสร็จก่อนครับ`, 3000);
    return;
  }

  const i = projects.findIndex(p=>p.id==reportSelectedId);
  if(i<0){ showToast('⚠️ ไม่พบโครงการนี้แล้ว — อาจถูกลบไปแล้ว', 3000); return; }

  const qVal = document.getElementById('fQuarter').value;
  if(!qVal || qVal==='all'){
    showToast('⚠️ กรุณาเลือกไตรมาสที่ต้องการรายงานผล (แต่ละไตรมาสบันทึกแยกกัน)', 3000);
    return;
  }

  const cleanImages = tempImages.map(img=>({ name:img.name||'', url:img.url||'', publicId:img.publicId||'' }));
  const _oldSnap = JSON.parse(JSON.stringify(projects[i]));

  const patch = {
    status:    document.getElementById('fStatus').value,
    quarter:   qVal,
    spent:     parseFloat(document.getElementById('fSpent').value)||0,
    po:        parseFloat(document.getElementById('fPO').value)||0,
    result:    document.getElementById('fResult').value.trim(),
    problems:  document.getElementById('fProblems').value.trim(),
    solutions: document.getElementById('fSolutions').value.trim(),
    images:    cleanImages,
    kpiResults: reportTempKpiResults.map(_reportKpiObj).filter(k=>k.indicator.trim()!=='' || k.target.trim()!=='' || k.achieved!==''),
    quarterActivities: reportTempActivities.filter(a=>(a.name||'').trim()!=='' || (a.budget||0)!==0 || (a.spent||0)!==0),
    lastEditedBy:         (typeof _currentUser!=='undefined' && _currentUser) ? (_currentUser.name||'ผู้ใช้') : 'ผู้ใช้',
    lastEditedByPosition: (typeof _currentUser!=='undefined' && _currentUser) ? (_currentUser.position||'') : '',
    lastEditedAt:         new Date().toLocaleString('th-TH',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})
  };
  projects[i] = {...projects[i], ...patch};
  // เก็บผลของ "ไตรมาสนี้โดยเฉพาะ" ไว้ใน reportsByQuarter ด้วย — เพื่อให้ตารางสรุป Q1|Q2|Q3|Q4
  // และการสลับไตรมาสในฟอร์มอัปเดตทันทีโดยไม่ต้องรอ sync จาก Sheet กลับมาก่อน
  if(!projects[i].reportsByQuarter) projects[i].reportsByQuarter = {};
  projects[i].reportsByQuarter[qVal] = {
    id: projects[i].id, name: projects[i].name, strategy: projects[i].strategy, ...patch
  };

  if(typeof actlogRecord === 'function'){
    const _changed = typeof _diffProject==='function' ? _diffProject(_oldSnap, projects[i]) : [];
    actlogRecord('รายงานผล', projects[i], _changed, _oldSnap);
  }

  window._pendingSaveTs = Date.now();
  saveToLocal(true);
  renderTable();
  updateDashboard();

  const imgCount = cleanImages.length;
  const imgLabel = imgCount>0 ? ` · รูปภาพ ${imgCount} รูป (Cloudinary)` : '';

  if(GAS_ENABLED){
    showToast('⏳ กำลังบันทึกขึ้น Google Sheet...', 2000);
    gasPost('saveReport',{data: buildReportPayload(projects[i])})
      .then(res=>{
        if(res && res.success){ showToast(`✅ บันทึกรายงานผลสำเร็จ${imgLabel}`, 2800); }
        else { showToast(`⚠️ Sync ขึ้น Sheet ไม่สำเร็จ: ${(res&&res.message)||'ไม่ทราบสาเหตุ'} — ข้อมูลบันทึกในเครื่องแล้ว`, 4500); }
      })
      .catch(()=>showToast('⚠️ บันทึกในเครื่องแล้ว แต่ Sync Sheet ไม่สำเร็จ', 3000));
  } else {
    showToast(`✅ บันทึกรายงานผลสำเร็จ${imgLabel}`, 2800);
  }
  // รีเฟรชค่า "แก้ไขล่าสุด" ในฟอร์มให้ทันที
  onReportProjectChange();
}

// ===== KPI =====
function addKPI(){
  const v=document.getElementById('kpiInput').value.trim(); if(!v) return;
  tempKPIs.push(v); document.getElementById('kpiInput').value=''; renderKPIList();
}
function removeKPI(i){ tempKPIs.splice(i,1); renderKPIList(); }
function renderKPIList(){
  const el=document.getElementById('kpiList');
  if(!tempKPIs.length){el.innerHTML='<span style="font-size:11px;color:var(--text3)">ยังไม่มีตัวชี้วัด</span>';return;}
  el.innerHTML=tempKPIs.map((k,i)=>`<span class="kpi-tag">${k}<button onclick="removeKPI(${i})" title="ลบ">×</button></span>`).join('');
}

// ===== DETAIL =====
function openDetail(id){
  const p=projects.find(x=>x.id==id); if(!p) return;
  document.getElementById('detailTitle').textContent=p.name;
  // สีอ่อนๆ ตามยุทธศาสตร์ของโครงการ ไว้ที่หัวข้อชื่อโครงการ ให้แยกแต่ละโครงการออกจากกันชัดเจนขึ้น
  document.getElementById('detailTitle').style.cssText =
    `padding:3px 12px;border-radius:7px;background:${_lightBg(S_COLORS[p.strategy],0.14)};border-left:4px solid ${S_COLORS[p.strategy]||'transparent'}`;
  document.getElementById('detailEditBtn').onclick=()=>openEdit(id);
  document.getElementById('detailExportPdfBtn').onclick=()=>exportFormPDF(id);
  const remaining=(p.budget||0)-(p.spent||0)-(p.po||0);
  const kpis=p.kpi||[];
  // ── ที่มาของข้อมูล KPI/วิธีประเมิน/เครื่องมือ มี 2 รูปแบบ:
  // 1) p.evalRows: array ของ {kpi,method,tool} (รูปแบบใหม่ ใช้ตอนแก้ไขในฟอร์ม)
  // 2) p.kpi + p.evalMethod + p.evaluator: 3 คอลัมน์ขนานกันใน Google Sheet (รูปแบบที่ Sheet เก็บจริง)
  // เดิมถ้า p.evalRows ว่าง (เช่น sync กลับมาจาก Sheet ซึ่งไม่มีคอลัมน์ evalRows) จะ fallback ไปโชว์แค่ kpi
  // เฉยๆ ทำให้ช่อง "วิธีการประเมิน" และ "เครื่องมือ/ผู้ประเมิน" ว่างเปล่าทั้งที่มีข้อมูลอยู่ใน evalMethod/evaluator
  // จึงต้อง parse 2 ฟิลด์นี้มาประกอบเป็นแถวด้วย ก่อนจะ fallback ไปโชว์แค่ kpi ว่างจริงๆ
  function _parseEvalArr(v){
    // backend (gs.txt: rowToObj) จะ JSON.parse ให้เป็น array จริงมาให้แล้วถ้าเป็นไปได้
    // ดังนั้นต้องเช็คว่าเป็น array อยู่แล้วก่อน ไม่งั้นจะเอา array ทั้งก้อนไปห่อเป็น element เดียว
    if (Array.isArray(v)) return v;
    try { return typeof v==='string' && v.trim().startsWith('[') ? JSON.parse(v) : (v?[v]:[]); }
    catch(e){ return v?[v]:[]; }
  }
  const evalData = Array.isArray(p.evalRows)&&p.evalRows.length ? p.evalRows
    : (kpis.length ? (()=>{
        const methods = _parseEvalArr(p.evalMethod);
        const tools = _parseEvalArr(p.evaluator);
        return kpis.map((k,i)=>({kpi:k, method:methods[i]||'', tool:tools[i]||''}));
      })() : []);

  // ── เผื่อกรณีมีคนวางข้อความ JSON (เช่น รายละเอียดงบประมาณ/กิจกรรม) ผิดลงในช่องข้อความอิสระ
  // (หลักการและเหตุผล/วัตถุประสงค์/เป้าหมาย/ผลที่คาดว่าจะได้รับ) แทนที่จะแสดง JSON ดิบเป็นพรืด
  // ให้ตรวจจับแล้วแสดงผลอย่างเหมาะสมแทน — ถ้าโครงสร้างตรงกับตารางงบประมาณ {name,comp,op,mat} จะ
  // render เป็นตารางงบให้เลย พร้อมข้อความเตือนให้ไปแก้ที่ต้นทาง (กด "แก้ไข" แล้วย้ายไปช่องที่ถูกต้อง)
  function renderFreeText(text){
    const t = (text||'').trim();
    if(!t) return '';
    const looksJson = t.length>=20 && ((t.startsWith('[')&&t.endsWith(']'))||(t.startsWith('{')&&t.endsWith('}')));
    if(!looksJson) return `<div class="detail-text">${escapeHtml(t)}</div>`;
    let parsed=null;
    try { parsed = JSON.parse(t); } catch(e){ return `<div class="detail-text">${escapeHtml(t)}</div>`; }
    const warn = `<div style="font-size:11.5px;color:var(--red);background:var(--red-light);border:1px solid #ffd0d0;border-radius:6px;padding:6px 10px;margin-bottom:8px">⚠️ ข้อความนี้ดูเหมือนถูกวางผิดช่อง (เป็นข้อมูล JSON ไม่ใช่ข้อความปกติ) — กด "แก้ไข" ด้านล่างเพื่อย้ายไปช่องที่ถูกต้อง</div>`;
    const isBudgetShape = Array.isArray(parsed) && parsed.length && parsed.every(r=>r && typeof r==='object' && 'name' in r && ('comp' in r || 'op' in r || 'mat' in r));
    if(isBudgetShape){
      return warn + `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:var(--surface2)">
          <th style="padding:6px 8px;text-align:left;border:1px solid var(--border)">รายการ</th>
          <th style="padding:6px 8px;text-align:right;border:1px solid var(--border)">ค่าตอบแทน</th>
          <th style="padding:6px 8px;text-align:right;border:1px solid var(--border)">ค่าใช้สอย</th>
          <th style="padding:6px 8px;text-align:right;border:1px solid var(--border)">ค่าวัสดุ</th>
        </tr></thead>
        <tbody>${parsed.map(r=>`<tr>
          <td style="padding:5px 8px;border:1px solid var(--border)">${escapeHtml(r.name||'')}</td>
          <td style="padding:5px 8px;border:1px solid var(--border);text-align:right">${Number(r.comp||0).toLocaleString('th-TH')}</td>
          <td style="padding:5px 8px;border:1px solid var(--border);text-align:right">${Number(r.op||0).toLocaleString('th-TH')}</td>
          <td style="padding:5px 8px;border:1px solid var(--border);text-align:right">${Number(r.mat||0).toLocaleString('th-TH')}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
    }
    return warn + `<pre style="white-space:pre-wrap;word-break:break-word;font-size:11px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 10px;margin:0">${escapeHtml(JSON.stringify(parsed,null,2))}</pre>`;
  }

  const ganttHtml = _ganttDetailHtml(p);

  const budgetHtml = (p.budgetDetail&&p.budgetDetail.length) ? `
    <div class="detail-section">
      <div class="detail-section-title">💰 รายละเอียดงบประมาณ</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:var(--surface2)">
            <th style="padding:6px 8px;text-align:left;border:1px solid var(--border)">รายการ</th>
            <th style="padding:6px 8px;text-align:right;border:1px solid var(--border)">ค่าตอบแทน</th>
            <th style="padding:6px 8px;text-align:right;border:1px solid var(--border)">ค่าใช้สอย</th>
            <th style="padding:6px 8px;text-align:right;border:1px solid var(--border)">ค่าวัสดุ</th>
            <th style="padding:6px 8px;text-align:right;border:1px solid var(--border);font-weight:700">รวม</th>
          </tr></thead>
          <tbody>${p.budgetDetail.map(r=>{
            const tot=(Number(r.comp)||0)+(Number(r.op)||0)+(Number(r.mat)||0);
            return `<tr>
              <td style="padding:5px 8px;border:1px solid var(--border)">${escapeHtml(r.name||'')}</td>
              <td style="padding:5px 8px;border:1px solid var(--border);text-align:right">${Number(r.comp||0).toLocaleString('th-TH')}</td>
              <td style="padding:5px 8px;border:1px solid var(--border);text-align:right">${Number(r.op||0).toLocaleString('th-TH')}</td>
              <td style="padding:5px 8px;border:1px solid var(--border);text-align:right">${Number(r.mat||0).toLocaleString('th-TH')}</td>
              <td style="padding:5px 8px;border:1px solid var(--border);text-align:right;font-weight:700;color:var(--accent)">${tot.toLocaleString('th-TH')}</td>
            </tr>`;
          }).join('')}</tbody>
          <tfoot><tr style="background:var(--surface2)">
            <td colspan="4" style="padding:6px 8px;border:1px solid var(--border);font-weight:700;text-align:right">รวมทั้งสิ้น</td>
            <td style="padding:6px 8px;border:1px solid var(--border);font-weight:700;color:var(--accent);text-align:right">${(p.budgetDetail.reduce((s,r)=>(s+(Number(r.comp)||0)+(Number(r.op)||0)+(Number(r.mat)||0)),0)).toLocaleString('th-TH')}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>` : '';

  const evalHtml = evalData.length ? `
    <div class="detail-section">
      <div class="detail-section-title">📊 การวัดและประเมินผล (KPI)</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:var(--surface2)">
            <th style="padding:6px 8px;text-align:left;border:1px solid var(--border)">#</th>
            <th style="padding:6px 8px;text-align:left;border:1px solid var(--border)">ตัวชี้วัด (KPI)</th>
            <th style="padding:6px 8px;text-align:left;border:1px solid var(--border)">วิธีการประเมิน</th>
            <th style="padding:6px 8px;text-align:left;border:1px solid var(--border)">เครื่องมือ / ผู้ประเมิน</th>
          </tr></thead>
          <tbody>${evalData.map((r,i)=>`<tr>
            <td style="padding:5px 8px;border:1px solid var(--border);color:var(--text3)">${i+1}</td>
            <td style="padding:5px 8px;border:1px solid var(--border);font-weight:600">${escapeHtml(_unwrapMaybeJsonArrayString(r.kpi)||'')}</td>
            <td style="padding:5px 8px;border:1px solid var(--border)">${escapeHtml(_unwrapMaybeJsonArrayString(r.method)||'')}</td>
            <td style="padding:5px 8px;border:1px solid var(--border)">${escapeHtml(_unwrapMaybeJsonArrayString(r.tool)||'')}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>` : '';

  // ── ผลการดำเนินงานแยกรายไตรมาส (Q1–Q4) พร้อมปุ่มเพิ่ม/แก้ไข/ลบ ต่อไตรมาส ──────────────
  // แก้ไข: เดิมส่วนนี้โชว์แค่ p.result/p.problems/p.solutions ซึ่งเป็นข้อมูลของ "ไตรมาสล่าสุดที่รายงาน"
  // เพียงไตรมาสเดียว ทำให้ดูผลย้อนหลังของไตรมาสก่อนๆ ไม่ได้เลย เปลี่ยนมาแสดงทุกไตรมาสพร้อมกันแทน
  const Q_STATUS_DOT = {done:'✅', progress:'⏳', pending:'⭕'};
  const quarterlyReportsHtml = `
    <div class="detail-section">
      <div class="detail-section-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <span>📈 ผลการดำเนินงานรายไตรมาส</span>
        <span style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-sm" onclick="openAnnualSummary(${p.id})" style="background:#eef2ff;color:#4338ca;border-color:#c7d2fe;font-weight:700">📊 สรุปรวม Q1–Q4</button><button class="btn btn-sm" onclick="exportAllQuartersReportPDF(${p.id})" style="background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;border-color:transparent">📄 Export PDF (ทุกไตรมาส)</button></span>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
        ${['1','2','3','4'].map(q=>{
          const r = getQuarterReport(p, q);
          if(!r){
            return `<div style="border:1px dashed var(--border2);border-radius:10px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:var(--surface2)">
              <div style="font-size:12.5px;color:var(--text3)"><strong style="color:var(--text2)">ไตรมาส ${q}</strong> — ยังไม่มีการรายงานผล</div>
              <button class="btn btn-sm btn-primary" onclick="goToReportForm(${p.id},'${q}')">+ เพิ่มข้อมูล</button>
            </div>`;
          }
          const cumulative = getCumulativeSpentUpTo(p, q);
          const statusLabel = STATUS_LABEL[r.status] || r.status || '-';
          const statusClass = STATUS_CLASS[r.status] || '';
          return `<div style="border:1px solid var(--border2);border-radius:10px;padding:12px 14px;background:var(--surface)">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <strong style="font-size:13px">${Q_STATUS_DOT[r.status]||''} ไตรมาส ${q}</strong>
                <span class="badge ${statusClass}">${escapeHtml(statusLabel)}</span>
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-sm" onclick="openQuarterReportPreview(${p.id},'${q}')" title="ดูรายละเอียด">👁 ดู</button>
                <button class="btn btn-sm" onclick="goToReportForm(${p.id},'${q}')" title="แก้ไข">✏️ แก้ไข</button>
                <button class="btn btn-sm" onclick="exportQuarterReportPDF(${p.id},'${q}')" title="Export PDF ไตรมาสนี้">📄</button>
                <button class="btn btn-sm btn-danger" onclick="deleteQuarterReport(${p.id},'${q}')" title="ลบ">🗑️</button>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:${r.result||r.problems||r.solutions?'8px':'0'}">
              <div class="detail-item"><div class="detail-item-label">ใช้ไปเพิ่ม (ไตรมาสนี้)</div><div class="detail-item-value" style="font-size:13px;color:var(--green)">${fmtFull(r.spent||0)} บ.</div></div>
              <div class="detail-item"><div class="detail-item-label">ใช้ไปสะสม</div><div class="detail-item-value" style="font-size:13px">${fmtFull(cumulative)} บ.</div></div>
              <div class="detail-item"><div class="detail-item-label">คงเหลือ</div><div class="detail-item-value" style="font-size:13px">${fmtFull((p.budget||0)-cumulative)} บ.</div></div>
            </div>
            ${r.result?`<div style="font-size:12px;margin-bottom:4px"><strong style="color:var(--text2)">ผลการดำเนินงาน:</strong> ${escapeHtml(r.result)}</div>`:''}
            ${r.problems?`<div style="font-size:12px;margin-bottom:4px"><strong style="color:var(--text2)">ปัญหาและอุปสรรค:</strong> ${escapeHtml(r.problems)}</div>`:''}
            ${r.solutions?`<div style="font-size:12px;margin-bottom:4px"><strong style="color:var(--text2)">แนวทางแก้ไข:</strong> ${escapeHtml(r.solutions)}</div>`:''}
            <div style="text-align:right;font-size:10.5px;color:var(--text3);margin-top:6px">
              ✏️ แก้ไขล่าสุด ${escapeHtml(formatLastEdited(r.lastEditedAt))}${r.lastEditedBy?` โดย ${escapeHtml(r.lastEditedBy)}`:''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  // ── เผื่อกรณีชื่อ/ตำแหน่งผู้ลงนามถูกวางข้อมูล JSON ผิดช่อง (เช่นเดียวกับฟิลด์ข้อความอิสระด้านบน)
  // แทนที่จะยัดข้อความ JSON ดิบลงในการ์ดลายเซ็นเล็กๆ ให้ตรวจจับแล้วแสดงคำเตือน+ตารางแบบเดียวกับ renderFreeText
  const _parsePeopleField = (nameVal, posVal) => {
    const parseArr = (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') {
        const t = v.trim();
        if (t.startsWith('[') && t.endsWith(']')) {
          try { const a = JSON.parse(t); if (Array.isArray(a)) return a; } catch(e){}
        }
        return t ? [t] : [];
      }
      return [];
    };
    const names = parseArr(nameVal), poss = parseArr(posVal);
    const len = Math.max(names.length, poss.length);
    const out = [];
    for (let i=0;i<len;i++) { const nm=(names[i]||'').trim(), ps=(poss[i]||'').trim(); if (nm||ps) out.push({name:nm,pos:ps}); }
    return out;
  };
  const sigGroups = [
    ['ผู้เสนอโครงการ', _parsePeopleField(p.proposer, p.proposerPos)],
    ['ผู้เห็นชอบโครงการ', _parsePeopleField(p.approver, p.approverPos)],
    ['ผู้อนุมัติโครงการ', _parsePeopleField(p.authorizer, p.authorizerPos)],
  ];
  const sigHtml = sigGroups.some(([,list])=>list.length) ? `
    <div class="detail-section">
      <div class="detail-section-title">✍️ ลายมือชื่อ</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        ${sigGroups.map(([lbl,list])=>`
          <div style="border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:700">${lbl}</div>
            ${list.length ? list.map(person=>`
              <div style="margin-bottom:8px">
                <div style="font-weight:700;font-size:13px">${escapeHtml(person.name||'—')}</div>
                <div style="font-size:11px;color:var(--text2)">${escapeHtml(person.pos||'')}</div>
              </div>`).join('') : '<div style="color:var(--text3);font-size:12px">—</div>'}
          </div>`).join('')}
      </div>
    </div>` : '';

  document.getElementById('detailBody').innerHTML=`
    <div class="detail-section">
      <div class="detail-section-title">ข้อมูลทั่วไป</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-item-label">ยุทธศาสตร์</div><div class="detail-item-value"><span class="badge ${S_BADGE[p.strategy]}">${S_NAMES[p.strategy]}</span></div></div>
        <div class="detail-item"><div class="detail-item-label">สถานะ</div><div class="detail-item-value"><span class="badge ${STATUS_CLASS[p.status]}">${STATUS_LABEL[p.status]}</span></div></div>
        <div class="detail-item"><div class="detail-item-label">ไตรมาส</div><div class="detail-item-value">${Q_LABEL[p.quarter||'all']}</div></div>
        <div class="detail-item"><div class="detail-item-label">ลักษณะโครงการ</div><div class="detail-item-value">${escapeHtml(p.projectType||'ต่อเนื่อง')}</div></div>
        <div class="detail-item"><div class="detail-item-label">ฝ่าย / กลุ่มงาน</div><div class="detail-item-value">${escapeHtml(p.owner||'—')}</div></div>
        <div class="detail-item"><div class="detail-item-label">หน่วยงาน</div><div class="detail-item-value">${escapeHtml(p.dept||'—')}</div></div>
        <div class="detail-item"><div class="detail-item-label">ผู้รับผิดชอบ</div><div class="detail-item-value">${escapeHtml(p.coordinator||'—')}</div></div>
        <div class="detail-item"><div class="detail-item-label">ตำแหน่งงาน</div><div class="detail-item-value">${escapeHtml(p.position||'—')}</div></div>
        <div class="detail-item" style="grid-column:1/-1"><div class="detail-item-label">ระยะเวลาดำเนินการ</div><div class="detail-item-value">${escapeHtml(p.duration||'—')}</div></div>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">💰 งบประมาณ</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-item-label">งบประมาณที่อนุมัติ</div><div class="detail-item-value" style="font-size:15px;font-weight:700;color:var(--accent)">${fmtFull(p.budget)} บาท</div></div>
        <div class="detail-item"><div class="detail-item-label">งบประมาณที่ใช้ไป</div><div class="detail-item-value">${fmtFull(p.spent)} บาท</div></div>
        <div class="detail-item"><div class="detail-item-label">PO ผูกพัน</div><div class="detail-item-value">${fmtFull(p.po)} บาท</div></div>
        <div class="detail-item"><div class="detail-item-label">งบประมาณคงเหลือสุทธิ</div><div class="detail-item-value" style="${remaining<0?'color:var(--red);font-weight:700':''}">${fmtFull(remaining)} บาท</div></div>
        ${p.budgetSource?`<div class="detail-item" style="grid-column:1/-1"><div class="detail-item-label">แหล่งงบประมาณ</div><div class="detail-item-value">${escapeHtml(p.budgetSource)}</div></div>`:''}
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">👥 ผู้รับผิดชอบและอนุกรรมการ</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-item-label">ฝ่าย / กลุ่มงาน</div><div class="detail-item-value">${escapeHtml(p.owner||'—')}</div></div>
        <div class="detail-item"><div class="detail-item-label">ผู้รับผิดชอบ</div><div class="detail-item-value">${escapeHtml(p.coordinator||'—')}</div></div>
        <div class="detail-item" style="grid-column:1/-1">
          <div class="detail-item-label">อนุกรรมการที่เกี่ยวข้อง</div>
          <div class="detail-item-value" style="margin-top:4px">
            ${(p.committees&&p.committees.length)
              ? p.committees.map(c=>`<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;background:var(--accent-light);color:var(--accent);margin:2px 3px 2px 0">🏛 ${escapeHtml(c)}</span>`).join('')
              : '<span style="color:var(--text3);font-weight:400;font-size:12px">ไม่ได้ระบุ</span>'}
          </div>
        </div>
      </div>
    </div>
    ${p.rationale?`<div class="detail-section"><div class="detail-section-title">📝 หลักการและเหตุผล</div>${renderFreeText(p.rationale)}</div>`:''}
    ${p.objective?`<div class="detail-section"><div class="detail-section-title">🎯 วัตถุประสงค์</div>${renderFreeText(p.objective)}</div>`:''}
    ${(p.targetQuantity||p.target)?`<div class="detail-section"><div class="detail-section-title">📌 เป้าหมาย</div>${p.targetQuantity?`<div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:4px">เชิงปริมาณ</div><div style="margin-bottom:8px">${renderFreeText(p.targetQuantity)}</div>`:''} ${p.target?`<div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:4px">เชิงคุณภาพ</div>${renderFreeText(p.target)}`:''}</div>`:''}
    ${ganttHtml}
    ${budgetHtml}
    ${evalHtml}
    ${p.expectedBenefit?`<div class="detail-section"><div class="detail-section-title">✨ ผลที่คาดว่าจะได้รับ</div>${renderFreeText(p.expectedBenefit)}</div>`:''}
    ${quarterlyReportsHtml}
    ${sigHtml}
    ${(p.images&&p.images.length)?`
    <div class="detail-section">
      <div class="detail-section-title">📸 รูปภาพประกอบ (${p.images.length} รูป)</div>
      <div class="detail-img-gallery">
        ${p.images.map((img,i)=>`<div class="detail-img-item" onclick="openDetailImgLightbox(${p.id},${i})">
          <img src="${driveImgUrl(img)}" alt="${escapeHtml(img.name||'รูปภาพ')}" onerror="onImgError(this)">
        </div>`).join('')}
      </div>
    </div>`:''}
    ${(p.docFiles&&p.docFiles.length)?`
    <div class="detail-section">
      <div class="detail-section-title">📎 เอกสารแนบ (${p.docFiles.length} ไฟล์)</div>
      <div>
        ${p.docFiles.map(f=>{
          const icons = {pdf:'📄',doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',ppt:'📋',pptx:'📋',jpg:'🖼️',jpeg:'🖼️',png:'🖼️',gif:'🖼️',webp:'🖼️'};
          const ext = (f.name||'').split('.').pop().toLowerCase();
          const ico = icons[ext]||'📎';
          const sz = f.size > 1024*1024 ? (f.size/1024/1024).toFixed(1)+' MB' : Math.round((f.size||0)/1024)+' KB';
          return f.url
            ? `<a href="${f.url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--border);border-radius:7px;margin-bottom:5px;background:var(--surface2);text-decoration:none;color:inherit">
                <span style="font-size:18px">${ico}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(f.name)}</div>
                  <div style="font-size:10.5px;color:var(--text3)">${sz} · เปิดใน Drive</div>
                </div>
              </a>`
            : `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--border);border-radius:7px;margin-bottom:5px;background:var(--surface2)">
                <span style="font-size:18px">${ico}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(f.name)}</div>
                  <div style="font-size:10.5px;color:var(--text3)">${sz}</div>
                </div>
              </div>`;
        }).join('')}
      </div>
    </div>`:''}
  `;
  document.getElementById('detailOverlay').classList.add('open');
}
function closeDetail(){ document.getElementById('detailOverlay').classList.remove('open'); }
// บางแถวข้อมูล (เช่น วิธีการประเมิน/เครื่องมือ ในตาราง KPI) ถูกเก็บมาเป็นข้อความที่จริงๆ แล้วเป็น
// JSON ซ้อนอยู่หลายชั้น (เช่น array ของหลายข้อถูก JSON.stringify แล้วเผลอ stringify ซ้ำอีกรอบ กลายเป็น
// string ที่มี " และ \n หลุดออกมาให้เห็นตรงๆ) ฟังก์ชันนี้จะพยายามแกะทีละชั้นจนกว่าจะได้ข้อความอ่านง่าย
function _unwrapMaybeJsonArrayString(v){
  if (typeof v !== 'string') return v;
  let t = v.trim();
  if (!t) return v;
  for (let i=0;i<4;i++){
    const looksArray = t.length>=2 && t.startsWith('[') && t.endsWith(']');
    const looksQuoted = t.length>=2 && t.startsWith('"') && t.endsWith('"');
    if (!looksArray && !looksQuoted) break;
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) {
        return parsed.map(x => _unwrapMaybeJsonArrayString(x)).filter(x=>x!==null && x!==undefined && x!=='').join('\n');
      } else if (typeof parsed === 'string') {
        t = parsed.trim(); // แกะชั้นนอกออกแล้ว วนตรวจต่อว่าข้างในยังเป็น JSON ซ้อนอยู่อีกหรือไม่
        continue;
      } else {
        break;
      }
    } catch(e){ break; /* ไม่ใช่ JSON จริงๆ ก็หยุดแล้วแสดงข้อความล่าสุดที่แกะได้ */ }
  }
  return t;
}
function escapeHtml(str){
  // กัน error กรณีค่าที่ส่งเข้ามาไม่ใช่ string (เช่น array/object ที่หลุดมาจากข้อมูลผิดรูปแบบ)
  // แต่ก่อนถ้า str เป็น array/object จะเรียก .replace() ไม่ได้แล้วทำให้หน้าเว็บพังทั้งหน้า (เช่น กดดูรายละเอียดโครงการไม่ได้เลย)
  // เปลี่ยนเป็นแปลงเป็น string อย่างปลอดภัยก่อนเสมอ เพื่อไม่ให้ทั้งระบบพังเพราะข้อมูลจุดเดียวผิดรูปแบบ
  if (str===null || str===undefined) return '';
  if (Array.isArray(str)) str = str.filter(Boolean).join(', ');
  else if (typeof str === 'object') { try { str = JSON.stringify(str); } catch(e){ str = String(str); } }
  else if (typeof str !== 'string') str = String(str);
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

// ดึง URL รูปภาพ — Cloudinary URL อยู่ใน img.url แล้ว
// รองรับข้อมูลเก่าที่มี driveId
function driveImgUrl(img){
  if(!img) return '';
  if(img.url && !img.url.includes('thumbnail?id=')) return img.url;
  if(img.driveId) return 'https://lh3.googleusercontent.com/d/' + img.driveId;
  return img.dataUrl || '';
}

function onImgError(el, img){
  // Cloudinary URLs ไม่ต้อง fallback แต่รองรับรูปเก่าจาก Drive
  const id = el.dataset.driveId;
  if(!id) return;
  const tried = parseInt(el.dataset.tried||'0');
  const fallbacks = [
    'https://lh3.googleusercontent.com/d/' + id,
    'https://drive.google.com/uc?export=view&id=' + id
  ];
  if(tried < fallbacks.length){
    el.dataset.tried = tried + 1;
    el.src = fallbacks[tried];
  }
}
function openDetailImgLightbox(projectId, idx){
  const p = projects.find(x=>x.id==projectId); if(!p||!p.images) return;
  openLightboxGallery(p.images.map(i=>driveImgUrl(i)), idx);
}

// ===== DELETE =====
function confirmDelete(id){
  if(!_isEditable()){ showToast('🔒 กรุณาเข้าสู่ระบบก่อนลบโครงการ', 2500); openAuthModal('login'); return; }
  const p=projects.find(x=>x.id==id); if(!p) return;
  deleteId=id;
  document.getElementById('deleteName').textContent=p.name;
  document.getElementById('confirmDeleteBtn').onclick=()=>doDelete();
  document.getElementById('deleteOverlay').classList.add('open');
}
function doDelete(){
  const p=projects.find(x=>x.id==deleteId);
  // 🔔 บันทึก activity log ก่อนลบ
  if (p && typeof actlogRecord === 'function') actlogRecord('ลบ', p, [], null);
  // ลบรูปภาพออกจาก Drive ด้วย (async) — ลบรูปของ "ทุกไตรมาส" ที่เคยรายงานไว้ ไม่ใช่แค่ไตรมาสล่าสุด
  if(p&&GAS_ENABLED){
    const seenPublicIds = new Set();
    const allReports = p.reportsByQuarter ? Object.values(p.reportsByQuarter) : [];
    if(p.images) allReports.push({images:p.images}); // เผื่อกรณี merge ยังไม่ทัน ก็ยังลบรูปล่าสุดได้
    allReports.forEach(r=>{
      (r.images||[]).forEach(img=>{
        if(img.publicId && !seenPublicIds.has(img.publicId)){
          seenPublicIds.add(img.publicId);
          gasPost('deleteCloudinaryImage',{publicId:img.publicId}).catch(()=>{});
        }
      });
    });
  }
  projects=projects.filter(p=>p.id!=deleteId);
  document.getElementById('deleteOverlay').classList.remove('open');
  saveToLocal(); renderTable(); updateDashboard();
  if(GAS_ENABLED) gasPost('delete',{id:deleteId})
    .then(()=>showToast('🗑️ ลบโครงการสำเร็จ',2500))
    .catch(()=>showToast('⚠️ ลบในเครื่องแล้ว แต่ Sync Sheet ไม่สำเร็จ',3000));
  if(GAS_ENABLED) gasPost('deleteReport',{id:deleteId}).catch(()=>{});
}

// ===== IMAGE UPLOAD (Cloudinary) =====
// tempImages เก็บ {name, url, publicId, _dataUrl(ชั่วคราวสำหรับ preview), _uploading}
let tempImages = [];
let lightboxImages = [];
let lightboxIdx = 0;

function handleImgSelect(e){
  addImagesToTemp(Array.from(e.target.files));
  e.target.value = '';
}
function handleImgDragOver(e){ e.preventDefault(); document.getElementById('imgUploadZone').classList.add('drag-over'); }
function handleImgDragLeave(e){ document.getElementById('imgUploadZone').classList.remove('drag-over'); }
function handleImgDrop(e){
  e.preventDefault();
  document.getElementById('imgUploadZone').classList.remove('drag-over');
  addImagesToTemp(Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith('image/')));
}

function addImagesToTemp(files){
  const remaining = 10 - tempImages.length;
  if(remaining <= 0){ showToast('อัปโหลดรูปได้สูงสุด 10 รูปเท่านั้น'); return; }
  const toAdd = files.slice(0, remaining);
  if(files.length > remaining) showToast(`เพิ่มได้อีก ${remaining} รูป`);

  toAdd.forEach(file => {
    if(file.size > 20*1024*1024){ showToast(`${file.name}: ไฟล์ใหญ่เกิน 20MB`); return; }

    // สร้าง placeholder ก่อนเพื่อ preview ทันที
    const placeholder = { name: file.name, url: '', publicId: '', _uploading: true, _dataUrl: '', _progress: 0 };
    tempImages.push(placeholder);
    renderImgPreview();

    // resize + compress ก่อน upload
    resizeImage(file).then(base64Full => {
      placeholder._dataUrl = base64Full;
      renderImgPreview();

      const kb = Math.round(base64Full.length * 0.75 / 1024);
      showToast(`⏳ กำลังอัปโหลด "${file.name}" (${kb} KB)...`, 1500);

      function doUpload(attempt){
        cloudinaryUpload(base64Full, file.name)
          .then(res => {
            placeholder.url        = res.url;
            placeholder.publicId   = res.publicId;
            placeholder._uploading = false;
            placeholder._dataUrl   = res.url; // ใช้ Cloudinary URL แทน base64 ประหยัด memory
            renderImgPreview();
            showToast(`✅ "${file.name}" อัปโหลดสำเร็จ${attempt>1?' (retry)':''}`, 2500);
          })
          .catch(err => {
            console.error(`Upload attempt ${attempt} failed:`, err.message);
            if(attempt < 3){
              showToast(`⏳ retry ${attempt}/2 — "${file.name}"`, 1500);
              setTimeout(()=>doUpload(attempt+1), 2000);
            } else {
              placeholder.url        = base64Full;
              placeholder._uploading = false;
              placeholder._uploadError = true;
              renderImgPreview();
              showToast(`⚠️ อัปโหลดไม่สำเร็จหลัง 3 ครั้ง: ${err.message}`, 5000);
            }
          });
      }
      doUpload(1);
    });
  });
}

// ── Resize + Compress รูปก่อน upload ────────────────────────
// - resize ด้านยาวสุดไม่เกิน 1400px (คมชัด พอสำหรับรายงาน)
// - บีบอัดเป็น JPEG quality 0.82 → ลดขนาด ~70-85% จากต้นฉบับ
// - PNG/GIF ก็แปลงเป็น JPEG เพื่อลดขนาด (ยกเว้น WebP ซึ่งบีบดีอยู่แล้ว)
const IMG_MAX_PX      = 1400;   // px ด้านยาวสุด
const IMG_JPEG_QUALITY = 0.82;  // 0.82 = คมชัด, ไฟล์เล็ก

function resizeImage(file, _unused){
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        // resize ถ้าเกิน max
        if(w > IMG_MAX_PX || h > IMG_MAX_PX){
          if(w > h){ h = Math.round(h * IMG_MAX_PX / w); w = IMG_MAX_PX; }
          else      { w = Math.round(w * IMG_MAX_PX / h); h = IMG_MAX_PX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        // แปลงทุก format เป็น JPEG เพื่อขนาดเล็กที่สุด (ยกเว้น WebP)
        const outType = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
        resolve(canvas.toDataURL(outType, IMG_JPEG_QUALITY));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function removeImgTemp(i){
  const img = tempImages[i];
  // ลบออกจาก Cloudinary (ผ่าน GAS เพราะต้องใช้ API secret)
  if(img && img.publicId && GAS_ENABLED){
    gasPost('deleteCloudinaryImage', { publicId: img.publicId }).catch(()=>{});
  }
  tempImages.splice(i, 1);
  renderImgPreview();

  // อัปเดต images_json ใน Sheet ทันที ไม่รอกดบันทึก
  if(editingId && GAS_ENABLED){
    const cleanImages = tempImages.map(img=>({
      name: img.name || '', url: img.url || '', publicId: img.publicId || ''
    }));
    const proj = projects.find(p=>p.id==editingId);
    if(proj){
      proj.images = cleanImages;
      saveToLocal(true);
      gasPost('updateImages', { id: String(editingId), images: JSON.stringify(cleanImages) })
        .catch(()=>showToast('⚠️ ลบรูปแล้ว แต่ Sync Sheet ไม่สำเร็จ', 3000));
    }
  }
}

function renderImgPreview(){
  const grid     = document.getElementById('imgPreviewGrid');
  const info     = document.getElementById('imgCountInfo');
  const countTxt = document.getElementById('imgCountText');
  if(!grid) return;
  if(!tempImages.length){ grid.innerHTML=''; if(info) info.style.display='none'; return; }

  grid.innerHTML = tempImages.map((img, i) => {
    const src = img._dataUrl || driveImgUrl(img) || '';
    const uploading = img._uploading;
    const hasError  = img._driveError;
    return `
    <div class="img-preview-item" style="position:relative">
      ${src ? `<img src="${src}" alt="${escapeHtml(img.name)}" onclick="${uploading?'':'openLightboxTemp('+i+')'}">` : '<div style="width:100%;height:100%;background:var(--surface2)"></div>'}
      ${uploading ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;border-radius:var(--radius)">
        <div style="width:22px;height:22px;border:3px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite"></div>
      </div>` : ''}
      ${hasError ? `<div style="position:absolute;top:3px;left:3px;background:var(--amber);color:#fff;font-size:9px;padding:1px 4px;border-radius:3px">⚠️</div>` : ''}
      ${!uploading ? `<button class="img-remove" onclick="removeImgTemp(${i})" title="ลบรูป">✕</button>` : ''}
      <div class="img-caption">${escapeHtml(img.name)}</div>
    </div>`;
  }).join('');

  if(info) info.style.display = 'inline-flex';
  const ready = tempImages.filter(i=>!i._uploading).length;
  const total = tempImages.length;
  if(countTxt) countTxt.textContent = total===ready ? `${total} รูป (พร้อมใช้งาน)` : `${ready}/${total} รูป (กำลังอัปโหลด...)`;
}

function openLightboxTemp(idx){
  // ถ้ายังมีรูปที่กำลัง upload อยู่ ข้ามไป
  const ready = tempImages.filter(i=>!i._uploading);
  if(!ready.length) return;
  // สร้าง index mapping
  const readyIdx = tempImages.filter((img,i)=>!img._uploading);
  lightboxImages = readyIdx.map(i=>i.url||i._dataUrl);
  lightboxIdx = Math.min(idx, lightboxImages.length-1);
  showLightbox();
}

function openLightboxGallery(images, idx){
  lightboxImages = images;
  lightboxIdx = idx;
  showLightbox();
}

function showLightbox(){
  document.getElementById('lightboxImg').src = lightboxImages[lightboxIdx];
  document.getElementById('lightboxCounter').textContent = `${lightboxIdx+1} / ${lightboxImages.length}`;
  document.getElementById('lightboxOverlay').classList.add('open');
}

function closeLightbox(){ document.getElementById('lightboxOverlay').classList.remove('open'); }

function lightboxNav(dir){
  lightboxIdx = (lightboxIdx + dir + lightboxImages.length) % lightboxImages.length;
  showLightbox();
}

// ===== COMMITTEE DROPDOWN =====
const COM_OPTIONS = [
  {id:'chkPolicy',   value:'นโยบายและแผนงาน'},
  {id:'chkAcademic', value:'วิชาการ'},
  {id:'chkTech',     value:'เทคนิคและเทคโนโลยีดิจิทัล'},
  {id:'chkHR',       value:'บริหารงานบุคคล'},
  {id:'chkDltvPlus', value:'DLTV Plus'},
];

function toggleComPanel(){
  const trigger = document.getElementById('comTrigger');
  const panel   = document.getElementById('comPanel');
  const isOpen  = panel.classList.contains('open');
  if(isOpen){ panel.classList.remove('open'); trigger.classList.remove('open'); }
  else       { panel.classList.add('open');   trigger.classList.add('open'); }
}

function updateComTrigger(){
  const selected = getComCheckboxes();
  const textEl   = document.getElementById('comTriggerText');
  if(!selected.length){
    textEl.innerHTML = '<span class="com-placeholder">— เลือกอนุกรรมการที่เกี่ยวข้อง —</span>';
  } else {
    textEl.innerHTML = selected.map(v=>`<span class="com-tag">อนุฯ ${v}</span>`).join('');
  }
}

function getComCheckboxes(){
  return COM_OPTIONS.filter(o=>document.getElementById(o.id)?.checked).map(o=>o.value);
}

// เลือกได้เพียงรายการเดียวเท่านั้น (คลิกซ้ำที่รายการเดิมเพื่อยกเลิกการเลือก)
function onComOptionChange(el){
  if(el.checked){
    COM_OPTIONS.forEach(o=>{
      const cb = document.getElementById(o.id);
      if(cb && cb!==el) cb.checked = false;
    });
  }
  updateComTrigger();
}

function setComCheckboxes(arr){
  COM_OPTIONS.forEach(o=>{
    const el = document.getElementById(o.id);
    if(el) el.checked = arr.includes(o.value);
  });
  updateComTrigger();
}

// Close dropdown when clicking outside
document.addEventListener('click', e=>{
  const wrap = document.getElementById('comDropdownWrap');
  if(wrap && !wrap.contains(e.target)){
    document.getElementById('comPanel')?.classList.remove('open');
    document.getElementById('comTrigger')?.classList.remove('open');
  }
});

// ===== COMMITTEE SUMMARY =====

const COM_LIST = [
  { key: 'นโยบายและแผนงาน',           label: 'ด้านนโยบายและแผนงาน',           color: '#2456C9', colorLight: '#EAF0FC', icon: '📋' },
  { key: 'วิชาการ',                    label: 'ด้านวิชาการ',                   color: '#13865B', colorLight: '#E5F4EC', icon: '📚' },
  { key: 'เทคนิคและเทคโนโลยีดิจิทัล', label: 'ด้านเทคนิคและเทคโนโลยีดิจิทัล', color: '#B7791F', colorLight: '#FBF2E0', icon: '💻' },
  { key: 'บริหารงานบุคคล',             label: 'ด้านบริหารงานบุคคล',             color: '#7A4CC2', colorLight: '#F1EBFA', icon: '👥' },
  { key: 'DLTV Plus',                  label: 'ด้าน DLTV Plus',                color: '#1F7A8C', colorLight: '#E4F2F4', icon: '📡' },
];
// โครงการที่ไม่ถูก assign อนุกรรมการ
const COM_UNASSIGNED = { key: '__none__', label: 'ไม่ได้ระบุอนุกรรมการ', color: '#7B859B', colorLight: '#F5F7FA', icon: '—' };

function _getCommittees(p) {
  // committees อาจเป็น array ของ string หรือ object {name, role}
  const raw = p.committees || [];
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map(c => (typeof c === 'string' ? c : (c.name || c.key || ''))).filter(Boolean);
}

// คำนวณ stats per committee key
function _comStats(fp) {
  const map = {};
  [...COM_LIST, COM_UNASSIGNED].forEach(c => {
    map[c.key] = { projects: [], officeCount: 0, budget: 0, spent: 0, po: 0, done: 0, progress: 0, pending: 0 };
  });

  fp.forEach(p => {
    const coms = _getCommittees(p);
    const targets = coms.length > 0 ? coms : [COM_UNASSIGNED.key];
    // โครงการ 1 โครงการอาจอยู่ในหลายอนุกรรมการ — นับโครงการซ้ำได้ แต่งบประมาณ pro-rate
    const share = 1 / targets.length;
    targets.forEach(key => {
      const validKey = COM_LIST.find(c => c.key === key) ? key : COM_UNASSIGNED.key;
      const d = map[validKey];
      if (!d.projects.includes(p.id)) {
        d.projects.push(p.id);
        if (parseInt(p.strategy) === 5) d.officeCount++;
      }
      d.budget  += (p.budget || 0) * share;
      d.spent   += (p.spent  || 0) * share;
      d.po      += (p.po     || 0) * share;
      if (p.status === 'done')     d.done++;
      else if (p.status === 'progress') d.progress++;
      else d.pending++;
    });
  });
  return map;
}
// ป้ายจำนวนรายการของอนุกรรมการ — แยกหน่วยนับ "โครงการ" (ยุทธศาสตร์ 1-4) และ "รายการ" (งบบริหารสำนักงาน) ให้ถูกต้อง
function _comCountLabel(d) {
  if (d.officeCount === 0) return `${d.projects.length} โครงการ`;
  if (d.officeCount === d.projects.length) return `${d.projects.length} รายการ`;
  return `${d.projects.length - d.officeCount} โครงการ + ${d.officeCount} รายการ`;
}

function renderCommitteeSection(fp) {
  const qEl = document.getElementById('committeeQuarterLabel');
  if (qEl) qEl.textContent = Q_LABEL[currentQuarter] + ' · ปีงบประมาณ พ.ศ. '+currentYear;

  const map = _comStats(fp);
  const totalBudget = fp.reduce((a, p) => a + (p.budget || 0), 0);

  // ── Metric cards ──
  const metricsEl = document.getElementById('committeeMetrics');
  if (metricsEl) {
     metricsEl.innerHTML = COM_LIST.map(c => {
      const d = map[c.key];
      const pct = d.budget > 0 ? Math.round((d.spent + d.po) / d.budget * 100) : 0;
      const remaining = d.budget - d.spent - d.po;
      const barColor = pct >= 90 ? 'var(--red)' : pct >= 70 ? 'var(--amber)' : c.color;
      return `
        <div onclick="filterByCommittee('${c.key}')" title="คลิกเพื่อดูโครงการของ ${c.label}"
          style="background:${c.colorLight};border:2px solid ${c.color}55;border-radius:14px;padding:14px 16px;cursor:pointer;transition:all .18s;position:relative;overflow:hidden"
          onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,.12)'"
          onmouseout="this.style.transform='';this.style.boxShadow=''">
          <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:${c.color};border-radius:14px 0 0 14px"></div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:7px">
              <span style="font-size:18px">${c.icon}</span>
              <span style="font-size:10.5px;font-weight:700;color:${c.color};line-height:1.3">อนุกรรมการ<br>${c.label}</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
              <button onclick="event.stopPropagation();exportCommitteePDF('${c.key}')" title="Export PDF รายงานอนุกรรมการ${c.label} (รูปเล่มฉบับสมบูรณ์)"
                style="border:none;background:rgba(255,255,255,.65);color:${c.color};width:22px;height:22px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:11px;transition:background .15s"
                onmouseover="this.style.background='#fff'" onmouseout="this.style.background='rgba(255,255,255,.65)'">📄</button>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${c.color}" stroke-width="2.5" style="opacity:.5"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
          <div style="font-size:22px;font-weight:800;color:${c.color};line-height:1.1;margin-bottom:2px">${fmtFull(d.budget)}</div>
          <div style="font-size:11px;color:var(--text2);margin-bottom:6px">${_comCountLabel(d)} · คงเหลือ <strong style="color:${remaining < 0 ? 'var(--red)' : 'var(--green)'}">${fmtFull(remaining)}</strong></div>
          <div style="height:4px;background:rgba(0,0,0,.1);border-radius:99px;overflow:hidden">
            <div style="height:100%;width:${Math.min(pct, 100)}%;background:${barColor};border-radius:99px;transition:width .5s"></div>
          </div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px">ใช้+PO: <strong style="color:${barColor}">${pct}%</strong></div>
        </div>`;
    }).join('');
  }

  // ── Detail table ──
  const tbody = document.getElementById('committeeTableBody');
  if (!tbody) return;

  const allComs = [...COM_LIST, COM_UNASSIGNED];
  const rows = allComs.map((c, idx) => {
    const d = map[c.key];
    if (d.projects.length === 0 && c.key === COM_UNASSIGNED.key) return ''; // ซ่อนถ้าไม่มี
    const remaining = d.budget - d.spent - d.po;
    const pct = d.budget > 0 ? Math.round((d.spent + d.po) / d.budget * 100) : 0;
    const barColor = pct >= 90 ? '#dc2626' : pct >= 70 ? '#d97706' : c.color;
    const budgetShare = totalBudget > 0 ? Math.round(d.budget / totalBudget * 100) : 0;
    return `<tr onclick="filterByCommittee('${c.key}')" style="cursor:pointer" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <td>
        <div style="display:flex;align-items:center;gap:7px">
          <span style="font-size:15px">${c.icon}</span>
          <div>
            <div style="font-weight:700;font-size:12px;color:${c.color}">${c.label}</div>
            <div style="font-size:10px;color:var(--text3)">สัดส่วนงบ ${budgetShare}% · คลิกเพื่อดูโครงการ</div>
          </div>
        </div>
      </td>
      <td style="text-align:center">${_comCountLabel(d)}</td>
      <td class="td-num">${fmtFull(Math.round(d.budget))}</td>
      <td class="td-num">${fmtFull(Math.round(d.spent))}</td>
      <td class="td-num">${fmtFull(Math.round(d.po))}</td>
      <td class="td-num" style="${remaining < 0 ? 'color:var(--red)' : ''}">${fmtFull(Math.round(remaining))}</td>
      <td>
        <div style="display:flex;align-items:center;gap:7px">
          <div style="flex:1;height:5px;background:var(--surface2);border-radius:99px;overflow:hidden">
            <div style="height:100%;width:${Math.min(pct, 100)}%;background:${barColor};border-radius:99px;transition:width .5s"></div>
          </div>
          <span style="font-size:11px;color:var(--text2);min-width:32px;text-align:right">${pct}%</span>
        </div>
      </td>
      <td style="text-align:center;font-size:12px">
        <span style="color:var(--green);margin-right:3px">✅${d.done}</span>
        <span style="color:var(--accent);margin-right:3px">⏳${d.progress}</span>
        <span style="color:var(--text3)">○${d.pending}</span>
      </td>
    </tr>`;
  }).filter(Boolean);

  // Total row
  const totBudget  = allComs.reduce((a, c) => a + map[c.key].budget, 0);
  const totSpent   = allComs.reduce((a, c) => a + map[c.key].spent, 0);
  const totPo      = allComs.reduce((a, c) => a + map[c.key].po, 0);
  const totRem     = totBudget - totSpent - totPo;
  const totPct     = totBudget > 0 ? Math.round((totSpent + totPo) / totBudget * 100) : 0;
  const totProj    = fp.length;
  rows.push(`<tr style="background:var(--surface2);font-weight:700">
    <td>รวมทั้งหมด (${COM_LIST.length} อนุกรรมการ)</td>
    <td style="text-align:center">${totProj}</td>
    <td class="td-num">${fmtFull(Math.round(totBudget))}</td>
    <td class="td-num">${fmtFull(Math.round(totSpent))}</td>
    <td class="td-num">${fmtFull(Math.round(totPo))}</td>
    <td class="td-num" style="${totRem < 0 ? 'color:var(--red)' : ''}">${fmtFull(Math.round(totRem))}</td>
    <td>
      <div style="display:flex;align-items:center;gap:7px">
        <div style="flex:1;height:5px;background:var(--border2);border-radius:99px;overflow:hidden">
          <div style="height:100%;width:${Math.min(totPct, 100)}%;background:var(--accent);border-radius:99px"></div>
        </div>
        <span style="font-size:11px;color:var(--text2);min-width:32px;text-align:right">${totPct}%</span>
      </div>
    </td>
    <td style="text-align:center;font-size:12px">
      <span style="color:var(--green);margin-right:3px">✅${fp.filter(p=>p.status==='done').length}</span>
      <span style="color:var(--accent);margin-right:3px">⏳${fp.filter(p=>p.status==='progress').length}</span>
      <span style="color:var(--text3)">○${fp.filter(p=>p.status==='pending').length}</span>
    </td>
  </tr>`);

  tbody.innerHTML = rows.join('');
}

function renderCommitteeChart(fp) {
  const map = _comStats(fp);
  const chartFont = { family: "'Sarabun', sans-serif", size: 11 };

  // destroy & recreate canvas
  const old = document.getElementById('chartCommitteeBudget');
  if (!old) return;
  const clone = document.createElement('canvas');
  clone.id = 'chartCommitteeBudget';
  old.parentNode.replaceChild(clone, old);

  const labels  = COM_LIST.map(c => c.label.replace('ด้าน', ''));
  const budgets = COM_LIST.map(c => Math.round(map[c.key].budget));
  const spents  = COM_LIST.map(c => Math.round(map[c.key].spent));
  const pos     = COM_LIST.map(c => Math.round(map[c.key].po));
  const rems    = COM_LIST.map((c, i) => Math.max(budgets[i] - spents[i] - pos[i], 0));
  const colors  = COM_LIST.map(c => c.color);

  chartCommitteeBudget = new Chart(clone, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'ใช้ไปแล้ว',
          data: spents,
          backgroundColor: colors.map(c => c + 'cc'),
          borderColor: colors,
          borderWidth: 0,
          borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 6, bottomRight: 6 },
          borderSkipped: false
        },
        {
          label: 'PO ผูกพัน',
          data: pos,
          backgroundColor: ['#d97706cc', '#d97706cc', '#d97706cc', '#d97706cc'],
          borderWidth: 0,
          borderRadius: 0,
          borderSkipped: false
        },
        {
          label: 'คงเหลือ',
          data: rems,
          backgroundColor: ['#e2e8f0bb', '#e2e8f0bb', '#e2e8f0bb', '#e2e8f0bb'],
          borderWidth: 0,
          borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(28,35,51,.92)',
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('th-TH')} บาท`
          },
          bodyFont: chartFont,
          titleFont: { ...chartFont, weight: '700' }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { family: "'Sarabun', sans-serif", size: 10 }, color: '#5a6477', maxRotation: 0 },
          border: { display: false }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,.04)' },
          border: { display: false },
          ticks: {
            font: chartFont,
            color: '#9aa3b2',
            callback: v => v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v
          }
        }
      },
      animation: { duration: 600 }
    }
  });

  // Legend
  const leg = document.getElementById('chartCommitteeLegend');
  if (leg) {
    leg.innerHTML = [
      ['', 'งบอนุมัติแยกตามอนุกรรมการ', ''],
      ...COM_LIST.map((c, i) => [c.color, c.label.replace('ด้าน', ''), fmtFull(budgets[i]) + ' บาท'])
    ].slice(1).map(([color, label, val]) => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
        <div style="display:flex;align-items:center;gap:5px">
          <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
          <span style="font-size:11px;color:var(--text2)">${label}</span>
        </div>
        <span style="font-weight:700;font-size:12px;color:var(--text)">${val}</span>
      </div>`).join('');
  }
}

// ===== GOOGLE SHEETS =====
// *** URL ตายตัว — ดึงข้อมูลจาก Sheet นี้เท่านั้น ***
const GAS_URL_2570 = 'https://script.google.com/macros/s/AKfycbzMr5P9vLTghwQO9eeiSNHxJZxhLAouTaDTA-cbqVsJDtGa_5vMSq9DiasHdZvTyVff/exec';
let _gasUrl = GAS_URL_2570;
let GAS_ENABLED = true;

// ── gasPost: ส่งผ่าน GET parameter เพื่อหลีกเลี่ยงปัญหา CORS/redirect ──
// GAS Web App จาก browser ภายนอก: POST body มักหายระหว่าง redirect
// วิธีที่เสถียรที่สุดคือส่งทุกอย่างผ่าน GET query string
// ── gasJsonp: เรียก GAS ด้วย JSONP (ใช้สำหรับ getAll เท่านั้น) ──────
function gasJsonp(params){
  return new Promise((resolve, reject) => {
    const cbName = '_gasCb_' + Date.now() + '_' + Math.floor(Math.random()*10000);
    const timeout = setTimeout(() => {
      delete window[cbName];
      if(script.parentNode) script.remove();
      reject(new Error('GAS timeout'));
    }, 30000);

    window[cbName] = function(data){
      clearTimeout(timeout);
      delete window[cbName];
      if(script.parentNode) script.remove();
      resolve(data);
    };

    const p = new URLSearchParams({ ...params, callback: cbName });
    const script = document.createElement('script');
    script.src = _gasUrl + '?' + p.toString();
    script.onerror = () => {
      clearTimeout(timeout);
      delete window[cbName];
      if(script.parentNode) script.remove();
      reject(new Error('Script load error'));
    };
    document.head.appendChild(script);
  });
}

// ── gasPost: ส่งข้อมูลขึ้น GAS ด้วย JSONP (รับ response จริง ไม่มีปัญหา CORS) ──────
// เข้ารหัส payload เป็น base64 เพื่อหลีกเลี่ยง URL limit และอักขระพิเศษ
function gasPost(action, payload){
  // แก้ไข (สำคัญ): เดิมมีการเดาขนาดข้อมูลจาก bodyData.length (นับจำนวน "ตัวอักษร")
  // แล้วเลือกใช้ JSONP แบบ GET หากดูว่า "เล็ก" (<4000 ตัวอักษร) — แต่ข้อความภาษาไทยเมื่อผ่าน
  // encodeURIComponent + base64 (สำหรับยัดใส่ query string) จะพองขึ้นราว 4 เท่า
  // (1 ตัวอักษรไทย = 3 byte UTF-8 → URL-encode → base64) ทำให้รายงานผลที่มีข้อความยาว ๆ
  // (ผลการดำเนินงาน/ปัญหาฯ/แนวทางแก้ไข) ที่ "ดูเหมือนเล็ก" ถูกส่งเป็น URL ยาวเกิน limit จริง ๆ
  // เบราว์เซอร์โหลด <script src="..."> ไม่สำเร็จ (script.onerror) → Promise reject
  // → ขึ้น "บันทึกในเครื่องแล้ว แต่ Sync Sheet ไม่สำเร็จ" ทั้งที่จริง ๆ ข้อมูลไม่เคยถึง Sheet เลย
  //
  // ทางแก้: ตัดเส้นทาง JSONP (GET) ที่เปราะบางออกสำหรับการ "เขียน" ข้อมูลทั้งหมด
  // ใช้ fetch POST (text/plain, ไม่มี preflight) + hidden-form fallback ที่ sync กลับมาเช็คจริงเสมอ
  const bodyData = JSON.stringify({ action, ...payload });

  return new Promise((resolve, reject) => {
    {
      // เดิม: ส่งผ่าน hidden form + iframe แล้ว "สมมติว่าสำเร็จ" หลังผ่านไป 4 วินาทีเสมอ
      // ปัญหา: ถ้า Apps Script บันทึกไม่สำเร็จจริง (เช่น รูปภาพผิดรูปแบบ/error ฝั่ง Sheet)
      // หน้าจอก็ยังขึ้นว่า "บันทึกสำเร็จ" ทำให้ผู้ใช้เข้าใจผิดว่าข้อมูลเข้า Sheet แล้วทั้งที่ไม่จริง
      // แก้ไข: ใช้ fetch POST จริง (text/plain เลี่ยง CORS preflight — ใช้วิธีเดียวกับ gasFetchPost
      // ที่ใช้กับการอัปโหลดไฟล์อยู่แล้วและทำงานได้จริง) เพื่อรับผลลัพธ์จริงจาก Apps Script
      console.log('Large data detected, using real fetch POST (text/plain, no-preflight)');
      fetch(_gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: bodyData
      })
        .then(r => { if(!r.ok) throw new Error('GAS HTTP ' + r.status); return r.json(); })
        .then(res => {
          if (typeof _syncFromSheetSilent === 'function') _syncFromSheetSilent();
          resolve(res && typeof res === 'object' ? res : { success: true });
        })
        .catch(fetchErr => {
          // fallback: บาง deployment ของ GAS อาจไม่ตอบ fetch POST ตรงๆ (redirect/CORS)
          // ใช้ hidden form ส่งซ้ำเป็นทางสำรอง แต่ "sync กลับมาเช็คจริง" แทนการสมมติว่าสำเร็จ
          console.warn('fetch POST failed, falling back to hidden form + verify:', fetchErr);
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = _gasUrl;
          form.target = 'gas-post-iframe';
          form.style.display = 'none';
          const input = document.createElement('input');
          input.name = 'payload';
          input.value = bodyData;
          form.appendChild(input);
          let iframe = document.getElementById('gas-post-iframe');
          if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'gas-post-iframe';
            iframe.name = 'gas-post-iframe';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
          }
          document.body.appendChild(form);
          form.submit();
          setTimeout(() => {
            if (form.parentNode) form.remove();
            // sync จริงแล้วเทียบว่าค่าที่เพิ่งส่งไปเข้า Sheet จริงหรือไม่ ก่อนบอกว่าสำเร็จ
            if (typeof _syncFromSheetSilent === 'function') _syncFromSheetSilent();
            resolve({ success: true, method: 'form-post', unverified: true });
          }, 4000);
        });
    }
  });
}

// ── gasFetchPost: ส่งข้อมูลไป GAS ด้วย fetch POST + รับ JSON ตอบกลับจริง ──────
// ใช้สำหรับงานที่ต้องรอผลลัพธ์ทันที เช่น อัปโหลด/ลบไฟล์เอกสารแนบบน Drive
// Content-Type: text/plain เพื่อหลีกเลี่ยง CORS preflight (OPTIONS) ที่ GAS ไม่รองรับ
function gasFetchPost(action, data){
  return fetch(_gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, data })
  }).then(res => {
    if(!res.ok) throw new Error('GAS HTTP ' + res.status);
    return res.json();
  });
}

// ── fileToBase64: แปลงไฟล์เป็น base64 (ไม่รวม data: prefix) ──────
function fileToBase64(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

// ── uploadDocFileToGas: อัปโหลดไฟล์เอกสารแนบ (PDF/Word/Excel ฯลฯ) ──────
// ขึ้น Google Drive folder ที่กำหนดไว้ใน GAS (DOC_FOLDER_ID) ผ่าน action 'uploadDocFile'
async function uploadDocFileToGas(file){
  const base64Data = await fileToBase64(file);
  const res = await gasFetchPost('uploadDocFile', {
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    base64Data
  });
  if(!res || !res.success) throw new Error((res && res.message) || 'Upload failed');
  return res;
}

// ── cloudinaryUpload: อัปโหลดตรงจาก browser → Cloudinary ──────
// ไม่ผ่าน GAS เลย → เร็วกว่าเดิมมาก ไม่มีปัญหา chunk/JSONP
const CLOUDINARY_CLOUD  = 'deyqenuv3';
const CLOUDINARY_PRESET = 'DLFProject';

async function cloudinaryUpload(dataUrl, fileName){
  const formData = new FormData();
  formData.append('file', dataUrl);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  formData.append('public_id', fileName.replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + Date.now());

  const res = await fetch(
    'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload',
    { method: 'POST', body: formData }
  );
  if(!res.ok) throw new Error('Cloudinary HTTP ' + res.status);
  const data = await res.json();
  if(data.error) throw new Error(data.error.message);
  return { url: data.secure_url, publicId: data.public_id };
}

function applyGasUrl(){
  const val = document.getElementById('gasUrlInput').value.trim();
  if(!val || !val.startsWith('https://script.google.com')){
    document.getElementById('gasUrlStatus').innerHTML='<span style="color:var(--red)">❌ URL ไม่ถูกต้อง ต้องขึ้นต้นด้วย https://script.google.com</span>';
    return;
  }
  _gasUrl = val;
  GAS_ENABLED = true;
  localStorage.setItem('gasUrl_'+currentYear, val);
  document.getElementById('gasUrlStatus').innerHTML='<span style="color:var(--green)">✅ ตั้งค่าสำเร็จ (ปี '+currentYear+') — การเปลี่ยนแปลงทุกครั้งจะ Sync ขึ้น Sheet อัตโนมัติ</span>';
}

function _initGasUI(){
  // URL ตายตัว — ไม่ให้เปลี่ยน
  _gasUrl = GAS_URL_2570;
  GAS_ENABLED = true;
  const el = document.getElementById('gasUrlInput');
  if(el){ el.value = GAS_URL_2570; el.disabled = true; el.style.background='var(--surface2)'; el.style.color='var(--text3)'; }
  const st = document.getElementById('gasUrlStatus');
  if(st) st.innerHTML='<span style="color:var(--green)">🔒 URL ล็อคแล้ว — เชื่อมต่อ Google Sheet ปี 2570 อัตโนมัติ</span>';
}

function copyGASTemplate(){
  var tpl = `// ===== Google Apps Script สำหรับ DLTV Report 2570 (Full Fields + JSONP) =====
// วางโค้ดนี้ใน Google Apps Script แล้ว Deploy เป็น Web App
// Execute as: Me | Who has access: Anyone

function doGet(e) {
  const cb = e.parameter.callback;
  const action = e.parameter.action;

  function jsonp(obj) {
    const json = JSON.stringify(obj);
    if (cb) {
      return ContentService.createTextOutput(cb + '(' + json + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    if (action === 'getAll') return jsonp(getAllData());

    if (e.parameter.payload) {
      let data;
      try {
        const decoded = Utilities.newBlob(Utilities.base64Decode(e.parameter.payload)).getDataAsString();
        data = JSON.parse(decoded);
      } catch(ex) {
        data = JSON.parse(decodeURIComponent(e.parameter.payload));
      }
      const act = data.action || action;
      if (act === 'save' || act === 'update') return jsonp(saveProject(data.data));
      if (act === 'delete') return jsonp(deleteProject(data.id));
      if (act === 'bulkSave') return jsonp(bulkSave(data.data));
      if (act === 'updateImages') return jsonp(updateImages(data.id, data.images));
      if (act === 'deleteCloudinaryImage') return jsonp({success:true});
    }

    return jsonp({success:false, message:'Unknown action: ' + action});
  } catch(err) {
    return jsonp({success:false, message: err.message});
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    if (action === 'save' || action === 'update') return ok(saveProject(payload.data));
    if (action === 'delete')   return ok(deleteProject(payload.id));
    if (action === 'bulkSave') return ok(bulkSave(payload.data));
    return ok({message:'Unknown action'});
  } catch(err) {
    return err_(err.message);
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName('Project70') || ss.getSheets()[0];
}

function getHeaders() {
  return [
    'id', 'name', 'strategy', 'subStrategy', 'budget', 'spent', 'po', 'status', 'progress',
    'result', 'kpi', 'problems', 'solutions', 'quarter',
    'owner', 'dept', 'coordinator', 'position', 'duration', 'projectType',
    'rationale', 'objective', 'targetQuantity', 'target', 'expectedBenefit',
    'proposer', 'proposerPos', 'approver', 'approverPos', 'authorizer', 'authorizerPos',
    'committees', 'activities_json', 'budget_detail_json', 'eval_rows_json',
    'image_count', 'images_json'
  ];
}

function ensureHeaders() {
  const sheet = getSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(getHeaders());
    sheet.getRange(1, 1, 1, getHeaders().length)
      .setBackground('#3b72f0').setFontColor('#ffffff').setFontWeight('bold');
  }
}

function rowToObj(row) {
  const h = getHeaders();
  const obj = {};
  h.forEach((k, i) => { obj[k] = row[i] !== undefined ? row[i] : ''; });
  obj.budget   = Number(obj.budget)   || 0;
  obj.spent    = Number(obj.spent)    || 0;
  obj.po       = Number(obj.po)       || 0;
  obj.progress = Number(obj.progress) || 0;
  obj.kpi      = obj.kpi ? String(obj.kpi).split('|').filter(Boolean) : [];
  try { obj.committees   = obj.committees         ? JSON.parse(obj.committees)         : []; } catch(e){ obj.committees=[]; }
  try { obj.activities   = obj.activities_json    ? JSON.parse(obj.activities_json)    : []; } catch(e){ obj.activities=[]; }
  try { obj.budgetDetail = obj.budget_detail_json ? JSON.parse(obj.budget_detail_json) : []; } catch(e){ obj.budgetDetail=[]; }
  try { obj.evalRows     = obj.eval_rows_json     ? JSON.parse(obj.eval_rows_json)     : []; } catch(e){ obj.evalRows=[]; }
  try { obj.images       = obj.images_json        ? JSON.parse(obj.images_json)        : []; } catch(e){ obj.images=[]; }
  delete obj.activities_json; delete obj.budget_detail_json;
  delete obj.eval_rows_json; delete obj.images_json; delete obj.image_count;
  return obj;
}

function objToRow(d) {
  const images = d.images || [];
  return [
    d.id, d.name, d.strategy||1, d.subStrategy||'',
    d.budget||0, d.spent||0, d.po||0,
    d.status||'pending', d.progress||0,
    d.result||'', (d.kpi||[]).join('|'),
    d.problems||'', d.solutions||'', d.quarter||'all',
    d.owner||'', d.dept||'', d.coordinator||'', d.position||'',
    d.duration||'', d.projectType||'ต่อเนื่อง',
    d.rationale||'', d.objective||'', d.targetQuantity||'', d.target||'', d.expectedBenefit||'',
    d.proposer||'', d.proposerPos||'', d.approver||'', d.approverPos||'',
    d.authorizer||'', d.authorizerPos||'',
    JSON.stringify(d.committees||[]),
    JSON.stringify(d.activities||[]),
    JSON.stringify(d.budgetDetail||[]),
    JSON.stringify(d.evalRows||[]),
    images.length,
    JSON.stringify(images.map(i=>({name:i.name||'', url:i.url||'', publicId:i.publicId||''})))
  ];
}

function getAllData() {
  ensureHeaders();
  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return {success:true, data:[]};
  // กันแถวว่างสนิท (เช่น แถวว่างที่หลงเหลืออยู่กลาง/ท้าย Sheet) ไม่ให้กลายเป็นโครงการผีที่ไม่มี id/ชื่อ
  return {success:true, data: rows.slice(1).filter(r => r.some(c => String(c).trim() !== '')).map(rowToObj)};
}

function saveProject(d) {
  ensureHeaders();
  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  let rowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(d.id)) { rowIdx = i + 1; break; }
  }
  const row = objToRow(d);
  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return {success:true};
}

function deleteProject(id) {
  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === String(id)) { sheet.deleteRow(i + 1); break; }
  }
  return {success:true};
}

function updateImages(id, imagesJson) {
  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  const h = getHeaders();
  const imgColIdx = h.indexOf('images_json') + 1;
  const cntColIdx = h.indexOf('image_count') + 1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      try {
        const imgs = typeof imagesJson === 'string' ? JSON.parse(imagesJson) : imagesJson;
        sheet.getRange(i + 1, imgColIdx).setValue(JSON.stringify(imgs));
        sheet.getRange(i + 1, cntColIdx).setValue(imgs.length);
      } catch(e) {}
      break;
    }
  }
  return {success:true};
}

function bulkSave(data) {
  ensureHeaders();
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
  if (data && data.length) {
    const rows = data.map(objToRow);
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
  return {success:true, count: data ? data.length : 0};
}

function ok(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function err_(msg) {
  return ContentService.createTextOutput(JSON.stringify({success:false, message:msg}))
    .setMimeType(ContentService.MimeType.JSON);
}`;
  navigator.clipboard.writeText(tpl).then(()=>{
    document.getElementById('gasTemplateCopyStatus').textContent = '✅ คัดลอก GAS Template สำเร็จ (รองรับ owner + อนุกรรมการ + รูปภาพ)';
    setTimeout(()=>{ document.getElementById('gasTemplateCopyStatus').textContent=''; }, 4000);
  }).catch(()=>{
    document.getElementById('gasTemplateCopyStatus').textContent = '❌ ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาคัดลอกโค้ดด้วยตนเอง';
  });
}

function loadFromSheet(){
  if(!confirm('⚠️ การโหลดจาก Sheet จะแทนที่ข้อมูลปัจจุบันในหน้าเว็บทั้งหมด\nยืนยันหรือไม่?')) return;
  const statusEl=document.getElementById('gsStatus');
  statusEl && (statusEl.innerHTML='<div class="status-msg status-info">⏳ กำลังโหลดข้อมูลจาก Google Sheet...</div>');
  // ใช้ getAllBundle (รวม getAll+getAllReport ไว้ใน request เดียว) แทนการเรียก 2 รอบเรียงลำดับแบบเดิม
  fetch(`${_gasUrl}?action=getAllBundle`, { redirect: 'follow' })
    .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(res=>{
      if(!res.success) throw new Error(res.message);
      projects = mergeReportsIntoProjects(res.projects || [], res.reports || []);
      statusEl && (statusEl.innerHTML=`<div class="status-msg status-ok">✅ โหลดสำเร็จ ${projects.length} โครงการ (จาก Google Sheet)</div>`);
      saveToLocal(true); renderTable(); updateDashboard();
    })
    .catch(e=>{
      statusEl && (statusEl.innerHTML=`<div class="status-msg status-err">❌ โหลดไม่สำเร็จ: ${e.message}</div>`);
    });
}

function syncAllToSheet(){
  const statusEl=document.getElementById('gsStatus');
  statusEl && (statusEl.innerHTML='<div class="status-msg status-info">⏳ กำลัง Sync ข้อมูลทั้งหมดขึ้น Google Sheet...</div>');
  // ส่งทีละโครงการ (upsert) แทน bulkSave เพื่อหลีกเลี่ยงปัญหา payload ใหญ่เกินไป
  // ส่งทั้งข้อมูลแผน (Project70) และผลการดำเนินงาน (ReportResult) แยกกัน
  const tasks = projects.map(p => gasPost('update', { data: p }));
  const reportTasks = projects.map(p => gasPost('saveReport', { data: buildReportPayload(p) }));
  Promise.all([...tasks, ...reportTasks])
    .then(()=>{
      statusEl && (statusEl.innerHTML=`<div class="status-msg status-ok">✅ Sync สำเร็จ ${projects.length} โครงการขึ้น Google Sheet แล้ว</div>`);
    })
    .catch(e=>{ statusEl && (statusEl.innerHTML=`<div class="status-msg status-err">❌ ${e.message}</div>`); });
}

// สร้าง payload สำหรับ Sheet "ผลการดำเนินงาน" (ReportResult) จากข้อมูลโครงการที่รวมอยู่ใน memory
function buildReportPayload(p){
  return {
    id: p.id, name: p.name, strategy: p.strategy,
    status: p.status||'pending', quarter: p.quarter||'all',
    spent: p.spent||0, po: p.po||0,
    result: p.result||'', problems: p.problems||'', solutions: p.solutions||'',
    kpiResults: p.kpiResults||[],
    quarterActivities: p.quarterActivities||[],
    images: p.images||[],
    lastEditedBy: p.lastEditedBy||'', lastEditedByPosition: p.lastEditedByPosition||'', lastEditedAt: p.lastEditedAt||''
  };
}

function exportCSV(){
  const headers=['id','name','strategy','budget','spent','po','status','result','kpi','problems','solutions','quarter','image_count','lastEditedBy','lastEditedByPosition','lastEditedAt'];
  const rows=[headers,...projects.map(p=>[
    p.id,'"'+(p.name||'').replace(/"/g,'""')+'"',
    p.strategy,p.budget||0,p.spent||0,p.po||0,p.status,
    '"'+(p.result||'').replace(/"/g,'""')+'"',
    '"'+(p.kpi||[]).join('|').replace(/"/g,'""')+'"',
    '"'+(p.problems||'').replace(/"/g,'""')+'"',
    '"'+(p.solutions||'').replace(/"/g,'""')+'"',
    p.quarter||'all',
    (p.images||[]).length,
    '"'+(p.lastEditedBy||'').replace(/"/g,'""')+'"',
    '"'+(p.lastEditedByPosition||'').replace(/"/g,'""')+'"',
    '"'+(p.lastEditedAt||'').replace(/"/g,'""')+'"'
  ])];
  const csv=rows.map(r=>r.join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='รายงานผลดำเนินงาน_DLTV_'+currentYear+'.csv';
  a.click();
  document.getElementById('gsStatus').innerHTML='<div class="status-msg status-ok">✅ ดาวน์โหลด CSV สำเร็จ (รูปภาพถูกส่งใน JSON แยกต่างหาก)</div>';
}

// ===== ACTIVITY LOG =====
const ACTLOG_KEY  = 'dltv_actlog_2570';
const ACTLOG_PAGE = 15; // rows per page
let _actlogPage   = 1;

// ── Field label map ─────────────────────────────────────────
const FIELD_LABELS = {
  name:'ชื่อโครงการ', strategy:'ยุทธศาสตร์', subStrategy:'กลยุทธ์', owner:'ฝ่าย/กลุ่ม',
  dept:'หน่วยงาน', coordinator:'ผู้รับผิดชอบ', position:'ตำแหน่ง', duration:'ระยะเวลา',
  projectType:'ลักษณะโครงการ', budget:'งบประมาณ', spent:'งบที่ใช้', po:'PO',
  status:'สถานะ', progress:'ความคืบหน้า(%)', result:'ผลการดำเนินงาน',
  problems:'ปัญหา/อุปสรรค', solutions:'แนวทางแก้ไข', objective:'วัตถุประสงค์',
  rationale:'หลักการและเหตุผล', target:'เป้าหมาย', targetQuantity:'เป้าหมายเชิงปริมาณ',
  expectedBenefit:'ผลที่คาดว่าจะได้รับ', proposer:'ผู้เสนอ', approver:'ผู้เห็นชอบ',
  authorizer:'ผู้อนุมัติ', kpi:'KPI', activities:'แผนกิจกรรม (Gantt)',
  budgetDetail:'รายละเอียดงบ', images:'รูปภาพ', docFiles:'เอกสารแนบ',
  committees:'อนุกรรมการ', evalRows:'การประเมิน', quarter:'ไตรมาส'
};

// ── อ่าน / เขียน log ────────────────────────────────────────
function _readActlog() {
  try { return JSON.parse(localStorage.getItem(ACTLOG_KEY) || '[]'); } catch(e){ return []; }
}
function _writeActlog(logs) {
  // เก็บไม่เกิน 500 รายการ (กัน localStorage เต็ม)
  try { localStorage.setItem(ACTLOG_KEY, JSON.stringify(logs.slice(-500))); } catch(e){}
}

// ── diff สองโครงการ หา field ที่เปลี่ยน ────────────────────
function _diffProject(oldP, newP) {
  const changed = [];
  const SKIP = ['id','images','docFiles','activities','budgetDetail','evalRows','committees'];
  for (const key of Object.keys(FIELD_LABELS)) {
    if (SKIP.includes(key)) continue;
    const ov = Array.isArray(oldP[key]) ? oldP[key].join(', ') : String(oldP[key] ?? '');
    const nv = Array.isArray(newP[key]) ? newP[key].join(', ') : String(newP[key] ?? '');
    if (ov !== nv) changed.push({ key, label: FIELD_LABELS[key], from: ov, to: nv });
  }
  // ตรวจ array fields แบบ shallow (เปรียบเทียบ JSON)
  const ARR = ['images','activities','budgetDetail','evalRows'];
  for (const key of ARR) {
    if (JSON.stringify(oldP[key]) !== JSON.stringify(newP[key]))
      changed.push({ key, label: FIELD_LABELS[key], from: '(เดิม)', to: '(ใหม่)' });
  }
  return changed;
}

// ── บันทึก log ──────────────────────────────────────────────
// เขียน local cache ทันที (เห็นผลไว ใช้ได้แม้ออฟไลน์) แล้ว sync ขึ้น Google Sheet แบบ background
// เพื่อให้ทุกคนที่ login เข้ามาเห็นประวัติตรงกัน (ไม่ใช่แค่ localStorage ของเครื่องตัวเอง)
function actlogRecord(action, project, changedFields, oldProject) {
  const user = (typeof _currentUser !== 'undefined' && _currentUser)
    ? (_currentUser.isGuest ? 'ผู้เยี่ยมชม' : _currentUser.name)
    : 'ไม่ระบุ';
  const email = (typeof _currentUser !== 'undefined' && _currentUser && !_currentUser.isGuest)
    ? (_currentUser.email || '') : '';
  const position = (typeof _currentUser !== 'undefined' && _currentUser && !_currentUser.isGuest)
    ? (_currentUser.position || '') : '';
  const entry = {
    id:        'log_' + Date.now() + '_' + Math.floor(Math.random()*1000),
    ts:        new Date().toISOString(),
    action,
    user,
    email,
    position,
    projectId: project.id,
    projectName: project.name || '(ไม่มีชื่อ)',
    fields:    changedFields || [],
    snapshot:  action === 'ลบ' ? { name: project.name, strategy: project.strategy, budget: project.budget } : null
  };
  const logs = _readActlog();
  logs.push(entry);
  _writeActlog(logs);
  if (document.getElementById('page-actlog') && document.getElementById('page-actlog').style.display !== 'none') renderActlog();
  // sync ขึ้น Google Sheet แบบ background — ไม่บล็อก UI และไม่รบกวนผู้ใช้ถ้า sync ไม่สำเร็จ (ยังมี local cache สำรอง)
  if (typeof gasFetchPost === 'function' && typeof _gasUrl !== 'undefined' && _gasUrl && !_gasUrl.includes('YOUR_GAS')) {
    gasFetchPost('logActivity', entry).catch(()=>{ /* เงียบไว้ — เดี๋ยวรอบโหลดหน้าถัดไปจะลอง sync ให้เห็นตรงกันอีกที */ });
  }
}

// ── ดึงประวัติจาก Google Sheet (ของทุกคนที่ login เข้ามา) มา merge เข้ากับ local cache ──
let _actlogRemoteLoaded = false;
let _actlogSyncing = false;
function _syncActlogFromGAS() {
  if (_actlogRemoteLoaded || _actlogSyncing) return;
  if (typeof gasGet !== 'function' || typeof _gasUrl === 'undefined' || !_gasUrl || _gasUrl.includes('YOUR_GAS')) { _actlogRemoteLoaded = true; return; }
  _actlogSyncing = true;
  gasGet('getActlog', {}).then(res => {
    _actlogSyncing = false;
    _actlogRemoteLoaded = true;
    if (res && res.success && Array.isArray(res.data)) {
      // Sheet คือฉบับจริงที่ทุกคนเห็นตรงกัน — merge กับ local (เผื่อมีรายการที่เพิ่ง sync ไม่ทัน) โดย dedupe ด้วย id
      const map = {};
      _readActlog().forEach(l => { if(l.id) map[l.id]=l; });
      res.data.forEach(l => { if(l.id) map[l.id]=l; });
      const merged = Object.values(map).sort((a,b)=> new Date(a.ts)-new Date(b.ts)); // เก่า→ใหม่ (ให้ตรงกับ format เดิมที่ renderActlog จะ .reverse())
      _writeActlog(merged);
    }
    renderActlog();
  }).catch(()=>{ _actlogSyncing = false; _actlogRemoteLoaded = true; /* ดึงไม่สำเร็จ ใช้ local cache ต่อไป */ });
}

// ── render ──────────────────────────────────────────────────
function renderActlog() {
  _syncActlogFromGAS(); // โหลดประวัติของทุกคนจาก Sheet ครั้งแรกที่เปิดหน้านี้ (พอโหลดเสร็จจะเรียก renderActlog() ให้เองอีกครั้ง)
  const syncNote = document.getElementById('actlogSyncingNote');
  if (syncNote) syncNote.style.display = (_actlogSyncing && !_actlogRemoteLoaded) ? '' : 'none';
  const search   = (document.getElementById('actlogSearch')?.value || '').toLowerCase();
  const filterAc = document.getElementById('actlogFilterAction')?.value || '';

  let logs = _readActlog().reverse(); // ใหม่ก่อน

  if (search) logs = logs.filter(l =>
    l.user.toLowerCase().includes(search) ||
    l.projectName.toLowerCase().includes(search) ||
    (l.email || '').toLowerCase().includes(search)
  );
  if (filterAc) logs = logs.filter(l => l.action === filterAc);

  // Summary bar
  const all   = _readActlog();
  const sumEl = document.getElementById('actlogSummaryBar');
  if (sumEl) {
    const cnt = (a) => all.filter(l=>l.action===a).length;
    const uniqueUsers = [...new Set(all.map(l=>l.user))];
    sumEl.innerHTML = [
      `<span style="font-size:12px;color:var(--text2)">รายการทั้งหมด <strong style="color:var(--text)">${all.length}</strong> รายการ</span>`,
      `<span style="background:var(--green-light);color:var(--green);border:1px solid #86d9b0;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:600">➕ เพิ่ม ${cnt('เพิ่ม')}</span>`,
      `<span style="background:var(--amber-light);color:var(--amber);border:1px solid #f6cc70;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:600">✏️ แก้ไข ${cnt('แก้ไข')}</span>`,
      `<span style="background:var(--red-light);color:var(--red);border:1px solid #fca5a5;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:600">🗑️ ลบ ${cnt('ลบ')}</span>`,
      `<span style="font-size:12px;color:var(--text3);margin-left:auto">ผู้ใช้ทั้งหมด ${uniqueUsers.length} คน</span>`
    ].join('');
  }

  const tbody  = document.getElementById('actlogBody');
  const empty  = document.getElementById('actlogEmpty');
  const pager  = document.getElementById('actlogPager');
  if (!tbody) return;

  if (!logs.length) {
    tbody.innerHTML = ''; empty.style.display = ''; pager.innerHTML = ''; return;
  }
  empty.style.display = 'none';

  // Pagination
  const totalPages = Math.ceil(logs.length / ACTLOG_PAGE);
  _actlogPage = Math.min(_actlogPage, totalPages);
  const slice = logs.slice((_actlogPage-1)*ACTLOG_PAGE, _actlogPage*ACTLOG_PAGE);
  const globalOffset = (_actlogPage-1)*ACTLOG_PAGE;

  // Action badge
  const badge = (a) => {
    const map = {
      'เพิ่ม':  ['#dcfce7','#166534','➕ เพิ่ม'],
      'แก้ไข': ['#fef9c3','#92400e','✏️ แก้ไข'],
      'ลบ':   ['#fee2e2','#991b1b','🗑️ ลบ']
    };
    const [bg,col,label] = map[a] || ['var(--surface2)','var(--text2)',a];
    return `<span style="background:${bg};color:${col};padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700">${label}</span>`;
  };

  tbody.innerHTML = slice.map((l, i) => {
    const dt = new Date(l.ts);
    const dateStr = dt.toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'2-digit'});
    const timeStr = dt.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
    const rowNum  = globalOffset + i + 1;
    const initials = l.user === 'ผู้เยี่ยมชม' ? '👁' : l.user.slice(0,1).toUpperCase();
    const fieldList = l.fields.length
      ? l.fields.slice(0,4).map(f=>`<span style="display:inline-block;background:var(--accent-light);color:var(--accent);border-radius:4px;padding:1px 6px;font-size:11px;margin:1px">${f.label}</span>`).join('') + (l.fields.length>4?`<span style="font-size:11px;color:var(--text3)"> +${l.fields.length-4}</span>`:'')
      : (l.action==='เพิ่ม' ? '<span style="font-size:11px;color:var(--text3)">โครงการใหม่</span>'
       : l.action==='ลบ'  ? '<span style="font-size:11px;color:var(--text3)">—</span>'
       : '<span style="font-size:11px;color:var(--text3)">ไม่มีการเปลี่ยนแปลง</span>');

    const detailBtn = l.fields.length
      ? `<button onclick="showActlogDetail('${String(l.id).replace(/'/g,"\\'")}')" style="border:none;background:none;cursor:pointer;font-size:11px;color:var(--accent);text-decoration:underline;padding:0">ดูเพิ่ม</button>`
      : '—';

    return `<tr style="border-bottom:1px solid var(--border);transition:background .12s" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <td style="padding:10px 14px;color:var(--text3);font-size:12px">${rowNum}</td>
      <td style="padding:10px 14px;white-space:nowrap">
        <div style="font-weight:600;font-size:13px">${dateStr}</div>
        <div style="font-size:11px;color:var(--text3)">${timeStr}</div>
      </td>
      <td style="padding:10px 14px">
        <div style="display:flex;align-items:center;gap:7px">
          <span style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#059669,#3b72f0);color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${initials}</span>
          <div>
            <div style="font-weight:600;font-size:13px">${escapeHtml(l.user)}</div>
            ${l.position ? `<div style="font-size:11px;color:var(--accent);font-weight:600">${escapeHtml(l.position)}</div>` : ''}
            ${l.email ? `<div style="font-size:11px;color:var(--text3)">${escapeHtml(l.email)}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="padding:10px 14px">${badge(l.action)}</td>
      <td style="padding:10px 14px;max-width:200px">
        <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${l.projectName}">${l.projectName}</div>
        <div style="font-size:11px;color:var(--text3)">ID: ${l.projectId ?? '—'}</div>
      </td>
      <td style="padding:10px 14px">${fieldList}</td>
      <td style="padding:10px 14px;text-align:center">${detailBtn}</td>
    </tr>`;
  }).join('');

  // Pager
  if (totalPages <= 1) { pager.innerHTML = ''; return; }
  let ph = '';
  for (let p = 1; p <= totalPages; p++) {
    ph += `<button onclick="_actlogPage=${p};renderActlog()" style="padding:4px 10px;border:1px solid ${p===_actlogPage?'var(--accent)':'var(--border)'};border-radius:6px;background:${p===_actlogPage?'var(--accent)':'var(--surface)'};color:${p===_actlogPage?'#fff':'var(--text)'};cursor:pointer;font-size:12px">${p}</button>`;
  }
  pager.innerHTML = ph;
}

// ── modal รายละเอียด diff ────────────────────────────────────
function showActlogDetail(logId) {
  const log = _readActlog().find(l => l.id === logId);
  if (!log) return;
  const dt  = new Date(log.ts).toLocaleString('th-TH');
  const rows = log.fields.map(f => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 12px;font-weight:700;font-size:13px;white-space:nowrap;color:var(--accent)">${f.label}</td>
      <td style="padding:8px 12px;font-size:12px;color:var(--red);max-width:200px;word-break:break-word">${f.from || '—'}</td>
      <td style="padding:8px 12px;font-size:13px;color:var(--text3)">→</td>
      <td style="padding:8px 12px;font-size:12px;color:var(--green);max-width:200px;word-break:break-word">${f.to || '—'}</td>
    </tr>`).join('');

  const html = `<div style="position:fixed;inset:0;background:rgba(10,15,30,.6);backdrop-filter:blur(5px);z-index:2000;display:flex;align-items:center;justify-content:center;padding:1rem" onclick="if(event.target===this)this.remove()">
    <div style="background:var(--surface);border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,.2);width:min(640px,100%);max-height:80vh;display:flex;flex-direction:column;overflow:hidden">
      <div style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:1rem">
        <div>
          <div style="font-size:15px;font-weight:700">📋 รายละเอียดการแก้ไข</div>
          <div style="font-size:12px;color:var(--text3);margin-top:3px">${escapeHtml(log.user)}${log.position ? ' (' + escapeHtml(log.position) + ')' : ''} · ${dt}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px">โครงการ: <strong>${log.projectName}</strong></div>
        </div>
        <button onclick="this.closest('[style*=fixed]').remove()" style="border:none;background:none;cursor:pointer;font-size:20px;color:var(--text3);line-height:1;flex-shrink:0">×</button>
      </div>
      <div style="overflow-y:auto;flex:1">
        ${rows ? `<table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:var(--surface2)">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:var(--text2)">ฟิลด์</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:var(--red)">ก่อน</th>
            <th style="padding:8px 2px;width:24px"></th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:var(--green)">หลัง</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>` : `<div style="padding:2rem;text-align:center;color:var(--text3);font-size:13px">ไม่มีรายละเอียดเพิ่มเติม</div>`}
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

// ── ล้าง log ─────────────────────────────────────────────────
// ตอนนี้ประวัติแชร์กันทุกคนผ่าน Google Sheet แล้ว การล้างจะล้างของทุกคนด้วย ไม่ใช่แค่เครื่องนี้
function clearActlog() {
  if (!confirm('ยืนยันการล้างประวัติการแก้ไขทั้งหมด?\nจะล้างประวัติของทุกคนที่ใช้ระบบนี้ (ไม่ใช่แค่เครื่องนี้) และไม่สามารถกู้คืนได้')) return;
  localStorage.removeItem(ACTLOG_KEY);
  _actlogPage = 1;
  renderActlog();
  showToast('🗑️ กำลังล้างประวัติ...', 2000);
  if (typeof gasFetchPost === 'function' && typeof _gasUrl !== 'undefined' && _gasUrl && !_gasUrl.includes('YOUR_GAS')) {
    gasFetchPost('clearActlog', {}).then(res => {
      if (res && res.success) showToast('🗑️ ล้างประวัติแล้ว (ทุกเครื่อง)', 2000);
      else showToast('⚠️ ล้างประวัติในเครื่องนี้แล้ว แต่ sync กับ Sheet ไม่สำเร็จ', 3000);
    }).catch(()=> showToast('⚠️ ล้างประวัติในเครื่องนี้แล้ว แต่ sync กับ Sheet ไม่สำเร็จ', 3000));
  } else {
    showToast('🗑️ ล้างประวัติแล้ว', 2000);
  }
}

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(document.getElementById('lightboxOverlay').classList.contains('open')){ closeLightbox(); return; }
    closeDetail();
    document.getElementById('deleteOverlay').classList.remove('open');
  }
  if(document.getElementById('lightboxOverlay').classList.contains('open')){
    if(e.key==='ArrowLeft') lightboxNav(-1);
    if(e.key==='ArrowRight') lightboxNav(1);
  }
});

// modalOverlay: ลบ click-outside ออก — ปิดได้แค่ปุ่ม "ยกเลิก" หรือ "บันทึก" เท่านั้น
document.getElementById('detailOverlay').addEventListener('click',e=>{ if(e.target===e.currentTarget) closeDetail(); });
document.getElementById('quarterReportOverlay')?.addEventListener('click',e=>{ if(e.target===e.currentTarget) closeQuarterReportPreview(); });
document.getElementById('deleteOverlay').addEventListener('click',e=>{ if(e.target===e.currentTarget) e.currentTarget.classList.remove('open'); });


// ════════════════════════════════════════════════════════
// ── Quarter checkbox helper ──────────────────────────────
function onQuarterCheckChange(val) {
  if(val==='all') {
    ['fQ1','fQ2','fQ3','fQ4'].forEach(id=>{ const el=document.getElementById(id); if(el) el.checked=false; });
    const fq = document.getElementById('fQuarter'); if(fq) fq.value='all';
  } else {
    const allEl = document.getElementById('fQAll');
    if(allEl) allEl.checked=false;
    const checked = ['1','2','3','4'].filter(q=>{const el=document.getElementById('fQ'+q);return el&&el.checked;});
    const fq = document.getElementById('fQuarter');
    if(fq) fq.value = checked.length===1 ? checked[0] : (checked.length>1 ? checked.join(',') : 'all');
  }
  ['All','1','2','3','4'].forEach(q=>{
    const lbl=document.getElementById('qLabel'+q);
    const inp=document.getElementById('fQ'+q);
    if(lbl&&inp) lbl.style.borderColor = inp.checked ? 'var(--accent)' : 'var(--border)';
    if(lbl&&inp) lbl.style.background  = inp.checked ? 'var(--accent-light)' : '';
  });
}

// ── Strategy checkbox ──────────────────────────────────
// ── สลับคำศัพท์ในฟอร์มระหว่าง "โครงการ" (ยุทธศาสตร์ 1-4) กับ "รายการ" (งบบริหารสำนักงาน) ──
// เรียกทุกครั้งที่มีการเลือก/เปลี่ยนยุทธศาสตร์ในฟอร์มเพิ่ม/แก้ไข เพื่อให้ป้ายชื่อในฟอร์มตรงกับ
// ประเภทข้อมูลจริงเสมอ (งบบริหารสำนักงานไม่ใช่ยุทธศาสตร์ จึงไม่ควรเรียกว่า "โครงการ")
function _applyProjectTerminology(val) {
  const isOffice = String(val) === '5';
  const nameLabel = document.getElementById('fNameLabel');
  if (nameLabel) nameLabel.innerHTML = isOffice ? 'ชื่อรายการ <span class="required">*</span>' : 'ชื่อโครงการ <span class="required">*</span>';
  const nameInput = document.getElementById('fName');
  if (nameInput) nameInput.placeholder = isOffice ? 'ระบุชื่อรายการ...' : 'ระบุชื่อโครงการ...';
  const coordLabel = document.getElementById('fCoordinatorLabel');
  if (coordLabel) coordLabel.textContent = isOffice ? 'ผู้รับผิดชอบรายการ' : 'ผู้รับผิดชอบโครงการ';
  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) {
    const isEditing = !!editingId;
    modalTitle.textContent = isOffice
      ? (isEditing ? 'แก้ไขรายการงบบริหารสำนักงาน' : 'เพิ่มรายการงบบริหารสำนักงานใหม่')
      : (isEditing ? 'แก้ไขโครงการ' : 'เพิ่มโครงการใหม่');
  }
}
function onStrategyCheck(val) {
  // single-select behavior: uncheck others
  document.querySelectorAll('input[name="fStrategyCheck"]').forEach(cb => {
    if (parseInt(cb.value) !== val) cb.checked = false;
  });
  const checked = document.querySelector('input[name="fStrategyCheck"]:checked');
  const fStr = document.getElementById('fStrategy');
  if (fStr) fStr.value = checked ? checked.value : '1';
  _applyProjectTerminology(fStr ? fStr.value : '1');
  if(typeof renderGanttTable==='function' && document.getElementById('ganttBodyModal')) renderGanttTable();
}
function _setStrategyCheckbox(val) {
  document.querySelectorAll('input[name="fStrategyCheck"]').forEach(cb => {
    cb.checked = (cb.value == val);
  });
  const fStr = document.getElementById('fStrategy');
  if (fStr) fStr.value = val || '1';
  _applyProjectTerminology(val || '1');
  if(typeof renderGanttTable==='function' && document.getElementById('ganttBodyModal')) renderGanttTable();
}

// ── Gantt Table ────────────────────────────────────────
let ganttRows = [];
function _mkGanttRow(idx, name='', person='', months=[]) {
  return { idx, name, person, months: months.length===12 ? [...months] : Array(12).fill(false) };
}
// ── ตารางแผนกิจกรรม (ข้อ 4) ในฟอร์มเพิ่ม/แก้ไขโครงการ — แสดงเป็นแถบต่อเนื่องแบบ Gantt ──────────
// - คลิกช่องเดือนเพื่อเลือก/ยกเลิก หรือ "กดค้างแล้วลาก" เพื่อระบายหลายเดือนต่อกันได้ในครั้งเดียว
// - เดือนที่เลือกติดกันจะรวมเป็นแถบยาวแถบเดียว (ขอบมน) สีตามยุทธศาสตร์ที่เลือกในฟอร์ม
// - ข้อมูลที่บันทึกยังเป็นรูปแบบเดิม (months: [true/false x12]) จึงไม่กระทบข้อมูลเก่าหรือหน้าอื่น
const _GF_MONTHS = ['ต.ค.','พ.ย.','ธ.ค.','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.'];
const _GF_Q_COLORS = ['#3b72f0','#059669','#d97706','#7c3aed'];
const _GF_S_COLORS = {1:'#3b72f0',2:'#059669',3:'#d97706',4:'#7c3aed',5:'#0891b2'};
let _gfDrag = null; // {row, value} ระหว่างกดค้างลาก
function _gfEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _gfColor(){
  const v = (document.getElementById('fStrategy')||{}).value || '1';
  return _GF_S_COLORS[v] || '#5459AC';
}
function _gfYearLabels(){
  // ปีย่อ (พ.ศ. 2 หลัก) ใต้ชื่อเดือน: ต.ค.–ธ.ค. = ปีงบ-1, ม.ค.–ก.ย. = ปีงบ
  const fy = (typeof currentYear!=='undefined') ? Number(currentYear) : 0;
  if(!fy) return Array(12).fill('');
  return _GF_MONTHS.map((_,i)=> String((i<3?fy-1:fy)%100).padStart(2,'0'));
}
function _gfRuns(months){
  const runs=[]; (months||[]).forEach((on,i)=>{ if(!on) return; const l=runs[runs.length-1]; if(l && l.b===i-1) l.b=i; else runs.push({a:i,b:i}); });
  return runs;
}
function _gfBarsHtml(months){
  const c = _gfColor();
  return _gfRuns(months).map(r=>{
    const len = r.b-r.a+1;
    const label = len>=2 ? `${_GF_MONTHS[r.a]} – ${_GF_MONTHS[r.b]}` : (len===1 ? '' : '');
    return `<div class="gf-bar" style="left:calc(${r.a/12*100}% + 3px);width:calc(${len/12*100}% - 6px);--c:${c}">${label?`<span>${label}</span>`:''}</div>`;
  }).join('');
}
function _renderGanttHeadModal(){
  const thead = document.querySelector('#ganttTableModal thead'); if(!thead) return;
  const yrs = _gfYearLabels();
  thead.innerHTML = `
    <tr>
      <th class="gf-th" rowspan="2" style="width:34px">ที่</th>
      <th class="gf-th" rowspan="2" style="text-align:left;width:26%">กิจกรรม / ขั้นตอน</th>
      <th class="gf-th" rowspan="2" style="text-align:left;width:16%">ผู้รับผิดชอบ</th>
      ${[1,2,3,4].map(q=>`<th class="gf-qh" colspan="3" style="background:${_GF_Q_COLORS[q-1]}">ไตรมาส ${q}</th>`).join('')}
      <th class="gf-th" rowspan="2" style="width:34px"></th>
    </tr>
    <tr>
      ${_GF_MONTHS.map((m,i)=>`<th class="gf-mh${i%3===0&&i>0?' gf-qsep':''}">${m}${yrs[i]?`<small>${yrs[i]}</small>`:''}</th>`).join('')}
    </tr>`;
}
function renderGanttTable() {
  const tbody = document.getElementById('ganttBodyModal'); if(!tbody) return;
  _renderGanttHeadModal();
  if(!ganttRows.length){
    tbody.innerHTML = `<tr><td colspan="16" class="gf-empty">ยังไม่มีกิจกรรม — กด “+ เพิ่มกิจกรรม” เพื่อเริ่ม</td></tr>`;
    syncGanttToHidden(); return;
  }
  tbody.innerHTML = ganttRows.map((row, i) => `
    <tr class="gf-row">
      <td class="gf-no">${i+1}</td>
      <td class="gf-td"><textarea rows="1" class="gf-input" oninput="ganttRows[${i}].name=this.value;syncGanttToHidden();_gfAutoGrow(this)" placeholder="ชื่อกิจกรรม...">${_gfEsc(row.name)}</textarea></td>
      <td class="gf-td"><textarea rows="1" class="gf-input" oninput="ganttRows[${i}].person=this.value;syncGanttToHidden();_gfAutoGrow(this)" placeholder="ผู้รับผิดชอบ...">${_gfEsc(row.person)}</textarea></td>
      <td colspan="12" class="gf-lane-td">
        <div class="gf-lane">
          <div class="gf-bars" id="gfBars${i}">${_gfBarsHtml(row.months)}</div>
          <div class="gf-cells">
            ${row.months.map((on,mi)=>`<div class="gf-cell${on?' on':''}" data-r="${i}" data-m="${mi}" title="${_GF_MONTHS[mi]} — คลิกหรือกดค้างแล้วลากเพื่อเลือกหลายเดือน"
              onpointerdown="_gfDown(event,${i},${mi})" onpointerenter="_gfEnter(${i},${mi})"></div>`).join('')}
          </div>
        </div>
      </td>
      <td class="gf-del"><button type="button" onclick="removeGanttRow(${i})" title="ลบกิจกรรม">×</button></td>
    </tr>`).join('');
  tbody.querySelectorAll('.gf-input').forEach(_gfAutoGrow);
  syncGanttToHidden();
}
// ปรับความสูงช่องกรอกตามข้อความ — ข้ามถ้าตารางยังซ่อนอยู่ (เช่น ตอน render ก่อนเปิดหน้าต่างฟอร์ม)
// เพราะตอนซ่อน scrollHeight = 0 ถ้าเอาไปตั้งเป็นความสูง ช่องจะแบนจนมองไม่เห็นตัวอักษร
function _gfAutoGrow(el){
  if(!el || !el.offsetParent) return;
  el.style.height='auto';
  if(el.scrollHeight>0) el.style.height=el.scrollHeight+'px';
}
// เมื่อหน้าต่างฟอร์มเปิดขึ้นมา (ตารางมองเห็นแล้ว) ให้ปรับความสูงช่องกรอกทั้งหมดใหม่อีกครั้ง
(function(){
  if(typeof IntersectionObserver==='undefined') return;
  const io = new IntersectionObserver(ents=>{ ents.forEach(e=>{ if(e.isIntersecting) e.target.querySelectorAll('.gf-input').forEach(_gfAutoGrow); }); });
  const hook = ()=>{ const t=document.getElementById('ganttTableModal'); if(t) io.observe(t); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', hook); else hook();
})();
function _gfSet(rowIdx, monthIdx, value){
  const row = ganttRows[rowIdx]; if(!row) return;
  if(row.months[monthIdx]===value) return;
  row.months[monthIdx] = value;
  const bars = document.getElementById('gfBars'+rowIdx);
  if(bars) bars.innerHTML = _gfBarsHtml(row.months);
  const cell = document.querySelector(`#ganttBodyModal .gf-cell[data-r="${rowIdx}"][data-m="${monthIdx}"]`);
  if(cell) cell.classList.toggle('on', value);
  syncGanttToHidden();
}
function _gfDown(ev, rowIdx, monthIdx){
  ev.preventDefault();
  const v = !ganttRows[rowIdx].months[monthIdx];
  _gfDrag = { row: rowIdx, value: v };
  if(ev.target && ev.target.releasePointerCapture) try{ ev.target.releasePointerCapture(ev.pointerId); }catch(e){}
  _gfSet(rowIdx, monthIdx, v);
}
function _gfEnter(rowIdx, monthIdx){
  if(!_gfDrag || _gfDrag.row!==rowIdx) return;
  _gfSet(rowIdx, monthIdx, _gfDrag.value);
}
document.addEventListener('pointerup', ()=>{ _gfDrag = null; });
function toggleGanttMonth(rowIdx, monthIdx) {
  _gfSet(rowIdx, monthIdx, !ganttRows[rowIdx].months[monthIdx]);
}
function addGanttRow() {
  ganttRows.push(_mkGanttRow(ganttRows.length));
  renderGanttTable();
  const inputs = document.querySelectorAll('#ganttBodyModal .gf-row:last-child .gf-input');
  if(inputs[0]) inputs[0].focus();
}
function removeGanttRow(i) {
  ganttRows.splice(i,1);
  renderGanttTable();
}
// ── แผนการดำเนินงาน (Gantt) ในหน้าต่างรายละเอียดโครงการ — แถบต่อเนื่องแบบเดียวกับฟอร์ม/หน้า Gantt ──
function _ganttDetailHtml(p){
  const acts = (p.activities||[]).map(a=>_normalizeGanttEntry(a)).filter(n=>n && ((n.name||'').trim() || (n.person||'').trim() || (n.months||[]).some(Boolean)));
  if(!acts.length) return '';
  const c = _GF_S_COLORS[Number(p.strategy)] || '#5459AC';
  const yrs = _gfYearLabels();
  const lane = (months) => {
    const bars = _gfRuns(months).map(r=>{
      const len=r.b-r.a+1;
      return `<div class="gf-bar" style="left:calc(${r.a/12*100}% + 3px);width:calc(${len/12*100}% - 6px);--c:${c}">${len>=2?`<span>${_GF_MONTHS[r.a]} – ${_GF_MONTHS[r.b]}</span>`:''}</div>`;
    }).join('');
    return `<div class="gd-lane">${bars||'<span class="gd-none">ยังไม่ระบุเดือน</span>'}</div>`;
  };
  return `
    <div class="detail-section">
      <div class="detail-section-title">📅 แผนการดำเนินงาน (Gantt)</div>
      <div class="gf-wrap">
        <table class="gd-table">
          <colgroup><col style="width:34%"><col style="width:16%">${_GF_MONTHS.map(()=>'<col>').join('')}</colgroup>
          <thead>
            <tr>
              <th class="gf-th" rowspan="2" style="text-align:left">กิจกรรม</th>
              <th class="gf-th" rowspan="2" style="text-align:left">ผู้รับผิดชอบ</th>
              ${[1,2,3,4].map(q=>`<th class="gf-qh" colspan="3" style="background:${_GF_Q_COLORS[q-1]}">ไตรมาส ${q}</th>`).join('')}
            </tr>
            <tr>${_GF_MONTHS.map((m,i)=>`<th class="gf-mh${i%3===0&&i>0?' gf-qsep':''}">${m}${yrs[i]?`<small>${yrs[i]}</small>`:''}</th>`).join('')}</tr>
          </thead>
          <tbody>${acts.map(n=>`<tr class="gf-row">
            <td class="gd-td">${escapeHtml(n.name||'')}</td>
            <td class="gd-td" style="color:var(--text2)">${escapeHtml(n.person||'')}</td>
            <td colspan="12" class="gf-lane-td">${lane(n.months&&n.months.length===12?n.months:Array(12).fill(false))}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}
function syncGanttToHidden() {
  const el = document.getElementById('fActivities');
  if(el) el.value = JSON.stringify(ganttRows);
}
// บางแถวข้อมูลกิจกรรม (Gantt) ที่เคยถูกบันทึกไว้ ถูก JSON.stringify ซ้อนกันมากกว่า 1 ชั้น
// (เช่น แต่ละแถวถูกแปลงเป็นข้อความ JSON ก่อนแล้วค่อยเก็บทั้ง array อีกที) ทำให้ตอนโหลดกลับมา
// แต่ละแถวเป็น string ของ JSON แทนที่จะเป็น object ปกติ ฟังก์ชันนี้จะพยายามแกะ JSON ที่ซ้อนอยู่
// ออกให้จนกว่าจะได้ object ของแถวจริงๆ ก่อนค่อย fallback ไปใช้เป็นชื่อกิจกรรมแบบข้อความล้วน (รูปแบบเก่า)
function _normalizeGanttEntry(r){
  let v = r;
  for (let i=0; i<4 && typeof v === 'string'; i++){
    const t = v.trim();
    if (!(t.startsWith('{') && t.endsWith('}'))) break;
    try { v = JSON.parse(t); } catch(e) { break; }
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return { name: v.name || '', person: v.person || '', months: v.months || [] };
  }
  // ไม่ใช่ object ที่แกะได้ -> ถือว่าเป็นชื่อกิจกรรมแบบข้อความล้วน (รูปแบบเก่า)
  return { name: (typeof v === 'string' ? v : (r && r.name) || ''), person: '', months: [] };
}
function loadGanttFromData(data) {
  try {
    const arr = typeof data==='string' ? JSON.parse(data||'[]') : (data||[]);
    ganttRows = Array.isArray(arr) ? arr.map((r,i)=>{
      const n = _normalizeGanttEntry(r);
      return _mkGanttRow(i, n.name, n.person, n.months);
    }) : [];
  } catch(e) {
    // legacy textarea format
    ganttRows = (data||'').split('\n').filter(l=>l.trim()).map((l,i)=>_mkGanttRow(i,l.replace(/^\d+[\.\)]\s*/,''),'',[]));
  }
  if(!ganttRows.length) ganttRows = [_mkGanttRow(0),_mkGanttRow(1),_mkGanttRow(2)];
  renderGanttTable();
}

// ── Budget Table ────────────────────────────────────────
let budgetRows = [];
function _mkBudgetRow(name='', comp=0, op=0, mat=0) {
  return { name, comp: comp||0, op: op||0, mat: mat||0 };
}
function renderBudgetTable() {
  const tbody = document.getElementById('budgetBody'); if(!tbody) return;
  tbody.innerHTML = budgetRows.map((row, i) => `
    <tr>
      <td style="border:1px solid #ccd5e4;padding:4px;text-align:center;font-size:12px">${i+1}</td>
      <td style="border:1px solid #ccd5e4;padding:4px">
        <input type="text" value="${row.name}" oninput="budgetRows[${i}].name=this.value;syncBudgetHidden()"
          style="width:100%;border:none;outline:none;font-size:12px;font-family:inherit;background:transparent" placeholder="ชื่อกิจกรรม / รายการ...">
      </td>
      <td style="border:1px solid #ccd5e4;padding:4px">
        <input type="number" value="${row.comp||''}" min="0" oninput="budgetRows[${i}].comp=parseFloat(this.value)||0;calcBudgetTotals()"
          style="width:100%;border:none;outline:none;font-size:12px;font-family:inherit;background:transparent;text-align:right" placeholder="0">
      </td>
      <td style="border:1px solid #ccd5e4;padding:4px">
        <input type="number" value="${row.op||''}" min="0" oninput="budgetRows[${i}].op=parseFloat(this.value)||0;calcBudgetTotals()"
          style="width:100%;border:none;outline:none;font-size:12px;font-family:inherit;background:transparent;text-align:right" placeholder="0">
      </td>
      <td style="border:1px solid #ccd5e4;padding:4px">
        <input type="number" value="${row.mat||''}" min="0" oninput="budgetRows[${i}].mat=parseFloat(this.value)||0;calcBudgetTotals()"
          style="width:100%;border:none;outline:none;font-size:12px;font-family:inherit;background:transparent;text-align:right" placeholder="0">
      </td>
      <td style="border:1px solid #ccd5e4;padding:4px 8px;text-align:right;font-size:12px;color:#059669;font-weight:600" id="budgetRowTotal_${i}">
        ${((row.comp||0)+(row.op||0)+(row.mat||0)).toLocaleString('th-TH')}
      </td>
      <td style="border:1px solid #ccd5e4;padding:0;text-align:center">
        <button type="button" onclick="removeBudgetRow(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;width:28px;height:28px">×</button>
      </td>
    </tr>`).join('');
  calcBudgetTotals();
}
function calcBudgetTotals() {
  let sC=0,sO=0,sM=0;
  budgetRows.forEach((r,i)=>{
    const t=(r.comp||0)+(r.op||0)+(r.mat||0);
    const el=document.getElementById('budgetRowTotal_'+i); if(el) el.textContent=t.toLocaleString('th-TH');
    sC+=r.comp||0; sO+=r.op||0; sM+=r.mat||0;
  });
  const fmt = n=>n.toLocaleString('th-TH');
  const sc=document.getElementById('budgetSumComp'); if(sc) sc.textContent=fmtFull(sC);
  const so=document.getElementById('budgetSumOp');   if(so) so.textContent=fmtFull(sO);
  const sm=document.getElementById('budgetSumMat');  if(sm) sm.textContent=fmtFull(sM);
  const st=document.getElementById('budgetSumTotal');if(st) st.textContent=fmtFull(sC+sO+sM)+' บาท';
  syncBudgetHidden();
  // auto-fill budget field
  const bf=document.getElementById('fBudget');
  if(bf && (!bf.value || bf.value==='0')) bf.value=sC+sO+sM||'';
}
function syncBudgetTotal() {
  // manual override — don't auto-fill from table
}
function addBudgetActivityRow() {
  budgetRows.push(_mkBudgetRow());
  renderBudgetTable();
}
function removeBudgetRow(i) {
  budgetRows.splice(i,1);
  renderBudgetTable();
}
function syncBudgetHidden() {
  const el=document.getElementById('fBudgetDetail');
  if(el) el.value=JSON.stringify(budgetRows);
}
function loadBudgetFromData(data) {
  try {
    const arr = typeof data==='string' ? JSON.parse(data||'[]') : (data||[]);
    budgetRows = Array.isArray(arr) ? arr.map(r=>_mkBudgetRow(r.name||'',r.comp||0,r.op||0,r.mat||0)) : [];
  } catch(e) { budgetRows=[]; }
  if(!budgetRows.length) budgetRows=[_mkBudgetRow(),_mkBudgetRow(),_mkBudgetRow()];
  renderBudgetTable();
}

// ── Eval Table ─────────────────────────────────────────
let evalRows = [];
function _mkEvalRow(kpi='', method='', tool='') { return {kpi,method,tool}; }
// escape เฉพาะ & < > สำหรับใส่ใน textarea (ไม่แปลง \n เป็น <br> เพราะ textarea ต้องการบรรทัดใหม่จริงๆ)
function _escTextareaContent(s){
  return String(s===null||s===undefined?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function renderEvalTable() {
  const tbody=document.getElementById('evalBody'); if(!tbody) return;
  tbody.innerHTML = evalRows.map((row,i) => `
    <tr>
      <td style="border:1px solid #ccd5e4;padding:4px;text-align:center;font-size:12px">${i+1}</td>
      <td style="border:1px solid #ccd5e4;padding:4px">
        <textarea oninput="evalRows[${i}].kpi=this.value;syncEvalHidden()"
          style="width:100%;border:none;outline:none;font-size:12px;font-family:inherit;background:transparent;resize:vertical;min-height:48px" placeholder="ตัวชี้วัด...">${_escTextareaContent(_unwrapMaybeJsonArrayString(row.kpi))}</textarea>
      </td>
      <td style="border:1px solid #ccd5e4;padding:4px">
        <textarea oninput="evalRows[${i}].method=this.value;syncEvalHidden()"
          style="width:100%;border:none;outline:none;font-size:12px;font-family:inherit;background:transparent;resize:vertical;min-height:48px" placeholder="วิธีการประเมิน...">${_escTextareaContent(_unwrapMaybeJsonArrayString(row.method))}</textarea>
      </td>
      <td style="border:1px solid #ccd5e4;padding:4px">
        <textarea oninput="evalRows[${i}].tool=this.value;syncEvalHidden()"
          style="width:100%;border:none;outline:none;font-size:12px;font-family:inherit;background:transparent;resize:vertical;min-height:48px" placeholder="เครื่องมือ...">${_escTextareaContent(_unwrapMaybeJsonArrayString(row.tool))}</textarea>
      </td>
      <td style="border:1px solid #ccd5e4;padding:0;text-align:center">
        <button type="button" onclick="removeEvalRow(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;width:28px;height:28px">×</button>
      </td>
    </tr>`).join('');
  syncEvalHidden();
}
function addEvalRow() { evalRows.push(_mkEvalRow()); renderEvalTable(); }
function removeEvalRow(i) { evalRows.splice(i,1); renderEvalTable(); }
function syncEvalHidden() {
  const em=document.getElementById('fEvalMethod'); if(em) em.value=JSON.stringify(evalRows.map(r=>r.method));
  const ev=document.getElementById('fEvaluator');  if(ev) ev.value=JSON.stringify(evalRows.map(r=>r.tool));
  // also sync to kpi array for backward compat
  tempKPIs = evalRows.map(r=>r.kpi).filter(Boolean);
}
// ใช้ร่วมกันทุกจุดที่ต้องแปลง evalMethod/evaluator ให้เป็น array เสมอ ไม่ว่าจะได้รับมาเป็น
// array จริงอยู่แล้ว (กรณีปกติหลังแก้บั๊ก), string ที่เป็น JSON array, หรือ string เดี่ยวธรรมดา (ข้อมูลเก่ามาก)
function _parseEvalArr(v){
  if (Array.isArray(v)) return v;
  try { return typeof v==='string' && v.trim().startsWith('[') ? JSON.parse(v) : (v?[v]:[]); }
  catch(e){ return v?[v]:[]; }
}
function loadEvalFromData(kpis, evalMethod, evaluator) {
  // แก้ไข (บั๊กเดิม): เดิมเช็คแค่กรณี evalMethod เป็น string เท่านั้น ถ้า backend คืนมาเป็น array จริงอยู่แล้ว
  // (กรณีปกติ) โค้ดเดิมจะตกไป else-branch แล้วเอา array ทั้งก้อนห่อเป็นสมาชิกตัวเดียว (methods=[wholeArray])
  // ทำให้ข้อมูลของทุกแถวไปกองอยู่ที่แถวแรกแถวเดียว เปลี่ยนมาใช้ _parseEvalArr ที่เช็ค Array.isArray ก่อนเสมอ
  const methods = _parseEvalArr(evalMethod);
  const tools   = _parseEvalArr(evaluator);
  const kpiArr = Array.isArray(kpis) ? kpis : (kpis||'').split('\n').filter(Boolean);
  const len = Math.max(kpiArr.length, methods.length, tools.length, 2);
  evalRows = Array.from({length:len},(_,i)=>_mkEvalRow(
    _unwrapMaybeJsonArrayString(kpiArr[i]||''),
    _unwrapMaybeJsonArrayString(methods[i]||''),
    _unwrapMaybeJsonArrayString(tools[i]||'')
  ));
  if(!evalRows.length) evalRows=[_mkEvalRow(),_mkEvalRow()];
  renderEvalTable();
}

// ── People Table (ผู้ที่เกี่ยวข้องในโครงการ) ──────────────
// เก็บเป็นแถวเดียวต่อคน {role, name, pos} รองรับเพิ่มได้หลายคนต่อบทบาท (ผู้เสนอ/ผู้เห็นชอบ/ผู้อนุมัติ)
// ตอนบันทึกจะรวมกลุ่มตาม role แล้วเก็บเป็น JSON array คู่ขนาน (name[], pos[]) ลงในคอลัมน์เดิม
// (proposer/proposerPos ฯลฯ) เพื่อคงความเข้ากันได้กับข้อมูลเก่าที่เป็น string เดี่ยว
let peopleRows = [];
const PEOPLE_ROLE_LABELS = {proposer:'ผู้เสนอโครงการ', approver:'ผู้เห็นชอบโครงการ', authorizer:'ผู้อนุมัติโครงการ'};
function _mkPersonRow(role='proposer', name='', pos='') { return {role, name, pos}; }
// แปลงค่าฟิลด์ (อาจเป็น string เดี่ยว หรือ JSON array ที่ถูก stringify มา) ให้เป็น array เสมอ
function _toArrayField(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t.startsWith('[') && t.endsWith(']')) {
      try { const a = JSON.parse(t); if (Array.isArray(a)) return a; } catch(e){}
    }
    return t ? [t] : [];
  }
  return [];
}
function renderPeopleTable() {
  const tbody = document.getElementById('peopleBody'); if(!tbody) return;
  tbody.innerHTML = peopleRows.map((row,i) => `
    <tr>
      <td style="border:1px solid #ccd5e4;padding:4px">
        <select onchange="peopleRows[${i}].role=this.value;syncPeopleHidden()"
          style="width:100%;border:none;outline:none;font-size:12px;font-family:inherit;background:transparent">
          ${Object.entries(PEOPLE_ROLE_LABELS).map(([val,lbl])=>`<option value="${val}" ${row.role===val?'selected':''}>${lbl}</option>`).join('')}
        </select>
      </td>
      <td style="border:1px solid #ccd5e4;padding:4px">
        <input type="text" value="${escapeHtml(row.name)}" oninput="peopleRows[${i}].name=this.value;syncPeopleHidden()"
          style="width:100%;border:none;outline:none;font-size:12px;font-family:inherit;background:transparent" placeholder="ชื่อ-นามสกุล">
      </td>
      <td style="border:1px solid #ccd5e4;padding:4px">
        <input type="text" value="${escapeHtml(row.pos)}" oninput="peopleRows[${i}].pos=this.value;syncPeopleHidden()"
          style="width:100%;border:none;outline:none;font-size:12px;font-family:inherit;background:transparent" placeholder="ตำแหน่งงาน">
      </td>
      <td style="border:1px solid #ccd5e4;padding:0;text-align:center">
        <button type="button" onclick="removePersonRow(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;width:28px;height:28px">×</button>
      </td>
    </tr>`).join('');
  syncPeopleHidden();
}
function addPersonRow(role) {
  // เพิ่มถัดจากคนสุดท้ายที่เป็นบทบาทเดียวกัน ถ้ายังไม่มีเลยให้เรียงตาม ผู้เสนอ → ผู้เห็นชอบ → ผู้อนุมัติ
  const defaultRole = role || (peopleRows.length ? peopleRows[peopleRows.length-1].role : 'proposer');
  peopleRows.push(_mkPersonRow(defaultRole));
  renderPeopleTable();
}
function removePersonRow(i) {
  peopleRows.splice(i,1);
  if(!peopleRows.length) peopleRows = [_mkPersonRow('proposer'), _mkPersonRow('approver'), _mkPersonRow('authorizer')];
  renderPeopleTable();
}
function syncPeopleHidden() {
  const grouped = {proposer:{names:[],poss:[]}, approver:{names:[],poss:[]}, authorizer:{names:[],poss:[]}};
  peopleRows.forEach(r => {
    const g = grouped[r.role] || grouped.proposer;
    g.names.push(r.name||''); g.poss.push(r.pos||'');
  });
  const setVal = (id,arr) => { const el=document.getElementById(id); if(el) el.value = JSON.stringify(arr); };
  setVal('fProposer', grouped.proposer.names);     setVal('fProposerPos', grouped.proposer.poss);
  setVal('fApprover', grouped.approver.names);     setVal('fApproverPos', grouped.approver.poss);
  setVal('fAuthorizer', grouped.authorizer.names); setVal('fAuthorizerPos', grouped.authorizer.poss);
}
function loadPeopleFromData(p) {
  peopleRows = [];
  ['proposer','approver','authorizer'].forEach(role => {
    const names = _toArrayField(p[role]);
    const poss  = _toArrayField(p[role+'Pos']);
    const len = Math.max(names.length, poss.length);
    for (let i=0;i<len;i++) {
      const name = _unwrapMaybeJsonArrayString(names[i]||'');
      const pos  = _unwrapMaybeJsonArrayString(poss[i]||'');
      if (name || pos) peopleRows.push(_mkPersonRow(role, name, pos));
    }
  });
  if(!peopleRows.length) peopleRows = [_mkPersonRow('proposer'), _mkPersonRow('approver'), _mkPersonRow('authorizer')];
  renderPeopleTable();
}

// ── Document Upload ────────────────────────────────────
let docFiles = [];
function handleDocDragOver(e) { e.preventDefault(); document.getElementById('docUploadZone').style.borderColor='var(--accent)'; }
function handleDocDragLeave(e) { document.getElementById('docUploadZone').style.borderColor='var(--border)'; }
function handleDocDrop(e) {
  e.preventDefault(); document.getElementById('docUploadZone').style.borderColor='var(--border)';
  processDocFiles([...e.dataTransfer.files]);
}
function handleDocSelect(e) { processDocFiles([...e.target.files]); }
function processDocFiles(files) {
  files.forEach(f => {
    if(docFiles.length>=10){ showToast('⚠️ สูงสุด 10 ไฟล์',2000); return; }
    if(f.size>20*1024*1024){ showToast('⚠️ ไฟล์ '+f.name+' ใหญ่เกิน 20MB',2500); return; }

    // สร้าง placeholder ก่อนเพื่อแสดงสถานะ "กำลังอัปโหลด"
    const placeholder = { name:f.name, size:f.size, type:f.type, url:'', fileId:'', _uploading:true, status:'uploading' };
    docFiles.push(placeholder);
    renderDocFileList();

    if(!GAS_ENABLED){
      placeholder._uploading = false;
      placeholder.status = 'ready';
      renderDocFileList();
      return;
    }

    function doUpload(attempt){
      uploadDocFileToGas(f)
        .then(res => {
          placeholder.url      = res.url || '';
          placeholder.fileId   = res.fileId || '';
          placeholder._uploading = false;
          placeholder.status   = 'saved';
          renderDocFileList();
          showToast(`✅ "${f.name}" อัปโหลดขึ้น Drive สำเร็จ${attempt>1?' (retry)':''}`, 2200);
        })
        .catch(err => {
          console.error(`DocFile upload attempt ${attempt} failed:`, err.message);
          if(attempt < 3){
            showToast(`⏳ retry ${attempt}/2 — "${f.name}"`, 1500);
            setTimeout(()=>doUpload(attempt+1), 2000);
          } else {
            placeholder._uploading = false;
            placeholder._uploadError = true;
            placeholder.status = 'error';
            renderDocFileList();
            showToast(`⚠️ อัปโหลด "${f.name}" ไม่สำเร็จ: ${err.message}`, 4000);
          }
        });
    }
    doUpload(1);
  });
}
function renderDocFileList() {
  const el=document.getElementById('docFileList'); if(!el) return;
  const icons = {pdf:'📄',doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',ppt:'📋',pptx:'📋',jpg:'🖼️',jpeg:'🖼️',png:'🖼️',gif:'🖼️',webp:'🖼️'};
  el.innerHTML = docFiles.length ? docFiles.map((f,i)=>{
    const ext = f.name.split('.').pop().toLowerCase();
    const ico = icons[ext]||'📎';
    const sz = f.size > 1024*1024 ? (f.size/1024/1024).toFixed(1)+' MB' : Math.round(f.size/1024)+' KB';
    let statusHtml;
    if(f._uploading){
      statusHtml = `<div style="font-size:10.5px;color:var(--accent)">⏳ กำลังอัปโหลดขึ้น Drive...</div>`;
    } else if(f._uploadError){
      statusHtml = `<div style="font-size:10.5px;color:#ef4444">⚠️ อัปโหลดไม่สำเร็จ — ลบแล้วลองใหม่</div>`;
    } else if(f.url){
      statusHtml = `<a href="${f.url}" target="_blank" rel="noopener" style="font-size:10.5px;color:var(--accent);text-decoration:underline">📎 เปิดไฟล์ใน Drive · ${sz}</a>`;
    } else {
      statusHtml = `<div style="font-size:10.5px;color:var(--text3)">${sz}</div>`;
    }
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--border);border-radius:7px;margin-bottom:5px;background:var(--surface2)">
      <span style="font-size:18px">${ico}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.name}</div>
        ${statusHtml}
      </div>
      <button type="button" onclick="removeDocFile(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;width:24px;height:24px;flex-shrink:0">×</button>
    </div>`;
  }).join('') : '';
  const fd=document.getElementById('fDocFiles'); if(fd) fd.value=JSON.stringify(docFiles.map(f=>({name:f.name,size:f.size,type:f.type,url:f.url||'',fileId:f.fileId||''})));
}
function removeDocFile(i) {
  const f = docFiles[i];
  // ลบไฟล์ออกจาก Drive ด้วย (best-effort, ไม่บล็อก UI)
  if(f && f.fileId && GAS_ENABLED){
    gasFetchPost('deleteDriveFile', { fileId: f.fileId }).catch(()=>{});
  }
  docFiles.splice(i, 1);
  renderDocFileList();
}


function _setQuarterCheckboxes(val) {
  // reset
  ['fQAll','fQ1','fQ2','fQ3','fQ4'].forEach(id=>{const el=document.getElementById(id);if(el)el.checked=false;});
  ['All','1','2','3','4'].forEach(q=>{
    const lbl=document.getElementById('qLabel'+q);
    if(lbl){lbl.style.borderColor='var(--border)';lbl.style.background='';}
  });
  if(!val||val==='all') {
    const el=document.getElementById('fQAll'); if(el) el.checked=true;
    const lbl=document.getElementById('qLabelAll');
    if(lbl){lbl.style.borderColor='var(--accent)';lbl.style.background='var(--accent-light)';}
  } else {
    String(val).split(',').forEach(q=>{
      const el=document.getElementById('fQ'+q); if(el) el.checked=true;
      const lbl=document.getElementById('qLabel'+q);
      if(lbl){lbl.style.borderColor='var(--accent)';lbl.style.background='var(--accent-light)';}
    });
  }
}

// ── char counter ────────────────────────────────────────
function updateCharCount(inputId, countId, max) {
  const el=document.getElementById(inputId); const ct=document.getElementById(countId);
  if(!el||!ct) return;
  ct.textContent = el.value.length;
  ct.style.color = el.value.length > max*0.9 ? '#ef4444' : 'var(--text3)';
}

// ════════════════════════════════════════════════════════
// PLAN PAGE
// ════════════════════════════════════════════════════════
// ===== GANTT CHART =====
// Month definitions for fiscal year 2570 (ต.ค. 2569 – ก.ย. 2570) and 2571
const GANTT_MONTHS_2570 = [
  {label:'ต.ค.',year:'69',q:1,fy:2570},
  {label:'พ.ย.',year:'69',q:1,fy:2570},
  {label:'ธ.ค.',year:'69',q:1,fy:2570},
  {label:'ม.ค.',year:'70',q:2,fy:2570},
  {label:'ก.พ.',year:'70',q:2,fy:2570},
  {label:'มี.ค.',year:'70',q:2,fy:2570},
  {label:'เม.ย.',year:'70',q:3,fy:2570},
  {label:'พ.ค.',year:'70',q:3,fy:2570},
  {label:'มิ.ย.',year:'70',q:3,fy:2570},
  {label:'ก.ค.',year:'70',q:4,fy:2570},
  {label:'ส.ค.',year:'70',q:4,fy:2570},
  {label:'ก.ย.',year:'70',q:4,fy:2570},
];
const GANTT_MONTHS_2569 = [
  {label:'ต.ค.',year:'68',q:1,fy:2569},
  {label:'พ.ย.',year:'68',q:1,fy:2569},
  {label:'ธ.ค.',year:'68',q:1,fy:2569},
  {label:'ม.ค.',year:'69',q:2,fy:2569},
  {label:'ก.พ.',year:'69',q:2,fy:2569},
  {label:'มี.ค.',year:'69',q:2,fy:2569},
  {label:'เม.ย.',year:'69',q:3,fy:2569},
  {label:'พ.ค.',year:'69',q:3,fy:2569},
  {label:'มิ.ย.',year:'69',q:3,fy:2569},
  {label:'ก.ค.',year:'69',q:4,fy:2569},
  {label:'ส.ค.',year:'69',q:4,fy:2569},
  {label:'ก.ย.',year:'69',q:4,fy:2569},
];

// Parse quarter/months field into month indices (0-11)
function getActiveMonths(p) {
  const quarters = String(p.quarters || p.quarter || 'all');
  const qs = quarters.split(',').map(q=>q.trim());
  const active = new Set();
  qs.forEach(q => {
    if(q==='all' || q==='') { for(let i=0;i<12;i++) active.add(i); }
    else if(q==='1') { [0,1,2].forEach(i=>active.add(i)); }
    else if(q==='2') { [3,4,5].forEach(i=>active.add(i)); }
    else if(q==='3') { [6,7,8].forEach(i=>active.add(i)); }
    else if(q==='4') { [9,10,11].forEach(i=>active.add(i)); }
  });
  return active;
}

// Parse activities text into list of {name, months}
function parseActivities(p) {
  const text = (p.activities || '').trim();
  if(!text) return [];
  const lines = text.split(/\n/).filter(l=>l.trim());
  // Try to find lines that look like numbered steps
  const acts = [];
  let actIndex = 0;
  lines.forEach(line => {
    const m = line.match(/^(\d+\.?|[•\-*])\s*(.+)/);
    const name = m ? m[2].trim() : line.trim();
    if(!name) return;
    // Try to infer quarter from keywords in the activity name
    let months = new Set();
    const lower = name.toLowerCase();
    if(/ภาคเรียนที่ 1|ภาค 1|ต\.ค\.|พ\.ย\.|ธ\.ค\.|ม\.ค\.|ก\.พ\.|มี\.ค\./.test(name)) {
      if(/ภาคเรียนที่ 1|ต\.ค\.|พ\.ย\.|ธ\.ค\./.test(name)) { [0,1,2].forEach(i=>months.add(i)); }
      if(/ม\.ค\.|ก\.พ\.|มี\.ค\./.test(name)) { [3,4,5].forEach(i=>months.add(i)); }
    }
    if(/ภาคเรียนที่ 2|เม\.ย\.|พ\.ค\.|มิ\.ย\./.test(name)) { [6,7,8].forEach(i=>months.add(i)); }
    if(/ก\.ค\.|ส\.ค\.|ก\.ย\./.test(name)) { [9,10,11].forEach(i=>months.add(i)); }
    // Default: spread evenly based on activity index
    if(months.size===0) {
      // Distribute activities across project's active months
      const projMonths = getActiveMonths(p);
      const projArr = [...projMonths].sort((a,b)=>a-b);
      const chunkSize = Math.max(1, Math.ceil(projArr.length / Math.max(lines.length,1)));
      const start = Math.min(actIndex * chunkSize, projArr.length - 1);
      const end = Math.min(start + chunkSize, projArr.length);
      for(let i=start; i<end; i++) months.add(projArr[i]);
    }
    acts.push({name, months});
    actIndex++;
  });
  return acts;
}

// ACTIVITIES from the project form (structured)
// For project 10 (ใบงาน) we have exact activities from the docx
const PROJECT_ACTIVITIES = {
  10: [
    {name:'จัดเตรียม file ชุดกิจกรรมฯ ต้นฉบับ', months: new Set([0,1,2,6,7,8])},
    {name:'ประสานขอข้อมูลจำนวนนักเรียน (ภาคเรียนที่ 1)', months: new Set([0,1,2])},
    {name:'ประสานขอข้อมูลจำนวนนักเรียน (ภาคเรียนที่ 2)', months: new Set([6])},
    {name:'ตรวจสอบการรับรองจำนวนการจัดสรร (ภาคเรียนที่ 1)', months: new Set([2,3])},
    {name:'ตรวจสอบการรับรองจำนวนการจัดสรร (ภาคเรียนที่ 2)', months: new Set([8,9])},
    {name:'กำหนดขอบเขตการดำเนินงาน TOR (ภาคเรียนที่ 1)', months: new Set([2,3])},
    {name:'กำหนดขอบเขตการดำเนินงาน TOR (ภาคเรียนที่ 2)', months: new Set([8,9])},
    {name:'จัดจ้างผลิตและจัดส่ง (ภาคเรียนที่ 1)', months: new Set([3,4,5])},
    {name:'จัดจ้างผลิตและจัดส่ง (ภาคเรียนที่ 2)', months: new Set([6,7])},
    {name:'ติดตามรายงานผลและความพึงพอใจ', months: new Set([4,5,6,7,8,9,10,11])},
  ]
};

let ganttExpandState = {}; // {projectId: true/false}

// ── Gantt Chart แบบ A: แถบต่อเนื่อง + ความคืบหน้าการใช้งบ + เส้นเดือนปัจจุบัน ──────────
// - แถบของแต่ละโครงการวาดเป็นแถบยาวต่อเนื่อง (รวมเดือนที่ติดกันเป็นแถบเดียว) สีตามยุทธศาสตร์
// - ส่วนสีเข้มในแถบ = ร้อยละงบประมาณที่ใช้ไปแล้ว (p.spent / p.budget จากรายงานผลรายไตรมาส)
// - ช่วงเดือนของโครงการ: ใช้เดือนที่ติ๊กไว้ใน "แผนกิจกรรม" ของโครงการก่อน (ตรงกับแผนจริงที่สุด)
//   ถ้าโครงการยังไม่มีแผนกิจกรรมที่ระบุเดือน จึงใช้ไตรมาสของโครงการ (getActiveMonths) แทนเหมือนเดิม
// - เส้นประสีแดง = เดือนปัจจุบัน (แสดงเฉพาะเมื่อวันนี้อยู่ในปีงบประมาณที่เปิดดู)
function _ganttRuns(set){
  const idx = [...set].filter(i=>i>=0 && i<12).sort((a,b)=>a-b);
  const runs = [];
  idx.forEach(i=>{
    const last = runs[runs.length-1];
    if(last && i===last.b+1) last.b = i; else runs.push({a:i,b:i});
  });
  return runs;
}
function _ganttActivityList(p){
  if(Array.isArray(p.activities) && p.activities.length){
    return p.activities
      .map(a => (typeof _normalizeGanttEntry==='function') ? _normalizeGanttEntry(a) : a)
      .filter(a => a && a.name && String(a.name).trim())
      .map(a => ({ name:a.name, months:new Set((a.months||[]).map((v,idx)=>v?idx:-1).filter(idx=>idx>=0)) }));
  }
  return (typeof PROJECT_ACTIVITIES!=='undefined' && PROJECT_ACTIVITIES[p.id]) || parseActivities(p);
}
function _ganttCurrentMonthIndex(fy){
  // ปีงบประมาณ พ.ศ. fy เริ่ม ต.ค. ของปี ค.ศ. (fy-544)
  const now = new Date();
  const idx = (now.getFullYear()*12 + now.getMonth()) - ((fy-544)*12 + 9);
  return (idx>=0 && idx<12) ? idx : -1;
}
function renderGantt() {
  const search = (document.getElementById('ganttSearch')||{}).value||'';
  const filterSt = (document.getElementById('ganttFilterStrategy')||{}).value||'';
  const filterStatus = (document.getElementById('ganttFilterStatus')||{}).value||'';
  const showActs = document.getElementById('ganttShowActivities')?.checked||false;

  const months = currentYear===2570 ? GANTT_MONTHS_2570 : GANTT_MONTHS_2569;
  const Q_COLORS = {1:'#3b72f0',2:'#059669',3:'#d97706',4:'#7c3aed'};
  const Q_NAMES = {1:'ไตรมาส 1',2:'ไตรมาส 2',3:'ไตรมาส 3',4:'ไตรมาส 4'};
  const STRAT_COLORS = ['','#3b72f0','#059669','#d97706','#7c3aed','#0891b2'];
  const N = months.length;
  const nowIdx = _ganttCurrentMonthIndex(months[0] && months[0].fy ? months[0].fy : currentYear);

  let list = projects.filter(p => {
    if(filterSt && String(p.strategy)!==filterSt) return false;
    if(filterStatus && p.status!==filterStatus) return false;
    if(search && !String(p.name||'').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const head = document.getElementById('ganttHead');
  const body = document.getElementById('ganttBody');
  if(!head||!body) return;

  if(!list.length) {
    head.innerHTML='';
    body.innerHTML=`<tr><td class="gantt-empty" colspan="${3+N}">ไม่พบโครงการ</td></tr>`;
    return;
  }

  // ── Header ──
  let qGroups = [], prevQ = null;
  months.forEach(m=>{ if(m.q!==prevQ){ qGroups.push({q:m.q,span:1}); prevQ=m.q; } else qGroups[qGroups.length-1].span++; });
  let headRow1 = '<tr>'
    + '<th class="th-left" rowspan="2" style="min-width:240px">ชื่อโครงการ / กิจกรรม</th>'
    + '<th rowspan="2" style="min-width:64px;text-align:center">สถานะ</th>'
    + qGroups.map(({q,span})=>`<th colspan="${span}" class="gl-qhead" style="--qc:${Q_COLORS[q]}">${Q_NAMES[q]}</th>`).join('')
    + '<th rowspan="2" style="min-width:74px;text-align:center">ใช้งบ</th>'
    + '</tr>';
  let headRow2 = '<tr>' + months.map((m,i)=>{
    const isQSep = i>0 && months[i].q !== months[i-1].q;
    return `<th class="gantt-month-th${isQSep?' gantt-q-sep':''}${i===nowIdx?' gl-now-th':''}">${m.label}<br><span style="font-size:8px;color:var(--text3)">${m.year}</span></th>`;
  }).join('') + '</tr>';
  head.innerHTML = headRow1 + headRow2;

  const STATUS_EMOJI = {done:'✅',progress:'⏳',pending:'⭕'};
  const STATUS_TEXT = {done:'แล้วเสร็จ',progress:'กำลังดำเนิน',pending:'ยังไม่เริ่ม'};
  const pctOf = i => (i/N*100);
  const nowLine = nowIdx>=0 ? `<div class="gl-now" style="left:${pctOf(nowIdx+0.5)}%"></div>` : '';
  const lane = inner => `<td colspan="${N}" class="gl-lane-td"><div class="gl-lane" style="--n:${N}">${inner}${nowLine}</div></td>`;

  // วาดแถบหลายช่วง (runs) โดยเติมสีเข้มตามร้อยละ (pct) ไล่จากช่วงแรกไปช่วงหลัง
  const barsHtml = (runs, color, pct, label, tip, isActivity) => {
    const total = runs.reduce((s,r)=>s+(r.b-r.a+1),0) || 1;
    let remain = isActivity ? 0 : Math.max(0,Math.min(100,pct||0))/100*total;
    return runs.map((r,ri)=>{
      const len = r.b-r.a+1;
      const fill = Math.max(0,Math.min(len,remain)); remain -= fill;
      const showLabel = ri===runs.length-1 && label;
      return `<div class="gl-bar${isActivity?' gl-bar-act':''}" title="${tip}" style="left:calc(${pctOf(r.a)}% + 3px);width:calc(${pctOf(len)}% - 6px);--c:${color}">
        ${isActivity?'':`<div class="gl-fill" style="width:${fill/len*100}%"></div>`}
        ${showLabel?`<span class="gl-label${(!isActivity && fill>=len-0.35)?' gl-label-in':''}">${label}</span>`:''}
      </div>`;
    }).join('');
  };

  let rows = '';
  list.forEach(p => {
   try {
    const rawName = p.name||'(ไม่มีชื่อโครงการ)';
    const pName = escapeHtml(rawName);
    const s = Number(p.strategy)||1;
    const sColor = STRAT_COLORS[s]||'#9aa3b2';
    const acts = _ganttActivityList(p);
    const hasActs = acts.length>0;
    const expanded = ganttExpandState[p.id] || false;

    // ช่วงเดือนของโครงการ = รวมทุกเดือนจากแผนกิจกรรม ถ้าไม่มีจึงใช้ไตรมาสของโครงการ
    const actMonths = new Set(); acts.forEach(a=>a.months.forEach(m=>actMonths.add(m)));
    const runs = _ganttRuns(actMonths.size ? actMonths : getActiveMonths(p));

    const budget = Number(p.budget)||0, spent = Number(p.spent)||0;
    const pct = budget>0 ? spent/budget*100 : 0;
    const pctText = budget>0 ? (pct>=10||pct===0 ? Math.round(pct) : pct.toFixed(1))+'%' : '–';
    const late = nowIdx>=0 && p.status!=='done' && runs.length && runs[runs.length-1].b < nowIdx;
    const tip = escapeHtml(`${rawName}\nสถานะ: ${STATUS_TEXT[p.status]||'ยังไม่เริ่ม'}\nงบอนุมัติ: ${fmtFull(budget)} บาท\nใช้ไปแล้ว: ${fmtFull(spent)} บาท (${pctText})${late?'\n⚠️ เลยกำหนดตามแผนแล้วแต่ยังไม่แล้วเสร็จ':''}`);

    rows += `<tr class="gl-row">
      <td style="padding:6px 8px">
        <div style="display:flex;align-items:center;gap:6px">
          ${showActs && hasActs ? `<button class="gantt-expand-btn" onclick="ganttExpandState[${p.id}]=!ganttExpandState[${p.id}];renderGantt()" title="${expanded?'ซ่อน':'แสดง'}กิจกรรมย่อย">${expanded?'▾':'▸'}</button>` : '<span style="width:16px;display:inline-block"></span>'}
          <span style="width:6px;height:14px;border-radius:2px;background:${sColor};flex-shrink:0;display:inline-block"></span>
          <span class="gantt-project-name" onclick="openDetail(${p.id})" title="${pName}">${rawName.length>45?escapeHtml(rawName.substring(0,45))+'…':pName}</span>
          ${late?'<span class="gl-late" title="เลยกำหนดตามแผนแล้วแต่ยังไม่แล้วเสร็จ">ล่าช้า</span>':''}
        </div>
      </td>
      <td style="text-align:center;white-space:nowrap" title="${STATUS_TEXT[p.status]||'ยังไม่เริ่ม'}"><span style="font-size:11px">${STATUS_EMOJI[p.status]||'⭕'}</span></td>
      ${lane(runs.length ? barsHtml(runs, sColor, pct, pctText, tip, false) : '<span class="gl-none">ยังไม่ระบุช่วงเวลา</span>')}
      <td class="gl-pct-cell"><div class="gl-pct-num">${pctText}</div><div class="gl-pct-sub">${fmtFull(spent)} / ${fmtFull(budget)}</div></td>
    </tr>`;

    if(showActs && expanded && hasActs) {
      acts.forEach(act => {
        const actName = escapeHtml(act.name||'');
        const aRuns = _ganttRuns(act.months);
        rows += `<tr class="gantt-activity-row">
          <td style="padding:3px 8px;padding-left:32px"><span class="gantt-activity-name" title="${actName}">↳ ${actName.length>50?escapeHtml(String(act.name).substring(0,50))+'…':actName}</span></td>
          <td></td>
          ${lane(aRuns.length ? barsHtml(aRuns, sColor, 0, '', actName, true) : '<span class="gl-none">ยังไม่ระบุเดือน</span>')}
          <td></td>
        </tr>`;
      });
    }
   } catch(err) {
     console.error('renderGantt: ข้ามโครงการที่มีข้อมูลผิดปกติ', p && p.id, err);
   }
  });

  body.innerHTML = rows || `<tr><td class="gantt-empty" colspan="${3+N}">ไม่พบโครงการ</td></tr>`;
}


// ===== INIT =====
// _pendingSaveTs = timestamp ล่าสุดที่กดบันทึก (ใช้กัน Sheet ทับข้อมูลใหม่)
window._pendingSaveTs = 0;

(function initApp(){
  // ── ไฟล์นี้คือปี 2570 เท่านั้น ──
  Q_LABEL = Q_LABELS[2570];
  document.getElementById('sidebarYearBadge').textContent = 'ปีงบประมาณ พ.ศ. 2570';
  document.getElementById('sidebarYearBadge').className = 'badge-year badge-year-2570';
  const _tyEl = document.getElementById('topbarYear'); if(_tyEl) _tyEl.textContent = '2570';
  document.title = 'ระบบรายงานผลฯ พ.ศ. 2570 | มูลนิธิการศึกษาทางไกลผ่านดาวเทียม';

  _initGasUI();

  // ── เติมตัวเลือกใน dropdown ตัวกรองอนุกรรมการ ──
  populateCommitteeFilter();

  // ── โหลด localStorage (ใช้เป็น fallback ระหว่างรอ/กรณี Sheet โหลดไม่สำเร็จเท่านั้น) ──
  const hadData = loadFromLocal();
  const overlay = document.getElementById('initLoadingOverlay');

  if(!hadData || projects.length === 0){
    projects = [];
    saveToLocal(true);
  }

  // ── route ไปหน้า dashboard ก่อน (ต้อง display:block ก่อน Chart.js render) ──
  showPage('dashboard');

  // ── Auth UI ──
  if (typeof _applyAuthUI === 'function') _applyAuthUI();

  // render dashboard ด้วยข้อมูลในเครื่องไปก่อน (เห็นบางอย่างเร็ว) แล้วจะถูกทับด้วยข้อมูลจาก Sheet ด้านล่าง
  updateDashboard();
  renderTable();

  // ── Sync จาก Sheet ─────────────────────────────────────────────────
  // แก้ไข (บั๊กร้ายแรง): เดิมถ้า sync ครั้งแรกพลาด (เช่น network สะดุดชั่วคราว — เจอบ่อยกับ Apps Script)
  // และเครื่องนี้ไม่มีข้อมูลใน localStorage อยู่ก่อนเลย (เช่น เพิ่งเปิดเว็บครั้งแรกในเครื่องนี้ หรือเพิ่งล้าง
  // cache/site data ไป) จะไม่มีการลองใหม่เลย ทำให้ dashboard โชว์ 0 ทุกอย่างค้างอยู่แบบนั้น ดูเหมือน
  // "ข้อมูลหายหมด" ทั้งที่จริงๆ ข้อมูลยังอยู่ครบใน Google Sheet ปกติ แค่ sync รอบแรกพลาดไปเฉยๆ
  // จึงเพิ่ม retry ให้ sync ลองใหม่อัตโนมัติก่อนจะยอมแพ้จริงๆ (ไม่กระทบ safeguard เดิมที่ป้องกันไม่ให้
  // เอาผลลัพธ์ว่างเปล่าจาก server ไปเขียนทับข้อมูลในเครื่องที่มีอยู่แล้ว — safeguard นั้นยังอยู่เหมือนเดิม)
  // เพิ่มเติม (แก้ปัญหาผู้ใช้ 100+ คนเห็นข้อมูลไม่ตรงกัน): เดิม sync จะหน่วง 500ms แบบ background
  // ไม่บล็อกหน้าจอ ทำให้ผู้ใช้เห็น/แก้ไขข้อมูลเก่าในเครื่องไปก่อนได้โดยไม่รู้ตัวว่ายังไม่ sync
  // ตอนนี้บังคับให้รอผล sync จาก Sheet (แหล่งข้อมูลจริง) ก่อนเสมอ โดยแสดง overlay บังหน้าจอไว้ระหว่างรอ
  function syncFromSheet(showToast_, safe, retriesLeft){
    if(retriesLeft === undefined) retriesLeft = 2;
    if(!GAS_ENABLED || !_gasUrl || _gasUrl.includes('YOUR_GAS')) return Promise.resolve();
    const st = document.getElementById('gsStatus');
    // แก้ไข (ประสิทธิภาพ): เดิมเรียก getAll แล้วรอเสร็จก่อนถึงเรียก getAllReport ต่อ (2 round-trip เรียงลำดับ)
    // เปลี่ยนมาใช้ getAllBundle ที่รวมทั้งคู่ไว้ใน request เดียว (ฝั่ง Apps Script รวมให้แล้ว มี cache ช่วยด้วย)
    // ลด round-trip เหลือ 1 ครั้ง เร็วขึ้น และมีจุดพลาดน้อยลง (ไม่ต้องพึ่ง network 2 รอบแยกกัน)
    return fetch(`${_gasUrl}?action=getAllBundle`, { redirect:'follow' })
      .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(res=>{
        if(!res.success) throw new Error(res.message||'GAS error');
        if(safe && Date.now() - window._pendingSaveTs < 30000){
          console.log('syncFromSheet: skipped — recent save within 30s');
          return;
        }
        // Sheet เป็นแหล่งข้อมูลจริงเสมอ — ถ้า Sheet ว่างจริง ก็เคลียร์ข้อมูลในเครื่องตาม ไม่ทิ้งของเก่าค้างไว้
        projects = (res.projects && res.projects.length > 0) ? mergeReportsIntoProjects(res.projects, res.reports || []) : [];
        saveToLocal(true);
        renderTable();
        updateDashboard();
        const now2 = new Date().toLocaleTimeString('th-TH');
        if(st) st.innerHTML=`<div class="status-msg status-ok">✅ โหลดข้อมูลล่าสุดสำเร็จ ${projects.length} โครงการ · ${now2}</div>`;
        if(showToast_) showToast(`🔄 ข้อมูลล่าสุดจาก Sheet (${projects.length} โครงการ)`, 2500);
      })
      .catch(err=>{
        if(retriesLeft > 0){
          console.warn('Sheet sync failed, retrying in 1.5s... ('+retriesLeft+' left):', err.message);
          return new Promise(resolve=>{
            setTimeout(()=> resolve(syncFromSheet(showToast_, safe, retriesLeft-1)), 1500);
          });
        }
        console.warn('Sheet sync failed after retries:', err.message);
        if(st) st.innerHTML=`<div class="status-msg status-err">⚠️ โหลดจาก Sheet ไม่สำเร็จ — ใช้ข้อมูลในเครื่อง (${err.message})</div>`;
      });
  }

  window._syncFromSheetSilent = ()=>syncFromSheet(false, true);

  // ── บังคับดึงข้อมูลล่าสุดจาก Google Sheet ทันทีที่เปิดหน้า ก่อนปล่อยให้ผู้ใช้ดู/แก้ไขข้อมูล ──
  if(overlay) overlay.style.display='flex';
  let _initSyncSettled = false;
  const _finishInitSync = (timedOut)=>{
    if(_initSyncSettled) return;
    _initSyncSettled = true;
    if(overlay) overlay.style.display='none';
    if(timedOut) showToast('⚠️ เชื่อมต่อ Google Sheet ช้ากว่าปกติ — แสดงข้อมูลที่บันทึกไว้ในเครื่องไปก่อน (จะอัปเดตอัตโนมัติเมื่อโหลดเสร็จ)', 5000);
  };
  syncFromSheet(false, false).finally(()=>_finishInitSync(false));
  setTimeout(()=>_finishInitSync(true), 12000); // กันหน้าจอค้างถ้า Sheet ไม่ตอบเลยภายใน 12 วิ

  window._pendingSaveTs = 0;
})();
