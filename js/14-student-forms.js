/* ============================================================
   14-student-forms.js — แบบฟอร์มติดตามนักเรียน (ฟอร์ม 1/2) + พิมพ์ + preview
   (แยกมาจาก index.html เดิม บรรทัด 3964-4437 โดยรักษาลำดับโค้ดเดิม)
   ============================================================ */
function sfEscapeHtml(str){
  if(str===undefined||str===null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function sfUid(){ return 'r'+Math.random().toString(36).slice(2,10)+Date.now().toString(36); }
function sfDebounce(fn,ms){ let t; return function(...a){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a),ms); }; }

const sfState = { studentIdx:null, formKey:'form1', sectionIndex:0, saveStatus:'idle', lastDir:'jump' };

function sfGetSections(formKey){ return formKey==='form1' ? SF_FORM1 : SF_FORM2; }

/* ── ตัวช่วยดึงข้อมูลจากระเบียนนักเรียนมาเติมฟอร์ม (ลดการกรอกซ้ำ) ── */
function sfSplitName(full){
  const t = String(full||'').replace(/เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|นางสาว|นาย|นาง/g,'').trim().split(/\s+/);
  return { first: t[0]||'', last: t.slice(1).join(' ') };
}
function sfLatestTerm(s){ const g = s.semGpa||[]; return g.length ? (g[g.length-1].term||'') : ''; }
function sfSumPayments(s){
  let t = 0;
  (s.semPayments||[]).forEach(p => { for(const k in p){ if(/^p\d+$/.test(k)) t += parseFloat(p[k])||0; } });
  return t || '';
}

