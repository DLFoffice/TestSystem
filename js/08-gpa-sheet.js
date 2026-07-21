/* ============================================================
   08-gpa-sheet.js — หน้าตารางผลการเรียน (GPA Sheet) + export
   (แยกมาจาก index.html เดิม บรรทัด 2490-2829 โดยรักษาลำดับโค้ดเดิม)
   ============================================================ */
const BASE_YEAR = 2568; // ปีที่รับทุน (ม.1 ปีแรก)
function gradeFromTerm(term){
  if(!term) return 'ม.1';
  const m = String(term).match(/(\d+)\/(\d+)/);
  if(!m) return 'ม.1';
  const yr = parseInt(m[2]);
  const diff = yr - BASE_YEAR;
  const grade = Math.min(Math.max(diff+1,1),3);
  return `ม.${grade}`;
}

function getAllTermsSorted(){
  const terms = new Set();
  DB.students.forEach(s=>(s.semGpa||[]).forEach(g=>{ if(g.term) terms.add(g.term); }));
  return [...terms].sort((a,b)=>{
    const pa=String(a).match(/(\d+)\/(\d+)/), pb=String(b).match(/(\d+)\/(\d+)/);
    if(!pa||!pb) return String(a).localeCompare(String(b));
    return (parseInt(pa[2])*10+parseInt(pa[1])) - (parseInt(pb[2])*10+parseInt(pb[1]));
  });
}

function populateGpsTermFilter(){
  const terms = getAllTermsSorted();
  const sel = document.getElementById('gps-filter-term');
  // clear old options (keep first "ทุกภาคเรียน")
  while(sel.options.length > 1) sel.remove(1);
  terms.forEach(t=>{
    const o = document.createElement('option');
    o.value = t; o.textContent = `ภาคเรียน ${t}`;
    sel.appendChild(o);
  });
}

