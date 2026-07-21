/* ============================================================
   06-students-list.js — รายชื่อนักเรียน: filter, ค้นหา, การ์ด/ตาราง, pagination
   (แยกมาจาก index.html เดิม บรรทัด 1791-1897 โดยรักษาลำดับโค้ดเดิม)
   ============================================================ */
function populateFilters(){
  const provs=[...new Set(DB.students.map(s=>s.province).filter(Boolean))].sort();
  const orgs=[...new Set(DB.students.map(s=>s.org).filter(Boolean))].sort();
  const ps=document.getElementById('std-filter-prov');
  const os=document.getElementById('std-filter-org');
  if(ps.options.length<=1) provs.forEach(p=>{const o=document.createElement('option');o.value=p;o.textContent=p;ps.appendChild(o);});
  if(os.options.length<=1) orgs.forEach(p=>{const o=document.createElement('option');o.value=p;o.textContent=p;os.appendChild(o);});
}

function filterStudents(){
  const q=(document.getElementById('std-search').value||'').toLowerCase();
  const fp=document.getElementById('std-filter-prov').value;
  const fo=document.getElementById('std-filter-org').value;
  const fr=document.getElementById('std-filter-risk').value;
  return DB.students.filter(s=>{
    const g=getLatestGpa(s);
    const m=!q||(s.name+s.nickname+s.id+s.school_m1).toLowerCase().includes(q);
    return m&&(!fp||s.province===fp)&&(!fo||s.org===fo)&&(!fr||g.riskLevel===fr);
  });
}