/* ---------- Schemas (field labels kept verbatim from the official form; numbering is Arabic per request) ---------- */
const SF_FORM1 = [
  { id:'school', title:'ข้อมูลสถานศึกษา', short:'สถานศึกษา', fields:[
    { id:'school_name', type:'text', label:'ชื่อสถานศึกษา', full:true, from:s=>s.school_m1 },
    { id:'addr_no', type:'text', label:'เลขที่' },
    { id:'addr_moo', type:'text', label:'หมู่ที่' },
    { id:'addr_road', type:'text', label:'ถนน' },
    { id:'addr_tambon', type:'text', label:'ตำบล/แขวง', from:s=>(s.school_m1_addr&&s.school_m1_addr.district)||'' },
    { id:'addr_amphoe', type:'text', label:'อำเภอ/เขต', from:s=>(s.school_m1_addr&&s.school_m1_addr.amphoe)||'' },
    { id:'addr_province', type:'text', label:'จังหวัด', from:s=>s.province },
    { id:'addr_zip', type:'text', label:'รหัสไปรษณีย์' },
    { id:'phone', optional:true, type:'text', label:'โทรศัพท์' },
    { id:'fax', type:'text', label:'โทรสาร' },
    { id:'email', type:'text', label:'อีเมล' },
    { id:'fund_year', type:'text', label:'รับทุนปีที่' },
    { id:'academic_year', type:'text', label:'ปีการศึกษา', from:()=>'2568' },
  ]},
  { id:'personal', title:'ข้อมูลส่วนตัวนักเรียน', short:'ข้อมูลส่วนตัว', fields:[
    { id:'full_name', type:'text', label:'ชื่อ - นามสกุล ผู้รับทุนการศึกษา', full:true, from:s=>s.name },
    { id:'nickname', type:'text', label:'ชื่อเล่น', from:s=>s.nickname },
    { id:'national_id', type:'text', label:'เลขประจำตัวประชาชน', mono:true, maxlength:13, from:s=>s.id },
    { id:'dob', type:'date', label:'วัน เดือน ปีเกิด', from:s=>s.dob },
    { id:'nationality', type:'text', label:'เชื้อชาติ', from:s=>(s.addr&&s.addr.nat)||'ไทย' },
    { id:'religion', type:'text', label:'ศาสนา', from:s=>(s.addr&&s.addr.rel)||'' },
    { id:'hometown', type:'text', label:'ภูมิลำเนา (จังหวัด)', from:s=>(s.addr&&s.addr.province)||'' },
    { id:'cur_addr_no', type:'text', label:'ที่อยู่ปัจจุบัน เลขที่', from:s=>(s.addr&&s.addr.no)||'' },
    { id:'cur_addr_moo', type:'text', label:'หมู่ที่', from:s=>(s.addr&&s.addr.moo)||'' },
    { id:'cur_addr_road', type:'text', label:'ถนน' },
    { id:'cur_addr_tambon', type:'text', label:'ตำบล/แขวง', from:s=>(s.addr&&s.addr.tambon)||'' },
    { id:'cur_addr_amphoe', type:'text', label:'อำเภอ/เขต', from:s=>(s.addr&&s.addr.amphoe)||'' },
    { id:'cur_addr_province', type:'text', label:'จังหวัด', from:s=>(s.addr&&s.addr.province)||'' },
    { id:'cur_addr_zip', type:'text', label:'รหัสไปรษณีย์', from:s=>(s.addr&&s.addr.zip)||'' },
    { id:'cur_phone', optional:true, type:'text', label:'โทรศัพท์', from:s=>s.phone },
    { id:'cur_email', type:'text', label:'อีเมล' },
    { id:'id_line', type:'text', label:'ID Line' },
    { id:'live_with', type:'radio', label:'ปัจจุบันอาศัยอยู่กับ', options:['บิดาและมารดา','บิดา','มารดา'], other:true, full:true },
    { id:'residence_type', type:'radio', label:'ลักษณะของที่อยู่', options:['บ้านส่วนตัว','บ้านเช่า','หอพัก','ห้องเช่า'], other:true, full:true },
    { id:'travel_method', type:'radio', label:'นักเรียนเดินทางมาสถานศึกษาโดย', options:['รถประจำทาง','จักรยาน','จักรยานยนต์','เดิน'], other:true, full:true },
    { id:'distance_km', type:'number', label:'ระยะทางจากบ้าน (กิโลเมตร)' },
    { id:'travel_hour', type:'number', label:'เวลาเดินทาง (ชั่วโมง)' },
    { id:'travel_min', type:'number', label:'เวลาเดินทาง (นาที)' },
    { id:'expense_source', type:'text', label:'ได้รับเงินเพื่อเป็นค่าใช้จ่ายจาก', full:true },
    { id:'expense_amount', type:'number', label:'เป็นเงิน (บาท/วัน)' },
    { id:'expense_transport', type:'number', label:'ค่าพาหนะเดินทางไป-กลับ (บาท/วัน)' },
    { id:'expense_food', type:'number', label:'ค่าอาหารเช้า-กลางวัน (บาท/วัน)' },
    { id:'expense_other', type:'text', label:'ค่าใช้จ่ายอื่น ๆ ระบุ', full:true },
    { id:'heading_friends', type:'heading', text:'เพื่อนในสถานศึกษาที่สนิทมากที่สุด' },
    { id:'friends_school', type:'table', full:true, seedRows:2, columns:[
      {id:'name',label:'ชื่อ - นามสกุล',type:'text'},{id:'class',label:'ชั้น',type:'text'},
      {id:'room',label:'ห้อง',type:'text'},{id:'phone',label:'โทรศัพท์',type:'text'},{id:'reason',label:'เหตุผล',type:'text'}
    ]},
    { id:'heading_neighbor', type:'heading', text:'เพื่อนที่อยู่บ้านใกล้เคียงกับนักเรียนมากที่สุด' },
    { id:'friend_neighbor', type:'table', full:true, seedRows:1, columns:[
      {id:'name',label:'ชื่อ - นามสกุล',type:'text'},{id:'class',label:'ชั้น',type:'text'},
      {id:'room',label:'ห้อง',type:'text'},{id:'phone',label:'โทรศัพท์',type:'text'}
    ]},
    { id:'expect_education', type:'textarea', label:'ทุนนี้เป็นทุนต่อเนื่องจนจบปริญญาตรี นักเรียนมีความคาดหวังด้านการศึกษาอย่างไร', full:true },
    { id:'expect_career', type:'textarea', label:'ความคาดหวังด้านอาชีพในอนาคต', full:true },
    { id:'heading_pride', type:'heading', text:'ความภาคภูมิใจและความต้องการพัฒนาตนเอง' },
    { id:'pride_table', type:'table', full:true, seedRows:1, columns:[
      {id:'level',label:'ระดับชั้น/ปี',type:'text'},{id:'pride',label:'ความภาคภูมิใจในตนเอง',type:'text'},
      {id:'develop',label:'ความต้องการพัฒนาตนเอง',type:'text'},{id:'help',label:'ความต้องการให้ครู/สถานศึกษาช่วยเหลือ',type:'text'}
    ]},
  ]},
  { id:'health', title:'ข้อมูลด้านสุขภาพ', short:'สุขภาพ', fields:[
    { id:'blood_type', type:'text', label:'หมู่โลหิต' },
    { id:'visible_mark', type:'text', label:'มีตำหนิที่เห็นชัดเจน คือ', full:true },
    { id:'chronic_disease', type:'text', label:'โรคประจำตัว' },
    { id:'treatment', type:'text', label:'การรักษาพยาบาลเบื้องต้น' },
    { id:'allergy', type:'text', label:'แพ้ยา' },
    { id:'regular_medicine', type:'text', label:'ยาที่ใช้ประจำ' },
    { id:'eyesight', type:'checkboxgroup', label:'สายตา', options:['ปกติ','สายตาสั้น','สายตายาว','สายตาเอียง'], other:true, full:true },
    { id:'impairment', type:'radio', label:'ความบกพร่องทางร่างกาย', options:['ไม่มี','มี'], full:true },
    { id:'impairment_detail', type:'text', label:'ระบุความบกพร่องทางร่างกาย', full:true, showIf:{field:'impairment',equals:'มี'} },
    { id:'serious_illness', type:'textarea', label:'เคยป่วยหนักหรือประสบอุบัติเหตุร้ายแรงถึงขั้นเข้านอนโรงพยาบาล คือ', full:true },
    { id:'illness_year', type:'text', label:'เมื่อ พ.ศ.' },
  ]},
  { id:'family', title:'ข้อมูลด้านครอบครัว', short:'ครอบครัว', fields:[
    { id:'heading_father', type:'heading', text:'บิดา' },
    { id:'father_name', type:'text', label:'ชื่อ' }, { id:'father_surname', type:'text', label:'นามสกุล' },
    { id:'father_id', type:'text', label:'เลขประจำตัวประชาชน', mono:true, maxlength:13 },
    { id:'father_age', type:'number', label:'อายุ (ปี)' }, { id:'father_education', type:'text', label:'การศึกษา' },
    { id:'father_occupation', type:'text', label:'อาชีพ' }, { id:'father_income', type:'number', label:'รายได้ต่อปี (บาท)' },
    { id:'father_workplace', type:'text', label:'ที่อยู่หรือที่ทำงาน', full:true }, { id:'father_phone', optional:true, type:'text', label:'โทรศัพท์' },
    { id:'heading_mother', type:'heading', text:'มารดา' },
    { id:'mother_name', type:'text', label:'ชื่อ' }, { id:'mother_surname', type:'text', label:'นามสกุล' },
    { id:'mother_id', type:'text', label:'เลขประจำตัวประชาชน', mono:true, maxlength:13 },
    { id:'mother_age', type:'number', label:'อายุ (ปี)' }, { id:'mother_education', type:'text', label:'การศึกษา' },
    { id:'mother_occupation', type:'text', label:'อาชีพ' }, { id:'mother_income', type:'number', label:'รายได้ต่อปี (บาท)' },
    { id:'mother_workplace', type:'text', label:'ที่อยู่หรือที่ทำงาน', full:true }, { id:'mother_phone', optional:true, type:'text', label:'โทรศัพท์' },
    { id:'heading_guardian', type:'heading', text:'ผู้ปกครอง' },
    { id:'guardian_name', type:'text', label:'ชื่อ', from:s=>sfSplitName(s.parent).first }, { id:'guardian_surname', type:'text', label:'นามสกุล', from:s=>sfSplitName(s.parent).last },
    { id:'guardian_id', type:'text', label:'เลขประจำตัวประชาชน', mono:true, maxlength:13 },
    { id:'guardian_age', type:'number', label:'อายุ (ปี)' }, { id:'guardian_education', type:'text', label:'การศึกษา' },
    { id:'guardian_occupation', type:'text', label:'อาชีพ' }, { id:'guardian_income', type:'number', label:'รายได้ต่อปี (บาท)' },
    { id:'guardian_workplace', type:'text', label:'ที่อยู่หรือที่ทำงาน', full:true }, { id:'guardian_phone', optional:true, type:'text', label:'โทรศัพท์', from:s=>s.parentPhone },
    { id:'guardian_type', type:'radio', label:'ผู้ปกครอง คือ', options:['บิดา','มารดา'], other:true, otherLabel:'ผู้อื่นซึ่งเกี่ยวข้องเป็น', full:true },
    { id:'parents_status', type:'radio', label:'ปัจจุบันบิดามารดา', options:['อยู่ด้วยกัน','หย่าร้าง','แยกกันอยู่','บิดาถึงแก่กรรม','มารดาถึงแก่กรรม'], other:true, full:true },
    { id:'family_debt', type:'radio', label:'ภาระหนี้สินของครอบครัว', options:['ไม่มี','มี'], full:true },
    { id:'family_debt_amount', type:'number', label:'จำนวนหนี้สิน (บาท)', showIf:{field:'family_debt',equals:'มี'} },
    { id:'family_members', type:'number', label:'ครอบครัวของนักเรียนมีสมาชิกทั้งหมด (คน)' },
    { id:'siblings_total', type:'number', label:'นักเรียนมีพี่น้องทั้งหมด (คน)' },
    { id:'heading_siblings', type:'heading', text:'พี่น้องร่วมบิดามารดาเดียวกัน เรียงลำดับ' },
    { id:'siblings_table', type:'table', full:true, seedRows:1, columns:[
      {id:'name',label:'ชื่อ - สกุล',type:'text'},{id:'age',label:'อายุ',type:'text'},{id:'education',label:'การศึกษา',type:'text'},
      {id:'occupation',label:'อาชีพ/ตำแหน่ง',type:'text'},{id:'income',label:'รายได้ต่อเดือน',type:'text'},
      {id:'workplace',label:'สถานศึกษา/ที่ทำงาน',type:'text'},{id:'status',label:'สถานภาพ (โสด/แต่งงาน/อื่นๆ)',type:'text'}
    ]},
  ]},
  { id:'relations', title:'ความสัมพันธ์ในครอบครัว', short:'ความสัมพันธ์', fields:[
    { id:'trusted_name', type:'text', label:'บุคคลในครอบครัวที่นักเรียนไว้ใจมากที่สุด ชื่อ-นามสกุล', full:true },
    { id:'trusted_age', type:'number', label:'อายุ (ปี)' }, { id:'trusted_relation', type:'text', label:'เกี่ยวข้องเป็น' },
    { id:'trusted_phone', optional:true, type:'text', label:'โทรศัพท์' },
    { id:'parents_relationship', type:'radio', label:'ความสัมพันธ์ในครอบครัวระหว่างบิดา-มารดา', full:true,
      options:['รักใคร่กันดี','ขัดแย้งทะเลาะกันบางครั้ง','ขัดแย้งทะเลาะกันบ่อยครั้ง','ขัดแย้งและทำร้ายร่างกายบางครั้ง','ขัดแย้งและทำร้ายร่างกายบ่อยครั้ง'], other:true },
    { id:'substance_abuse', type:'radio', label:'บุคคลในครอบครัวมีการใช้สารเสพติด', options:['ไม่มี','มี'], full:true },
    { id:'substance_relation', type:'text', label:'เกี่ยวข้องเป็น...กับนักเรียน', showIf:{field:'substance_abuse',equals:'มี'} },
    { id:'travel_map_note', type:'textarea', label:'แผนที่แสดงการเดินทางจากสถานศึกษาไปบ้าน (โดยสังเขป) — บันทึกคำอธิบายเส้นทาง', full:true },
    { id:'note_photo', type:'note', text:'โปรดแนบรูปถ่ายบ้านผู้รับทุนการศึกษาแยกต่างหากเมื่อจัดพิมพ์เอกสารฉบับจริง' },
  ]},
  { id:'study', title:'ข้อมูลด้านการเรียนและความสามารถ', short:'การเรียน', fields:[
    { id:'heading_edu_history', type:'heading', text:'ประวัติการศึกษา' },
    { id:'education_history', type:'table', full:true,
      seedRowsData:[{level:'ประถมศึกษา'},{level:'มัธยมศึกษาตอนต้น'},{level:'มัธยมศึกษาตอนปลาย'}],
      columns:[{id:'level',label:'ระดับการศึกษา',type:'text'},{id:'school',label:'สถานศึกษา',type:'text'},{id:'province',label:'จังหวัด',type:'text'}] },
    { id:'note_edu', type:'note', text:'กรณีเรียนระดับชั้นสูงกว่าหรือเทียบเท่า ให้ปรับแก้ไขเพื่อกรอกข้อมูลตามความเหมาะสม' },
    { id:'study_plan', type:'table', full:true, seedRows:1, columns:[
      {id:'level',label:'ระดับชั้น/ปี',type:'text'},{id:'track',label:'แผนการเรียน/แผนก/สาขาวิชา',type:'text'},{id:'advisor',label:'ครูที่ปรึกษาหรือครูผู้ดูแล',type:'text'}
    ]},
    { id:'heading_grades', type:'heading', text:'ข้อมูลผลการเรียน (ในสถานศึกษาปัจจุบัน)' },
    { id:'grades_matrix', type:'matrix', full:true, defaultCols:2, rows:[
      {id:'term1',label:'ภาคเรียนที่ 1'},{id:'term2',label:'ภาคเรียนที่ 2'},{id:'avg',label:'คะแนนเฉลี่ย'},{id:'cumavg',label:'คะแนนเฉลี่ยสะสม'}
    ]},
    { id:'special_ability', type:'textarea', label:'ความสามารถพิเศษ', full:true },
    { id:'achievement', type:'textarea', label:'ผลงานดีเด่นและความภาคภูมิใจในปีที่ผ่านมา', full:true },
  ]},
  { id:'support', title:'การดูแลช่วยเหลือที่สถานศึกษาดำเนินการ', short:'การช่วยเหลือ', fields:[
    { id:'heading_scholar', type:'heading', text:'ทุนการศึกษาอื่นที่ได้รับ' },
    { id:'other_scholarships', type:'table', full:true, seedRows:1, columns:[
      {id:'name',label:'ชื่อทุน',type:'text'},{id:'amount',label:'จำนวนเงิน (บาท)',type:'text'},{id:'year',label:'เมื่อปี พ.ศ.',type:'text'}
    ]},
    { id:'heading_income', type:'heading', text:'การหารายได้ระหว่างเรียน' },
    { id:'part_time_income', type:'table', full:true, seedRows:1, columns:[{id:'detail',label:'รายละเอียด',type:'text'}] },
    { id:'heading_tutoring', type:'heading', text:'การได้รับการสอนเสริมพิเศษ' },
    { id:'extra_tutoring', type:'table', full:true, seedRows:1, columns:[
      {id:'subject',label:'วิชา',type:'text'},{id:'time',label:'ช่วงเวลา',type:'text'},{id:'teacher',label:'ผู้สอน คือ',type:'text'}
    ]},
    { id:'other_support', type:'checkboxgroup', label:'อื่น ๆ (ตอบได้มากกว่า 1 ข้อ)', full:true, other:true,
      options:['จัดที่พัก','จัดรถรับส่ง','จัดอาหารกลางวัน','สนับสนุนอุปกรณ์การเรียน'] },
  ]},
  { id:'needs', title:'ความต้องการเพิ่มเติมและกิจกรรม', short:'ความต้องการ', fields:[
    { id:'heading_needs', type:'heading', text:'ความต้องการในการได้รับความช่วยเหลือเพิ่มเติม' },
    { id:'additional_needs', type:'table', full:true, seedRows:1, columns:[{id:'detail',label:'รายละเอียด',type:'text'}] },
    { id:'heading_loyalty', type:'heading', text:'การเข้าร่วมกิจกรรมที่แสดงถึงความสำนึกในพระมหากรุณาธิคุณ' },
    { id:'loyalty_activities', type:'table', full:true, seedRows:1, columns:[{id:'detail',label:'รายละเอียด',type:'text'}] },
  ]},
  { id:'finance', title:'การเงินและการรับรอง', short:'การเงิน', fields:[
    { id:'bank_name', type:'text', label:'บัญชีธนาคาร', from:s=>(s.bank&&s.bank.bankSt)||'' },
    { id:'bank_branch', type:'text', label:'สาขา', from:s=>(s.bank&&s.bank.branchSt)||'' },
    { id:'account_name', type:'text', label:'ชื่อบัญชี', from:s=>(s.bank&&s.bank.accNameSt)||'' },
    { id:'account_no', type:'text', label:'เลขที่บัญชี', mono:true, from:s=>(s.bank&&s.bank.accNoSt)||'' },
    { id:'signer1', type:'text', label:'ผู้มีอำนาจสั่งจ่าย คนที่ 1' }, { id:'signer2', optional:true, type:'text', label:'ผู้มีอำนาจสั่งจ่าย คนที่ 2' },
    { id:'heading_receipts', type:'heading', text:'การรับเงินทุนการศึกษาและค่าใช้จ่าย' },
    { id:'receipts', type:'table', full:true, seedRows:1, columns:[
      {id:'no',label:'ครั้งที่',type:'text'},{id:'date',label:'วันที่ได้รับ',type:'text'},{id:'amount',label:'จำนวนเงิน',type:'text'},
      {id:'part1',label:'ส่วนที่ 1 สถานศึกษาเรียกเก็บ',type:'text'},{id:'part2',label:'ส่วนที่ 2 ค่าครองชีพ',type:'text'},{id:'part3',label:'ส่วนที่ 3 กรณีพิเศษเฉพาะราย',type:'text'}
    ]},
    { id:'student_sign_date', type:'date', label:'วันที่ลงนามผู้รับทุนการศึกษา' },
    { id:'heading_teacher', type:'heading', text:'ครูที่ปรึกษาหรือครูผู้ดูแล บันทึกความคิดเห็นเพิ่มเติม' },
    { id:'teacher_comment_study', type:'textarea', label:'ด้านการเรียน', full:true },
    { id:'teacher_comment_behavior', type:'textarea', label:'ด้านความประพฤติ', full:true },
    { id:'teacher_comment_other', type:'textarea', label:'ด้านอื่น ๆ', full:true },
    { id:'teacher_name', type:'text', label:'ชื่อครูที่ปรึกษาหรือครูผู้ดูแล', from:s=>[s.mentor&&s.mentor.firstName,s.mentor&&s.mentor.lastName].filter(Boolean).join(' ') },
    { id:'teacher_position', type:'text', label:'ตำแหน่ง', from:s=>(s.mentor&&s.mentor.position)||'' },
    { id:'teacher_school', type:'text', label:'สถานศึกษา', from:s=>s.school_m1 },
    { id:'teacher_phone', optional:true, type:'text', label:'เบอร์โทรศัพท์', from:s=>(s.mentor&&s.mentor.phone)||'' },
    { id:'teacher_sign_date', type:'date', label:'วันที่ลงนาม' },
  ]},
];

