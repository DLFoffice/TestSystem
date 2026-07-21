/* ============================================================
   15-form-tracking.js — หน้าติดตามสถานะการกรอกแบบฟอร์ม + ส่งขึ้น Google Sheet
   (แยกมาจาก index.html เดิม บรรทัด 4438-5368 โดยรักษาลำดับโค้ดเดิม)
   ============================================================ */
let ftPage = 1;
const FT_PER_PAGE = 15;
function ftOverallStatus(student){
  const {done1, done2, started1, started2} = sfFormStatus(student);
  if(done1 && done2) return 'done';                 // ครบทั้ง 2 แบบฟอร์ม
  if(done1 || done2 || started1 || started2) return 'partial';  // เริ่มกรอก/ครบบางแบบฟอร์ม
  return 'none';                                     // ยังไม่แตะเลย
}
function ftStatusMeta(status){
  if(status==='done') return {label:'✓ กรอกครบแล้ว', cls:'b-green'};
  if(status==='partial') return {label:'◐ กรอกบางส่วน', cls:'b-amber'};
  return {label:'✗ ยังไม่กรอก', cls:'b-red'};
}
function filterFormTrack(){
  const q = (document.getElementById('ft-search')?.value||'').trim().toLowerCase();
  const statusFilter = document.getElementById('ft-filter-status')?.value||'';
  return DB.students.filter(s=>{
    const matchQ = !q || (s.name||'').toLowerCase().includes(q) || (s.school_m1||'').toLowerCase().includes(q);
    const matchStatus = !statusFilter || ftOverallStatus(s)===statusFilter;
    return matchQ && matchStatus;
  });
}
function renderFormTrack(){
  const filtered = filterFormTrack();
  const total = filtered.length;
  const termLbl = (window.Term && window.Term.label) ? window.Term.label(window.Term.active()) : '';
  document.getElementById('ft-count').textContent = `(${total} คน)`;

  // Summary metrics
  const doneCount = DB.students.filter(s=>ftOverallStatus(s)==='done').length;
  const partialCount = DB.students.filter(s=>ftOverallStatus(s)==='partial').length;
  const noneCount = DB.students.filter(s=>ftOverallStatus(s)==='none').length;
  document.getElementById('ft-metrics').innerHTML = `
    <div class="metric mv-blue">
      <div class="metric-icon">🏫</div>
      <div class="metric-lbl">โรงเรียนทั้งหมด</div>
      <div class="metric-val">${DB.students.length}</div>
      <div class="metric-sub">คน ในระบบ</div>
    </div>
    <div class="metric mv-green">
      <div class="metric-icon">✅</div>
      <div class="metric-lbl">กรอกครบแล้ว</div>
      <div class="metric-val">${doneCount}</div>
      <div class="metric-sub">แบบฟอร์ม 1 และ 2</div>
    </div>
    <div class="metric mv-amber">
      <div class="metric-icon">🟠</div>
      <div class="metric-lbl">กรอกบางส่วน</div>
      <div class="metric-val">${partialCount}</div>
      <div class="metric-sub">กรอกแล้ว 1 แบบฟอร์ม</div>
    </div>
    <div class="metric mv-red">
      <div class="metric-icon">🔴</div>
      <div class="metric-lbl">ยังไม่กรอก</div>
      <div class="metric-val">${noneCount}</div>
      <div class="metric-sub">ยังไม่ส่งข้อมูล</div>
    </div>`;

  const pages = Math.max(1, Math.ceil(total/FT_PER_PAGE));
  if(ftPage>pages) ftPage=1;
  const slice = filtered.slice((ftPage-1)*FT_PER_PAGE, ftPage*FT_PER_PAGE);

  document.getElementById('formtrack-tbody').innerHTML = slice.map(s=>{
    const idx = DB.students.indexOf(s);
    const {has1, has2, started1, started2} = sfFormStatus(s);
    const status = ftOverallStatus(s);
    const meta = ftStatusMeta(status);
    const orderNo = s.no || (idx+1);
    const previewLinks = (started1||started2) ? `<div style="display:flex;gap:6px;margin-top:4px;font-size:11px">
        ${started1?`<a href="javascript:void(0)" onclick="ftOpenPreview(${idx},'form1')" style="color:var(--blue);text-decoration:underline">👁️ พรีวิวฟอร์ม 1${has1?' ✓':' (บางส่วน)'}</a>`:''}
        ${started2?`<a href="javascript:void(0)" onclick="ftOpenPreview(${idx},'form2')" style="color:var(--blue);text-decoration:underline">👁️ พรีวิวฟอร์ม 2${has2?' ✓':' (บางส่วน)'}</a>`:''}
      </div>` : '';
    return `<tr>
      <td style="color:var(--text2)">${orderNo}</td>
      <td class="photo-cell">${photoEl(s)}</td>
      <td><div style="font-weight:600">${s.name||'(ไม่ระบุชื่อ)'}</div>${s.nickname?`<div style="font-size:11px;color:var(--text3)">${s.nickname}</div>`:''}</td>
      <td style="font-size:12px">${s.school_m1||'-'}</td>
      <td><span class="badge ${meta.cls}">${meta.label}</span>${termLbl?`<div style="font-size:10px;color:var(--text3);margin-top:3px">📅 ${termLbl}</div>`:''}${previewLinks}</td>
      <td><button class="btn btn-sm" onclick="ftOpenStudentForm(${idx})">📝 เปิดฟอร์ม</button></td>
    </tr>`;
  }).join('');

  document.getElementById('formtrack-footer').textContent = total
    ? `แสดง ${(ftPage-1)*FT_PER_PAGE+1}–${Math.min(ftPage*FT_PER_PAGE,total)} จาก ${total} รายการ`
    : 'ไม่พบข้อมูล';

  const pag = document.getElementById('formtrack-pagination');
  let h='';
  if(pages>1){
    h+=`<button class="page-btn" onclick="ftGoPage(${ftPage-1})" ${ftPage===1?'disabled':''}>←</button>`;
    for(let p=1;p<=pages;p++){
      if(p===1||p===pages||Math.abs(p-ftPage)<=1) h+=`<button class="page-btn ${p===ftPage?'active':''}" onclick="ftGoPage(${p})">${p}</button>`;
      else if(Math.abs(p-ftPage)===2) h+='<span style="padding:4px 6px;color:var(--text3)">…</span>';
    }
    h+=`<button class="page-btn" onclick="ftGoPage(${ftPage+1})" ${ftPage===pages?'disabled':''}>→</button>`;
  }
  pag.innerHTML = h;
}
function ftGoPage(p){ if(p<1) return; ftPage=p; renderFormTrack(); }
function ftOpenStudentForm(idx){
  sfState.studentIdx = idx;
  sfState.formKey = 'form1';
  sfState.sectionIndex = 0;
  sfState.lastDir = 'jump';
  showPage('scholarform', document.querySelector('.nav-btn[onclick*="scholarform"]'));
}
function ftOpenPreview(idx, formKey){
  sfState.studentIdx = idx;
  sfState.formKey = formKey || 'form1';
  sfOpenPreview();
}

function sfRenderPicker(){
  const q = (sfState.query||'').trim().toLowerCase();
  const list = DB.students.map((s,idx)=>({s,idx})).filter(({s})=>{
    if(!q) return true;
    return (s.name||'').toLowerCase().includes(q) || (s.school_m1||'').toLowerCase().includes(q) || (s.province||'').toLowerCase().includes(q) || (s.id||'').includes(q);
  });
  const cards = list.map(({s,idx}, i)=>{
    const st = sfFormStatus(s);
    const initialLetter = (s.name||'?').replace(/^(ด\.ช\.|ด\.ญ\.|นาย|นางสาว|น\.ส\.)/,'').trim().charAt(0)||'?';
    const delay = Math.min(i,24)*0.02;
    const orderNo = s.no || (idx+1);
    const avatarInner = s.photoUrl
      ? `<img class="sf-card-photo" src="${sfEscapeHtml(typeof fixDriveUrl==='function'?fixDriveUrl(s.photoUrl):s.photoUrl)}" alt="${sfEscapeHtml(s.name||'')}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="sf-card-avatar-fallback">${sfEscapeHtml(initialLetter)}</span>`
      : `<span class="sf-card-avatar-fallback" style="display:flex">${sfEscapeHtml(initialLetter)}</span>`;
    return `<button type="button" class="sf-card" style="animation-delay:${delay}s" data-sf-action="open-student" data-sf-idx="${idx}">
      <span class="sf-card-order">${orderNo}</span>
      <span class="sf-card-avatar">${avatarInner}</span>
      <span class="sf-card-body">
        <span class="sf-card-name">${sfEscapeHtml(s.name||'(ไม่ระบุชื่อ)')}</span>
        <span class="sf-card-meta">${sfEscapeHtml(s.school_m1||'-')} · ${sfEscapeHtml(s.province||'-')}</span>
        <span class="sf-card-status">
          <span class="sf-tag ${st.done1?'done':st.started1?'partial':''}">${st.done1?'✓ ':st.started1?'◐ ':''}แบบฟอร์ม 1</span>
          <span class="sf-tag ${st.done2?'done':st.started2?'partial':''}">${st.done2?'✓ ':st.started2?'◐ ':''}แบบฟอร์ม 2</span>
          ${(window.Term&&window.Term.label)?`<span class="sf-tag sf-tag-term">📅 ${window.Term.label(window.Term.active())}</span>`:''}
        </span>
      </span>
    </button>`;
  }).join('');
  return `<div class="sf-picker">
    <div class="sf-picker-head">
      <h2>เลือกนักเรียนเพื่อกรอกแบบฟอร์ม (${list.length})</h2>
      <input type="text" class="sf-search" placeholder="🔍 ค้นหาชื่อ / โรงเรียน / จังหวัด / เลขบัตรประชาชน" value="${sfEscapeHtml(sfState.query||'')}" data-sf-action="search">
    </div>
    ${list.length? `<div class="sf-picker-grid">${cards}</div>` : `
      <div class="sf-empty"><p>ไม่พบนักเรียนที่ค้นหา</p><span>ลองคำค้นอื่น หรือเพิ่มนักเรียนในหน้า "รายชื่อนักเรียน" ก่อน</span></div>`}
  </div>`;
}

