// ============================================================
// app.js — ตัวควบคุมหลักของระบบ
// ============================================================

import { renderForm } from "./form-renderer.js";
import { initFirebase, saveSubmission, listSubmissions, exportOffline } from "./firebase-service.js";
import { OFFLINE_MODE } from "./firebase-config.js";

const state = {
  forms: [],          // ทะเบียนฟอร์ม
  commonSchema: null, // ฟิลด์ข้อมูลโรงเรียน
  school: {},         // ค่าข้อมูลโรงเรียนปัจจุบัน
  current: null,      // { schema, controller }
  offline: true
};

const $ = sel => document.querySelector(sel);
const navEl = $("#nav");
const viewEl = $("#view");
const statusEl = $("#status");
const toastEl = $("#toast");

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error("โหลดไม่สำเร็จ: " + path);
  return res.json();
}

function toast(msg, kind = "ok") {
  toastEl.textContent = msg;
  toastEl.className = "toast toast--" + kind + " show";
  setTimeout(() => (toastEl.className = "toast"), 3200);
}

// ---------- เริ่มต้น ----------
async function boot() {
  const fb = await initFirebase();
  state.offline = fb.offline;
  statusEl.textContent = state.offline
    ? "โหมดออฟไลน์ (ทดสอบ) — ยังไม่บันทึกลง Firebase"
    : "เชื่อมต่อ Firebase แล้ว";
  statusEl.className = "status " + (state.offline ? "status--offline" : "status--online");

  const reg = await loadJSON("forms/index.json");
  state.forms = reg.forms;
  state.commonSchema = await loadJSON("forms/common.json");

  buildNav();
  showSchoolView();
}

function buildNav() {
  navEl.innerHTML = "";
  navEl.append(navButton("ข้อมูลโรงเรียน", "school", () => showSchoolView()));
  const lbl = document.createElement("div");
  lbl.className = "nav-label";
  lbl.textContent = "แบบฟอร์มประเมิน";
  navEl.append(lbl);
  state.forms.forEach(f => {
    navEl.append(navButton(f.code + " · " + f.title, f.id, () => showFormView(f)));
  });
  const lbl2 = document.createElement("div");
  lbl2.className = "nav-label";
  lbl2.textContent = "ข้อมูล";
  navEl.append(lbl2);
  navEl.append(navButton("ข้อมูลที่บันทึก", "records", () => showRecordsView()));
}

function navButton(label, key, onClick) {
  const b = document.createElement("button");
  b.className = "nav-btn";
  b.dataset.key = key;
  b.textContent = label;
  b.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    onClick();
  });
  return b;
}

// ---------- หน้าข้อมูลโรงเรียน ----------
function showSchoolView() {
  viewEl.innerHTML = "";
  viewEl.append(header("ข้อมูลพื้นฐานโรงเรียน", "กรอกครั้งเดียว ระบบจะแนบข้อมูลนี้ไปกับทุกแบบฟอร์มที่บันทึก"));
  const container = document.createElement("div");
  viewEl.append(container);

  const ctrl = renderForm(state.commonSchema, container);
  // เติมค่าที่เคยกรอกไว้ ให้รองรับทุกชนิดฟิลด์
  for (const [id, val] of Object.entries(state.school)) {
    if (val == null || val === "") continue;
    // ฟิลด์ inline (ค่าเป็นออบเจ็กต์ ไม่ใช่อาเรย์)
    if (typeof val === "object" && !Array.isArray(val)) {
      for (const [k, v] of Object.entries(val)) {
        const part = container.querySelector("#f_" + id + "_" + k);
        if (part) part.value = v;
      }
      continue;
    }
    const values = Array.isArray(val) ? val : [val];
    // text / number / textarea / select
    const single = container.querySelector("#f_" + id);
    if (single && (single.tagName === "INPUT" || single.tagName === "SELECT" || single.tagName === "TEXTAREA")) {
      single.value = val;
      continue;
    }
    // radio / checkbox (หลาย input ชื่อเดียวกัน)
    container.querySelectorAll(`input[name="f_${id}"]`).forEach(inp => {
      if (values.includes(inp.value)) inp.checked = true;
    });
  }

  const bar = actionBar();
  const saveBtn = primaryBtn("บันทึกข้อมูลโรงเรียน", () => {
    const { data } = ctrl.collect();
    state.school = data;
    toast("บันทึกข้อมูลโรงเรียนในเครื่องแล้ว ใช้ร่วมกับทุกแบบฟอร์ม");
  });
  bar.append(saveBtn);
  viewEl.append(bar);
}