const SF_FORM2 = [
  { id:'general', title:'ข้อมูลทั่วไป', short:'ข้อมูลทั่วไป', fields:[
    { id:'semester', type:'text', label:'ภาคเรียนที่', from:s=>sfLatestTerm(s) },
    { id:'academic_year', type:'text', label:'ปีการศึกษา', from:()=>'2568' },
    { id:'prefix', type:'radio', label:'คำนำหน้า', options:['เด็กชาย','เด็กหญิง','นาย','นางสาว'] },
    { id:'first_name', type:'text', label:'ชื่อ', from:s=>sfSplitName(s.name).first }, { id:'last_name', type:'text', label:'นามสกุล', from:s=>sfSplitName(s.name).last },
    { id:'nickname', type:'text', label:'ชื่อเล่น', from:s=>s.nickname },
    { id:'national_id', type:'text', label:'เลขประจำตัวประชาชน', mono:true, maxlength:13, from:s=>s.id },
    { id:'dob', type:'date', label:'วัน เดือน ปีเกิด', from:s=>s.dob },
    { id:'school_name', type:'text', label:'สถานศึกษา', full:true, from:s=>s.school_m1 },
    { id:'amphoe', type:'text', label:'อำเภอ', from:s=>(s.school_m1_addr&&s.school_m1_addr.amphoe)||'' },
    { id:'province', type:'text', label:'จังหวัด', from:s=>s.province },
    { id:'sangkad', type:'text', label:'สังกัด', from:s=>s.org },
    { id:'grade_level', type:'text', label:'ระดับชั้น' }, { id:'track', type:'text', label:'แผน/แผนก/สาขา' },
  ]},
  { id:'grades', title:'ผลการเรียน', short:'ผลการเรียน', fields:[
    { id:'grades_matrix', type:'matrix', full:true, defaultCols:2, rows:[
      {id:'term1',label:'ภาคเรียนที่ 1'},{id:'term2',label:'ภาคเรียนที่ 2'},{id:'avg2',label:'คะแนนเฉลี่ย 2 ภาคเรียน'},{id:'cumavg',label:'คะแนนเฉลี่ยสะสม'}
    ]},
    { id:'learning_problems', type:'textarea', label:'ปัญหาอุปสรรคที่ส่งผลต่อการเรียนที่เป็นสาเหตุให้มีคะแนนผลการเรียนลดลง', full:true },
    { id:'current_help', type:'textarea', label:'ปัจจุบันได้รับความช่วยเหลือจากโรงเรียนด้าน', full:true },
  ]},
  { id:'assistance', title:'การดูแลช่วยเหลือ ความต้องการ และความคาดหวัง', short:'ช่วยเหลือ/คาดหวัง', fields:[
    { id:'heading_tutor', type:'heading', text:'จัดสอนเสริมพิเศษ' },
    { id:'tutoring', type:'table', full:true, seedRows:1, columns:[
      {id:'subject',label:'วิชา',type:'text'},{id:'time',label:'ช่วงเวลา',type:'text'},{id:'teacher',label:'ผู้สอน คือ',type:'text'}
    ]},
    { id:'heading_fund', type:'heading', text:'จัดหาเงินทุนจากแหล่งอื่นเพิ่มเติม' },
    { id:'extra_funding', type:'table', full:true, seedRows:1, columns:[{id:'source',label:'แหล่งทุน',type:'text'},{id:'amount',label:'จำนวนเงิน',type:'text'}] },
    { id:'support_other', type:'checkboxgroup', label:'การดูแลช่วยเหลืออื่น ๆ (เลือกได้มากกว่า 1 ข้อ)', full:true, other:true,
      options:['จัดอาหารกลางวัน','จัดที่พักในสถานศึกษา','จัดบริการรถรับส่ง','จัดให้หารายได้ระหว่างเรียน'] },
    { id:'additional_needs', type:'textarea', label:'ความต้องการในการได้รับความช่วยเหลือเพิ่มเติม จากสถานศึกษา ครู หรืออื่น ๆ', full:true },
    { id:'expect_education', type:'textarea', label:'ความคาดหวังด้านการศึกษา', full:true },
    { id:'expect_career', type:'textarea', label:'ความคาดหวังด้านอาชีพในอนาคต', full:true },
    { id:'achievement', type:'textarea', label:'ผลงานดีเด่น ความภาคภูมิใจในปีที่ผ่านมา', full:true },
  ]},
  { id:'behavior', title:'ข้อมูลความประพฤติ', short:'ความประพฤติ', fields:[
    { id:'activities_participation', type:'textarea', label:'การเข้าร่วมกิจกรรมต่าง ๆ ของสถานศึกษาในภาคเรียนปัจจุบัน', full:true },
    { id:'family_responsibility', type:'textarea', label:'งานที่ต้องรับผิดชอบดูแลช่วยเหลือครอบครัวในด้านต่าง ๆ', full:true },
    { id:'community_loyalty', type:'textarea', label:'การมีส่วนร่วมในกิจกรรมที่เป็นประโยชน์ต่อชุมชนและสังคม ตลอดจนความจงรักภักดีต่อสถาบันพระมหากษัตริย์', full:true },
  ]},
  { id:'finance', title:'การเงินและการรับรอง', short:'การเงิน', fields:[
    { id:'bank_name', type:'text', label:'บัญชีธนาคาร', from:s=>(s.bank&&s.bank.bankSt)||'' },
    { id:'bank_branch', type:'text', label:'สาขา', from:s=>(s.bank&&s.bank.branchSt)||'' },
    { id:'account_name', type:'text', label:'ชื่อบัญชี', from:s=>(s.bank&&s.bank.accNameSt)||'' },
    { id:'account_no', type:'text', label:'เลขที่บัญชี', mono:true, from:s=>(s.bank&&s.bank.accNoSt)||'' },
    { id:'signer1', type:'text', label:'ผู้มีอำนาจสั่งจ่าย คนที่ 1' }, { id:'signer2', optional:true, type:'text', label:'ผู้มีอำนาจสั่งจ่าย คนที่ 2' },
    { id:'heading_receipts', type:'heading', text:'รายงานการรับเงินทุนการศึกษาและการใช้จ่าย' },
    { id:'receipts', type:'table', full:true, seedRows:1, columns:[
      {id:'no',label:'ครั้งที่',type:'text'},{id:'date',label:'วันที่ได้รับ',type:'text'},{id:'amount',label:'จำนวนเงิน',type:'text'},
      {id:'part1',label:'ส่วนที่ 1 สถานศึกษาเรียกเก็บ',type:'text'},{id:'part2',label:'ส่วนที่ 2 ค่าครองชีพ',type:'text'},{id:'part3',label:'ส่วนที่ 3 กรณีพิเศษเฉพาะราย',type:'text'}
    ]},
    { id:'heading_summary', type:'heading', text:'สรุปยอดเงินทุนการศึกษา' },
    { id:'total_received', type:'number', label:'ได้รับเงินทุนรวมทั้งสิ้น (บาท)', from:s=>sfSumPayments(s) },
    { id:'total_disbursed', type:'number', label:'เบิกจ่ายไปแล้วรวมทั้งสิ้น (บาท)' },
    { id:'part1_amount', type:'number', label:'ส่วนที่ 1 ค่าใช้จ่ายที่สถานศึกษาเรียกเก็บ (บาท)' },
    { id:'part2_amount', type:'number', label:'ส่วนที่ 2 ค่าใช้จ่ายครองชีพประจำตัว (บาท)' },
    { id:'part3_amount', type:'number', label:'ส่วนที่ 3 ค่าใช้จ่ายกรณีพิเศษเฉพาะราย (บาท)' },
    { id:'balance', type:'number', label:'ยอดคงเหลือ (บาท)' },
    { id:'balance_date', type:'date', label:'ยอดคงเหลือ ณ วันที่' },
    { id:'student_sign_date', type:'date', label:'วันที่ลงนามผู้รับทุนการศึกษา' },
    { id:'heading_teacher', type:'heading', text:'ข้อคิดเห็นเพิ่มเติมของครูที่ปรึกษาหรือครูผู้ดูแล' },
    { id:'teacher_comment_study', type:'textarea', label:'ด้านการเรียนของผู้รับทุนการศึกษา', full:true },
    { id:'teacher_comment_behavior', type:'textarea', label:'ด้านความประพฤติและการปฏิบัติตน', full:true },
    { id:'teacher_comment_expense', type:'textarea', label:'การรับรองและข้อคิดเห็นเพิ่มเติมในการใช้จ่ายเงินทุนการศึกษา', full:true },
    { id:'teacher_name', type:'text', label:'ชื่อครูที่ปรึกษาหรือครูผู้ดูแล', from:s=>[s.mentor&&s.mentor.firstName,s.mentor&&s.mentor.lastName].filter(Boolean).join(' ') },
    { id:'teacher_position', type:'text', label:'ตำแหน่ง', from:s=>(s.mentor&&s.mentor.position)||'' },
    { id:'teacher_phone', optional:true, type:'text', label:'โทรศัพท์', from:s=>(s.mentor&&s.mentor.phone)||'' },
    { id:'teacher_sign_date', type:'date', label:'วันที่ลงนามครู' },
    { id:'director_name', type:'text', label:'ชื่อผู้อำนวยการสถานศึกษา', from:s=>s.directorM1||s.directorM_1||'' },
    { id:'director_sign_date', type:'date', label:'วันที่ลงนามผู้อำนวยการ' },
  ]},
];


