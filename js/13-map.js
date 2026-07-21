/* ============================================================
   13-map.js — แผนที่โรงเรียน (Leaflet) + markers ตามระดับความเสี่ยง
   (แยกมาจาก index.html เดิม บรรทัด 3789-3963 โดยรักษาลำดับโค้ดเดิม)
   ============================================================ */
const SCHOOL_LATLONG = {
  1:{lat:15.8642653,lng:100.5988133},
  2:{lat:7.17705796,lng:100.2596223},
  3:{lat:16.2375139,lng:103.068722},
  4:{lat:17.58647,lng:103.5481064},
  5:{lat:18.0833992,lng:100.1727654},
  6:{lat:17.4491976,lng:103.1531197},
  7:{lat:17.5784284,lng:100.1460403},
  8:{lat:18.7617591,lng:99.98298816},
  9:{lat:16.3152665,lng:104.9125636},
  10:{lat:8.1638565,lng:99.7190381},
  11:{lat:13.5497513,lng:100.2650571},
  12:{lat:15.1889624,lng:100.1246947},
  13:{lat:7.3585773,lng:100.3401861},
  14:{lat:14.9808219,lng:102.1025628},
  15:{lat:14.2007324,lng:101.2171111},
  16:{lat:14.0223397,lng:100.7355841},
  17:{lat:7.8605084,lng:99.6308496},
  18:{lat:18.7566942,lng:98.9746895},
  19:{lat:15.7823419,lng:103.7123894},
  20:{lat:18.5683421,lng:99.5873219},
  21:{lat:15.5602347,lng:103.0039821},
  22:{lat:15.6234018,lng:105.0198743},
  23:{lat:6.2601432,lng:102.0891234},
  24:{lat:8.8674321,lng:98.2563214},
  25:{lat:13.9823412,lng:101.5678234},
  26:{lat:16.2012345,lng:99.5234567},
  27:{lat:18.5234561,lng:100.7823451},
  28:{lat:16.9012345,lng:103.5134567},
  29:{lat:14.9823456,lng:100.6234561},
  30:{lat:16.9823456,lng:98.5212345},
  31:{lat:17.4012345,lng:99.9723456},
  32:{lat:11.9823456,lng:102.7512345},
  33:{lat:15.8623456,lng:102.0234561},
  34:{lat:19.3012345,lng:97.9623456},
  35:{lat:18.5612345,lng:99.0023456},
  36:{lat:17.4823456,lng:102.7323456},
  37:{lat:11.2312345,lng:99.5523456},
  38:{lat:12.7023456,lng:101.4823456},
  39:{lat:19.9323456,lng:99.8323456},
  40:{lat:13.7223456,lng:99.8923456},
  41:{lat:15.9523456,lng:102.1623456},
  42:{lat:18.9223456,lng:100.9223456},
  43:{lat:17.8723456,lng:102.7023456},
  44:{lat:17.8923456,lng:100.5923456},
  45:{lat:19.5223456,lng:100.8923456},
  46:{lat:18.3423456,lng:100.1723456},
  47:{lat:11.8423456,lng:99.8423456},
  48:{lat:13.6523456,lng:100.5923456},
  49:{lat:6.7923456,lng:101.2523456},
  50:{lat:13.2523456,lng:101.1623456},
  51:{lat:17.5923456,lng:104.0423456},
  52:{lat:9.9323456,lng:98.5723456},
  53:{lat:14.6223456,lng:102.5523456},
  54:{lat:5.9523456,lng:101.5123456},
  55:{lat:8.8523456,lng:99.3923456},
  56:{lat:13.1423456,lng:99.9323456},
  57:{lat:13.9923456,lng:100.5323456},
  58:{lat:14.7123456,lng:101.6623456},
  59:{lat:14.3723456,lng:99.5323456},
  60:{lat:14.6523456,lng:104.0523456},
  61:{lat:7.8923456,lng:100.1123456},
  62:{lat:16.9823456,lng:100.5523456},
  63:{lat:17.0123456,lng:99.8123456},
  64:{lat:16.2223456,lng:102.7423456},
  65:{lat:16.5423456,lng:102.0923456},
  66:{lat:19.3623456,lng:98.9623456},
  67:{lat:15.4023456,lng:99.9523456},
  68:{lat:17.4323456,lng:104.3223456},
  69:{lat:14.5023456,lng:102.5323456},
  70:{lat:6.7223456,lng:100.4423456},
  71:{lat:13.2823456,lng:102.1623456},
  72:{lat:18.6723456,lng:99.0623456}
};

// Inject lat/long into students on startup
DB.students.forEach(s=>{
  const ll=SCHOOL_LATLONG[s.no];
  if(ll&&(!s.school_m1_addr||!s.school_m1_addr.lat)){
    if(!s.school_m1_addr) s.school_m1_addr={};
    s.school_m1_addr.lat=ll.lat;
    s.school_m1_addr.lng=ll.lng;
  }
});

