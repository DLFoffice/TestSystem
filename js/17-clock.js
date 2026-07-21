/* ============================================================
   17-clock.js — นาฬิกาบน topbar (locale ไทย)
   (แยกมาจาก index.html เดิม บรรทัด 5465-5476 โดยรักษาลำดับโค้ดเดิม)
   ============================================================ */
// Topbar live clock (Thai locale)
function updateClock(){
  const el=document.getElementById('topbar-datetime');
  if(!el) return;
  const now=new Date();
  el.textContent=now.toLocaleString('th-TH',{
    day:'numeric',month:'long',year:'numeric',
    hour:'2-digit',minute:'2-digit'
  });
}
updateClock();
setInterval(updateClock,30000);