/* ---------- Data access (stored on student.form1 / student.form2) ---------- */
function sfGetStudent(){ return DB.students[sfState.studentIdx]; }
function sfEnsureFormStore(student){
  if(!student.form1) student.form1 = {};
  if(!student.form2) student.form2 = {};
}
function sfGetValue(formKey, fieldId, field){
  const student = sfGetStudent();
  sfEnsureFormStore(student);
  const store = student[formKey];
  if(store[fieldId]!==undefined){
    // ถ้าฟิลด์มีตัวดึงข้อมูล (from) และค่าที่เก็บไว้ว่างเปล่า → เติมจากระเบียนนักเรียนให้ใหม่
    // (แก้ปัญหาเปิดฟอร์มก่อนข้อมูลคลาวด์มา แล้วค่าว่างค้างถาวร)
    const v = store[fieldId];
    if(field && field.from && (v==='' || v===null || v===undefined)){
      const fresh = field.from(student);
      if(fresh !== '' && fresh !== null && fresh !== undefined){ store[fieldId] = fresh; return fresh; }
    }
    return v;
  }
  let def;
  if(field.type==='radio') def = {choice:'', other:''};
  else if(field.type==='checkboxgroup') def = {selected:[], other:''};
  else if(field.type==='table'){
    if(field.seedRowsData) def = field.seedRowsData.map(r=>({_id:sfUid(), cells:Object.assign({},r)}));
    else def = Array.from({length:field.seedRows||0}).map(()=>({_id:sfUid(), cells:{}}));
  } else if(field.type==='matrix'){
    const cols = Array.from({length:field.defaultCols||2}).map(()=>({_id:sfUid(), label:''}));
    def = {cols, values:{}};
  } else if(field.from){
    def = field.from(student) || '';
  } else def = '';
  store[fieldId] = def;
  return def;
}
function sfSetSimpleValue(formKey, fieldId, value){
  const student = sfGetStudent(); sfEnsureFormStore(student);
  student[formKey][fieldId] = value;
}

