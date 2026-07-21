/* ============================================================
   04-navigation.js — เมนู sidebar และการสลับหน้า (PAGE_META, showPage, setView)
   (แยกมาจาก index.html เดิม บรรทัด 1611-1656 โดยรักษาลำดับโค้ดเดิม)
   ============================================================ */
const PAGE_META = {
  dashboard: {title:'Dashboard', sub:'ภาพรวมระบบการดูแลนักเรียนทุน'},
  students:  {title:'รายชื่อนักเรียน', sub:'ข้อมูลนักเรียนทุนการศึกษาพระราชทานฯ'},
  address:   {title:'ที่อยู่', sub:'ข้อมูลที่อยู่นักเรียน'},
  banking:   {title:'บัญชีธนาคาร', sub:'ข้อมูลบัญชีธนาคารนักเรียน'},
  payment:   {title:'การเงิน', sub:'ประวัติการรับเงินทุน'},
  academic:  {title:'ผลการเรียน', sub:'ประวัติ GPA และผลการศึกษา'},
  gpasheet:  {title:'GPA Sheet', sub:'เกรดเฉลี่ยรายชั้นเรียนและรายภาคเรียน'},
  schoolmap: {title:'แผนที่โรงเรียน', sub:'ตำแหน่งโรงเรียนของนักเรียนทุน'},
  scholarform: {title:'แบบฟอร์มทุนการศึกษา', sub:'แบบฟอร์มที่ 1 ข้อมูลรายบุคคล และแบบฟอร์มที่ 2 ผลการเรียน/ความประพฤติ/การใช้จ่าย'},
  formtrack: {title:'ติดตามการกรอกแบบฟอร์ม', sub:'ติดตามสถานะการกรอกแบบฟอร์มทุนการศึกษาของนักเรียนแต่ละโรงเรียน'},
};

function showPage(p,btn){
  document.querySelectorAll('.page').forEach(x=>{x.classList.remove('active');x.style.display='';});
  document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));
  const pg=document.getElementById('page-'+p);
  if(pg){pg.classList.add('active');pg.style.display='block';}
  if(btn) btn.classList.add('active');
  // Update topbar
  const m=PAGE_META[p]||{};
  const tt=document.getElementById('topbar-title');
  const ts=document.getElementById('topbar-sub');
  if(tt) tt.textContent=m.title||p;
  if(ts) ts.textContent=m.sub||'';
  if(p==='dashboard') renderDashboard();
  else if(p==='students'){populateFilters();renderStudents();}
  else if(p==='address') renderAddress();
  else if(p==='banking') renderBanking();
  else if(p==='payment'){populateTermFilter();renderPayment();}
  else if(p==='academic'){populateGpaTerm();renderAcademic();}
  else if(p==='gpasheet'){renderGpaSheet();}
  else if(p==='schoolmap'){setTimeout(initSchoolMap,50);}
  else if(p==='scholarform'){sfRenderPage();}
  else if(p==='formtrack'){renderFormTrack();}
}

function setView(v,btn){
  currentView=v;
  document.querySelectorAll('.view-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('students-card-view').style.display=v==='card'?'block':'none';
  document.getElementById('students-table-view').style.display=v==='table'?'block':'none';
  renderStudents();
}