function renderGpaSheet(){
  populateGpsTermFilter();
  const q  = (document.getElementById('gps-search').value||'').toLowerCase();
  const fg = document.getElementById('gps-filter-grade').value;
  const ft = document.getElementById('gps-filter-term').value;

  // Build flat rows [{s, g, grade}]
  const rows = [];
  DB.students.forEach(s=>{
    (s.semGpa||[]).forEach(g=>{
      const grade = gradeFromTerm(g.term);
      if(fg && grade !== fg) return;
      if(ft && g.term !== ft) return;
      if(q && !(s.name+(s.school_m1||'')+(s.province||'')).toLowerCase().includes(q)) return;
      rows.push({s, g, grade});
    });
  });

  // Sort: grade → term → name
  rows.sort((a,b)=>{
    if(a.grade!==b.grade) return a.grade.localeCompare(b.grade,'th');
    if(a.g.term!==b.g.term) return String(a.g.term).localeCompare(String(b.g.term));
    return (a.s.name||'').localeCompare(b.s.name||'','th');
  });

  // ── KPI ──
  const gpas = rows.map(r=>r.g.gpa||0).filter(v=>v>0);
  const avg  = gpas.length ? (gpas.reduce((a,b)=>a+b,0)/gpas.length).toFixed(2) : '-';
  const mx   = gpas.length ? Math.max(...gpas).toFixed(2) : '-';
  const mn   = gpas.length ? Math.min(...gpas).toFixed(2) : '-';
  const highRisk = rows.filter(r=>r.g.riskLevel==='สูง'||r.g.riskLevel==='สูงมาก').length;
  const withObs  = rows.filter(r=>r.g.hasObstacle).length;
  document.getElementById('gps-kpi').innerHTML = `
    <div class="metric mv-blue" style="--metric-accent:var(--blue)">
      <div class="metric-icon">📊</div>
      <div class="metric-lbl">รายการ GPA</div>
      <div class="metric-val">${rows.length}</div>
      <div class="metric-sub">รายการทั้งหมด</div>
    </div>
    <div class="metric mv-teal">
      <div class="metric-icon">🎯</div>
      <div class="metric-lbl">GPA เฉลี่ย</div>
      <div class="metric-val">${avg}</div>
      <div class="metric-sub">ค่าเฉลี่ยกลุ่ม</div>
    </div>
    <div class="metric mv-green">
      <div class="metric-icon">⬆️</div>
      <div class="metric-lbl">GPA สูงสุด</div>
      <div class="metric-val">${mx}</div>
      <div class="metric-sub">ในกลุ่มที่เลือก</div>
    </div>
    <div class="metric mv-amber">
      <div class="metric-icon">⬇️</div>
      <div class="metric-lbl">GPA ต่ำสุด</div>
      <div class="metric-val">${mn}</div>
      <div class="metric-sub">ในกลุ่มที่เลือก</div>
    </div>
    <div class="metric mv-red">
      <div class="metric-icon">🔴</div>
      <div class="metric-lbl">ความเสี่ยงสูง</div>
      <div class="metric-val">${highRisk}</div>
      <div class="metric-sub">รายการ</div>
    </div>
    <div class="metric mv-amber">
      <div class="metric-icon">🚧</div>
      <div class="metric-lbl">มีอุปสรรค</div>
      <div class="metric-val">${withObs}</div>
      <div class="metric-sub">รายการ</div>
    </div>`;

  // ── Summary Table: Grade × Term ──
  const allTerms = getAllTermsSorted();
  const grades   = ['ม.1','ม.2','ม.3'];
  // build map: grade → term → [gpa values]
  const gMap = {};
  grades.forEach(gr=>{ gMap[gr]={}; allTerms.forEach(t=>{ gMap[gr][t]=[]; }); });
  rows.forEach(r=>{ if(gMap[r.grade] && r.g.gpa>0) (gMap[r.grade][r.g.term]=gMap[r.grade][r.g.term]||[]).push(r.g.gpa); });

  const displayTerms = ft ? [ft] : allTerms;
  document.getElementById('gps-summary-head').innerHTML =
    `<tr><th style="text-align:left">ชั้น / ภาคเรียน</th>${displayTerms.map(t=>`<th>${t}</th>`).join('')}<th>รวมเฉลี่ย</th></tr>`;
  document.getElementById('gps-summary-body').innerHTML = grades.map(gr=>{
    const allVals = displayTerms.flatMap(t=>(gMap[gr][t]||[]));
    const rowAvg  = allVals.length ? (allVals.reduce((a,b)=>a+b,0)/allVals.length).toFixed(2) : '-';
    const cells   = displayTerms.map(t=>{
      const vals=(gMap[gr][t]||[]);
      if(!vals.length) return `<td style="color:var(--text3)">—</td>`;
      const a=(vals.reduce((x,y)=>x+y,0)/vals.length).toFixed(2);
      const clr=gpaColor(parseFloat(a));
      return `<td><span style="font-weight:700;color:${clr}">${a}</span><div style="font-size:10px;color:var(--text3)">${vals.length} คน</div></td>`;
    }).join('');
    return `<tr>
      <td style="font-weight:700;font-family:var(--font-heading)">${gr}</td>
      ${cells}
      <td style="font-weight:700;color:${gpaColor(parseFloat(rowAvg))};font-size:15px">${rowAvg}</td>
    </tr>`;
  }).join('');

  // ── Charts ──
  // 1) Trend: avg per term (all grades or filtered grade)
  destroyChart('gpsChartTrend');
  const trendLabels = displayTerms;
  const gradeColors = {'ม.1':'#2563EB','ม.2':'#0F766E','ม.3':'#92400E'};
  const trendDatasets = (fg ? [fg] : grades).map(gr=>({
    label: gr,
    data: displayTerms.map(t=>{ const v=(gMap[gr][t]||[]); return v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2):null; }),
    borderColor: gradeColors[gr]||'#666',
    backgroundColor: (gradeColors[gr]||'#666')+'22',
    tension:0.3, fill:true, pointRadius:5, pointHoverRadius:7, borderWidth:2.5
  }));
  charts['gpsChartTrend'] = new Chart(document.getElementById('gpsChartTrend'),{
    type:'line',
    data:{labels:trendLabels, datasets:trendDatasets},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'top',labels:{font:{family:'Sarabun',size:12},boxWidth:12}}},
      scales:{
        y:{min:0,max:4,ticks:{stepSize:0.5},title:{display:true,text:'GPA',font:{family:'Sarabun'}}},
        x:{ticks:{font:{family:'Sarabun',size:11}}}
      }
    }
  });

  // 2) Grade bar: avg per grade
  destroyChart('gpsChartGrade');
  const gradeAvgs = grades.map(gr=>{ const v=Object.values(gMap[gr]).flat(); return v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2):0; });
  charts['gpsChartGrade'] = new Chart(document.getElementById('gpsChartGrade'),{
    type:'bar',
    data:{labels:grades, datasets:[{
      label:'GPA เฉลี่ย',
      data:gradeAvgs,
      backgroundColor:grades.map(gr=>gradeColors[gr]+'CC'),
      borderColor:grades.map(gr=>gradeColors[gr]),
      borderWidth:2, borderRadius:6
    }]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{y:{min:0,max:4,ticks:{stepSize:0.5}},x:{ticks:{font:{family:'Sarabun',size:13}}}}
    }
  });

  // 3) Histogram: distribution of GPA in filtered set
  destroyChart('gpsChartDist');
  const buckets={'<2.0':0,'2.0–2.49':0,'2.5–2.99':0,'3.0–3.49':0,'3.5–4.0':0};
  gpas.forEach(v=>{
    if(v<2.0)       buckets['<2.0']++;
    else if(v<2.5)  buckets['2.0–2.49']++;
    else if(v<3.0)  buckets['2.5–2.99']++;
    else if(v<3.5)  buckets['3.0–3.49']++;
    else            buckets['3.5–4.0']++;
  });
  charts['gpsChartDist'] = new Chart(document.getElementById('gpsChartDist'),{
    type:'bar',
    data:{labels:Object.keys(buckets), datasets:[{
      label:'จำนวน',
      data:Object.values(buckets),
      backgroundColor:['#DC2626CC','#EE4E4ECC','#E9C46ACC','#41B06ECC','#15803DCC'],
      borderRadius:5, borderWidth:0
    }]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{y:{beginAtZero:true,ticks:{stepSize:1}},x:{ticks:{font:{family:'Sarabun',size:11}}}}
    }
  });

  // ── Detail Table ──
  document.getElementById('gps-tbody').innerHTML = rows.map(({s,g,grade},i)=>{
    const idx = DB.students.indexOf(s);
    const delta = (s.gpa_p6&&g.gpa) ? (g.gpa-s.gpa_p6).toFixed(2) : null;
    const deltaHtml = delta!=null
      ? `<span style="font-weight:600;color:${parseFloat(delta)>=0?'var(--green)':'var(--red)'}">
           ${parseFloat(delta)>=0?'▲':'▼'} ${Math.abs(delta)}</span>`
      : '<span style="color:var(--text3)">—</span>';
    return `<tr>
      <td>${i+1}</td>
      <td class="photo-cell">${photoEl(s)}</td>
      <td style="font-weight:600">${s.name}<div style="font-size:11px;color:var(--text3)">${s.nickname||''}</div></td>
      <td><span class="badge b-blue">${grade}</span></td>
      <td style="font-size:12px;max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.school_m1||'-'}</td>
      <td><span class="badge b-gray">${s.province||'-'}</span></td>
      <td><span class="badge b-teal">${g.term||'-'}</span></td>
      <td>
        <div style="font-weight:700;font-size:16px;color:${gpaColor(g.gpa)}">${g.gpa||'-'}</div>
        ${g.gpa?`<div class="gpa-bar"><div class="gpa-fill" style="width:${(g.gpa/4*100).toFixed(0)}%;background:${gpaColor(g.gpa)}"></div></div>`:''}
      </td>
      <td style="font-weight:600;color:${gpaColor(s.gpa_p6)}">${s.gpa_p6||'-'}</td>
      <td>${deltaHtml}</td>
      <td><span class="${riskBadge(g.riskLevel)}">${g.riskLevel||'-'}</span></td>
      <td>${g.hasObstacle?'<span class="badge b-amber">มี</span>':'<span class="badge b-teal">ไม่มี</span>'}</td>
      <td style="font-size:12px;color:var(--red);max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${g.weakSubjects||'-'}</td>
      <td>
        <button class="btn btn-sm" onclick="openStudentDetail(${idx});setTimeout(()=>switchTabByName('📊 ประวัติ GPA'),200)">✏️ แก้ไข</button>
      </td>
    </tr>`;
  }).join('');
  document.getElementById('gps-footer').textContent = `แสดง ${rows.length} รายการ (${[...new Set(rows.map(r=>r.s.id||r.s.no))].length} คน)`;
  document.getElementById('gpa-sheet-count').textContent = `— ${rows.length} รายการ`;
}