/* ---------- Progress ---------- */
function sfSectionProgress(formKey, section){
  let total=0, filled=0;
  section.fields.forEach(f=>{
    if(f.type==='heading'||f.type==='note') return;
    if(f.optional) return;                       // ช่องที่ไม่บังคับ ไม่นับรวมในความครบถ้วน
    total++;
    const v = sfGetValue(formKey, f.id, f);
    if(f.type==='radio'){ if(v.choice) filled++; }
    else if(f.type==='checkboxgroup'){ if(v.selected.length||v.other) filled++; }
    else if(f.type==='table'||f.type==='matrix'){ filled++; total--; }
    else if(v!==''&&v!==null&&v!==undefined) filled++;
  });
  return total===0?1:filled/total;
}

/* ฟอร์มถือว่า "กรอกครบสมบูรณ์" ก็ต่อเมื่อทุกส่วน (section) กรอกครบทุกช่อง
   (ตาราง/เมทริกซ์นับเป็นช่องอิสระ ไม่บังคับ ตามตรรกะเดิมของ sfSectionProgress) */
function sfIsFormComplete(formKey){
  const secs = sfGetSections(formKey);
  return secs.length > 0 && secs.every(sec => sfSectionProgress(formKey, sec) >= 1);
}
/* คืนรายชื่อส่วนที่ยังกรอกไม่ครบ — ใช้บอกผู้ใช้ว่าต้องกรอกส่วนไหนต่อ */
function sfIncompleteSections(formKey){
  return sfGetSections(formKey)
    .filter(sec => sfSectionProgress(formKey, sec) < 1)
    .map(sec => sec.title || 'ส่วนที่ไม่มีชื่อ');
}