/* ---------- Root render ---------- */
function sfRenderPage(){
  const root = document.getElementById('sf-root');
  if(!root) return;
  if(sfState.studentIdx===null || !DB.students[sfState.studentIdx]){
    root.innerHTML = sfRenderPicker();
  } else {
    root.innerHTML = sfRenderEditor();
  }
  sfSetupEventsOnce();
}

/* ---------- Persistence (reuses the app's own storage) ---------- */
const _sfDebouncedSave = sfDebounce(function(){
  sfState.saveStatus='saving';
  sfUpdateSaveStatusUI();
  saveToStorage();
  sfState.saveStatus='saved';
  sfUpdateSaveStatusUI();
}, 600);
function sfPersist(){
  const student = sfGetStudent();
  if(student){
    if(!student[sfState.formKey]) student[sfState.formKey] = {};
    student[sfState.formKey].__touched = true;   // เริ่มกรอกแล้ว (บางส่วน)
    // ❗ ไม่ตั้ง __complete ที่นี่ — สถานะ "กรอกครบ" จะขึ้นก็ต่อเมื่อกรอกครบและกดบันทึกเท่านั้น
    // ถ้าเคยครบแล้วแต่ตอนนี้ถูกแก้จนไม่ครบ → ถอนสถานะให้ตรงความจริง
    if(student[sfState.formKey].__complete && !sfIsFormComplete(sfState.formKey)){
      student[sfState.formKey].__complete = false;
    }
  }
  _sfDebouncedSave();
}
function sfUpdateSaveStatusUI(){
  const el = document.querySelector('.sf-save-status');
  if(!el) return;
  el.className = 'sf-save-status '+sfState.saveStatus;
  el.textContent = sfState.saveStatus==='saving'?'กำลังบันทึก…':sfState.saveStatus==='saved'?'บันทึกแล้ว':'พร้อมบันทึกอัตโนมัติ';
}

/* ---------- Helpers used by event delegation ---------- */
function sfFindField(formKey, fieldId){
  for(const s of sfGetSections(formKey)){ const f=s.fields.find(f=>f.id===fieldId); if(f) return f; }
  return null;
}
function sfRerenderTable(fieldId, field){ const el=document.getElementById('sf-table-'+fieldId); if(el) el.outerHTML = sfRenderTable(sfState.formKey, field); }
function sfRerenderMatrix(fieldId, field){ const el=document.getElementById('sf-matrix-'+fieldId); if(el) el.outerHTML = sfRenderMatrix(sfState.formKey, field); }
function sfUpdateChipUI(){
  const el = document.querySelector('.sf-student-chip-name');
  if(el){ const s=sfGetStudent(); el.textContent = (s&&s.name) || '(ยังไม่ระบุชื่อ)'; }
}

/* ---------- Event delegation (bound once) ---------- */
let _sfEventsBound = false;
function sfSetupEventsOnce(){
  if(_sfEventsBound) return;
  _sfEventsBound = true;
  const root = document.getElementById('sf-root');

  // การ์ดเลือกนักเรียน: ขยายเมื่อเมาส์ชี้ (ใช้ JS toggle class แทน/เสริม CSS :hover
  // เพื่อให้ทำงานแน่นอนแม้ในบางเบราว์เซอร์/บางกรณีที่ pseudo-class ไม่ทำงานตามคาด)
  root.addEventListener('mouseover', function(e){
    const card = e.target.closest('.sf-card');
    if(card) card.classList.add('sf-hovered');
  });
  root.addEventListener('mouseout', function(e){
    const card = e.target.closest('.sf-card');
    if(card && (!e.relatedTarget || !card.contains(e.relatedTarget))) card.classList.remove('sf-hovered');
  });

  root.addEventListener('click', function(e){
    const btn = e.target.closest('[data-sf-action]');
    if(!btn) return;
    const action = btn.getAttribute('data-sf-action');
    if(action==='open-student'){ sfState.studentIdx = parseInt(btn.getAttribute('data-sf-idx'),10); sfState.formKey='form1'; sfState.sectionIndex=0; sfState.lastDir='jump'; sfRenderPage(); }
    else if(action==='go-picker'){ sfState.studentIdx=null; sfRenderPage(); }
    else if(action==='switch-form'){ sfState.formKey=btn.getAttribute('data-sf-form'); sfState.sectionIndex=0; sfState.lastDir='jump'; sfRenderPage(); }
    else if(action==='go-section'){ const target=parseInt(btn.getAttribute('data-sf-idx'),10); sfState.lastDir = target>sfState.sectionIndex?'next':target<sfState.sectionIndex?'prev':'jump'; sfState.sectionIndex=target; sfRenderPage(); }
    else if(action==='prev-section'){ if(sfState.sectionIndex>0){ sfState.sectionIndex--; sfState.lastDir='prev'; sfRenderPage(); } }
    else if(action==='next-section'){ const max=sfGetSections(sfState.formKey).length-1; if(sfState.sectionIndex<max){ sfState.sectionIndex++; sfState.lastDir='next'; sfRenderPage(); } }
    else if(action==='print'){ sfOpenPreview(); }
    else if(action==='send-sheet'){ sfSendToSheet(btn); }
    else if(action==='add-row'){
      const fieldId=btn.getAttribute('data-sf-table'); const field=sfFindField(sfState.formKey,fieldId);
      const arr = sfGetValue(sfState.formKey, fieldId, field); arr.push({_id:sfUid(), cells:{}});
      sfRerenderTable(fieldId, field); sfPersist();
    }
    else if(action==='del-row'){
      const fieldId=btn.getAttribute('data-sf-table'); const rowId=btn.getAttribute('data-sf-row'); const field=sfFindField(sfState.formKey,fieldId);
      let arr = sfGetValue(sfState.formKey, fieldId, field); arr = arr.filter(r=>r._id!==rowId);
      sfGetStudent()[sfState.formKey][fieldId] = arr;
      sfRerenderTable(fieldId, field); sfPersist();
    }
    else if(action==='add-col'){
      const fieldId=btn.getAttribute('data-sf-matrix'); const field=sfFindField(sfState.formKey,fieldId);
      const val = sfGetValue(sfState.formKey, fieldId, field); val.cols.push({_id:sfUid(), label:''});
      sfRerenderMatrix(fieldId, field); sfPersist();
    }
  });

  root.addEventListener('change', function(e){
    const t = e.target;
    if(t.matches('input[type=radio][data-sf-field]')){
      const fieldId=t.getAttribute('data-sf-field'); const field=sfFindField(sfState.formKey,fieldId);
      const val = sfGetValue(sfState.formKey, fieldId, field); val.choice=t.getAttribute('data-sf-choice');
      sfGetStudent()[sfState.formKey][fieldId]=val; sfState.lastDir='jump'; sfRenderPage(); sfPersist();
    } else if(t.matches('input[type=checkbox][data-sf-field]')){
      const fieldId=t.getAttribute('data-sf-field'); const field=sfFindField(sfState.formKey,fieldId);
      const val = sfGetValue(sfState.formKey, fieldId, field);
      if(t.hasAttribute('data-sf-cbother')){
        const i=val.selected.indexOf('__other__');
        if(t.checked&&i===-1) val.selected.push('__other__'); if(!t.checked&&i>-1) val.selected.splice(i,1);
      } else {
        const opt=t.getAttribute('data-sf-cbvalue'); const i=val.selected.indexOf(opt);
        if(t.checked&&i===-1) val.selected.push(opt); if(!t.checked&&i>-1) val.selected.splice(i,1);
      }
      sfGetStudent()[sfState.formKey][fieldId]=val; sfState.lastDir='jump'; sfRenderPage(); sfPersist();
    }
  });

  root.addEventListener('input', function(e){
    const t = e.target;
    if(t.matches('[data-sf-action="search"]')){ sfState.query=t.value; sfRenderPage();
      const inp=document.querySelector('.sf-search'); if(inp){ inp.focus(); inp.selectionStart=inp.selectionEnd=inp.value.length; }
      return;
    }
    if(t.matches('.sf-input[data-sf-field]') && !t.hasAttribute('data-sf-other')){
      sfSetSimpleValue(sfState.formKey, t.getAttribute('data-sf-field'), t.value); sfPersist();
      const fid=t.getAttribute('data-sf-field');
      if(['full_name','first_name','last_name'].includes(fid)) sfUpdateChipUI();
    } else if(t.hasAttribute('data-sf-other')){
      const fieldId=t.getAttribute('data-sf-field'); const field=sfFindField(sfState.formKey,fieldId);
      const val = sfGetValue(sfState.formKey, fieldId, field); val.other=t.value;
      sfGetStudent()[sfState.formKey][fieldId]=val; sfPersist();
    } else if(t.matches('[data-sf-table][data-sf-row][data-sf-col]')){
      const fieldId=t.getAttribute('data-sf-table'); const field=sfFindField(sfState.formKey,fieldId);
      const arr = sfGetValue(sfState.formKey, fieldId, field);
      const row = arr.find(r=>r._id===t.getAttribute('data-sf-row'));
      if(row) row.cells[t.getAttribute('data-sf-col')] = t.value;
      sfPersist();
    } else if(t.matches('[data-sf-matrix][data-sf-mrow][data-sf-mcol]')){
      const fieldId=t.getAttribute('data-sf-matrix'); const field=sfFindField(sfState.formKey,fieldId);
      const val = sfGetValue(sfState.formKey, fieldId, field);
      const rk=t.getAttribute('data-sf-mrow'), ck=t.getAttribute('data-sf-mcol');
      if(!val.values[rk]) val.values[rk]={}; val.values[rk][ck]=t.value; sfPersist();
    } else if(t.matches('[data-sf-matrix][data-sf-colhead]')){
      const fieldId=t.getAttribute('data-sf-matrix'); const field=sfFindField(sfState.formKey,fieldId);
      const val = sfGetValue(sfState.formKey, fieldId, field);
      const col = val.cols.find(c=>c._id===t.getAttribute('data-sf-colhead'));
      if(col) col.label=t.value; sfPersist();
    }
  });
}