function openAddGpaRecord(){
  // เปิด modal เพิ่ม GPA: ให้เลือกนักเรียนก่อน
  const names = DB.students.map((s,i)=>`<option value="${i}">${s.no}. ${s.name} (${s.nickname||''})</option>`).join('');
  const terms = getAllTermsSorted();
  const termOpts = terms.map(t=>`<option>${t}</option>`).join('');
  const suggestTerm = terms.length ? '' : '1/2568';
  document.getElementById('sem-modal-title').textContent = '+ เพิ่มข้อมูล GPA';
  document.getElementById('sem-modal-type').innerHTML = '';
  document.getElementById('sem-modal-body').innerHTML = `
    <div class="form-grid">
      <div class="fg fg-full"><label>นักเรียน</label>
        <select id="add-gpa-student"><option value="">-- เลือกนักเรียน --</option>${names}</select>
      </div>
      <div class="fg"><label>ภาคเรียน</label>
        <input id="add-gpa-term" list="add-gpa-term-list" placeholder="เช่น 1/2568" value="${suggestTerm}">
        <datalist id="add-gpa-term-list">${termOpts}</datalist>
      </div>
      <div class="fg"><label>GPA</label>
        <input type="number" id="add-gpa-val" step="0.01" min="0" max="4" placeholder="0.00–4.00">
      </div>
      <div class="fg"><label>ระดับความเสี่ยง</label>
        <select id="add-gpa-risk">
          <option>ต่ำ</option><option selected>ปานกลาง</option><option>สูง</option><option>สูงมาก</option>
        </select>
      </div>
      <div class="fg"><label>มีอุปสรรค</label>
        <select id="add-gpa-obs"><option value="false">ไม่มี</option><option value="true">มี</option></select>
      </div>
      <div class="fg"><label>ประเภทอุปสรรค</label>
        <input id="add-gpa-obs-type" placeholder="เช่น ด้านการเงิน">
      </div>
      <div class="fg fg-full"><label>วิชาที่อ่อน</label>
        <input id="add-gpa-weak" placeholder="เช่น คณิตศาสตร์, ภาษาอังกฤษ">
      </div>
      <div class="fg fg-full"><label>การช่วยเหลือของโรงเรียน</label>
        <input id="add-gpa-support" placeholder="เช่น ติวเสริม, ครูที่ปรึกษา">
      </div>
    </div>`;
  // override saveSemData for this context
  window._addGpaMode = true;
  document.getElementById('sem-modal').classList.add('open');
}