/* ---------- Field renderers ---------- */
function sfFormatDateISO(raw){
  if(!raw) return '';
  const s = String(raw).trim();
  if(/^(\d{4})-(\d{2})-(\d{2})$/.test(s)) return s;
  const dateTime = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z?$/.exec(s);
  if(dateTime){
    const utcMs = Date.UTC(+dateTime[1], +dateTime[2]-1, +dateTime[3], +dateTime[4], +dateTime[5], +dateTime[6]);
    const bkk = new Date(utcMs + 7*60*60*1000);
    const y = bkk.getUTCFullYear(), m = String(bkk.getUTCMonth()+1).padStart(2,'0'), d = String(bkk.getUTCDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }
  return '';
}
function sfRenderField(formKey, field){
  if(field.showIf){
    const dep = sfGetValue(formKey, field.showIf.field, {type:'radio'});
    const depChoice = (dep&&typeof dep==='object') ? dep.choice : dep;
    if(depChoice!==field.showIf.equals) return '';
  }
  if(field.type==='heading') return `<div class="sf-heading ${field.full?'full':''}">${sfEscapeHtml(field.text)}</div>`;
  if(field.type==='note') return `<div class="sf-note ${field.full?'full':''}">${sfEscapeHtml(field.text)}</div>`;

  const value = sfGetValue(formKey, field.id, field);
  const wrapClass = 'sf-item'+(field.full?' full':'');

  if(field.type==='text'||field.type==='number'||field.type==='date'){
    const displayValue = field.type==='date' ? sfFormatDateISO(value) : value;
    return `<label class="${wrapClass}"><span class="sf-label">${sfEscapeHtml(field.label)}</span>
      <input class="sf-input ${field.mono?'mono':''}" type="${field.type}" data-sf-field="${field.id}"
        ${field.maxlength?`maxlength="${field.maxlength}"`:''} value="${sfEscapeHtml(displayValue)}" placeholder=" "></label>`;
  }
  if(field.type==='textarea'){
    return `<label class="${wrapClass}"><span class="sf-label">${sfEscapeHtml(field.label)}</span>
      <textarea class="sf-input sf-textarea" data-sf-field="${field.id}" rows="3" placeholder=" ">${sfEscapeHtml(value)}</textarea></label>`;
  }
  if(field.type==='radio'){
    const opts = field.options.map(opt=>`
      <label class="sf-choice"><input type="radio" name="sfrad-${formKey}-${field.id}" data-sf-field="${field.id}" data-sf-choice="${sfEscapeHtml(opt)}" ${value.choice===opt?'checked':''}><span>${sfEscapeHtml(opt)}</span></label>`).join('');
    const otherRow = field.other ? `
      <label class="sf-choice sf-choice-other"><input type="radio" name="sfrad-${formKey}-${field.id}" data-sf-field="${field.id}" data-sf-choice="__other__" ${value.choice==='__other__'?'checked':''}>
      <span>${sfEscapeHtml(field.otherLabel||'อื่น ๆ ระบุ')}</span>
      <input type="text" class="sf-input sf-other-input" data-sf-field="${field.id}" data-sf-other="1" value="${sfEscapeHtml(value.other)}" ${value.choice==='__other__'?'':'disabled'}></label>` : '';
    return `<div class="${wrapClass}"><span class="sf-label">${sfEscapeHtml(field.label)}</span><div class="sf-choices">${opts}${otherRow}</div></div>`;
  }
  if(field.type==='checkboxgroup'){
    const sel = value.selected||[];
    const opts = field.options.map(opt=>`
      <label class="sf-choice"><input type="checkbox" data-sf-field="${field.id}" data-sf-cbvalue="${sfEscapeHtml(opt)}" ${sel.indexOf(opt)>-1?'checked':''}><span>${sfEscapeHtml(opt)}</span></label>`).join('');
    const otherRow = field.other ? `
      <label class="sf-choice sf-choice-other"><input type="checkbox" data-sf-field="${field.id}" data-sf-cbother="1" ${sel.indexOf('__other__')>-1?'checked':''}>
      <span>อื่น ๆ ระบุ</span>
      <input type="text" class="sf-input sf-other-input" data-sf-field="${field.id}" data-sf-other="1" value="${sfEscapeHtml(value.other)}" ${sel.indexOf('__other__')>-1?'':'disabled'}></label>` : '';
    return `<div class="${wrapClass}"><span class="sf-label">${sfEscapeHtml(field.label)}</span><div class="sf-choices">${opts}${otherRow}</div></div>`;
  }
  if(field.type==='table') return `<div class="${wrapClass}">${sfRenderTable(formKey, field)}</div>`;
  if(field.type==='matrix') return `<div class="${wrapClass}">${sfRenderMatrix(formKey, field)}</div>`;
  return '';
}

function sfRenderTable(formKey, field){
  const rows = sfGetValue(formKey, field.id, field);
  const thead = field.columns.map(c=>`<th>${sfEscapeHtml(c.label)}</th>`).join('')+'<th class="sf-th-x"></th>';
  const trs = rows.map(row=>{
    const tds = field.columns.map(c=>{
      const v = (row.cells&&row.cells[c.id])||'';
      return `<td><input class="sf-input sf-cell-input" type="text" data-sf-table="${field.id}" data-sf-row="${row._id}" data-sf-col="${c.id}" value="${sfEscapeHtml(v)}"></td>`;
    }).join('');
    return `<tr>${tds}<td class="sf-td-x"><button type="button" class="sf-btn-icon" data-sf-action="del-row" data-sf-table="${field.id}" data-sf-row="${row._id}" title="ลบแถว">✕</button></td></tr>`;
  }).join('');
  return `<div class="sf-table-wrap" id="sf-table-${field.id}">
    <table class="sf-data-table"><thead><tr>${thead}</tr></thead><tbody>${trs}</tbody></table>
    <button type="button" class="sf-btn-add" data-sf-action="add-row" data-sf-table="${field.id}">+ เพิ่มแถว</button></div>`;
}

function sfRenderMatrix(formKey, field){
  const value = sfGetValue(formKey, field.id, field);
  const cols = value.cols;
  const thead = `<th class="sf-th-rowlabel">ภาคเรียน</th>` + cols.map(c=>`<th><input class="sf-input sf-col-head" type="text" data-sf-matrix="${field.id}" data-sf-colhead="${c._id}" value="${sfEscapeHtml(c.label)}" placeholder="ระดับชั้น/ปี"></th>`).join('') + `<th class="sf-th-x"></th>`;
  const trs = field.rows.map(r=>{
    const tds = cols.map(c=>{
      const v = (value.values[r.id]&&value.values[r.id][c._id])||'';
      return `<td><input class="sf-input sf-cell-input" type="text" data-sf-matrix="${field.id}" data-sf-mrow="${r.id}" data-sf-mcol="${c._id}" value="${sfEscapeHtml(v)}"></td>`;
    }).join('');
    return `<tr><td class="sf-td-rowlabel">${sfEscapeHtml(r.label)}</td>${tds}<td></td></tr>`;
  }).join('');
  return `<div class="sf-table-wrap" id="sf-matrix-${field.id}">
    <table class="sf-data-table"><thead><tr>${thead}</tr></thead><tbody>${trs}</tbody></table>
    <button type="button" class="sf-btn-add" data-sf-action="add-col" data-sf-matrix="${field.id}">+ เพิ่มคอลัมน์ระดับชั้น/ปี</button></div>`;
}

/* ---------- Section / stepper / editor ---------- */
function sfRenderSectionContent(formKey, idx){
  const section = sfGetSections(formKey)[idx];
  const fieldsHtml = section.fields.map(f=>sfRenderField(formKey,f)).join('');
  const dirClass = sfState.lastDir==='prev' ? 'sf-dir-prev' : sfState.lastDir==='jump' ? 'sf-dir-jump' : '';
  return `<div class="sf-section-card ${dirClass}">
    <div class="sf-section-head"><span class="sf-section-num">${idx+1}</span><h2>${sfEscapeHtml(section.title)}</h2></div>
    <div class="sf-grid">${fieldsHtml}</div></div>`;
}

function sfRenderStepper(formKey){
  const sections = sfGetSections(formKey);
  const dots = sections.map((s,i)=>{
    const prog = sfSectionProgress(formKey,s);
    let cls = 'sf-step';
    if(i===sfState.sectionIndex) cls+=' active'; else if(prog>=0.999) cls+=' complete';
    return `<button type="button" class="${cls}" data-sf-action="go-section" data-sf-idx="${i}" title="${sfEscapeHtml(s.title)}">
      <span class="sf-step-num">${i+1}</span><span class="sf-step-label">${sfEscapeHtml(s.short)}</span></button>`;
  }).join('<span class="sf-step-seg"></span>');
  const pct = Math.round((sfState.sectionIndex/(sections.length-1))*100);
  return `<div class="sf-stepper-wrap"><div class="sf-stepper-track"><div class="sf-stepper-fill" style="width:${pct}%"></div></div>
    <div class="sf-stepper-steps">${dots}</div></div>`;
}

function sfRenderEditor(){
  const student = sfGetStudent();
  const sections = sfGetSections(sfState.formKey);
  const isFirst = sfState.sectionIndex===0, isLast = sfState.sectionIndex===sections.length-1;
  const saveLabel = sfState.saveStatus==='saving'?'กำลังบันทึก…':sfState.saveStatus==='saved'?'บันทึกแล้ว':'พร้อมบันทึกอัตโนมัติ';
  return `<div class="sf-editor sf-theme-${sfState.formKey}">
    <div class="sf-editor-top">
      <div class="sf-editor-top-left">
        <button type="button" class="sf-btn sf-btn-ghost" data-sf-action="go-picker">← รายชื่อนักเรียน</button>
        <div class="sf-student-chip"><span class="sf-student-chip-name">${sfEscapeHtml(student.name||'(ยังไม่ระบุชื่อ)')}</span>
        <span class="sf-student-chip-id">${sfEscapeHtml(student.id||'')}</span></div>
      </div>
      <div class="sf-editor-top-right">
        <span class="sf-save-status ${sfState.saveStatus}">${saveLabel}</span>
        <button type="button" class="sf-btn sf-btn-ghost" data-sf-action="send-sheet">💾 บันทึกข้อมูล</button>
        <button type="button" class="sf-btn sf-btn-ghost" data-sf-action="print">👁️ ดูตัวอย่าง / พิมพ์ PDF</button>
      </div>
    </div>
    <div class="sf-tabs">
      <button type="button" class="sf-tab ${sfState.formKey==='form1'?'active':''}" data-sf-action="switch-form" data-sf-form="form1">แบบฟอร์มที่ 1<span>ข้อมูลรายบุคคล</span></button>
      <button type="button" class="sf-tab ${sfState.formKey==='form2'?'active':''}" data-sf-action="switch-form" data-sf-form="form2">แบบฟอร์มที่ 2<span>ผลการเรียน/ความประพฤติ/การใช้จ่าย</span></button>
    </div>
    ${sfRenderStepper(sfState.formKey)}
    <main>
      ${sfRenderSectionContent(sfState.formKey, sfState.sectionIndex)}
      <div class="sf-section-nav">
        <button type="button" class="sf-btn sf-btn-secondary" data-sf-action="prev-section" ${isFirst?'disabled':''}>← ย้อนกลับ</button>
        <span class="sf-section-count">${sfState.sectionIndex+1} / ${sections.length}</span>
        ${isLast
          ? `<button type="button" class="sf-btn sf-btn-primary" data-sf-action="send-sheet">💾 บันทึกข้อมูล</button>`
          : `<button type="button" class="sf-btn sf-btn-primary" data-sf-action="next-section">ถัดไป →</button>`}
      </div>
    </main>
  </div>`;
}

/* ---------- Picker (student list, reusing DB.students) ---------- */
function sfFormStatus(student){
  // started = แตะ/กรอกไปบ้างแล้ว (มีข้อมูลบางส่วน)
  const started1 = !!(student.form1 && student.form1.__touched);
  const started2 = !!(student.form2 && student.form2.__touched);
  // done = กรอกครบสมบูรณ์และกดบันทึกแล้ว (สถานะ "กรอกครบ" ที่แท้จริง)
  const done1 = !!(student.form1 && student.form1.__complete);
  const done2 = !!(student.form2 && student.form2.__complete);
  // has1/has2 คงความหมายเดิม = "แบบฟอร์มเสร็จสมบูรณ์แล้ว"
  return {has1:done1, has2:done2, started1, started2, done1, done2};
}

/* ══════════════════════════════════════════════
   FORM TRACKING PAGE (ติดตามการกรอกแบบฟอร์ม)
   สรุปสถานะการกรอกแบบฟอร์มทุนการศึกษาของนักเรียนแต่ละคน/โรงเรียน
══════════════════════════════════════════════ */