// ---------- หน้าฟอร์มประเมิน ----------
async function showFormView(formMeta) {
  viewEl.innerHTML = "";
  viewEl.append(header(formMeta.code + " — " + formMeta.title, "กำลังโหลด..."));
  let schema;
  try {
    schema = await loadJSON(formMeta.file);
  } catch (e) {
    viewEl.append(errorBox("โหลดแบบฟอร์มไม่สำเร็จ: " + e.message));
    return;
  }
  viewEl.innerHTML = "";
  viewEl.append(header(schema.code + " — " + schema.title, schema.audience || ""));

  if (!state.school.school_name) {
    viewEl.append(infoBox("ยังไม่ได้กรอกข้อมูลโรงเรียน — แนะนำให้กรอกที่เมนู “ข้อมูลโรงเรียน” ก่อน เพื่อแนบไปกับการบันทึก"));
  }
  if (schema.instruction) viewEl.append(infoBox(schema.instruction));

  const container = document.createElement("div");
  viewEl.append(container);
  const ctrl = renderForm(schema, container);
  state.current = { schema, ctrl, formMeta };

  // แถบบันทึกแบบลอยด้านล่าง พร้อมคะแนนรวมสด ๆ
  const hasScore = (schema.sections || []).some(s => s.scored);
  const savebar = document.createElement("div");
  savebar.className = "savebar";
  const totalWrap = document.createElement("div");
  totalWrap.className = "savebar__total";
  const btns = document.createElement("div");
  btns.className = "savebar__btns";
  btns.append(ghostBtn("ล้างฟอร์ม", () => showFormView(formMeta)));
  btns.append(primaryBtn("บันทึกข้อมูล", () => submitForm()));
  savebar.append(totalWrap, btns);
  viewEl.append(savebar);

  function refreshTotal() {
    if (!hasScore) { totalWrap.innerHTML = ""; return; }
    const t = ctrl.collect().scores.__total || { score: 0, max: 0 };
    const pct = t.max ? Math.round((t.score / t.max) * 100) : 0;
    totalWrap.innerHTML =
      '<span class="savebar__label">คะแนนรวม</span>' +
      '<span class="savebar__num">' + t.score + '</span>' +
      '<span class="savebar__max">/ ' + t.max + '</span>' +
      '<span class="savebar__bar"><i style="width:' + pct + '%"></i></span>';
  }
  container.addEventListener("change", refreshTotal);
  refreshTotal();
}

async function submitForm() {
  const { schema, ctrl, formMeta } = state.current;
  const { data, scores } = ctrl.collect();

  // ตรวจฟิลด์ required
  const missing = [];
  (schema.sections || []).forEach(sec => (sec.fields || []).forEach(f => {
    if (f.required) {
      const v = data[f.id];
      const empty = v == null || v === "" || (typeof v === "object" && "score" in v && !v.score);
      if (empty) missing.push(f.label);
    }
  }));
  if (missing.length) {
    toast("กรุณากรอก: " + missing.slice(0, 3).join(", ") + (missing.length > 3 ? " ..." : ""), "warn");
    return;
  }

  const payload = {
    formId: schema.id,
    formCode: schema.code,
    school: state.school,
    data,
    scores
  };
  const res = await saveSubmission(payload);
  if (res.ok) {
    toast(res.offline ? "บันทึกในเครื่องแล้ว (ออฟไลน์)" : "บันทึกลง Firebase แล้ว (id: " + res.id + ")");
  } else {
    toast("บันทึกไม่สำเร็จ: " + res.error, "warn");
  }
}

// ---------- หน้าข้อมูลที่บันทึก ----------
async function showRecordsView() {
  viewEl.innerHTML = "";
  viewEl.append(header("ข้อมูลที่บันทึก", state.offline ? "แสดงรายการที่บันทึกในเครื่อง (ออฟไลน์)" : "แสดงรายการจาก Firebase"));

  const rows = await listSubmissions();
  if (!rows.length) {
    viewEl.append(infoBox("ยังไม่มีข้อมูลที่บันทึก"));
    return;
  }

  const table = document.createElement("table");
  table.className = "data-table records";
  table.innerHTML = `<thead><tr>
      <th>แบบฟอร์ม</th><th>โรงเรียน</th><th>ผู้ตอบ</th>
      <th>คะแนนรวม</th><th>เวลาบันทึก</th>
    </tr></thead>`;
  const tbody = document.createElement("tbody");
  rows.forEach(r => {
    const respondent = r.data?.teacher_name || r.data?.director_name || r.data?.origin_teacher_name || "-";
    const total = r.scores?.__total ? `${r.scores.__total.score}/${r.scores.__total.max}` : "-";
    const when = r.submittedAt ? new Date(r.submittedAt).toLocaleString("th-TH") : "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.formCode || r.formId}</td>
      <td>${r.school?.school_name || "-"}</td>
      <td>${respondent}</td><td>${total}</td><td>${when}</td>`;
    tbody.append(tr);
  });
  table.append(tbody);
  viewEl.append(table);

  if (state.offline) {
    const bar = actionBar();
    bar.append(ghostBtn("ดาวน์โหลดข้อมูลออฟไลน์ (JSON)", () => exportOffline()));
    viewEl.append(bar);
  }
}

// ---------- UI helpers ----------
function header(title, sub) {
  const h = document.createElement("div");
  h.className = "view-header";
  h.innerHTML = `<h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}`;
  return h;
}
function actionBar() { const d = document.createElement("div"); d.className = "action-bar"; return d; }
function primaryBtn(t, fn) { const b = document.createElement("button"); b.className = "btn btn--primary"; b.textContent = t; b.onclick = fn; return b; }
function ghostBtn(t, fn) { const b = document.createElement("button"); b.className = "btn btn--ghost"; b.textContent = t; b.onclick = fn; return b; }
function infoBox(t) { const d = document.createElement("div"); d.className = "callout callout--info"; d.textContent = t; return d; }
function errorBox(t) { const d = document.createElement("div"); d.className = "callout callout--error"; d.textContent = t; return d; }

boot().catch(e => {
  statusEl.textContent = "เริ่มต้นระบบไม่สำเร็จ: " + e.message;
  statusEl.className = "status status--offline";
});