// override saveSemData to handle add-gpa mode
const _origSaveSemData = window.saveSemData;
window.saveSemData = function(){
  if(window._addGpaMode){
    window._addGpaMode = false;
    const idx = parseInt(document.getElementById('add-gpa-student').value);
    if(isNaN(idx)||idx<0||idx>=DB.students.length){ alert('กรุณาเลือกนักเรียน'); window._addGpaMode=true; return; }
    const term = (document.getElementById('add-gpa-term').value||'').trim();
    if(!term){ alert('กรุณากรอกภาคเรียน'); window._addGpaMode=true; return; }
    const gpa  = parseFloat(document.getElementById('add-gpa-val').value)||0;
    const rec = {
      term, gpa,
      riskLevel:    document.getElementById('add-gpa-risk').value,
      hasObstacle:  document.getElementById('add-gpa-obs').value==='true',
      obstacleType: document.getElementById('add-gpa-obs-type').value||'',
      weakSubjects: document.getElementById('add-gpa-weak').value||'',
      schoolSupport:document.getElementById('add-gpa-support').value||''
    };
    if(!DB.students[idx].semGpa) DB.students[idx].semGpa=[];
    // check duplicate term
    const dupIdx = DB.students[idx].semGpa.findIndex(g=>g.term===term);
    if(dupIdx>=0){
      if(!confirm(`ภาคเรียน ${term} มีอยู่แล้ว ต้องการอัพเดตหรือไม่?`)) { window._addGpaMode=true; return; }
      DB.students[idx].semGpa[dupIdx]=rec;
    } else {
      DB.students[idx].semGpa.push(rec);
    }
    // sync gpa object
    DB.students[idx].gpa = {...rec};
    saveToStorage();
    closeModal('sem-modal');
    renderGpaSheet();
    showStatus('✅ เพิ่มข้อมูล GPA สำเร็จ','success');
    return;
  }
  if(_origSaveSemData) _origSaveSemData();
};

function exportGpaSheet(){
  const q  = (document.getElementById('gps-search').value||'').toLowerCase();
  const fg = document.getElementById('gps-filter-grade').value;
  const ft = document.getElementById('gps-filter-term').value;
  const rows=[];
  DB.students.forEach(s=>{
    (s.semGpa||[]).forEach(g=>{
      const grade=gradeFromTerm(g.term);
      if(fg&&grade!==fg) return;
      if(ft&&g.term!==ft) return;
      if(q&&!(s.name+(s.school_m1||'')+(s.province||'')).toLowerCase().includes(q)) return;
      rows.push({s,g,grade});
    });
  });
  const header='ลำดับ,ชื่อ-สกุล,ชั้น,โรงเรียน,จังหวัด,ภาคเรียน,GPA,GPA ป.6,Δ vs ป.6,ความเสี่ยง,มีอุปสรรค,ประเภทอุปสรรค,วิชาที่อ่อน,การช่วยเหลือโรงเรียน';
  const csv=[header,...rows.map(({s,g,grade},i)=>{
    const delta=(s.gpa_p6&&g.gpa)?(g.gpa-s.gpa_p6).toFixed(2):'';
    return [i+1,s.name,grade,s.school_m1||'',s.province||'',g.term||'',g.gpa||'',s.gpa_p6||'',delta,g.riskLevel||'',g.hasObstacle?'มี':'ไม่มี',g.obstacleType||'',g.weakSubjects||'',g.schoolSupport||''].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',');
  })].join('\n');
  const bom='\uFEFF';
  const blob=new Blob([bom+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`GPA_Sheet_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// ============ PHOTO UPLOAD ============
