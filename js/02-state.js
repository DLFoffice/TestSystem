/* ============================================================
   02-state.js — สถานะกลางของแอป: DB, pagination, view mode
   (แยกมาจาก index.html เดิม บรรทัด 1403-1435 โดยรักษาลำดับโค้ดเดิม)
   ============================================================ */
let DB = {students: RAW.map(s => {
  // semPayments: ใช้จาก payment เดิมถ้ายังไม่มี (สำหรับ offline/local)
  if(!s.semPayments || s.semPayments.length === 0) {
    if(s.payment && (s.payment.p1 || s.payment.p2)) {
      s.semPayments = [{
        term: s.payment.term||'1/2568',
        p1: s.payment.p1||0, p2: s.payment.p2||0,
        item1: s.payment.item1||'ค่าเงินบำรุงการศึกษา', item2: s.payment.item2||'ค่าใช้จ่ายในการเรียน'
      }];
    } else {
      s.semPayments = [];
    }
  }
  if(!s.semGpa) s.semGpa = [{
    term: '1/2568',
    gpa: s.gpa.gpa||0, riskLevel: s.gpa.riskLevel||'ปานกลาง',
    hasObstacle: s.gpa.hasObstacle||false,
    obstacleType: s.gpa.obstacleType||'',
    weakSubjects: s.gpa.weakSubjects||'',
    schoolSupport: s.gpa.schoolSupport||''
  }];
  if(!s.school_m1_addr) s.school_m1_addr = {};
  if(!s.mentor) s.mentor = {firstName:'',lastName:'',phone:'',position:''};
  if(!s.hasOwnProperty('behavior')) s.behavior = '';
  return s;
})};

let stdPage=1; const STD_PER_PAGE=20;
let editingIndex=null; let currentView='card';
let semAddingIdx=null; let semAddingType=null;
let charts={};

// ============ UTILS ============