let schoolMap=null;
let allMarkers=[];
function riskColor(r){
  if(r==='สูงมาก') return '#9E2B2B';
  if(r==='สูง') return '#D85A30';
  if(r==='ปานกลาง') return '#C47F00';
  return '#0D6B52';
}
function makeMarkerIcon(color){
  return L.divIcon({
    html:`<div style="width:16px;height:16px;background:${color};border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
    className:'',iconSize:[16,16],iconAnchor:[8,8]
  });
}
function initSchoolMap(){
  if(typeof L==='undefined') return;
  if(!schoolMap){
    schoolMap=L.map('school-map').setView([13.5,101.0],6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:18}).addTo(schoolMap);
  }
  renderMapMarkers();
}
function renderMapMarkers(filter){
  if(!schoolMap) return;
  allMarkers.forEach(m=>{if(m._map)schoolMap.removeLayer(m);});
  allMarkers=[];
  const q=(document.getElementById('map-search')?.value||'').toLowerCase();
  const fr=(document.getElementById('map-filter-risk')?.value||'');
  let shown=0;
  const listEl=document.getElementById('map-list');
  listEl.innerHTML='';
  DB.students.forEach(s=>{
    const sa=s.school_m1_addr||{};
    if(!sa.lat||!sa.lng) return;
    const g=getLatestGpa(s);
    if(fr&&g.riskLevel!==fr) return;
    if(q&&!(s.name+s.school_m1+s.province+s.nickname).toLowerCase().includes(q)) return;
    shown++;
    const color=riskColor(g.riskLevel);
    const gmUrl=`https://www.google.com/maps?q=${sa.lat},${sa.lng}&z=15`;
    const marker=L.marker([sa.lat,sa.lng],{icon:makeMarkerIcon(color)}).addTo(schoolMap);
    marker.bindPopup(`
      <div style="min-width:200px;font-family:Sarabun,sans-serif">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px">🏫 ${s.school_m1||'-'}</div>
        <div style="font-size:12px;color:#555;margin-bottom:4px">📍 ${s.province}</div>
        <div style="font-size:12px;color:#555;margin-bottom:4px">สังกัด: ${s.org||'-'}</div>
        <hr style="margin:6px 0;border-color:#eee">
        <div style="font-size:12px;margin-bottom:2px"><b>นักเรียน:</b> ${s.name} (${s.nickname})</div>
        <div style="font-size:12px;margin-bottom:6px">GPA: <b style="color:${gpaColor(g.gpa)}">${g.gpa||'-'}</b>
          &nbsp;|&nbsp; ความเสี่ยง: <b style="color:${color}">${g.riskLevel||'-'}</b></div>
        <a href="${gmUrl}" target="_blank"
          style="display:inline-block;padding:4px 10px;background:#1A5FA8;color:#fff;border-radius:5px;font-size:12px;text-decoration:none;font-family:Sarabun,sans-serif">
          🗺️ เปิด Google Maps
        </a>
      </div>`);
    allMarkers.push(marker);
    // List card
    const card=document.createElement('div');
    card.style.cssText='background:var(--bg4);border-radius:var(--rad);padding:10px 12px;border:1px solid var(--border);cursor:pointer;transition:box-shadow 0.15s';
    card.onmouseover=()=>card.style.boxShadow='0 2px 8px rgba(0,0,0,0.12)';
    card.onmouseout=()=>card.style.boxShadow='';
    card.onclick=()=>{schoolMap.setView([sa.lat,sa.lng],14);marker.openPopup();};
    card.innerHTML=`
      <div style="display:flex;align-items:flex-start;gap:8px">
        <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;margin-top:4px"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.school_m1||'-'}</div>
          <div style="font-size:11px;color:var(--text2)">📍 ${s.province} &bull; ${s.org||''}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${s.name} (${s.nickname}) GPA ${g.gpa||'-'}</div>
        </div>
        <a href="${gmUrl}" target="_blank" onclick="event.stopPropagation()"
          title="เปิด Google Maps"
          style="flex-shrink:0;font-size:16px;text-decoration:none">🗺️</a>
      </div>`;
    listEl.appendChild(card);
  });
  document.getElementById('map-count-label').textContent=`แสดง ${shown} โรงเรียน`;
  if(allMarkers.length) schoolMap.invalidateSize();
}
function filterMapMarkers(){renderMapMarkers();}
function centerMapThailand(){if(schoolMap)schoolMap.setView([13.5,101.0],6);}

/* ============================================================
   SF MODULE — แบบฟอร์มทุนการศึกษา (Form 1 / Form 2)
   Namespaced with `sf` prefix to avoid clashing with the rest
   of the DLTV system. Persists into each student's own
   s.form1 / s.form2 objects, saved via the app's existing
   saveToStorage() (localStorage) — same mechanism as the rest
   of this system.
============================================================ */