function renderStudents(){
  const filtered=filterStudents();
  document.getElementById('std-count').textContent=`(${filtered.length} คน)`;
  const total=filtered.length;
  const pages=Math.ceil(total/STD_PER_PAGE);
  if(stdPage>pages) stdPage=1;

  if(currentView==='card'){
    document.getElementById('students-card-grid').innerHTML=filtered.map(s=>{
      const idx=DB.students.indexOf(s);
      const g=getLatestGpa(s);
      const gv=g.gpa||0;
      return `<div class="student-card" onclick="openStudentDetail(${idx})">
        <div class="card-photo-wrap">
          ${s.photoUrl
            ? `<img class="card-photo" src="${fixDriveUrl(s.photoUrl)}" alt="${s.name}" onclick="openLightbox('${(s.photoUrl||'').replace(/'/g,"&#39;")}','${(s.name||'').replace(/'/g,"&#39;")}');event.stopPropagation()" onerror="this.style.display='none';this.nextSibling.style.display='flex'"><div class="card-avatar" style="display:none">${initials(s.name)}</div><div class="card-photo-zoom-icon">🔍</div>`
            : `<div class="card-avatar">${initials(s.name)}</div>`}
          <div class="card-no">#${s.no}</div>
          ${g.riskLevel?`<div class="card-risk-badge"><span class="${riskBadge(g.riskLevel)}">${g.riskLevel}</span></div>`:''}
        </div>
        <div class="card-body">
          <div class="card-name">${s.name||'(ยังไม่ระบุชื่อ)'}</div>
          <div class="card-nickname">"${s.nickname}"</div>
          <div class="card-school">🏫 ${s.school_m1}</div>
          ${gv>0?`<div class="card-gpa-row">
            <div>
              <div class="card-gpa-val" style="color:${gpaColor(gv)}">${gv}</div>
              <div class="card-gpa-lbl">GPA</div>
            </div>
            <div class="card-bar"><div class="card-bar-fill" style="width:${(gv/4*100).toFixed(0)}%;background:${gpaColor(gv)}"></div></div>
          </div>`:'<div style="font-size:12px;color:var(--text3);margin-top:4px">ยังไม่มีข้อมูล GPA</div>'}
        </div>
        <div class="card-footer">
          <div class="card-province">📍 ${s.province}</div>
          ${g.hasObstacle?'<span class="badge b-amber" style="font-size:10px">มีอุปสรรค</span>':''}
        </div>
      </div>`;
    }).join('');
  } else {
    const slice=filtered.slice((stdPage-1)*STD_PER_PAGE,stdPage*STD_PER_PAGE);
    document.getElementById('students-tbody').innerHTML=slice.map(s=>{
      const idx=DB.students.indexOf(s);
      const g=getLatestGpa(s);
      const gv=g.gpa||0;
      const latestTerm=s.semGpa&&s.semGpa.length>0?s.semGpa[s.semGpa.length-1].term:'';
      return`<tr>
        <td style="color:var(--text2)">${s.no}</td>
        <td class="photo-cell">${photoEl(s)}</td>
        <td><div style="font-weight:600">${s.name||'(ยังไม่ระบุชื่อ)'}</div><div style="font-size:11px;color:var(--text3)">${s.nickname}</div></td>
        <td style="font-family:'Sarabun',monospace;font-size:11px">${maskId(s.id)}</td>
        <td style="font-size:12px">${s.dob||'-'}<div style="font-size:11px;color:var(--blue);font-weight:600">${calcAge(s.dob)}</div></td>
        <td style="font-size:12px">${s.phone||'-'}</td>
        <td style="font-size:12px">${s.school_m1}</td>
        <td><span class="badge b-blue">${s.province}</span></td>
        <td>${gv?`<span style="font-weight:700;color:${gpaColor(gv)}">${gv}</span>`:'-'} ${latestTerm?`<div style="font-size:10px;color:var(--text3)">${latestTerm}</div>`:''}</td>
        <td style="font-weight:600;color:${gpaColor(s.gpa_p6)}">${s.gpa_p6||'-'}</td>
        <td><span class="${riskBadge(g.riskLevel)}">${g.riskLevel||'-'}</span></td>
        <td><div style="display:flex;gap:4px">
          <button class="btn btn-sm" onclick="openStudentDetail(${idx});event.stopPropagation()">ดูข้อมูล</button>
          <button class="btn btn-sm btn-danger" onclick="deleteStudent(${idx});event.stopPropagation()">ลบ</button>
        </div></td>
      </tr>`;
    }).join('');
    document.getElementById('students-footer').textContent=`แสดง ${(stdPage-1)*STD_PER_PAGE+1}–${Math.min(stdPage*STD_PER_PAGE,total)} จาก ${total} รายการ`;
    // Pagination
    const pag=document.getElementById('students-pagination');
    let h='';
    if(pages>1){
      h+=`<button class="page-btn" onclick="goPage(${stdPage-1})" ${stdPage===1?'disabled':''}>←</button>`;
      for(let p=1;p<=pages;p++){
        if(p===1||p===pages||Math.abs(p-stdPage)<=1) h+=`<button class="page-btn ${p===stdPage?'active':''}" onclick="goPage(${p})">${p}</button>`;
        else if(Math.abs(p-stdPage)===2) h+='<span style="padding:4px 6px;color:var(--text3)">…</span>';
      }
      h+=`<button class="page-btn" onclick="goPage(${stdPage+1})" ${stdPage===pages?'disabled':''}>→</button>`;
    }
    pag.innerHTML=h;
  }
}
function goPage(p){if(p<1)return;stdPage=p;renderStudents();}
function openNewStudent(){
  const _no=DB.students.length+1;
  const ns={_docId:'no-'+_no,no:_no,id:'',name:'',nickname:'',dob:'',phone:'',parent:'',parentPhone:'',gpa_p6:0,school_p6:'',school_m1:'',province:'',org:'',photoUrl:'',addr:{},bank:{},payment:{p1:0,p2:0,term:'1/2568',item1:'ค่าเงินบำรุงการศึกษา',item2:'ค่าใช้จ่ายในการเรียน'},gpa:{gpa:0,hasObstacle:false,obstacleType:'',riskLevel:'ปานกลาง',weakSubjects:'',schoolSupport:''},semPayments:[{term:'1/2568',p1:0,p2:0,item1:'ค่าเงินบำรุงการศึกษา',item2:'ค่าใช้จ่ายในการเรียน'}],semGpa:[{term:'1/2568',gpa:0,riskLevel:'ปานกลาง',hasObstacle:false,obstacleType:'',weakSubjects:'',schoolSupport:''}]};
  DB.students.push(ns);
  openStudentDetail(DB.students.length-1);
}

// ============ STUDENT DETAIL MODAL ============
