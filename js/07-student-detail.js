/* ============================================================
   07-student-detail.js — Modal รายละเอียดนักเรียน + แท็บการเงิน/ผลการเรียน/โรงเรียน
   (แยกมาจาก index.html เดิม บรรทัด 1898-2489 โดยรักษาลำดับโค้ดเดิม)
   ============================================================ */
function openStudentDetail(idx){
  editingIndex=idx;
  const s=DB.students[idx];
  document.getElementById('student-modal-title').textContent=`${s.name||'(ไม่มีชื่อ)'} ${s.nickname?'('+s.nickname+')':''}`;
  const g=getLatestGpa(s);

  // Header with large photo
  const escapedPhotoUrl = (s.photoUrl||'').replace(/'/g,"&#39;");
  const escapedName = (s.name||'').replace(/'/g,"&#39;");
  const photoHtml=s.photoUrl
    ?`<img class="modal-photo-big" src="${fixDriveUrl(s.photoUrl)}" alt="${s.name}" title="คลิกดูรูปเต็ม" onclick="openLightbox('${escapedPhotoUrl}','${escapedName}')" onerror="this.style.display='none';this.nextSibling.style.display='flex'"><div class="modal-avatar-big" style="display:none">${initials(s.name)}</div>`
    :`<div class="modal-avatar-big">${initials(s.name)}</div>`;
  document.getElementById('student-modal-header-info').innerHTML=`
    ${photoHtml}
    <div class="modal-student-info">
      <div class="modal-student-name">${s.name||'-'}</div>
      <div class="modal-student-sub">ชื่อเล่น: ${s.nickname||'-'} &bull; ลำดับที่ ${s.no}</div>
      <div class="modal-student-sub" style="font-family:'Sarabun',monospace;font-size:12px">${maskId(s.id)}</div>
      <div class="modal-student-badges">
        ${g.gpa>0?`<span class="badge b-blue" style="font-size:12px">GPA ${g.gpa}</span>`:''}
        ${g.riskLevel?`<span class="${riskBadge(g.riskLevel)}">${g.riskLevel}</span>`:''}
        ${g.hasObstacle?`<span class="badge b-amber">มีอุปสรรค</span>`:''}
        <span class="badge b-gray">${s.province||'-'}</span>
      </div>
    </div>`;

  // Panel 0: Personal
  const a=s.addr||{};
  document.getElementById('st-panel-0').innerHTML=`
    <!-- ส่วนที่ 1: ประวัตินักเรียน -->
    <div class="form-section">
      <div class="form-section-title" style="color:var(--blue);border-color:var(--blue)">👤 ประวัตินักเรียน</div>
      <div class="form-grid">
        <div class="fg"><label>ชื่อ-สกุล</label><input value="${s.name||''}" onchange="DB.students[${idx}].name=this.value;refreshModalHeader(${idx})"></div>
        <div class="fg"><label>ชื่อเล่น</label><input value="${s.nickname||''}" onchange="DB.students[${idx}].nickname=this.value;refreshModalHeader(${idx})"></div>
        <div class="fg"><label>เลขบัตรประชาชน</label><input id="id-input-${idx}"value="${maskId(s.id)}"data-real-value="${s.id||''}"style="font-family:'Sarabun',monospace"title="คลิกเพื่อแก้ไข"onfocus="this.value=this.dataset.realValue;this.select()"onblur="document.getElementById('id-input-${idx}').dataset.realValue=this.value.replace(/\D/g,'');this.value=maskId(this.value)"onchange="document.getElementById('id-input-${idx}').dataset.realValue=this.value.replace(/\D/g,'')"></div>
        <div class="fg"><label>วันเดือนปีเกิด</label><input type="date" value="${s.dob||''}" onchange="DB.students[${idx}].dob=this.value"></div>
        <div class="fg"><label>อายุ (Age)</label><input readonly value="${calcAge(s.dob)}" style="background:var(--bg2);color:var(--text2);cursor:default" title="คำนวณอัตโนมัติจากวันเกิด"></div>
        <div class="fg"><label>โทรศัพท์นักเรียน</label><input value="${s.phone||''}" onchange="DB.students[${idx}].phone=this.value"></div>
        <div class="fg"><label>ชื่อ-สกุล ผู้ปกครอง</label><input value="${s.parent||''}" onchange="DB.students[${idx}].parent=this.value"></div>
        <div class="fg"><label>โทรศัพท์ผู้ปกครอง</label><input value="${s.parentPhone||''}" onchange="DB.students[${idx}].parentPhone=this.value"></div>
      </div>
    </div>
    <!-- ส่วนที่ 2: ภูมิลำเนา -->
    <div class="form-section">
      <div class="form-section-title" style="color:var(--teal);border-color:var(--teal)">🏡 ภูมิลำเนา (บ้านเกิด)</div>
      <div class="form-grid">
        <div class="fg"><label>สัญชาติ</label><input value="${a.nat||''}" onchange="DB.students[${idx}].addr.nat=this.value"></div>
        <div class="fg"><label>ศาสนา</label><input value="${a.rel||''}" onchange="DB.students[${idx}].addr.rel=this.value"></div>
        <div class="fg"><label>บ้านเลขที่</label><input value="${a.no||''}" placeholder="เช่น 123" onchange="DB.students[${idx}].addr.no=this.value"></div>
        <div class="fg"><label>หมู่ที่</label><input value="${a.moo||''}" onchange="DB.students[${idx}].addr.moo=this.value"></div>
        <div class="fg"><label>ชื่อหมู่บ้าน</label><input value="${a.village||''}" onchange="DB.students[${idx}].addr.village=this.value"></div>
        <div class="fg"><label>ตำบล</label><input value="${a.tambon||''}" onchange="DB.students[${idx}].addr.tambon=this.value"></div>
        <div class="fg"><label>อำเภอ</label><input value="${a.amphoe||''}" onchange="DB.students[${idx}].addr.amphoe=this.value"></div>
        <div class="fg"><label>จังหวัด</label><input value="${a.province||''}" onchange="DB.students[${idx}].addr.province=this.value"></div>
        <div class="fg"><label>รหัสไปรษณีย์</label><input value="${a.zip||''}" onchange="DB.students[${idx}].addr.zip=this.value"></div>
      </div>
    </div>
    <!-- ส่วนที่ 3: ข้อมูลโรงเรียน -->
    <div class="form-section">
      <div class="form-section-title" style="color:var(--amber);border-color:var(--amber)">🏫 ข้อมูลโรงเรียน</div>
      <div style="background:var(--blue-lt);border-radius:var(--rad);padding:12px 14px;margin-bottom:12px;border:1px solid rgba(26,95,168,0.12)">
        <div style="font-size:11px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px">📚 โรงเรียนเดิม (ป.6)</div>
        <div class="form-grid">
          <div class="fg fg-full"><label>ชื่อโรงเรียน ป.6</label><input value="${s.school_p6||''}" onchange="DB.students[${idx}].school_p6=this.value"></div>
          <div class="fg"><label>GPA ชั้น ป.6</label><input type="number" step="0.01" min="0" max="4" value="${s.gpa_p6||''}" onchange="DB.students[${idx}].gpa_p6=parseFloat(this.value)||0" style="font-weight:700;font-size:15px;color:var(--blue)"></div>
        </div>
      </div>
      <div style="background:var(--teal-lt);border-radius:var(--rad);padding:12px 14px;border:1px solid rgba(13,107,82,0.12)">
        <div style="font-size:11px;font-weight:700;color:var(--teal);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px">🎓 โรงเรียนปัจจุบัน (ม.1)</div>
        <div class="form-grid">
          <div class="fg fg-full"><label>ชื่อโรงเรียน ม.1</label><input value="${s.school_m1||''}" onchange="DB.students[${idx}].school_m1=this.value"></div>
          <div class="fg"><label>ตำบล (ที่ตั้งโรงเรียน)</label><input value="${(s.school_m1_addr||{}).district||''}" placeholder="เช่น หนองบัว" onchange="if(!DB.students[${idx}].school_m1_addr)DB.students[${idx}].school_m1_addr={};DB.students[${idx}].school_m1_addr.district=this.value"></div>
          <div class="fg"><label>อำเภอ (ที่ตั้งโรงเรียน)</label><input value="${(s.school_m1_addr||{}).amphoe||''}" placeholder="เช่น หนองบัว" onchange="if(!DB.students[${idx}].school_m1_addr)DB.students[${idx}].school_m1_addr={};DB.students[${idx}].school_m1_addr.amphoe=this.value"></div>
          <div class="fg"><label>จังหวัดที่ตั้งโรงเรียน</label><input value="${s.province||''}" onchange="DB.students[${idx}].province=this.value"></div>
          <div class="fg"><label>สังกัด</label><input value="${s.org||''}" onchange="DB.students[${idx}].org=this.value"></div>
          <div class="fg"><label>GPA ชั้น ม.1 (ล่าสุด)</label>
            <input type="number" step="0.01" min="0" max="4" 
              value="${getLatestGpa(s).gpa||''}" 
              onchange="if(DB.students[${idx}].semGpa&&DB.students[${idx}].semGpa.length>0){DB.students[${idx}].semGpa[DB.students[${idx}].semGpa.length-1].gpa=parseFloat(this.value)||0;DB.students[${idx}].gpa.gpa=parseFloat(this.value)||0;refreshModalHeader(${idx})}"
              style="font-weight:700;font-size:15px;color:var(--teal)"></div>
        </div>
      </div>
    </div>
    <!-- ส่วนที่ 4: พฤติกรรม / หมายเหตุ -->
    <div class="form-section">
      <div class="form-section-title">📝 พฤติกรรมนักเรียน / หมายเหตุ</div>
      <div class="form-grid">
        <div class="fg fg-full">
  <textarea placeholder="กรอกข้อมูลพฤติกรรมของนักเรียนที่นี่..." onchange="DB.students[${idx}].behavior=this.value">${s.behavior||''}</textarea>
</div>
      </div>
    </div>
    <!-- ส่วนที่ 5: พี่เลี้ยง -->
    <div class="form-section">
      <div class="form-section-title">👨‍🏫 ข้อมูลพี่เลี้ยง</div>
      <div class="form-grid">
        <div class="fg"><label>ชื่อ</label><input value="${s.mentor?.firstName||''}" placeholder="ชื่อ" onchange="if(!DB.students[${idx}].mentor)DB.students[${idx}].mentor={};DB.students[${idx}].mentor.firstName=this.value"></div>
        <div class="fg"><label>สกุล</label><input value="${s.mentor?.lastName||''}" placeholder="นามสกุล" onchange="if(!DB.students[${idx}].mentor)DB.students[${idx}].mentor={};DB.students[${idx}].mentor.lastName=this.value"></div>
        <div class="fg"><label>เบอร์โทร</label><input value="${s.mentor?.phone||''}" placeholder="08x-xxx-xxxx" onchange="if(!DB.students[${idx}].mentor)DB.students[${idx}].mentor={};DB.students[${idx}].mentor.phone=this.value"></div>
        <div class="fg"><label>ตำแหน่ง</label><input value="${s.mentor?.position||''}" placeholder="เช่น ครูที่ปรึกษา" onchange="if(!DB.students[${idx}].mentor)DB.students[${idx}].mentor={};DB.students[${idx}].mentor.position=this.value"></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">รูปภาพ</div>
      <div class="form-grid">
        <div class="fg fg-full"><label>รูปภาพ</label>
          <div class="photo-section">
            <div class="photo-preview-box">
              <div id="photo-preview-${idx}">
                ${s.photoUrl
                  ? `<img src="${fixDriveUrl(s.photoUrl)}" onerror="this.style.display='none';this.nextSibling.style.display='flex'" style="width:100px;height:100px;border-radius:var(--rad-lg);object-fit:cover;object-position:top center;border:2px solid var(--border2)"><div class="photo-avatar-lg" style="display:none">${initials(s.name)}</div>`
                  : `<div class="photo-avatar-lg">${initials(s.name)}</div>`}
              </div>
              ${s.photoUrl ? `<button class="btn btn-sm btn-danger" style="margin-top:6px;width:100%" onclick="removePhoto(${idx})">🗑 ลบรูป</button>` : ''}
            </div>
            <div class="photo-controls">
              <div class="photo-source-tabs">
                <button class="photo-source-tab active" onclick="switchPhotoSource('upload',this,${idx})">📁 อัปโหลดไฟล์</button>
                <button class="photo-source-tab" onclick="switchPhotoSource('url',this,${idx})">🔗 URL</button>
              </div>
              <div id="photo-src-upload-${idx}">
                <div class="photo-upload-zone" ondragover="event.preventDefault();this.style.borderColor='var(--blue)'" ondragleave="this.style.borderColor=''" ondrop="handlePhotoDrop(event,${idx})">
                  <input type="file" accept="image/*" onchange="handlePhotoFile(this,${idx})">
                  <div class="upload-icon">📷</div>
                  <div class="upload-text">คลิกหรือลากรูปภาพมาวาง</div>
                  <div class="upload-sub">JPG, PNG, WEBP ขนาดไม่เกิน 5MB</div>
                </div>
              </div>
              <div id="photo-src-url-${idx}" style="display:none">
                <input style="width:100%;padding:8px 10px;border-radius:var(--rad);border:1px solid var(--border2);font-size:12px;font-family:'Sarabun',sans-serif" 
                  value="${s.photoUrl||''}" 
                  placeholder="https://drive.google.com/uc?export=view&id=..."
                  onchange="setPhotoUrl(${idx},this.value)">
                <div class="photo-size-note" style="margin-top:4px">วาง URL จาก Google Drive หรือลิงก์รูปภาพโดยตรง</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  // Panel 1: Address
  document.getElementById('st-panel-1').innerHTML=`
    <div class="form-section">
      <div class="form-section-title">ที่อยู่</div>
      <div class="form-grid">
        <div class="fg"><label>สัญชาติ</label><input value="${a.nat||''}" onchange="DB.students[${idx}].addr.nat=this.value"></div>
        <div class="fg"><label>ศาสนา</label><input value="${a.rel||''}" onchange="DB.students[${idx}].addr.rel=this.value"></div>
        <div class="fg"><label>หมู่ที่</label><input value="${a.moo||''}" onchange="DB.students[${idx}].addr.moo=this.value"></div>
        <div class="fg"><label>หมู่บ้าน</label><input value="${a.village||''}" onchange="DB.students[${idx}].addr.village=this.value"></div>
        <div class="fg"><label>ตำบล</label><input value="${a.tambon||''}" onchange="DB.students[${idx}].addr.tambon=this.value"></div>
        <div class="fg"><label>อำเภอ</label><input value="${a.amphoe||''}" onchange="DB.students[${idx}].addr.amphoe=this.value"></div>
        <div class="fg"><label>จังหวัด</label><input value="${a.province||''}" onchange="DB.students[${idx}].addr.province=this.value"></div>
        <div class="fg"><label>รหัสไปรษณีย์</label><input value="${a.zip||''}" onchange="DB.students[${idx}].addr.zip=this.value"></div>
      </div>
    </div>`;

  // Panel 2: Parents
  document.getElementById('st-panel-2').innerHTML=`
    <div class="form-section">
      <div class="form-section-title">ข้อมูลผู้ปกครอง</div>
      <div class="form-grid">
        <div class="fg fg-full"><label>ชื่อ-สกุล ผู้ปกครอง</label><input value="${s.parent||''}" onchange="DB.students[${idx}].parent=this.value"></div>
        <div class="fg"><label>โทรศัพท์ผู้ปกครอง</label><input value="${s.parentPhone||''}" onchange="DB.students[${idx}].parentPhone=this.value"></div>
      </div>
    </div>`;

  // Panel 3: Bank
  const b=s.bank||{};
  document.getElementById('st-panel-3').innerHTML=`
    <div class="detail-card"><div class="detail-card-title">บัญชีนักเรียน</div>
    <div class="form-grid">
      <div class="fg"><label>เลขสัญญา</label><input value="${b.contract||''}" onchange="DB.students[${idx}].bank.contract=this.value"></div>
      <div class="fg"><label>วันที่สัญญา</label><input value="${fmtThaiDate(b.contractDate)}" onchange="DB.students[${idx}].bank.contractDate=this.value"></div>
      <div class="fg"><label>ธนาคาร</label><input value="${b.bankSt||''}" onchange="DB.students[${idx}].bank.bankSt=this.value"></div>
      <div class="fg"><label>สาขา</label><input value="${b.branchSt||''}" onchange="DB.students[${idx}].bank.branchSt=this.value"></div>
      <div class="fg"><label>เลขที่บัญชี</label><input value="${b.accNoSt||''}" onchange="DB.students[${idx}].bank.accNoSt=this.value"></div>
      <div class="fg fg-full"><label>ชื่อบัญชี</label><input value="${b.accNameSt||''}" onchange="DB.students[${idx}].bank.accNameSt=this.value"></div>
    </div></div>
    <div class="detail-card"><div class="detail-card-title">บัญชีโรงเรียน</div>
    <div class="form-grid">
      <div class="fg"><label>ธนาคาร</label><input value="${b.bankSch||''}" onchange="DB.students[${idx}].bank.bankSch=this.value"></div>
      <div class="fg"><label>สาขา</label><input value="${b.branchSch||''}" onchange="DB.students[${idx}].bank.branchSch=this.value"></div>
      <div class="fg"><label>เลขที่บัญชี</label><input value="${b.accNoSch||''}" onchange="DB.students[${idx}].bank.accNoSch=this.value"></div>
      <div class="fg fg-full"><label>ชื่อบัญชี</label><input value="${b.accNameSch||''}" onchange="DB.students[${idx}].bank.accNameSch=this.value"></div>
    </div></div>`;

  // Panel 4: Payment history (all semesters)
  renderPaymentPanel(idx);

  // Panel 5: GPA history
  renderGpaPanel(idx);
  renderSchoolPanel(idx);

  document.getElementById('student-modal').classList.add('open');
  switchTab('st',0,document.querySelector('.detail-tab'));
}

function renderPaymentPanel(idx){
  const s=DB.students[idx];
  const recs=s.semPayments||[];
  const grandTotal=recs.reduce((a,p)=>a+(p.p1||0)+(p.p2||0),0);
  let html=``;
  // Summary bar
  if(recs.length>0){
    html+=`<div style="background:var(--teal-lt);border:1px solid rgba(13,107,82,0.18);border-radius:var(--rad-lg);padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div style="flex:1">
        <div style="font-size:11px;color:var(--teal);font-weight:600;text-transform:uppercase;letter-spacing:0.4px">💰 ยอดรวมทุกภาคเรียน</div>
        <div style="font-size:22px;font-weight:700;color:var(--teal)">${fmt(grandTotal)} บาท</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:var(--text2)">${recs.length} ภาคเรียน</div>
        <div style="font-size:12px;color:var(--text3)">ส่วนที่ 1: ${fmt(recs.reduce((a,p)=>a+(p.p1||0),0))} + ส่วนที่ 2: ${fmt(recs.reduce((a,p)=>a+(p.p2||0),0))}</div>
      </div>
    </div>`;
  }
  html+=`<div class="sem-records">`;
  recs.forEach((p,pi)=>{
    const total=(p.p1||0)+(p.p2||0);
    const pct1=total>0?Math.round((p.p1||0)/total*100):0;
    const pct2=total>0?Math.round((p.p2||0)/total*100):0;
    html+=`<div class="sem-record">
      <div class="sem-record-header" onclick="toggleSemRecord(this)">
        <div style="width:8px;height:8px;border-radius:50%;background:var(--teal);flex-shrink:0"></div>
        <div class="sem-record-term">ภาคเรียน <strong>${p.term}</strong></div>
        <div style="font-size:13px;font-weight:700;color:var(--teal);margin-left:auto">${fmt(total)} บาท</div>
        <div style="font-size:18px;color:var(--text3);margin-left:8px">▾</div>
      </div>
      <div class="sem-record-body">
        <!-- ตารางสรุป -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px 14px 10px;border-bottom:1px solid var(--border)">
          <div style="background:var(--blue-lt);border-radius:var(--rad);padding:10px 12px;border:1px solid rgba(26,95,168,0.12)">
            <div style="font-size:10px;color:var(--blue);font-weight:700;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px">ส่วนที่ 1 (ค่าบำรุงฯ)</div>
            <div style="font-size:18px;font-weight:700;color:var(--blue)">${fmt(p.p1||0)}</div>
            <div style="font-size:10px;color:var(--text3)">บาท · ${pct1}%</div>
            <div style="font-size:11px;color:var(--text2);margin-top:4px">${p.item1||'-'}</div>
          </div>
          <div style="background:var(--teal-lt);border-radius:var(--rad);padding:10px 12px;border:1px solid rgba(13,107,82,0.12)">
            <div style="font-size:10px;color:var(--teal);font-weight:700;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px">ส่วนที่ 2 (ค่าใช้จ่าย)</div>
            <div style="font-size:18px;font-weight:700;color:var(--teal)">${fmt(p.p2||0)}</div>
            <div style="font-size:10px;color:var(--text3)">บาท · ${pct2}%</div>
            <div style="font-size:11px;color:var(--text2);margin-top:4px">${p.item2||'-'}</div>
          </div>
        </div>
        <!-- แบบฟอร์มแก้ไข -->
        <div class="form-grid" style="padding:14px">
          <div class="fg"><label>ภาคเรียน</label><input value="${p.term||''}" onchange="DB.students[${idx}].semPayments[${pi}].term=this.value;renderDashboard();populateTermFilter();debouncedSave(${idx})"></div>
          <div class="fg"><label>ส่วนที่ 1 (บาท) — ค่าบำรุงการศึกษา</label><input type="number" value="${p.p1||0}" onchange="DB.students[${idx}].semPayments[${pi}].p1=parseFloat(this.value)||0;renderPaymentPanel(${idx});renderDashboard();debouncedSave(${idx})"></div>
          <div class="fg"><label>รายการส่วนที่ 1</label><input value="${p.item1||''}" onchange="DB.students[${idx}].semPayments[${pi}].item1=this.value;debouncedSave(${idx})"></div>
          <div class="fg"><label>ส่วนที่ 2 (บาท) — ค่าใช้จ่ายในการเรียน</label><input type="number" value="${p.p2||0}" onchange="DB.students[${idx}].semPayments[${pi}].p2=parseFloat(this.value)||0;renderPaymentPanel(${idx});renderDashboard();debouncedSave(${idx})"></div>
          <div class="fg"><label>รายการส่วนที่ 2</label><input value="${p.item2||''}" onchange="DB.students[${idx}].semPayments[${pi}].item2=this.value;debouncedSave(${idx})"></div>
          <div class="fg" style="align-self:end"><button class="btn btn-danger btn-sm" onclick="if(confirm('ลบข้อมูลภาคเรียน ${p.term||''} นี้?')){DB.students[${idx}].semPayments.splice(${pi},1);renderPaymentPanel(${idx});saveToStorage();saveStudentToSheet(${idx})}">🗑 ลบภาคเรียน</button></div>
        </div>
        <div style="padding:0 14px 14px;font-size:13px;color:var(--text2)">
          รวมภาคเรียนนี้: <strong style="color:var(--teal);font-size:15px">${fmt(total)} บาท</strong>
          <span style="margin-left:8px;font-size:11px">(ส่วนที่ 1: ${fmt(p.p1||0)} + ส่วนที่ 2: ${fmt(p.p2||0)})</span>
        </div>
      </div>
    </div>`;
  });
  html+=`</div>
  <button class="sem-add-btn" style="margin-top:10px" onclick="addSemPayment(${idx})">+ เพิ่มข้อมูลภาคเรียนใหม่</button>`;
  document.getElementById('st-panel-4').innerHTML=html;
}

function renderGpaPanel(idx){
  const s=DB.students[idx];
  const recs=s.semGpa||[];
  let html=`<div class="sem-records">`;
  recs.forEach((g,gi)=>{
    html+=`<div class="sem-record">
      <div class="sem-record-header" onclick="toggleSemRecord(this)">
        <div class="sem-record-term">📅 ภาคเรียน ${g.term}</div>
        ${g.gpa>0?`<span style="font-size:15px;font-weight:700;color:${gpaColor(g.gpa)}">${g.gpa}</span>`:'<span style="color:var(--text3);font-size:12px">ยังไม่มี GPA</span>'}
        <span class="${riskBadge(g.riskLevel)}" style="margin-left:6px">${g.riskLevel||'-'}</span>
        <div style="font-size:18px;color:var(--text3);margin-left:auto">▾</div>
      </div>
      <div class="sem-record-body">
        <div class="form-grid" style="padding:14px">
          <div class="fg"><label>ภาคเรียน</label><input value="${g.term||''}" onchange="DB.students[${idx}].semGpa[${gi}].term=this.value;debouncedSave(${idx})"></div>
          <div class="fg"><label>GPA</label><input type="number" step="0.01" min="0" max="4" value="${g.gpa||''}" onchange="DB.students[${idx}].semGpa[${gi}].gpa=parseFloat(this.value)||0;renderGpaPanel(${idx});debouncedSave(${idx})"></div>
          <div class="fg"><label>ระดับความเสี่ยง</label>
            <select onchange="DB.students[${idx}].semGpa[${gi}].riskLevel=this.value;renderGpaPanel(${idx});debouncedSave(${idx})">
              ${['สูงมาก','สูง','ปานกลาง','ต่ำ'].map(v=>`<option ${g.riskLevel===v?'selected':''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="fg"><label>มีอุปสรรค</label>
            <select onchange="DB.students[${idx}].semGpa[${gi}].hasObstacle=this.value==='true';debouncedSave(${idx})">
              <option value="true" ${g.hasObstacle?'selected':''}>มี</option>
              <option value="false" ${!g.hasObstacle?'selected':''}>ไม่มี</option>
            </select>
          </div>
          <div class="fg"><label>ประเภทอุปสรรค</label><input value="${g.obstacleType||''}" onchange="DB.students[${idx}].semGpa[${gi}].obstacleType=this.value;debouncedSave(${idx})"></div>
          <div class="fg"><label>วิชาที่อ่อน</label><input value="${g.weakSubjects||''}" onchange="DB.students[${idx}].semGpa[${gi}].weakSubjects=this.value;debouncedSave(${idx})"></div>
          <div class="fg fg-full"><label>การช่วยเหลือของโรงเรียน</label><input value="${g.schoolSupport||''}" onchange="DB.students[${idx}].semGpa[${gi}].schoolSupport=this.value;debouncedSave(${idx})"></div>
          <div class="fg"><button class="btn btn-danger btn-sm" onclick="if(confirm('ลบข้อมูลภาคเรียนนี้?')){DB.students[${idx}].semGpa.splice(${gi},1);renderGpaPanel(${idx});debouncedSave(${idx})}">🗑 ลบ</button></div>
        </div>
      </div>
    </div>`;
  });
  html+=`</div>
  <button class="sem-add-btn" style="margin-top:10px" onclick="addSemGpa(${idx})">+ เพิ่ม GPA ภาคเรียนใหม่</button>`;
  document.getElementById('st-panel-5').innerHTML=html;
}

function toggleSemRecord(el){
  const body=el.nextElementSibling;
  body.classList.toggle('open');
}
function nextTermAfter(terms){
  // terms: array of strings like '1/2568', '2/2568'
  if(!terms||terms.length===0) return '1/2568';
  const sorted=[...terms].sort((a,b)=>{
    const pa=String(a).match(/(\d+)\/(\d+)/),pb=String(b).match(/(\d+)\/(\d+)/);
    if(!pa||!pb) return 0;
    return (parseInt(pa[2])*10+parseInt(pa[1]))-(parseInt(pb[2])*10+parseInt(pb[1]));
  });
  const last=sorted[sorted.length-1];
  const m=String(last).match(/(\d+)\/(\d+)/);
  if(!m) return last;
  const sem=parseInt(m[1]),yr=parseInt(m[2]);
  return sem===1?`2/${yr}`:`1/${yr+1}`;
}
function addSemPayment(idx){
  if(!DB.students[idx].semPayments) DB.students[idx].semPayments=[];
  const existingTerms=DB.students[idx].semPayments.map(p=>p.term).filter(Boolean);
  const newTerm=nextTermAfter(existingTerms);
  DB.students[idx].semPayments.push({term:newTerm,p1:0,p2:0,item1:'ค่าเงินบำรุงการศึกษา',item2:'ค่าใช้จ่ายในการเรียน'});
  renderPaymentPanel(idx);
  saveToStorage();
  saveStudentToSheet(idx);
  setTimeout(()=>{const recs=document.querySelectorAll('#st-panel-4 .sem-record-body');if(recs.length)recs[recs.length-1].classList.add('open');},50);
}
function addSemGpa(idx){
  if(!DB.students[idx].semGpa) DB.students[idx].semGpa=[];
  const existingTerms=DB.students[idx].semGpa.map(g=>g.term).filter(Boolean);
  const newTerm=nextTermAfter(existingTerms);
  DB.students[idx].semGpa.push({term:newTerm,gpa:0,riskLevel:'ปานกลาง',hasObstacle:false,obstacleType:'',weakSubjects:'',schoolSupport:''});
  renderGpaPanel(idx);
  saveToStorage();
  saveStudentToSheet(idx);
  setTimeout(()=>{const recs=document.querySelectorAll('#st-panel-5 .sem-record-body');if(recs.length)recs[recs.length-1].classList.add('open');},50);
}

function renderSchoolPanel(idx){
  const s=DB.students[idx];
  const sa=s.school_m1_addr||{};
  const lat=sa.lat||'';const lng=sa.lng||'';
  const gmapUrl=lat&&lng?`https://www.google.com/maps?q=${lat},${lng}&z=15`:`https://www.google.com/maps/search/${encodeURIComponent('โรงเรียน'+s.school_m1+' '+s.province)}`;
  const mapPreview=lat&&lng?`
    <div id="mini-map-${idx}" style="height:220px;border-radius:var(--rad);overflow:hidden;border:1px solid var(--border);margin-bottom:10px"></div>
    <script>
      (function(){
        if(typeof L==='undefined') return;
        const m=L.map('mini-map-${idx}').setView([${lat},${lng}],14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM'}).addTo(m);
        L.marker([${lat},${lng}]).addTo(m).bindPopup('<b>${s.school_m1.replace(/'/g,"&#39;")}</b><br>${s.province}').openPopup();
      })();
    <\/script>`:
    `<div style="background:var(--bg3);border-radius:var(--rad);padding:24px;text-align:center;color:var(--text3);margin-bottom:10px">
      <div style="font-size:24px;margin-bottom:6px">🗺️</div>
      <div style="font-size:12px">ยังไม่มีข้อมูล lat/long — กรอกด้านล่างเพื่อแสดงแผนที่</div>
    </div>`;

  document.getElementById('st-panel-6').innerHTML=`
    <div class="form-section">
      <div class="form-section-title" style="color:var(--teal);border-color:var(--teal)">🏫 ข้อมูลโรงเรียนปัจจุบัน (ม.1)</div>
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
        <a href="${gmapUrl}" target="_blank" class="btn btn-primary" style="text-decoration:none">
          🗺️ เปิดใน Google Maps
        </a>
        ${lat&&lng?`<span style="font-size:12px;color:var(--text2);align-self:center">📍 ${lat}, ${lng}</span>`:''}
      </div>
      ${mapPreview}
      <div class="form-grid">
        <div class="fg fg-full"><label>ชื่อโรงเรียน</label>
          <input value="${s.school_m1||''}" onchange="DB.students[${idx}].school_m1=this.value"></div>
        <div class="fg"><label>จังหวัด</label>
          <input value="${s.province||''}" onchange="DB.students[${idx}].province=this.value"></div>
        <div class="fg"><label>สังกัด</label>
          <input value="${s.org||''}" onchange="DB.students[${idx}].org=this.value"></div>
        <div class="fg"><label>ตำบล (ที่ตั้งโรงเรียน)</label>
          <input value="${sa.district||''}" placeholder="เช่น หัวขวาง" onchange="if(!DB.students[${idx}].school_m1_addr)DB.students[${idx}].school_m1_addr={};DB.students[${idx}].school_m1_addr.district=this.value"></div>
        <div class="fg"><label>อำเภอ (ที่ตั้งโรงเรียน)</label>
          <input value="${sa.amphoe||''}" placeholder="เช่น โกสุมพิสัย" onchange="if(!DB.students[${idx}].school_m1_addr)DB.students[${idx}].school_m1_addr={};DB.students[${idx}].school_m1_addr.amphoe=this.value"></div>
        <div class="fg"><label>ตำบล / แขวง</label>
          <input value="${sa.tambon||''}" onchange="if(!DB.students[${idx}].school_m1_addr)DB.students[${idx}].school_m1_addr={};DB.students[${idx}].school_m1_addr.tambon=this.value"></div>
        <div class="fg"><label>รหัสไปรษณีย์</label>
          <input value="${sa.zip||''}" onchange="if(!DB.students[${idx}].school_m1_addr)DB.students[${idx}].school_m1_addr={};DB.students[${idx}].school_m1_addr.zip=this.value"></div>
        <div class="fg fg-full"><label>ที่อยู่โรงเรียน (เพิ่มเติม)</label>
          <input value="${sa.address||''}" placeholder="เช่น 123 ถ.พหลโยธิน" onchange="if(!DB.students[${idx}].school_m1_addr)DB.students[${idx}].school_m1_addr={};DB.students[${idx}].school_m1_addr.address=this.value"></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title" style="color:var(--teal);border-color:var(--teal)">👨‍💼 ผู้อำนวยการและครูที่ปรึกษา</div>
      <div class="form-grid">
        <div class="fg"><label>ผู้อำนวยการโรงเรียน ม.1</label>
          <input value="${sa.directorM1||''}" placeholder="ชื่อ-นามสกุล" onchange="if(!DB.students[${idx}].school_m1_addr)DB.students[${idx}].school_m1_addr={};DB.students[${idx}].school_m1_addr.directorM1=this.value"></div>
        <div class="fg"><label>เบอร์โทรผู้อำนวยการ</label>
          <input value="${sa.telDirectorM1||''}" placeholder="0x-xxxx-xxxx" onchange="if(!DB.students[${idx}].school_m1_addr)DB.students[${idx}].school_m1_addr={};DB.students[${idx}].school_m1_addr.telDirectorM1=this.value"></div>
        <div class="fg"><label>ครูที่ปรึกษา / อาจารย์แนะแนว ม.1</label>
          <input value="${sa.advisorM1||''}" placeholder="ชื่อ-นามสกุล" onchange="if(!DB.students[${idx}].school_m1_addr)DB.students[${idx}].school_m1_addr={};DB.students[${idx}].school_m1_addr.advisorM1=this.value"></div>
        <div class="fg"><label>เบอร์โทรครูที่ปรึกษา</label>
          <input value="${sa.telAdvisorM1||''}" placeholder="0x-xxxx-xxxx" onchange="if(!DB.students[${idx}].school_m1_addr)DB.students[${idx}].school_m1_addr={};DB.students[${idx}].school_m1_addr.telAdvisorM1=this.value"></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">📡 พิกัดโรงเรียน (สำหรับแผนที่)</div>
      <div class="form-grid">
        <div class="fg"><label>Latitude (ละติจูด)</label>
          <input type="number" step="0.000001" value="${lat}" placeholder="เช่น 15.8642653"
            onchange="if(!DB.students[${idx}].school_m1_addr)DB.students[${idx}].school_m1_addr={};DB.students[${idx}].school_m1_addr.lat=parseFloat(this.value)||'';renderSchoolPanel(${idx})"></div>
        <div class="fg"><label>Longitude (ลองจิจูด)</label>
          <input type="number" step="0.000001" value="${lng}" placeholder="เช่น 100.5988133"
            onchange="if(!DB.students[${idx}].school_m1_addr)DB.students[${idx}].school_m1_addr={};DB.students[${idx}].school_m1_addr.lng=parseFloat(this.value)||'';renderSchoolPanel(${idx})"></div>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-top:6px">💡 คัดลอก lat/long จาก Google Maps หรือข้อมูล Excel ที่มีอยู่</div>
    </div>`;

  // Init mini map if Leaflet loaded and lat/lng available
  if(lat&&lng&&typeof L!=='undefined'){
    setTimeout(()=>{
      const containerId='mini-map-'+idx;
      const el=document.getElementById(containerId);
      if(el&&!el._leaflet_id){
        const m=L.map(containerId).setView([lat,lng],14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(m);
        L.marker([lat,lng]).addTo(m).bindPopup(`<b>${s.school_m1}</b><br>${s.province}`).openPopup();
      }
    },100);
  }
}
function refreshModalHeader(idx){
  const s=DB.students[idx];
  const g=getLatestGpa(s);
  const _ep2=(s.photoUrl||'').replace(/'/g,"&#39;");
  const _en2=(s.name||'').replace(/'/g,"&#39;");
  const photoHtml=s.photoUrl
    ?`<img class="modal-photo-big" src="${fixDriveUrl(s.photoUrl)}" alt="${s.name}" title="คลิกดูรูปเต็ม" onclick="openLightbox('${_ep2}','${_en2}')" onerror="this.style.display='none';this.nextSibling.style.display='flex'"><div class="modal-avatar-big" style="display:none">${initials(s.name)}</div>`
    :`<div class="modal-avatar-big">${initials(s.name)}</div>`;
  document.getElementById('student-modal-header-info').innerHTML=`
    ${photoHtml}
    <div class="modal-student-info">
      <div class="modal-student-name">${s.name||'-'}</div>
      <div class="modal-student-sub">ชื่อเล่น: ${s.nickname||'-'} &bull; ลำดับที่ ${s.no}</div>
      <div class="modal-student-sub" style="font-family:'Sarabun',monospace;font-size:12px">${maskId(s.id)}</div>
      <div class="modal-student-badges">
        ${g.gpa>0?`<span class="badge b-blue" style="font-size:12px">GPA ${g.gpa}</span>`:''}
        ${g.riskLevel?`<span class="${riskBadge(g.riskLevel)}">${g.riskLevel}</span>`:''}
        ${g.hasObstacle?`<span class="badge b-amber">มีอุปสรรค</span>`:''}
        <span class="badge b-gray">${s.province||'-'}</span>
      </div>
    </div>`;
}

function switchTab(prefix,idx,btn){
  const tabs=btn.closest('.detail-tabs').querySelectorAll('.detail-tab');
  tabs.forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  for(let i=0;i<7;i++){const el=document.getElementById(`${prefix}-panel-${i}`);if(el)el.classList.toggle('active',i===idx);}
}
function closeModal(id){
  // If closing student modal without saving and the student has no name (newly added but unsaved), remove it
  if (id === 'student-modal' && editingIndex !== null) {
    const s = DB.students[editingIndex];
    if (s && !s.name && editingIndex === DB.students.length - 1) {
      DB.students.splice(editingIndex, 1);
      DB.students.forEach((st, i) => { st.no = i + 1; });
      renderStudents(); renderDashboard();
    }
    editingIndex = null;
  }
  document.getElementById(id).classList.remove('open');
}

// ============ ADDRESS ============
function renderAddress(){
  const q=(document.getElementById('addr-search').value||'').toLowerCase();
  const filtered=DB.students.filter(s=>{const a=s.addr||{};return !q||(s.name+(a.amphoe||'')+(a.province||'')+(a.tambon||'')).toLowerCase().includes(q);});
  document.getElementById('address-tbody').innerHTML=filtered.map(s=>{
    const a=s.addr||{};const idx=DB.students.indexOf(s);
    return`<tr><td>${s.no}</td><td style="font-weight:600">${s.name}</td>
      <td>${a.moo||'-'}</td><td>${a.village||'-'}</td><td>${a.tambon||'-'}</td>
      <td>${a.amphoe||'-'}</td><td><span class="badge b-blue">${a.province||'-'}</span></td>
      <td>${a.zip||'-'}</td><td>${a.nat||'-'}</td><td>${a.rel||'-'}</td>
      <td><button class="btn btn-sm" onclick="openStudentDetail(${idx})">แก้ไข</button></td></tr>`;
  }).join('');
  document.getElementById('address-footer').textContent=`แสดง ${filtered.length} รายการ`;
}

// ============ BANKING ============
function renderBanking(){
  const q=(document.getElementById('bank-search').value||'').toLowerCase();
  const filtered=DB.students.filter(s=>{const b=s.bank||{};return !q||(s.name+(b.bankSt||'')+(b.accNoSt||'')).toLowerCase().includes(q);});
  document.getElementById('banking-tbody').innerHTML=filtered.map(s=>{
    const b=s.bank||{};const idx=DB.students.indexOf(s);
    return`<tr><td>${s.no}</td><td class="photo-cell">${photoEl(s)}</td><td style="font-weight:600">${s.name}<div style="font-size:11px;color:var(--text3)">${s.nickname||''}</div></td>
      <td style="font-family:'Sarabun',monospace;font-size:11px">${b.contract||'-'}</td>
      <td style="font-size:12px">${fmtThaiDate(b.contractDate)||'-'}</td>
      <td><span class="badge b-blue">${b.bankSt||'-'}</span></td>
      <td style="font-size:12px">${b.branchSt||'-'}</td>
      <td style="font-family:'Sarabun',monospace;font-size:12px">${b.accNoSt||'-'}</td>
      <td><span class="badge b-teal">${b.bankSch||'-'}</span></td>
      <td style="font-size:12px">${b.branchSch||'-'}</td>
      <td style="font-family:'Sarabun',monospace;font-size:12px">${b.accNoSch||'-'}</td>
      <td><button class="btn btn-sm" onclick="openStudentDetail(${idx})">แก้ไข</button></td></tr>`;
  }).join('');
  document.getElementById('banking-footer').textContent=`แสดง ${filtered.length} รายการ`;
}

// ============ PAYMENT ============
function populateTermFilter(){
  const terms=new Set();
  DB.students.forEach(s=>s.semPayments&&s.semPayments.forEach(p=>terms.add(p.term)));
  const sel=document.getElementById('pay-filter-term');
  if(sel.options.length<=1)[...terms].sort().forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=`ภาคเรียน ${t}`;sel.appendChild(o);});
}
function renderPayment(){
  const q=(document.getElementById('pay-search').value||'').toLowerCase();
  const ft=document.getElementById('pay-filter-term').value;
  let rows=[];
  DB.students.forEach(s=>{
    if(!s.name.toLowerCase().includes(q)&&q) return;
    const recs=s.semPayments||[{term:s.payment.term,p1:s.payment.p1||0,p2:s.payment.p2||0,item1:s.payment.item1,item2:s.payment.item2}];
    recs.filter(p=>!ft||p.term===ft).forEach(p=>{rows.push({s,p});});
  });
  const totalAll=rows.reduce((a,{p})=>a+(p.p1||0)+(p.p2||0),0);
  document.getElementById('payment-tbody').innerHTML=rows.map(({s,p})=>{
    const idx=DB.students.indexOf(s);
    const total=(p.p1||0)+(p.p2||0);
    return`<tr><td>${s.no}</td><td class="photo-cell">${photoEl(s)}</td><td style="font-weight:600">${s.name}<div style="font-size:11px;color:var(--text3)">${s.nickname||''}</div></td>
      <td style="font-size:12px">${s.school_m1||'-'}</td>
      <td><span class="badge b-blue">${s.province||'-'}</span></td>
      <td><span class="badge b-gray">${p.term||'-'}</span></td>
      <td><div style="font-weight:600;color:var(--blue)">${fmt(p.p1||0)}</div><div style="font-size:11px;color:var(--text3)">${p.item1||'-'}</div></td>
      <td><div style="font-weight:600;color:var(--teal)">${fmt(p.p2||0)}</div><div style="font-size:11px;color:var(--text3)">${p.item2||'-'}</div></td>
      <td style="font-weight:700;color:var(--teal);font-size:15px">${fmt(total)}</td>
      <td><button class="btn btn-sm" onclick="openStudentDetail(${idx});switchTabByName('ประวัติการเงิน')">แก้ไข</button></td></tr>`;
  }).join('');
  document.getElementById('payment-footer').textContent=`แสดง ${rows.length} รายการ • รวม ${fmt(totalAll)} บาท`;
}

// ============ ACADEMIC ============
function populateGpaTerm(){
  const terms=new Set();
  DB.students.forEach(s=>s.semGpa&&s.semGpa.forEach(g=>terms.add(g.term)));
  const sel=document.getElementById('gpa-term-select');
  if(sel.options.length<=1)[...terms].sort().forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=`ภาคเรียน ${t}`;sel.appendChild(o);});
}
function renderAcademic(){
  const q=(document.getElementById('gpa-search').value||'').toLowerCase();
  const fr=document.getElementById('gpa-filter-risk').value;
  const fo=document.getElementById('gpa-filter-obs').value;
  const ft=document.getElementById('gpa-term-select').value;
  let rows=[];
  DB.students.forEach(s=>{
    const recs=s.semGpa||[];
    recs.filter(g=>{
      const mq=!q||(s.name+s.province+(s.school_m1||'')).toLowerCase().includes(q);
      const mr=!fr||g.riskLevel===fr;
      const mo=!fo||(fo==='true'?g.hasObstacle:!g.hasObstacle);
      const mt=!ft||g.term===ft;
      return mq&&mr&&mo&&mt;
    }).forEach(g=>rows.push({s,g}));
  });
  document.getElementById('academic-tbody').innerHTML=rows.map(({s,g})=>{
    const idx=DB.students.indexOf(s);
    return`<tr>
      <td>${s.no}</td>
      <td class="photo-cell">${photoEl(s)}</td>
      <td style="font-weight:600">${s.name}</td>
      <td style="font-size:12px">${s.school_m1}</td>
      <td><span class="badge b-blue">${s.province}</span></td>
      <td><span class="badge b-gray">${g.term||'-'}</span></td>
      <td><div style="font-weight:700;font-size:15px;color:${gpaColor(g.gpa)}">${g.gpa||'-'}</div>
        ${g.gpa?`<div class="gpa-bar"><div class="gpa-fill" style="width:${(g.gpa/4*100).toFixed(0)}%;background:${gpaColor(g.gpa)}"></div></div>`:''}</td>
      <td style="font-weight:600;color:${gpaColor(s.gpa_p6)}">${s.gpa_p6||'-'}</td>
      <td><span class="${riskBadge(g.riskLevel)}">${g.riskLevel||'-'}</span></td>
      <td>${g.hasObstacle?'<span class="badge b-amber">มี</span>':'<span class="badge b-teal">ไม่มี</span>'}</td>
      <td style="font-size:12px">${g.obstacleType||'-'}</td>
      <td style="font-size:12px;color:var(--red)">${g.weakSubjects||'-'}</td>
    </tr>`;
  }).join('');
  document.getElementById('academic-footer').textContent=`แสดง ${rows.length} รายการ`;
}
function switchTabByName(name){
  document.querySelectorAll('.detail-tab').forEach((t,i)=>{if(t.textContent.trim()===name)switchTab('st',i,t);});
}

// ============ GPA SHEET ============
// กำหนดชั้นเรียนจาก ภาคเรียน (term เช่น 1/2568 → ม.1, 2/2568 → ม.1, 1/2569 → ม.2 ...)