/* ============================================================
   SF PRINT — faithful replica of the two official paper forms
   for window.print() → Save as PDF. Arabic numerals throughout
   per request (source form uses Thai numerals ๑,๒,๓...).
============================================================ */
function sfFormatDatePrint(raw){
  if(!raw) return '';
  const s = String(raw).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if(dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  // Handles values corrupted into an ISO datetime (e.g. after round-tripping through
  // Google Sheets / JSON, which turns a plain "YYYY-MM-DD" into a UTC timestamp).
  // Shift back by the Bangkok offset (+7h) to recover the intended calendar date.
  const dateTime = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z?$/.exec(s);
  if(dateTime){
    const utcMs = Date.UTC(+dateTime[1], +dateTime[2]-1, +dateTime[3], +dateTime[4], +dateTime[5], +dateTime[6]);
    const bkk = new Date(utcMs + 7*60*60*1000);
    const y = bkk.getUTCFullYear(), m = String(bkk.getUTCMonth()+1).padStart(2,'0'), d = String(bkk.getUTCDate()).padStart(2,'0');
    return `${d}/${m}/${y}`;
  }
  return s;
}
function sfPV(formKey, fieldId){
  const field = sfFindField(formKey, fieldId);
  if(!field) return '';
  return sfGetValue(formKey, fieldId, field);
}
function sfPText(formKey, fieldId){
  const field = sfFindField(formKey, fieldId);
  const v = sfPV(formKey, fieldId);
  if(typeof v!=='string') return '';
  return (field && field.type==='date') ? sfFormatDatePrint(v) : v;
}
// ตัวเลขเงิน — ใส่จุลภาคให้อ่านง่ายในเอกสารพิมพ์
function sfPMoney(formKey, fieldId){
  const raw = sfPText(formKey, fieldId);
  if(raw==='' || raw==null) return '';
  return (typeof sfFmtMoney==='function') ? sfFmtMoney(raw) : raw;
}
// ชื่อผู้รับทุน สำหรับช่องลงชื่อ (ใส่ชื่อเด็กให้เลย ไม่ต้องเซ็น/ลงวันที่)
function sfSignName(formKey, student){
  let nm = sfPText(formKey,'full_name');
  if(!nm){ nm = [sfPChoiceText(formKey,'prefix'), sfPText(formKey,'first_name'), sfPText(formKey,'last_name')].filter(Boolean).join(' '); }
  return nm || (student && student.name) || '';
}
function sfPChoiceText(formKey, fieldId){
  const v = sfPV(formKey, fieldId);
  if(!v || typeof v!=='object') return '';
  if(v.choice==='__other__') return v.other || '';
  return v.choice || '';
}
function sfPCheckbox(formKey, fieldId, optionLabel){
  const v = sfPV(formKey, fieldId);
  let checked = false;
  if(v && typeof v==='object'){
    if(Array.isArray(v.selected)) checked = v.selected.indexOf(optionLabel)>-1;
    else checked = v.choice===optionLabel;
  }
  return `<span class="sfp-checkbox">${checked?'☑':'☐'} ${sfEscapeHtml(optionLabel)}</span>`;
}
function sfPOtherText(formKey, fieldId){
  const v = sfPV(formKey, fieldId);
  if(v && typeof v==='object'){
    if(Array.isArray(v.selected) && v.selected.indexOf('__other__')>-1) return v.other||'';
    if(v.choice==='__other__') return v.other||'';
  }
  return '';
}
function sfFill(text, minWidth){
  const t = sfEscapeHtml(text||'');
  return `<span class="sfp-fill" style="min-width:${minWidth||40}px">${t||'&nbsp;'}</span>`;
}
function sfPLine(label, formKey, fieldId, minWidth){
  return `<span class="sfp-field-line"><span>${sfEscapeHtml(label)}</span>${sfFill(sfPText(formKey,fieldId), minWidth)}</span>`;
}
function sfPTableHtml(columns, rows){
  const thead = '<tr>'+columns.map(c=>`<th>${sfEscapeHtml(c)}</th>`).join('')+'</tr>';
  const trs = (rows.length?rows:[[]]).map(r=>{
    const tds = columns.map((c,i)=>`<td>${sfEscapeHtml(r[i]||'')}</td>`).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  return `<table class="sfp-table"><thead>${thead}</thead><tbody>${trs}</tbody></table>`;
}
function sfTableRowsFor(formKey, fieldId, colIds){
  const rows = sfPV(formKey, fieldId) || [];
  return rows.map(r=>colIds.map(cid=>(r.cells&&r.cells[cid])||''));
}
function sfMatrixRowsFor(formKey, fieldId){
  const m = sfPV(formKey, fieldId);
  if(!m || !m.cols) return {headers:[], rows:[]};
  const headers = m.cols.map(c=>c.label||'ระดับชั้น/ปี');
  const field = sfFindField(formKey, fieldId);
  const rows = field.rows.map(r=>{
    const rowVals = m.cols.map(c=> (m.values[r.id]&&m.values[r.id][c._id]) || '');
    return [r.label, ...rowVals];
  });
  return {headers, rows};
}
function sfPageHeader(no){ return `<div class="sfp-brand">DLTV · มูลนิธิการศึกษาทางไกลผ่านดาวเทียม ในพระบรมราชูปถัมภ์</div><div class="sfp-pageno">หน้า ${no}</div>`; }

/* ---------------- FORM 1 ---------------- */
function sfPrintForm1(student){
  const f='form1';
  const gradesM = sfMatrixRowsFor(f,'grades_matrix');
  const eduRows = sfTableRowsFor(f,'education_history',['level','school','province']);
  const planRows = sfTableRowsFor(f,'study_plan',['level','track','advisor']);
  const friendRows = sfTableRowsFor(f,'friends_school',['name','class','room','phone','reason']);
  const neighborRows = sfTableRowsFor(f,'friend_neighbor',['name','class','room','phone']);
  const prideRows = sfTableRowsFor(f,'pride_table',['level','pride','develop','help']);
  const sibRows = sfTableRowsFor(f,'siblings_table',['name','age','education','occupation','income','workplace','status']);
  const scholRows = sfTableRowsFor(f,'other_scholarships',['name','amount','year']);
  const incomeRows = sfTableRowsFor(f,'part_time_income',['detail']);
  const tutorRows = sfTableRowsFor(f,'extra_tutoring',['subject','time','teacher']);
  const needRows = sfTableRowsFor(f,'additional_needs',['detail']);
  const loyaltyRows = sfTableRowsFor(f,'loyalty_activities',['detail']);
  const receiptRows = sfTableRowsFor(f,'receipts',['no','date','amount','part1','part2','part3']);

  return `
  <div class="sfp-page">${sfPageHeader(1)}
    <div class="sfp-center">
      <div class="sfp-sub">แบบฟอร์มที่ 1 แบบรายงานข้อมูลรายบุคคล</div>
      <div class="sfp-sub">(สำหรับสถานศึกษาจัดทำทุกครั้งเมื่อรับนักเรียนทุนเข้าศึกษาในสถานศึกษา)</div>
      <div class="sfp-title" style="margin-top:8px">แบบรายงานข้อมูลรายบุคคล</div>
      <div class="sfp-sub">ผู้รับทุนการศึกษามูลนิธิการศึกษาทางไกลผ่านดาวเทียม ในพระบรมราชูปถัมภ์</div>
      <div class="sfp-sub">เนื่องในโอกาสมหามงคลเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว ทรงเจริญพระชนมพรรษา 6 รอบ 28 กรกฎาคม 2567</div>
      <div class="sfp-sub">รับทุนปีที่ ${sfFill(sfPText(f,'fund_year'),40)} ปีการศึกษา ${sfFill(sfPText(f,'academic_year'),40)}</div>
    </div>
    <hr class="sfp-hr">
    ${sfPLine('สถานศึกษา', f,'school_name',300)}<br>
    ${sfPLine('ที่ตั้ง เลขที่', f,'addr_no',50)} ${sfPLine('หมู่ที่', f,'addr_moo',40)} ${sfPLine('ถนน', f,'addr_road',80)} ${sfPLine('ตำบล', f,'addr_tambon',90)} ${sfPLine('อำเภอ', f,'addr_amphoe',90)}<br>
    ${sfPLine('จังหวัด', f,'addr_province',100)} ${sfPLine('รหัสไปรษณีย์', f,'addr_zip',60)} ${sfPLine('โทรศัพท์', f,'phone',90)}<br>
    ${sfPLine('โทรสาร', f,'fax',80)} ${sfPLine('อีเมล', f,'email',150)}
    <div class="sfp-section-title">1. ข้อมูลส่วนตัว</div>
    1.1 ${sfPLine('ชื่อ - นามสกุล ผู้รับทุนการศึกษา', f,'full_name',260)} ${sfPLine('ชื่อเล่น', f,'nickname',80)}<br>
    ${sfPLine('เลขประจำตัวประชาชน', f,'national_id',130)} ${sfPLine('วัน เดือน ปีเกิด', f,'dob',100)} ${sfPLine('เชื้อชาติ', f,'nationality',60)} ${sfPLine('ศาสนา', f,'religion',60)}<br>
    ${sfPLine('ภูมิลำเนา (จังหวัด)', f,'hometown',150)}<br>
    ${sfPLine('ที่อยู่ปัจจุบัน เลขที่', f,'cur_addr_no',50)} ${sfPLine('หมู่ที่', f,'cur_addr_moo',40)} ${sfPLine('ถนน', f,'cur_addr_road',80)} ${sfPLine('ตำบล', f,'cur_addr_tambon',90)}<br>
    ${sfPLine('อำเภอ', f,'cur_addr_amphoe',100)} ${sfPLine('จังหวัด', f,'cur_addr_province',100)} ${sfPLine('รหัสไปรษณีย์', f,'cur_addr_zip',60)}<br>
    ${sfPLine('โทรศัพท์', f,'cur_phone',100)} ${sfPLine('อีเมล', f,'cur_email',150)} ${sfPLine('ID Line', f,'id_line',100)}<br>
    ปัจจุบันอาศัยอยู่กับ ${sfPCheckbox(f,'live_with','บิดาและมารดา')} ${sfPCheckbox(f,'live_with','บิดา')} ${sfPCheckbox(f,'live_with','มารดา')} ${sfPCheckbox(f,'live_with','__other__')} ระบุ ${sfFill(sfPOtherText(f,'live_with'),120)}<br>
    ลักษณะของที่อยู่ ${sfPCheckbox(f,'residence_type','บ้านส่วนตัว')} ${sfPCheckbox(f,'residence_type','บ้านเช่า')} ${sfPCheckbox(f,'residence_type','หอพัก')} ${sfPCheckbox(f,'residence_type','ห้องเช่า')} ${sfPCheckbox(f,'residence_type','__other__')} ระบุ ${sfFill(sfPOtherText(f,'residence_type'),120)}<br>
    นักเรียนเดินทางมาสถานศึกษาโดย ${sfPCheckbox(f,'travel_method','รถประจำทาง')} ${sfPCheckbox(f,'travel_method','จักรยาน')} ${sfPCheckbox(f,'travel_method','จักรยานยนต์')} ${sfPCheckbox(f,'travel_method','เดิน')} ${sfPCheckbox(f,'travel_method','__other__')} ระบุ ${sfFill(sfPOtherText(f,'travel_method'),120)}<br>
    ระยะทางจากบ้านมาสถานศึกษา ${sfFill(sfPText(f,'distance_km'),40)} กิโลเมตร ใช้เวลาเดินทาง ${sfFill(sfPText(f,'travel_hour'),30)} ชั่วโมง ${sfFill(sfPText(f,'travel_min'),30)} นาที<br>
    ${sfPLine('ได้รับเงินเพื่อเป็นค่าใช้จ่ายจาก', f,'expense_source',200)} เป็นเงิน ${sfFill(sfPText(f,'expense_amount'),50)} บาท/วัน<br>
    โดยจำแนกค่าใช้จ่าย ดังนี้ ค่าพาหนะเดินทางไป-กลับ ${sfFill(sfPText(f,'expense_transport'),40)} บาท/วัน ค่าอาหารเช้า-กลางวัน ${sfFill(sfPText(f,'expense_food'),40)} บาท/วัน<br>
    ${sfPLine('ค่าใช้จ่ายอื่น ๆ ระบุ', f,'expense_other',300)}
  </div>

  <div class="sfp-page">${sfPageHeader(2)}
    <div class="sfp-section-title">เพื่อนในสถานศึกษาที่สนิทมากที่สุด</div>
    ${sfPTableHtml(['ชื่อ - นามสกุล','ชั้น','ห้อง','โทรศัพท์','เหตุผล'], friendRows)}
    <div class="sfp-section-title">เพื่อนที่อยู่บ้านใกล้เคียงกับนักเรียนมากที่สุด</div>
    ${sfPTableHtml(['ชื่อ - นามสกุล','ชั้น','ห้อง','โทรศัพท์'], neighborRows)}
    <div class="sfp-section-title">1.2 ทุนการศึกษานี้เป็นทุนต่อเนื่องจนจบระดับปริญญาตรี นักเรียนมีความคาดหวังด้านการศึกษาอย่างไร?</div>
    <div>${sfEscapeHtml(sfPText(f,'expect_education'))||'&nbsp;'}</div>
    <div class="sfp-section-title">1.3 ความคาดหวังด้านอาชีพในอนาคต</div>
    <div>${sfEscapeHtml(sfPText(f,'expect_career'))||'&nbsp;'}</div>
    <div class="sfp-section-title">1.4 ความภาคภูมิใจและความต้องการพัฒนาตนเอง</div>
    ${sfPTableHtml(['ระดับชั้น/ปี','ความภาคภูมิใจในตนเอง','ความต้องการในการพัฒนาตนเอง','ความต้องการให้ครูหรือสถานศึกษาช่วยเหลือ'], prideRows)}
    <div class="sfp-section-title">2. ข้อมูลด้านสุขภาพ</div>
    ${sfPLine('หมู่โลหิต', f,'blood_type',60)} ${sfPLine('มีตำหนิที่เห็นชัดเจน คือ', f,'visible_mark',220)}<br>
    ${sfPLine('โรคประจำตัว', f,'chronic_disease',150)} ${sfPLine('การรักษาพยาบาลเบื้องต้น', f,'treatment',200)}<br>
    ${sfPLine('แพ้ยา', f,'allergy',150)} ${sfPLine('ยาที่ใช้ประจำ', f,'regular_medicine',200)}<br>
    สายตา ${sfPCheckbox(f,'eyesight','ปกติ')} ${sfPCheckbox(f,'eyesight','สายตาสั้น')} ${sfPCheckbox(f,'eyesight','สายตายาว')} ${sfPCheckbox(f,'eyesight','สายตาเอียง')} ${sfPCheckbox(f,'eyesight','__other__')} ระบุ ${sfFill(sfPOtherText(f,'eyesight'),120)}<br>
    ความบกพร่องทางร่างกาย ${sfPCheckbox(f,'impairment','ไม่มี')} ${sfPCheckbox(f,'impairment','มี')} คือ ${sfFill(sfPText(f,'impairment_detail'),180)}<br>
    เคยป่วยหนักหรือประสบอุบัติเหตุร้ายแรงถึงขั้นเข้านอนโรงพยาบาล คือ ${sfFill(sfPText(f,'serious_illness'),260)} เมื่อ พ.ศ. ${sfFill(sfPText(f,'illness_year'),60)}
  </div>

  <div class="sfp-page">${sfPageHeader(3)}
    <div class="sfp-section-title">3. ข้อมูลด้านครอบครัว</div>
    <b>บิดา</b> ${sfPLine('ชื่อ', f,'father_name',120)} ${sfPLine('นามสกุล', f,'father_surname',120)}<br>
    ${sfPLine('เลขประจำตัวประชาชน', f,'father_id',130)} ${sfPLine('อายุ', f,'father_age',40)} ปี<br>
    ${sfPLine('การศึกษา', f,'father_education',120)} ${sfPLine('อาชีพ', f,'father_occupation',120)} ${sfPLine('รายได้ต่อปี', f,'father_income',80)} บาท<br>
    ${sfPLine('ที่อยู่หรือที่ทำงาน', f,'father_workplace',260)} ${sfPLine('โทรศัพท์', f,'father_phone',100)}<br>
    <b>มารดา</b> ${sfPLine('ชื่อ', f,'mother_name',120)} ${sfPLine('นามสกุล', f,'mother_surname',120)}<br>
    ${sfPLine('เลขประจำตัวประชาชน', f,'mother_id',130)} ${sfPLine('อายุ', f,'mother_age',40)} ปี<br>
    ${sfPLine('การศึกษา', f,'mother_education',120)} ${sfPLine('อาชีพ', f,'mother_occupation',120)} ${sfPLine('รายได้ต่อปี', f,'mother_income',80)} บาท<br>
    ${sfPLine('ที่อยู่หรือที่ทำงาน', f,'mother_workplace',260)} ${sfPLine('โทรศัพท์', f,'mother_phone',100)}<br>
    <b>ผู้ปกครอง</b> ${sfPLine('ชื่อ', f,'guardian_name',120)} ${sfPLine('นามสกุล', f,'guardian_surname',120)}<br>
    ${sfPLine('เลขประจำตัวประชาชน', f,'guardian_id',130)} ${sfPLine('อายุ', f,'guardian_age',40)} ปี<br>
    ${sfPLine('การศึกษา', f,'guardian_education',120)} ${sfPLine('อาชีพ', f,'guardian_occupation',120)} ${sfPLine('รายได้ต่อปี', f,'guardian_income',80)} บาท<br>
    ${sfPLine('ที่อยู่หรือที่ทำงาน', f,'guardian_workplace',260)} ${sfPLine('โทรศัพท์', f,'guardian_phone',100)}<br>
    ผู้ปกครอง คือ ${sfPCheckbox(f,'guardian_type','บิดา')} ${sfPCheckbox(f,'guardian_type','มารดา')} ${sfPCheckbox(f,'guardian_type','__other__')} ผู้อื่นซึ่งเกี่ยวข้องเป็น ${sfFill(sfPOtherText(f,'guardian_type'),140)}<br>
    ปัจจุบันบิดามารดา ${sfPCheckbox(f,'parents_status','อยู่ด้วยกัน')} ${sfPCheckbox(f,'parents_status','หย่าร้าง')} ${sfPCheckbox(f,'parents_status','แยกกันอยู่')} ${sfPCheckbox(f,'parents_status','บิดาถึงแก่กรรม')} ${sfPCheckbox(f,'parents_status','มารดาถึงแก่กรรม')} ${sfPCheckbox(f,'parents_status','__other__')} ระบุ ${sfFill(sfPOtherText(f,'parents_status'),120)}<br>
    ภาระหนี้สินของครอบครัว ${sfPCheckbox(f,'family_debt','ไม่มี')} ${sfPCheckbox(f,'family_debt','มี')} จำนวน ${sfFill(sfPText(f,'family_debt_amount'),80)} บาท<br>
    ครอบครัวของนักเรียนมีสมาชิกทั้งหมด ${sfFill(sfPText(f,'family_members'),40)} คน นักเรียนมีพี่น้องทั้งหมด ${sfFill(sfPText(f,'siblings_total'),40)} คน
    <div class="sfp-section-title">พี่น้องร่วมบิดามารดาเดียวกัน เรียงลำดับ ดังนี้</div>
    ${sfPTableHtml(['ชื่อ - สกุล','อายุ','การศึกษา','อาชีพ/ตำแหน่ง','รายได้ต่อเดือน','สถานศึกษาหรือที่ทำงาน','สถานภาพ'], sibRows)}
  </div>

  <div class="sfp-page">${sfPageHeader(4)}
    ${sfPLine('บุคคลในครอบครัวที่นักเรียนไว้ใจมากที่สุด ชื่อ-นามสกุล', f,'trusted_name',260)}<br>
    ${sfPLine('อายุ', f,'trusted_age',40)} ปี ${sfPLine('เกี่ยวข้องเป็น', f,'trusted_relation',120)} ${sfPLine('โทรศัพท์', f,'trusted_phone',100)}<br>
    ความสัมพันธ์ในครอบครัวระหว่างบิดา-มารดา<br>
    ${sfPCheckbox(f,'parents_relationship','รักใคร่กันดี')} ${sfPCheckbox(f,'parents_relationship','ขัดแย้งทะเลาะกันบางครั้ง')}<br>
    ${sfPCheckbox(f,'parents_relationship','ขัดแย้งทะเลาะกันบ่อยครั้ง')} ${sfPCheckbox(f,'parents_relationship','ขัดแย้งและทำร้ายร่างกายบางครั้ง')}<br>
    ${sfPCheckbox(f,'parents_relationship','ขัดแย้งและทำร้ายร่างกายบ่อยครั้ง')} ${sfPCheckbox(f,'parents_relationship','__other__')} ระบุ ${sfFill(sfPOtherText(f,'parents_relationship'),140)}<br>
    บุคคลในครอบครัวมีการใช้สารเสพติด ${sfPCheckbox(f,'substance_abuse','ไม่มี')} ${sfPCheckbox(f,'substance_abuse','มี')} เกี่ยวข้องเป็น ${sfFill(sfPText(f,'substance_relation'),140)} กับนักเรียน
    <div class="sfp-section-title">แผนที่แสดงการเดินทางจากสถานศึกษาไปบ้าน (โดยสังเขป)</div>
    <div style="border:1px solid #000;min-height:120px;padding:8px">${sfEscapeHtml(sfPText(f,'travel_map_note'))||'<span style="color:#666">โปรดแนบรูปถ่ายบ้านผู้รับทุนการศึกษา</span>'}</div>
    <div class="sfp-section-title">4. ข้อมูลด้านการเรียนและความสามารถ</div>
    4.1 ประวัติการศึกษา
    ${sfPTableHtml(['ระดับการศึกษา','สถานศึกษา','จังหวัด'], eduRows)}
    <div style="font-size:11px;color:#333">หมายเหตุ กรณีเรียนระดับชั้นสูงกว่าหรือเทียบเท่า ให้ปรับแก้ไข เพื่อกรอกข้อมูลตามความเหมาะสม</div>
    ${sfPTableHtml(['ระดับชั้น/ปี','แผนการเรียน/แผนก/สาขาวิชา','ครูที่ปรึกษาหรือครูผู้ดูแล'], planRows)}
  </div>

  <div class="sfp-page">${sfPageHeader(5)}
    4.2 ข้อมูลผลการเรียน
    ${sfPTableHtml(['ภาคเรียน', ...gradesM.headers], gradesM.rows)}
    <div style="font-size:11px;color:#333">หมายเหตุ เป็นข้อมูลผลการเรียนในสถานศึกษาที่เรียนอยู่ในปัจจุบัน แนบรายงานผลการเรียนแต่ละภาคเรียน</div>
    <div class="sfp-section-title">4.3 ความสามารถพิเศษ</div>
    <div>${sfEscapeHtml(sfPText(f,'special_ability'))||'&nbsp;'}</div>
    <div class="sfp-section-title">4.4 ผลงานดีเด่นและความภาคภูมิใจในปีที่ผ่านมา</div>
    <div>${sfEscapeHtml(sfPText(f,'achievement'))||'&nbsp;'}</div>
    <div class="sfp-section-title">5. ข้อมูลด้านการดูแลช่วยเหลือที่สถานศึกษาดำเนินการ</div>
    5.1 ทุนการศึกษาอื่นที่ได้รับ
    ${sfPTableHtml(['ชื่อทุน','จำนวนเงิน','เมื่อปี พ.ศ.'], scholRows)}
    5.2 การหารายได้ระหว่างเรียน
    ${sfPTableHtml(['รายละเอียด'], incomeRows)}
    5.3 การได้รับการสอนเสริมพิเศษ
    ${sfPTableHtml(['วิชา','ช่วงเวลา','ผู้สอน'], tutorRows)}
    5.4 อื่น ๆ (ตอบได้มากกว่า 1 ข้อ)<br>
    ${sfPCheckbox(f,'other_support','จัดที่พัก')} ${sfPCheckbox(f,'other_support','จัดรถรับส่ง')} ${sfPCheckbox(f,'other_support','จัดอาหารกลางวัน')} ${sfPCheckbox(f,'other_support','สนับสนุนอุปกรณ์การเรียน')} ${sfPCheckbox(f,'other_support','__other__')} ระบุ ${sfFill(sfPOtherText(f,'other_support'),140)}
  </div>

  <div class="sfp-page">${sfPageHeader(6)}
    <div class="sfp-section-title">6. ความต้องการในการได้รับความช่วยเหลือเพิ่มเติม</div>
    ${sfPTableHtml(['รายละเอียด'], needRows)}
    <div class="sfp-section-title">7. การเข้าร่วมกิจกรรมที่แสดงถึงความสำนึกในพระมหากรุณาธิคุณ</div>
    ${sfPTableHtml(['รายละเอียด'], loyaltyRows)}
    <div class="sfp-section-title">8. ข้อมูลด้านการรับเงินทุนการศึกษาและการใช้จ่าย</div>
    ${sfPLine('บัญชีธนาคาร', f,'bank_name',160)} ${sfPLine('สาขา', f,'bank_branch',140)}<br>
    ${sfPLine('ชื่อบัญชี', f,'account_name',260)} ${sfPLine('เลขที่บัญชี', f,'account_no',140)}<br>
    ผู้มีอำนาจสั่งจ่าย 1. ${sfFill(sfPText(f,'signer1'),180)} 2. ${sfFill(sfPText(f,'signer2'),180)}
    ${sfPTableHtml(['ครั้งที่','วันที่ได้รับ','จำนวนเงิน','ส่วนที่ 1 สถานศึกษาเรียกเก็บ','ส่วนที่ 2 ค่าครองชีพ','ส่วนที่ 3 กรณีพิเศษเฉพาะราย'], receiptRows)}
    <div class="sfp-center" style="margin-top:8px">ขอรับรองว่าข้อมูลข้างต้นเป็นจริงทุกประการ</div>
    <div class="sfp-sign-row">
      <div class="sfp-sign"><b>${sfEscapeHtml(sfSignName(f, student))||'&nbsp;'}</b><br>ผู้รับทุนการศึกษา</div>
    </div>
  </div>

  <div class="sfp-page">${sfPageHeader(7)}
    <div class="sfp-section-title">9. ครูที่ปรึกษาหรือครูผู้ดูแลบันทึกความคิดเห็นเพิ่มเติม</div>
    9.1 ด้านการเรียน<br><div>${sfEscapeHtml(sfPText(f,'teacher_comment_study'))||'&nbsp;'}</div>
    9.2 ด้านความประพฤติ<br><div>${sfEscapeHtml(sfPText(f,'teacher_comment_behavior'))||'&nbsp;'}</div>
    9.3 ด้านอื่น ๆ<br><div>${sfEscapeHtml(sfPText(f,'teacher_comment_other'))||'&nbsp;'}</div>
    <div class="sfp-center" style="margin-top:8px">ขอรับรองว่าข้อมูลข้างต้นเป็นจริงทุกประการ</div>
    <div class="sfp-sign-row">
      <div class="sfp-sign">แบบรายงานสำหรับนักเรียน<br>ลงชื่อ ..................................................ครูที่ปรึกษาหรือครูผู้ดูแล<br>
      (${sfEscapeHtml(sfPText(f,'teacher_name'))||'..................................................'})<br>
      ตำแหน่ง ${sfEscapeHtml(sfPText(f,'teacher_position'))||'..........................'}<br>
      สถานศึกษา ${sfEscapeHtml(sfPText(f,'teacher_school'))||'..........................'}<br>
      เบอร์โทรศัพท์ ${sfEscapeHtml(sfPText(f,'teacher_phone'))||'..........................'}<br>
      วันที่ ${sfEscapeHtml(sfPText(f,'teacher_sign_date'))||'..........................'}</div>
    </div>
  </div>`;
}

/* ---------------- FORM 2 ---------------- */
function sfPrintForm2(student){
  const f='form2';
  const gradesM = sfMatrixRowsFor(f,'grades_matrix');
  const tutorRows = sfTableRowsFor(f,'tutoring',['subject','time','teacher']);
  const fundRows = sfTableRowsFor(f,'extra_funding',['source','amount']);
  const receiptRows = sfTableRowsFor(f,'receipts',['no','date','amount','part1','part2','part3']);
  receiptRows.forEach(r => { [2,3,4,5].forEach(i => {
    const n = (typeof sfNum==='function') ? sfNum(r[i]) : NaN;
    if (isFinite(n)) r[i] = sfFmtMoney(n);
  }); });
  const fullName = [sfPChoiceText(f,'prefix'), sfPText(f,'first_name'), sfPText(f,'last_name')].filter(Boolean).join(' ');

  return `
  <div class="sfp-page">${sfPageHeader(1)}
    <div class="sfp-center">
      <div class="sfp-sub">แบบฟอร์มที่ 2 แบบรายงานผลการเรียนฯ</div>
      <div class="sfp-sub">(สำหรับสถานศึกษาจัดทำทุกภาคเรียน)</div>
      <div class="sfp-title" style="margin-top:10px">รายงานผลการเรียน ความประพฤติ และการใช้จ่ายเงินทุนการศึกษา</div>
      <div class="sfp-sub">ของผู้รับทุนการศึกษามูลนิธิการศึกษาทางไกลผ่านดาวเทียม ในพระบรมราชูปถัมภ์</div>
      <div class="sfp-sub">เนื่องในโอกาสมหามงคลเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว ทรงเจริญพระชนมพรรษา 6 รอบ 28 กรกฎาคม 2567</div>
      <div class="sfp-sub" style="margin-top:10px">ภาคเรียนที่ ${sfFill(sfPText(f,'semester'),40)} ปีการศึกษา ${sfFill(sfPText(f,'academic_year'),60)}</div>
      <div class="sfp-sub" style="margin-top:14px">${sfFill(fullName,240)}</div>
      <div class="sfp-sub">ระดับชั้น ${sfFill(sfPText(f,'grade_level'),80)} แผน/แผนก/สาขา ${sfFill(sfPText(f,'track'),120)}</div>
      <div class="sfp-sub">สถานศึกษา ${sfFill(sfPText(f,'school_name'),240)}</div>
      <div class="sfp-sub">จังหวัด ${sfFill(sfPText(f,'province'),120)}</div>
      <div class="sfp-sub">สังกัด ${sfFill(sfPText(f,'sangkad'),160)}</div>
    </div>
  </div>

  <div class="sfp-page">${sfPageHeader(2)}
    <div class="sfp-center"><b>สรุปสาระสำคัญรายงานผลการเรียน ความประพฤติ และการใช้จ่ายเงินทุนการศึกษา</b></div>
    <hr class="sfp-hr">
    <div class="sfp-section-title">1. สรุปรายงานผลการเรียนของนักเรียนทุนการศึกษา</div>
    ${sfFill(fullName,220)} ปัจจุบันเรียนระดับชั้น ${sfFill(sfPText(f,'grade_level'),80)} แผน/แผนก/สาขา ${sfFill(sfPText(f,'track'),120)}
    ในสถานศึกษา ${sfFill(sfPText(f,'school_name'),220)} จังหวัด ${sfFill(sfPText(f,'province'),100)} สังกัด ${sfFill(sfPText(f,'sangkad'),140)}<br>
    ในภาคเรียนที่ ${sfFill(sfPText(f,'semester'),40)} ปีการศึกษา ${sfFill(sfPText(f,'academic_year'),60)} โดยมีปัญหาอุปสรรคส่งผลต่อการเรียน<br>
    <div>${sfEscapeHtml(sfPText(f,'learning_problems'))||'&nbsp;'}</div>
    ปัจจุบันได้รับความช่วยเหลือจากโรงเรียนด้าน<br>
    <div>${sfEscapeHtml(sfPText(f,'current_help'))||'&nbsp;'}</div>
    <div class="sfp-section-title">2. สรุปรายงานความประพฤติของนักเรียนทุนการศึกษา</div>
    <div>${sfEscapeHtml([sfPText(f,'activities_participation'), sfPText(f,'community_loyalty')].filter(Boolean).join(' / '))||'&nbsp;'}</div>
    <div class="sfp-section-title">3. สรุปรายงานการใช้จ่ายเงินทุนการศึกษา</div>
    จากเงินทุนการศึกษาที่ได้รับจำนวนรวมเป็นเงินทั้งสิ้น ${sfFill(sfPMoney(f,'total_received'),80)} บาท ได้เบิกจ่ายไปแล้วจนถึงปัจจุบันรวมทั้งสิ้น ${sfFill(sfPMoney(f,'total_disbursed'),80)} บาท แยกเป็น<br>
    3.1 เงินทุนส่วนที่ 1 ค่าใช้จ่ายที่สถานศึกษาเรียกเก็บ ${sfFill(sfPMoney(f,'part1_amount'),80)} บาท<br>
    3.2 เงินทุนส่วนที่ 2 ค่าใช้จ่ายครองชีพประจำตัว ${sfFill(sfPMoney(f,'part2_amount'),80)} บาท<br>
    3.3 เงินทุนส่วนที่ 3 ค่าใช้จ่ายที่จำเป็นอย่างยิ่งต่อการเรียนเป็นกรณีพิเศษเฉพาะราย ${sfFill(sfPMoney(f,'part3_amount'),80)} บาท<br>
    ยอดคงเหลือ ณ วันที่ ${sfFill(sfPText(f,'balance_date'),100)} จำนวน ${sfFill(sfPMoney(f,'balance'),80)} บาท
    <div class="sfp-center" style="margin-top:10px">ขอรับรองว่าเป็นความจริงทุกประการ</div>
    <div class="sfp-sign-row">
      <div class="sfp-sign">ลงชื่อ .................................................. ครูที่ปรึกษาหรือครูผู้ดูแล<br>(${sfEscapeHtml(sfPText(f,'teacher_name'))||'..................................................'})<br>ตำแหน่ง ${sfEscapeHtml(sfPText(f,'teacher_position'))||'..........................'}<br>โทรศัพท์ ${sfEscapeHtml(sfPText(f,'teacher_phone'))||'..........................'}<br>วันที่ ${sfEscapeHtml(sfPText(f,'teacher_sign_date'))||'..........................'}</div>
      <div class="sfp-sign">ลงชื่อ .................................................. ผู้อำนวยการสถานศึกษา<br>(${sfEscapeHtml(sfPText(f,'director_name'))||'..................................................'})<br>วันที่ ${sfEscapeHtml(sfPText(f,'director_sign_date'))||'..........................'}</div>
    </div>
  </div>

  <div class="sfp-page">${sfPageHeader(3)}
    <div class="sfp-center"><b>รายงานผลการเรียน ความประพฤติ และการใช้จ่ายเงินทุนการศึกษา</b><br>
    ภาคเรียนที่ ${sfFill(sfPText(f,'semester'),40)} ปีการศึกษา ${sfFill(sfPText(f,'academic_year'),60)}</div>
    <div class="sfp-section-title">ข้อมูลทั่วไป</div>
    1. ${sfFill(fullName,220)} ชื่อเล่น ${sfFill(sfPText(f,'nickname'),80)}<br>
    เลขประจำตัวประชาชน ${sfFill(sfPText(f,'national_id'),130)} วัน เดือน ปีเกิด ${sfFill(sfPText(f,'dob'),100)}<br>
    2. สถานศึกษา ${sfFill(sfPText(f,'school_name'),220)} อำเภอ ${sfFill(sfPText(f,'amphoe'),100)}<br>
    จังหวัด ${sfFill(sfPText(f,'province'),100)} สังกัด ${sfFill(sfPText(f,'sangkad'),140)} ระดับชั้น ${sfFill(sfPText(f,'grade_level'),80)}
    <div class="sfp-section-title">ข้อมูลผลการเรียน</div>
    3. ข้อมูลผลการเรียน (โปรดแนบรายละเอียดรายงานผลการเรียนรายวิชาที่สถานศึกษารับรองแล้ว)
    ${sfPTableHtml(['ภาคเรียน', ...gradesM.headers], gradesM.rows)}
    <div class="sfp-section-title">4. ปัญหาอุปสรรคที่ส่งผลต่อการเรียนที่เป็นสาเหตุให้มีคะแนนผลการเรียนลดลง</div>
    <div>${sfEscapeHtml(sfPText(f,'learning_problems'))||'&nbsp;'}</div>
  </div>

  <div class="sfp-page">${sfPageHeader(4)}
    <div class="sfp-section-title">5. การดูแลช่วยเหลือที่สถานศึกษาดำเนินการ (เลือกได้มากกว่า 1 ข้อ)</div>
    จัดสอนเสริมพิเศษ ได้แก่
    ${sfPTableHtml(['วิชา','ช่วงเวลา','ผู้สอน'], tutorRows)}
    จัดหาเงินทุนจากแหล่งอื่นเพิ่มเติม ได้แก่
    ${sfPTableHtml(['แหล่งทุน','จำนวนเงิน'], fundRows)}
    ${sfPCheckbox(f,'support_other','จัดอาหารกลางวัน')} ${sfPCheckbox(f,'support_other','จัดที่พักในสถานศึกษา')} ${sfPCheckbox(f,'support_other','จัดบริการรถรับส่ง')} ${sfPCheckbox(f,'support_other','จัดให้หารายได้ระหว่างเรียน')} ${sfPCheckbox(f,'support_other','__other__')} ระบุ ${sfFill(sfPOtherText(f,'support_other'),140)}
    <div class="sfp-section-title">6. ความต้องการในการได้รับความช่วยเหลือเพิ่มเติม จากสถานศึกษา ครู หรือ อื่น ๆ</div>
    <div>${sfEscapeHtml(sfPText(f,'additional_needs'))||'&nbsp;'}</div>
    <div class="sfp-section-title">7. ความคาดหวังด้านการศึกษา</div>
    <div>${sfEscapeHtml(sfPText(f,'expect_education'))||'&nbsp;'}</div>
    <div class="sfp-section-title">8. ความคาดหวังด้านอาชีพในอนาคต</div>
    <div>${sfEscapeHtml(sfPText(f,'expect_career'))||'&nbsp;'}</div>
    <div class="sfp-section-title">9. ผลงานดีเด่น ความภาคภูมิใจ ในปีที่ผ่านมา</div>
    <div>${sfEscapeHtml(sfPText(f,'achievement'))||'&nbsp;'}</div>
  </div>

  <div class="sfp-page">${sfPageHeader(5)}
    <div class="sfp-section-title">ข้อมูลความประพฤติ</div>
    <div class="sfp-section-title">10. การเข้าร่วมกิจกรรมต่าง ๆ ของสถานศึกษาในภาคเรียนปัจจุบัน</div>
    <div>${sfEscapeHtml(sfPText(f,'activities_participation'))||'&nbsp;'}</div>
    <div class="sfp-section-title">11. งานที่ต้องรับผิดชอบดูแลช่วยเหลือครอบครัวในด้านต่าง ๆ</div>
    <div>${sfEscapeHtml(sfPText(f,'family_responsibility'))||'&nbsp;'}</div>
    <div class="sfp-section-title">12. การมีส่วนร่วมในการดำเนินกิจกรรมที่เป็นประโยชน์ต่อชุมชนและสังคม ตลอดจนการแสดงถึงความจงรักภักดีต่อสถาบันพระมหากษัตริย์</div>
    <div>${sfEscapeHtml(sfPText(f,'community_loyalty'))||'&nbsp;'}</div>
  </div>

  <div class="sfp-page">${sfPageHeader(6)}
    <div class="sfp-section-title">ข้อมูลด้านการรับเงินทุนการศึกษาและการใช้จ่าย</div>
    13. ${sfPLine('บัญชีธนาคาร', f,'bank_name',160)} ${sfPLine('สาขา', f,'bank_branch',140)}<br>
    ${sfPLine('ชื่อบัญชี', f,'account_name',260)} ${sfPLine('เลขที่บัญชี', f,'account_no',140)}<br>
    ผู้มีอำนาจสั่งจ่าย 1. ${sfFill(sfPText(f,'signer1'),180)} 2. ${sfFill(sfPText(f,'signer2'),180)}
    14. รายงานการรับเงินทุนการศึกษาและการใช้จ่าย (โปรดแนบสำเนาสมุดบัญชีเงินฝากธนาคารที่แสดงยอด ณ วันที่รายงาน)
    ${sfPTableHtml(['ครั้งที่','วันที่ได้รับ','จำนวนเงิน','ส่วนที่ 1 สถานศึกษาเรียกเก็บ','ส่วนที่ 2 ค่าครองชีพ','ส่วนที่ 3 กรณีพิเศษเฉพาะราย'], receiptRows)}
    <div class="sfp-center" style="margin-top:8px">ขอรับรองว่าข้อมูลข้างต้นเป็นจริงทุกประการ</div>
    <div class="sfp-sign-row">
      <div class="sfp-sign"><b>${sfEscapeHtml(sfSignName(f, student))||'&nbsp;'}</b><br>ผู้รับทุนการศึกษา</div>
    </div>
  </div>

  <div class="sfp-page">${sfPageHeader(7)}
    <div class="sfp-section-title">ข้อมูลข้อคิดเห็นเพิ่มเติมของครูที่ปรึกษาหรือครูผู้ดูแล</div>
    15. ด้านการเรียนของผู้รับทุนการศึกษา<br><div>${sfEscapeHtml(sfPText(f,'teacher_comment_study'))||'&nbsp;'}</div>
    16. ด้านความประพฤติและการปฏิบัติตนของผู้รับทุนการศึกษา<br><div>${sfEscapeHtml(sfPText(f,'teacher_comment_behavior'))||'&nbsp;'}</div>
    17. การรับรองและข้อคิดเห็นเพิ่มเติมของครูที่ปรึกษาหรือครูผู้ดูแล ในการใช้จ่ายเงินทุนการศึกษาของผู้รับทุนการศึกษา<br><div>${sfEscapeHtml(sfPText(f,'teacher_comment_expense'))||'&nbsp;'}</div>
    <div class="sfp-center" style="margin-top:8px">ขอรับรองว่าข้อมูลข้างต้นเป็นจริงทุกประการ และได้กำกับ ดูแล ตรวจสอบการเบิกจ่ายเงินของผู้รับทุนการศึกษาตามเงื่อนไขข้อกำหนด</div>
    <div class="sfp-sign-row">
      <div class="sfp-sign">ลงชื่อ .................................................. ครูที่ปรึกษาหรือครูผู้ดูแล<br>(${sfEscapeHtml(sfPText(f,'teacher_name'))||'..................................................'})<br>ตำแหน่ง ${sfEscapeHtml(sfPText(f,'teacher_position'))||'..........................'}<br>วันที่ ${sfEscapeHtml(sfPText(f,'teacher_sign_date'))||'..........................'}</div>
    </div>
  </div>`;
}

function sfSummaryHeaderHtml(formKey, student){
  const formTitle = formKey==='form1' ? 'แบบฟอร์มที่ 1 · ข้อมูลรายบุคคล (สรุปย่อ)' : 'แบบฟอร์มที่ 2 · ผลการเรียน/ความประพฤติ/การใช้จ่าย (สรุปย่อ)';
  const photo = student.photoUrl
    ? `<img class="sfp-sum-photo" src="${sfEscapeHtml(student.photoUrl)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'sfp-sum-photo-fallback',textContent:'🧑‍🎓'}))">`
    : `<div class="sfp-sum-photo-fallback">🧑‍🎓</div>`;
  const today = new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
  return `
  <div class="sfp-sum-header">
    ${photo}
    <div class="sfp-sum-header-mid">
      <div class="sfp-sum-header-name">${sfEscapeHtml(student.name||'(ยังไม่ระบุชื่อ)')}</div>
      ${student.nickname?`<div class="sfp-sum-header-nick">ชื่อเล่น ${sfEscapeHtml(student.nickname)}</div>`:''}
      <div class="sfp-sum-header-meta">
        ${student.id?`<span><b>เลขบัตร ปชช.</b> ${sfEscapeHtml(student.id)}</span>`:''}
        ${student.school_m1?`<span><b>สถานศึกษา</b> ${sfEscapeHtml(student.school_m1)}</span>`:''}
        ${student.province?`<span><b>จังหวัด</b> ${sfEscapeHtml(student.province)}</span>`:''}
      </div>
    </div>
    <div class="sfp-sum-header-right">
      <div class="sfp-sum-formtitle">${sfEscapeHtml(formTitle)}</div>
      <div>พิมพ์เมื่อ ${sfEscapeHtml(today)}</div>
    </div>
  </div>`;
}
function sfBuildSummaryForPrint(formKey, student){
  const sections = sfGetSections(formKey);
  const body = sections.map((section,idx)=>{
    const cards = section.fields.filter(f=>['text','number','date','textarea','radio','checkboxgroup'].includes(f.type))
      .map(f=>{
        const val = sfFieldSummaryValue(formKey, f);
        if(!val) return '';
        return `<div><div class="sfp-sum-card-label">${sfEscapeHtml(f.label)}</div><div class="sfp-sum-card-value">${sfEscapeHtml(val)}</div></div>`;
      }).filter(Boolean).join('');
    const hasAny = cards.length>0;
    const icon = SF_SECTION_ICON[section.id] || '📄';
    return `<div class="sfp-sum-section">
      <div class="sfp-sum-section-head">
        <span class="sfp-sum-section-icon">${icon}</span>
        <h3>${idx+1}. ${sfEscapeHtml(section.title)}</h3>
        <span class="sfp-sum-pill ${hasAny?'done':''}">${hasAny?'✓ มีข้อมูล':'ยังไม่มีข้อมูล'}</span>
      </div>
      <div class="sfp-sum-grid">${hasAny?cards:'<div class="sfp-sum-empty">ยังไม่ได้กรอกข้อมูลในหมวดนี้</div>'}</div>
    </div>`;
  }).join('');
  return `<div class="sfp-sumdoc">
    ${sfSummaryHeaderHtml(formKey, student)}
    ${body}
    <div class="sfp-sum-footer">มูลนิธิการศึกษาทางไกลผ่านดาวเทียม ในพระบรมราชูปถัมภ์ — เอกสารสรุปย่อสำหรับใช้งานภายใน</div>
  </div>`;
}
function sfPrintCurrentForm(){
  const student = sfGetStudent();
  if(!student) return;
  let area = document.getElementById('sf-print-area');
  if(!area){ area = document.createElement('div'); area.id='sf-print-area'; document.body.appendChild(area); }
  area.innerHTML = sfState.previewTab==='summary'
    ? sfBuildSummaryForPrint(sfState.formKey, student)
    : (sfState.formKey==='form1' ? sfPrintForm1(student) : sfPrintForm2(student));
  setTimeout(()=>window.print(), 50);
}

/* ---------------- PREVIEW MODAL (ดูตัวอย่างก่อนพิมพ์) ---------------- */
const SF_SECTION_ICON = {
  school:'🏫', personal:'🧑', health:'🩺', family:'👨‍👩‍👧', relations:'❤️', study:'🎓',
  support:'🤝', needs:'📋', finance:'💰', general:'🧑', grades:'📊', assistance:'🤝', behavior:'🌟'
};
function sfFieldSummaryValue(formKey, field){
  if(field.type==='text'||field.type==='number'||field.type==='date'||field.type==='textarea'){
    return sfPText(formKey, field.id);
  }
  if(field.type==='radio') return sfPChoiceText(formKey, field.id);
  if(field.type==='checkboxgroup'){
    const v = sfPV(formKey, field.id);
    const sel = (v&&v.selected)||[];
    return sel.map(s=> s==='__other__' ? (v.other||'') : s).filter(Boolean).join(', ');
  }
  if(field.type==='table'){
    const rows = sfPV(formKey, field.id)||[];
    const filled = rows.filter(r=>Object.values(r.cells||{}).some(v=>v));
    return filled.length ? `${filled.length} รายการ` : '';
  }
  if(field.type==='matrix'){
    const m = sfPV(formKey, field.id);
    if(!m) return '';
    const hasAny = Object.keys(m.values||{}).some(rk=>Object.values(m.values[rk]||{}).some(v=>v));
    return hasAny ? 'มีข้อมูลผลการเรียน' : '';
  }
  return '';
}
function sfBuildSummary(formKey, student){
  const sections = sfGetSections(formKey);
  return sections.map((section,idx)=>{
    const cards = section.fields.filter(f=>['text','number','date','textarea','radio','checkboxgroup'].includes(f.type))
      .map(f=>{
        const val = sfFieldSummaryValue(formKey, f);
        if(!val) return '';
        return `<div class="sf-sum-card"><div class="sf-sum-card-label">${sfEscapeHtml(f.label)}</div><div class="sf-sum-card-value">${sfEscapeHtml(val)}</div></div>`;
      }).filter(Boolean).join('');
    const hasAny = cards.length>0;
    const icon = SF_SECTION_ICON[section.id] || '📄';
    return `<div class="sf-sum-section">
      <div class="sf-sum-section-head">
        <span class="sf-sum-section-icon">${icon}</span>
        <h3>${idx+1}. ${sfEscapeHtml(section.title)}</h3>
        <span class="sf-pill ${hasAny?'sf-pill-done':''}">${hasAny?'✓ มีข้อมูล':'ยังไม่มีข้อมูล'}</span>
      </div>
      <div class="sf-sum-grid">${hasAny?cards:'<div class="sf-sum-empty">ยังไม่ได้กรอกข้อมูลในหมวดนี้</div>'}</div>
    </div>`;
  }).join('');
}
function sfPreviewEscHandler(e){ if(e.key==='Escape') sfClosePreview(); }
function sfClosePreview(){
  const overlay = document.getElementById('sf-preview-overlay');
  if(overlay) overlay.remove();
  document.removeEventListener('keydown', sfPreviewEscHandler);
}
function sfRenderPreviewBody(){
  const body = document.getElementById('sf-modal-body');
  if(!body) return;
  const student = sfGetStudent();
  if(sfState.previewTab==='summary'){
    const photo = student.photoUrl
      ? `<img class="sf-sum-photo" src="${sfEscapeHtml(student.photoUrl)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'sf-sum-photo-fallback',textContent:'🧑‍🎓'}))">`
      : `<div class="sf-sum-photo-fallback">🧑‍🎓</div>`;
    const headerHtml = `<div class="sf-sum-header">
      ${photo}
      <div class="sf-sum-header-mid">
        <div class="sf-sum-header-name">${sfEscapeHtml(student.name||'(ยังไม่ระบุชื่อ)')}</div>
        ${student.nickname?`<div class="sf-sum-header-nick">ชื่อเล่น ${sfEscapeHtml(student.nickname)}</div>`:''}
        <div class="sf-sum-header-meta">
          ${student.id?`<span><b>เลขบัตร ปชช.</b> ${sfEscapeHtml(student.id)}</span>`:''}
          ${student.school_m1?`<span><b>สถานศึกษา</b> ${sfEscapeHtml(student.school_m1)}</span>`:''}
          ${student.province?`<span><b>จังหวัด</b> ${sfEscapeHtml(student.province)}</span>`:''}
        </div>
      </div>
    </div>`;
    body.innerHTML = `<div class="sf-summary-wrap">${headerHtml}${sfBuildSummary(sfState.formKey, student)}</div>`;
  } else {
    const html = sfState.formKey==='form1' ? sfPrintForm1(student) : sfPrintForm2(student);
    body.innerHTML = `<div class="sf-preview-pages">${html}</div>`;
  }
}
function sfOpenPreview(){
  const student = sfGetStudent();
  if(!student) return;
  sfClosePreview();
  sfState.previewTab = 'full';
  const formTitle = sfState.formKey==='form1' ? 'แบบฟอร์มที่ 1 · ข้อมูลรายบุคคล' : 'แบบฟอร์มที่ 2 · ผลการเรียน/ความประพฤติ/การใช้จ่าย';
  const overlay = document.createElement('div');
  overlay.className = 'sf-modal-overlay';
  overlay.id = 'sf-preview-overlay';
  overlay.innerHTML = `
    <div class="sf-modal">
      <div class="sf-modal-header">
        <div class="sf-modal-header-left">
          <span class="sf-modal-icon">📄</span>
          <div>
            <div class="sf-modal-title">${sfEscapeHtml(student.name||'(ยังไม่ระบุชื่อ)')}</div>
            <div class="sf-modal-sub">${sfEscapeHtml(formTitle)}</div>
          </div>
        </div>
        <button type="button" class="sf-modal-close" data-sf-action="close-preview" aria-label="ปิด">×</button>
      </div>
      <div class="sf-modal-tabs">
        <button type="button" class="sf-modal-tab active" data-sf-action="preview-tab" data-sf-tab="full">📄 เต็มตามแบบฟอร์ม</button>
        <button type="button" class="sf-modal-tab" data-sf-action="preview-tab" data-sf-tab="summary">⚡ สรุปย่อ</button>
      </div>
      <div class="sf-modal-body" id="sf-modal-body"></div>
      <div class="sf-modal-footer">
        <button type="button" class="sf-btn sf-btn-secondary" data-sf-action="close-preview">ปิด</button>
        <button type="button" class="sf-btn sf-btn-primary" data-sf-action="do-print" id="sf-do-print-btn">🖨️ พิมพ์ / บันทึก PDF</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  sfRenderPreviewBody();
  sfUpdatePrintBtnLabel();
  overlay.addEventListener('click', function(e){
    if(e.target===overlay){ sfClosePreview(); return; }
    const btn = e.target.closest('[data-sf-action]');
    if(!btn) return;
    const action = btn.getAttribute('data-sf-action');
    if(action==='close-preview') sfClosePreview();
    else if(action==='do-print') sfPrintCurrentForm();
    else if(action==='preview-tab'){
      sfState.previewTab = btn.getAttribute('data-sf-tab');
      overlay.querySelectorAll('.sf-modal-tab').forEach(t=>t.classList.toggle('active', t.getAttribute('data-sf-tab')===sfState.previewTab));
      sfRenderPreviewBody();
      sfUpdatePrintBtnLabel();
    }
  });
  document.addEventListener('keydown', sfPreviewEscHandler);
}
function sfUpdatePrintBtnLabel(){
  const btn = document.getElementById('sf-do-print-btn');
  if(!btn) return;
  btn.textContent = sfState.previewTab==='summary' ? '🖨️ พิมพ์ / บันทึก PDF (สรุปย่อ)' : '🖨️ พิมพ์ / บันทึก PDF (เต็มฟอร์ม)';
}

/* ---------------- GOOGLE SHEET EXPORT ---------------- */
function sfFlattenFormForSheet(formKey, student){
  const sections = sfGetSections(formKey);
  const rows = [];
  sections.forEach(section=>{
    section.fields.forEach(f=>{
      if(f.type==='heading'||f.type==='note') return;
      let val = '';
      if(f.type==='text'||f.type==='number'||f.type==='date'||f.type==='textarea'){
        val = sfPText(formKey, f.id);
      } else if(f.type==='radio'){
        val = sfPChoiceText(formKey, f.id);
      } else if(f.type==='checkboxgroup'){
        const v = sfPV(formKey, f.id); const sel=(v&&v.selected)||[];
        val = sel.map(s=> s==='__other__' ? (v.other||'') : s).filter(Boolean).join(', ');
      } else if(f.type==='table'){
        const arr = sfPV(formKey, f.id)||[];
        val = arr.filter(r=>Object.values(r.cells||{}).some(Boolean))
          .map(r=> f.columns.map(c=>(r.cells&&r.cells[c.id])?`${c.label}:${r.cells[c.id]}`:'').filter(Boolean).join(' / '))
          .join('  |  ');
      } else if(f.type==='matrix'){
        const m = sfPV(formKey, f.id);
        if(m && m.cols){
          val = f.rows.map(r=>{
            const cellsTxt = m.cols.map(c=>{
              const cv = (m.values[r.id]&&m.values[r.id][c._id])||'';
              return cv ? `${c.label||'ระดับชั้น/ปี'}=${cv}` : '';
            }).filter(Boolean).join(', ');
            return cellsTxt ? `${r.label}: ${cellsTxt}` : '';
          }).filter(Boolean).join('  |  ');
        }
      }
      if(val) rows.push({ section: section.title, label: f.label, value: val });
    });
  });
  return rows;
}
async function sfSendToSheet(btn){
  const student = sfGetStudent();
  if(!student) return;

  // ── ตรวจความครบถ้วนก่อน แล้วค่อยตั้งสถานะ "กรอกครบ" ──
  // สถานะ "กรอกครบแล้ว" จะขึ้นก็ต่อเมื่อกรอกครบทุกช่องแล้วกดบันทึกเท่านั้น
  const formKey = sfState.formKey;
  const complete = sfIsFormComplete(formKey);
  if(!student[formKey]) student[formKey] = {};
  student[formKey].__touched = true;
  student[formKey].__complete = complete;
  try { saveToStorage(); } catch(e) {}           // บันทึกข้อมูล + สถานะลงเครื่อง/คลาวด์
  try { sfRenderPage(); } catch(e) {}             // อัปเดตแท็บ/สถานะบนหน้าจอทันที
  try { if(typeof renderFormTrack==='function') renderFormTrack(); } catch(e) {}

  const formLabelShort = formKey==='form1' ? 'แบบฟอร์มที่ 1' : 'แบบฟอร์มที่ 2';
  if(!complete){
    const missing = sfIncompleteSections(formKey);
    showStatus('💾 บันทึกข้อมูล'+formLabelShort+'เรียบร้อย'
      + (missing.length ? ' · ยังกรอกไม่ครบบางช่อง สถานะจึงเป็น "กรอกบางส่วน" (ส่วนที่เหลือ: ' + missing.slice(0,4).join(', ') + (missing.length>4?' …':'') + ')'
                        : ' · สถานะ: กรอกบางส่วน'), 'success');
    return;   // ยังไม่ส่งขึ้น Sheet จนกว่าจะกรอกครบ (กันข้อมูลไม่สมบูรณ์ปนขึ้นชีต)
  }

  // กรอกครบแล้ว → ส่งขึ้น Google Sheet ตามเดิม
  if(typeof SCRIPT_URL==='undefined' || !SCRIPT_URL){
    showStatus('✅ '+formLabelShort+' กรอกครบและบันทึกแล้ว (ยังไม่ได้ตั้งค่า Google Sheet จึงไม่ได้ส่งออนไลน์)', 'success');
    return;
  }
  const original = btn ? btn.textContent : '';
  if(btn){ btn.textContent='⏳ กำลังส่ง...'; btn.disabled=true; }
  try{
    const fields = sfFlattenFormForSheet(sfState.formKey, student);
    const formLabel = sfState.formKey==='form1' ? 'แบบฟอร์มที่ 1 - ข้อมูลรายบุคคล' : 'แบบฟอร์มที่ 2 - ผลการเรียน ความประพฤติ การใช้จ่าย';
    const payload = {
      action: 'saveScholarshipForm',
      formType: sfState.formKey,
      formLabel: formLabel,
      studentId: student.id || '',
      studentNo: student.no || '',
      studentName: student.name || '',
      school: student.school_m1 || '',
      province: student.province || '',
      updatedAt: new Date().toISOString(),
      fields: fields
    };
    const result = await gasPost(payload);
    showStatus('☁️ '+formLabel+' ของ '+(student.name||'นักเรียน')+' — กรอกครบและส่งไป Google Sheet แล้ว'+(result&&result.sheetName?' (ชีต: '+result.sheetName+')':''), 'success');
  } catch(err){
    showStatus('⚠️ ส่งไป Google Sheet ไม่สำเร็จ: '+err.message, 'error');
  } finally {
    if(btn){ btn.textContent=original; btn.disabled=false; }
  }
}

