// ============================================================
// app.js — ตัวควบคุมหลักของระบบ
// ============================================================

import { renderForm } from "./form-renderer.js";
import {
  initFirebase, saveSubmission, updateSubmission, deleteSubmission,
  listSubmissions, exportOffline, importOffline
} from "./firebase-service.js";
import { OFFLINE_MODE } from "./firebase-config.js";

const FOUNDATION = "มูลนิธิการศึกษาทางไกลผ่านดาวเทียม ในพระบรมราชูปถัมภ์";

const state = {
  forms: [],
  commonSchema: null,
  school: {},
  current: null,
  offline: true,
  schemaCache: {}   // formId -> schema
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

async function getSchema(formMeta) {
  if (state.schemaCache[formMeta.id]) return state.schemaCache[formMeta.id];
  const schema = await loadJSON(formMeta.file);
  state.schemaCache[formMeta.id] = schema;
  return schema;
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
    ? "โหมดออฟไลน์ — บันทึกในเครื่อง (localStorage)"
    : "เชื่อมต่อ Firebase แล้ว";
  statusEl.className = "status " + (state.offline ? "status--offline" : "status--online");

  const reg = await loadJSON("forms/index.json");
  state.forms = reg.forms;
  state.commonSchema = await loadJSON("forms/common.json");

  buildNav();
  showSchoolView();
}

function setActive(key) {
  document.querySelectorAll(".nav-btn").forEach(x => x.classList.toggle("active", x.dataset.key === key));
}

function buildNav() {
  navEl.innerHTML = "";
  navEl.append(navButton("ข้อมูลโรงเรียน", "school", () => showSchoolView()));

  navEl.append(navLabel("แบบฟอร์มประเมิน"));
  state.forms.forEach(f => {
    navEl.append(navButton(f.code + " · " + f.title, f.id, () => showFormView(f)));
  });

  navEl.append(navLabel("สรุปผล & รายงาน"));
  navEl.append(navButton("แดชบอร์ดสรุปผล", "dashboard", () => showDashboardView()));
  navEl.append(navButton("ข้อมูลที่บันทึก", "records", () => showRecordsView()));
}

function navLabel(text) {
  const lbl = document.createElement("div");
  lbl.className = "nav-label";
  lbl.textContent = text;
  return lbl;
}
function navButton(label, key, onClick) {
  const b = document.createElement("button");
  b.className = "nav-btn";
  b.dataset.key = key;
  b.textContent = label;
  b.addEventListener("click", () => { setActive(key); onClick(); });
  return b;
}

// ---------- หน้าข้อมูลโรงเรียน ----------
function showSchoolView() {
  setActive("school");
  viewEl.innerHTML = "";
  viewEl.append(header("ข้อมูลพื้นฐานโรงเรียน", "กรอกครั้งเดียว ระบบจะแนบข้อมูลนี้ไปกับทุกแบบฟอร์มที่บันทึก"));
  const container = document.createElement("div");
  viewEl.append(container);

  const ctrl = renderForm(state.commonSchema, container);
  ctrl.setValues(state.school);

  const bar = actionBar();
  bar.append(primaryBtn("บันทึกข้อมูลโรงเรียน", () => {
    const { data } = ctrl.collect();
    state.school = data;
    toast("บันทึกข้อมูลโรงเรียนในเครื่องแล้ว ใช้ร่วมกับทุกแบบฟอร์ม");
  }));
  viewEl.append(bar);
}

// ---------- หน้าฟอร์มประเมิน (กรอกใหม่ / แก้ไข) ----------
async function showFormView(formMeta, editRecord = null) {
  setActive(editRecord ? "records" : formMeta.id);
  viewEl.innerHTML = "";
  viewEl.append(header(formMeta.code + " — " + formMeta.title, "กำลังโหลด..."));
  let schema;
  try {
    schema = await getSchema(formMeta);
  } catch (e) {
    viewEl.append(errorBox("โหลดแบบฟอร์มไม่สำเร็จ: " + e.message));
    return;
  }
  viewEl.innerHTML = "";
  viewEl.append(header(
    (editRecord ? "แก้ไข · " : "") + schema.code + " — " + schema.title,
    schema.audience || ""
  ));

  // โหมดแก้ไข: ใช้ข้อมูลโรงเรียนของรายการนั้น
  const schoolForThis = editRecord ? (editRecord.school || {}) : state.school;
  if (!editRecord && !state.school.school_name) {
    viewEl.append(infoBox("ยังไม่ได้กรอกข้อมูลโรงเรียน — แนะนำให้กรอกที่เมนู “ข้อมูลโรงเรียน” ก่อน เพื่อแนบไปกับการบันทึก"));
  }
  if (schema.instruction) viewEl.append(infoBox(schema.instruction));

  const container = document.createElement("div");
  viewEl.append(container);
  const ctrl = renderForm(schema, container);
  if (editRecord) ctrl.setValues(editRecord.data);
  state.current = { schema, ctrl, formMeta, editRecord, school: schoolForThis };

  const hasScore = (schema.sections || []).some(s => s.scored);
  const savebar = document.createElement("div");
  savebar.className = "savebar";
  const totalWrap = document.createElement("div");
  totalWrap.className = "savebar__total";
  const btns = document.createElement("div");
  btns.className = "savebar__btns";
  btns.append(ghostBtn("ส่งออก PDF", () => {
    const { data, scores } = ctrl.collect();
    exportPDF({ schema, school: schoolForThis, data, scores });
  }));
  if (editRecord) {
    btns.append(ghostBtn("ยกเลิก", () => showRecordsView()));
    btns.append(primaryBtn("บันทึกการแก้ไข", () => submitForm(editRecord.id)));
  } else {
    btns.append(ghostBtn("ล้างฟอร์ม", () => showFormView(formMeta)));
    btns.append(primaryBtn("บันทึกข้อมูล", () => submitForm()));
  }
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

async function submitForm(editId = null) {
  const { schema, ctrl, school } = state.current;
  const { data, scores } = ctrl.collect();

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

  const payload = { formId: schema.id, formCode: schema.code, school, data, scores };
  const res = editId ? await updateSubmission(editId, payload) : await saveSubmission(payload);
  if (res.ok) {
    toast(editId ? "บันทึกการแก้ไขแล้ว" : (res.offline ? "บันทึกในเครื่องแล้ว" : "บันทึกลง Firebase แล้ว"));
    if (editId) showRecordsView();
  } else {
    toast("บันทึกไม่สำเร็จ: " + res.error, "warn");
  }
}

// ============================================================
// ตัวช่วยรวมกลุ่มข้อมูลตามโรงเรียน (ใช้โดยแดชบอร์ด)
// ============================================================
function schoolKey(s) { return (s?.school_code || "") + "|" + (s?.school_name || ""); }


// ============================================================
// แดชบอร์ดสรุปผล
// ============================================================
async function showDashboardView() {
  setActive("dashboard");
  viewEl.innerHTML = "";
  viewEl.append(header("แดชบอร์ดสรุปผล", "ภาพรวมคะแนนการประเมินรายโรงเรียน จากทุกแบบฟอร์มที่บันทึก"));

  const rows = await listSubmissions();
  if (!rows.length) { viewEl.append(infoBox("ยังไม่มีข้อมูลที่บันทึก")); return; }

  const formTitle = {};
  state.forms.forEach(f => { formTitle[f.id] = f.code; });

  // จัดกลุ่มตามโรงเรียน
  const groups = {};
  rows.forEach(r => {
    const k = schoolKey(r.school);
    (groups[k] = groups[k] || { school: r.school || {}, subs: [] }).subs.push(r);
  });
  const keys = Object.keys(groups);

  // สรุปบนสุด
  const totalSchools = keys.length;
  const totalSubs = rows.length;
  const scored = rows.filter(r => r.scores && r.scores.__total && r.scores.__total.max);
  const avgPct = scored.length
    ? Math.round(scored.reduce((a, r) => a + (r.scores.__total.score / r.scores.__total.max) * 100, 0) / scored.length)
    : 0;

  const stats = document.createElement("div");
  stats.className = "stat-grid";
  stats.append(statCard("โรงเรียนทั้งหมด", totalSchools, "โรงเรียน"));
  stats.append(statCard("จำนวนชุดที่บันทึก", totalSubs, "ชุด"));
  stats.append(statCard("คะแนนเฉลี่ยรวม", avgPct + "%", "ของคะแนนเต็ม"));
  viewEl.append(stats);

  const bar = actionBar();
  bar.append(ghostBtn("ส่งออกแดชบอร์ด PDF", () => exportDashboardPDF(groups, keys, formTitle, { totalSchools, totalSubs, avgPct })));
  viewEl.append(bar);

  // การ์ดต่อโรงเรียน
  keys.forEach(k => {
    const g = groups[k];
    const card = document.createElement("section");
    card.className = "school-card";
    const head = document.createElement("div");
    head.className = "school-card__head";
    head.innerHTML = `<h3>${esc(g.school.school_name || "(ไม่ระบุชื่อโรงเรียน)")}</h3>` +
      `<span class="school-card__meta">${esc(g.school.school_code || "")} ${g.school.area_office ? "· " + esc(g.school.area_office) : ""}</span>`;
    card.append(head);

    // เรียงตามรหัสฟอร์ม
    const byForm = {};
    g.subs.forEach(s => { (byForm[s.formId] = byForm[s.formId] || []).push(s); });
    Object.keys(byForm).sort().forEach(fid => {
      const subs = byForm[fid].slice().sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
      const latest = subs[0];
      const row = document.createElement("div");
      row.className = "dash-row";
      const t = latest.scores && latest.scores.__total;
      const pct = t && t.max ? Math.round((t.score / t.max) * 100) : null;
      const lvl = pct == null ? "" : pct >= 80 ? "good" : pct >= 60 ? "ok" : "dev";
      row.innerHTML =
        `<div class="dash-row__name">${esc(formTitle[fid] || fid)} <span class="dash-row__count">${subs.length} ชุด</span></div>` +
        (t && t.max
          ? `<div class="dash-row__score">${t.score} / ${t.max}</div>` +
            `<div class="dash-bar"><i class="lvl-${lvl}" style="width:${pct}%"></i></div>` +
            `<div class="dash-row__pct lvl-${lvl}">${pct}%</div>`
          : `<div class="dash-row__score">—</div><div class="dash-bar"></div><div class="dash-row__pct">ไม่มีคะแนน</div>`);
      card.append(row);

      // รายละเอียดองค์ประกอบ (ถ้ามีหลาย section ที่ให้คะแนน)
      const comps = latest.scores ? Object.entries(latest.scores).filter(([key, v]) => key !== "__total" && v && v.max) : [];
      if (comps.length > 1) {
        const sub = document.createElement("div");
        sub.className = "dash-sub";
        comps.forEach(([key, v]) => {
          const p = v.max ? Math.round((v.score / v.max) * 100) : 0;
          const l = p >= 80 ? "good" : p >= 60 ? "ok" : "dev";
          sub.innerHTML += `<div class="dash-sub__row"><span>${esc(v.title || key)}</span>` +
            `<span class="dash-sub__bar"><i class="lvl-${l}" style="width:${p}%"></i></span>` +
            `<span class="lvl-${l}">${v.score}/${v.max}${v.level ? " · " + esc(v.level) : ""}</span></div>`;
        });
        card.append(sub);
      }
    });
    viewEl.append(card);
  });
}

function statCard(label, value, unit) {
  const d = document.createElement("div");
  d.className = "stat-card";
  d.innerHTML = `<div class="stat-card__val">${value}</div><div class="stat-card__label">${esc(label)}</div><div class="stat-card__unit">${esc(unit)}</div>`;
  return d;
}

// ---------- หน้าข้อมูลที่บันทึก ----------
async function showRecordsView() {
  setActive("records");
  viewEl.innerHTML = "";
  viewEl.append(header("ข้อมูลที่บันทึก", state.offline ? "บันทึกในเครื่อง (localStorage) — แก้ไข/ลบ/ส่งออก PDF ได้" : "แสดงรายการจาก Firebase"));

  const rows = (await listSubmissions()).slice().sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));

  // ตัวกรองตามแบบฟอร์ม
  const filterBar = document.createElement("div");
  filterBar.className = "summary-picker";
  const fsel = document.createElement("select");
  fsel.className = "input select";
  fsel.append(new Option("ทุกแบบฟอร์ม", ""));
  state.forms.forEach(f => fsel.append(new Option(f.code + " — " + f.title, f.id)));
  filterBar.append(labelEl("กรองตามแบบฟอร์ม"), fsel);
  viewEl.append(filterBar);

  const tableMount = document.createElement("div");
  viewEl.append(tableMount);

  function draw() {
    tableMount.innerHTML = "";
    const list = rows.filter(r => !fsel.value || r.formId === fsel.value);
    if (!list.length) { tableMount.append(infoBox("ยังไม่มีข้อมูลที่บันทึก")); return; }
    const table = document.createElement("table");
    table.className = "data-table records";
    table.innerHTML = `<thead><tr>
        <th>แบบฟอร์ม</th><th>โรงเรียน</th><th>ผู้ตอบ</th>
        <th>คะแนนรวม</th><th>เวลาบันทึก</th><th>การจัดการ</th>
      </tr></thead>`;
    const tbody = document.createElement("tbody");
    list.forEach(r => {
      const respondent = r.data?.teacher_name || r.data?.director_name || r.data?.origin_teacher_name ||
        (r.data?.teacher_names ? r.data.teacher_names.filter(Boolean).join(", ") : "") || "-";
      const total = r.scores?.__total ? `${r.scores.__total.score}/${r.scores.__total.max}` : "-";
      const when = r.submittedAt ? new Date(r.submittedAt).toLocaleString("th-TH") : "-";
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${esc(r.formCode || r.formId)}</td>
        <td>${esc(r.school?.school_name || "-")}</td>
        <td>${esc(respondent)}</td><td>${total}</td><td>${esc(when)}</td>`;
      const actions = document.createElement("td");
      actions.className = "row-actions";
      actions.append(miniBtn("PDF", () => openRecordPDF(r)));
      actions.append(miniBtn("แก้ไข", () => editRecord(r)));
      actions.append(miniBtn("ลบ", () => removeRecord(r), "mini-btn--danger"));
      tr.append(actions);
      tbody.append(tr);
    });
    table.append(tbody);
    tableMount.append(table);
  }
  fsel.addEventListener("change", draw);
  draw();

  // เครื่องมือข้อมูล (ออฟไลน์)
  if (state.offline) {
    const bar = actionBar();
    bar.append(ghostBtn("ดาวน์โหลดข้อมูลทั้งหมด (JSON)", () => exportOffline()));
    const importBtn = ghostBtn("นำเข้าข้อมูล (JSON)", () => fileInput.click());
    const fileInput = document.createElement("input");
    fileInput.type = "file"; fileInput.accept = "application/json"; fileInput.style.display = "none";
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0]; if (!file) return;
      try {
        const arr = JSON.parse(await file.text());
        const res = importOffline(Array.isArray(arr) ? arr : [arr]);
        toast(res.ok ? `นำเข้าแล้ว ${res.added} รายการ` : "นำเข้าไม่สำเร็จ", res.ok ? "ok" : "warn");
        showRecordsView();
      } catch (e) { toast("ไฟล์ไม่ถูกต้อง: " + e.message, "warn"); }
    });
    bar.append(importBtn, fileInput);
    viewEl.append(bar);
  }
}

function editRecord(r) {
  const meta = state.forms.find(f => f.id === r.formId) || { id: r.formId, code: r.formCode, title: r.formId, file: "forms/" + r.formId + ".json" };
  showFormView(meta, r);
}

async function removeRecord(r) {
  if (!confirm("ต้องการลบรายการนี้หรือไม่? การลบไม่สามารถย้อนคืนได้")) return;
  const res = await deleteSubmission(r.id);
  toast(res.ok ? "ลบรายการแล้ว" : "ลบไม่สำเร็จ", res.ok ? "ok" : "warn");
  if (res.ok) showRecordsView();
}

async function openRecordPDF(r) {
  const meta = state.forms.find(f => f.id === r.formId);
  let schema = null;
  try { if (meta) schema = await getSchema(meta); } catch (e) { /* fallback below */ }
  if (schema) {
    exportPDF({ schema, school: r.school || {}, data: r.data || {}, scores: r.scores || {} });
  } else {
    toast("ไม่พบโครงสร้างแบบฟอร์มสำหรับสร้าง PDF", "warn");
  }
}

// ============================================================
// ส่งออก PDF (ใช้การพิมพ์ของเบราว์เซอร์ — รองรับฟอนต์ไทยสมบูรณ์)
// ============================================================
function printDoc(title, bodyHTML) {
  const win = window.open("", "_blank");
  if (!win) { toast("เบราว์เซอร์บล็อกหน้าต่างใหม่ — โปรดอนุญาต popup", "warn"); return; }
  win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
    <title>${esc(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>${PRINT_CSS}</style></head><body>${bodyHTML}
    <script>window.onload=function(){setTimeout(function(){window.print();},350);}<\/script>
    </body></html>`);
  win.document.close();
}

function printHeader(formCode, title, school, extra = "") {
  return `<div class="p-head">
    <div class="p-foundation">${esc(FOUNDATION)}</div>
    <div class="p-title">${esc(formCode)} — ${esc(title)}</div>
    <table class="p-school"><tbody>
      <tr><td>โรงเรียน</td><td>${esc(school.school_name || "-")}</td>
          <td>รหัส</td><td>${esc(school.school_code || "-")}</td></tr>
      <tr><td>สังกัด</td><td colspan="3">${esc(school.area_office || "-")}</td></tr>
      ${extra}
    </tbody></table>
  </div>`;
}

function levelBadge(score) {
  if (score == null || score === "") return "—";
  return String(score);
}

function exportPDF({ schema, school, data, scores }) {
  const parts = [];
  (schema.sections || []).forEach(sec => {
    parts.push(`<h3 class="p-section">${esc(sec.title || "")}</h3>`);
    if (sec.scored) {
      const sc = scores[sec.id] || {};
      let rows = "";
      (sec.fields || []).forEach(f => {
        if (f.type === "heading") { rows += `<tr class="p-sub"><td colspan="2">${esc(f.label)}</td></tr>`; return; }
        if (f.type !== "rating") return;
        const v = data[f.id] || {};
        const sug = v.suggestion ? `<div class="p-sug">ข้อเสนอแนะ: ${esc(v.suggestion)}</div>` : "";
        rows += `<tr><td>${esc(f.label)}${sug}</td><td class="p-num">${levelBadge(v.score)}</td></tr>`;
      });
      parts.push(`<table class="p-table"><thead><tr><th>รายการประเมิน</th><th class="p-num">ระดับ</th></tr></thead><tbody>${rows}</tbody></table>`);
      parts.push(`<div class="p-subtotal">รวม ${sc.score ?? 0} / ${sc.max ?? sec.maxScore} คะแนน${sc.level ? " · ระดับ " + esc(sc.level) : ""}</div>`);
    } else if (sec.layout === "readiness") {
      let rows = "";
      (sec.fields || []).forEach(f => {
        if (f.type === "heading") { rows += `<tr class="p-sub"><td colspan="2">${esc(f.label)}</td></tr>`; return; }
        if (f.type !== "level") return;
        rows += `<tr><td>${esc(f.label)}</td><td class="p-num">${esc(data[f.id] || "—")}</td></tr>`;
      });
      parts.push(`<table class="p-table"><tbody>${rows}</tbody></table>`);
    } else {
      let rows = "";
      (sec.fields || []).forEach(f => {
        if (f.type === "heading" || f.type === "note") return;
        rows += `<tr><td class="p-label">${esc(f.label)}</td><td>${esc(fmtValue(f, data[f.id]))}</td></tr>`;
      });
      parts.push(`<table class="p-table p-kv"><tbody>${rows}</tbody></table>`);
    }
  });
  const totalHTML = scores.__total
    ? `<div class="p-total">คะแนนรวมทั้งสิ้น ${scores.__total.score} / ${scores.__total.max} คะแนน</div>` : "";
  printDoc(schema.code + " " + (school.school_name || ""),
    printHeader(schema.code, schema.title, school) + parts.join("") + totalHTML + signBlock());
}

function exportDashboardPDF(groups, keys, formTitle, stat) {
  let body = `<div class="p-head"><div class="p-foundation">${esc(FOUNDATION)}</div>
    <div class="p-title">แดชบอร์ดสรุปผลการประเมินคุณภาพ DLTV รายโรงเรียน</div></div>`;
  body += `<div class="p-total">โรงเรียน ${stat.totalSchools} แห่ง · บันทึก ${stat.totalSubs} ชุด · คะแนนเฉลี่ยรวม ${stat.avgPct}%</div>`;
  keys.forEach(k => {
    const g = groups[k];
    body += `<h3 class="p-section">${esc(g.school.school_name || "(ไม่ระบุชื่อ)")} <small>${esc(g.school.school_code || "")}</small></h3>`;
    const byForm = {};
    g.subs.forEach(s => { (byForm[s.formId] = byForm[s.formId] || []).push(s); });
    let rows = "";
    Object.keys(byForm).sort().forEach(fid => {
      const subs = byForm[fid].slice().sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
      const t = subs[0].scores && subs[0].scores.__total;
      const cell = t && t.max ? `${t.score} / ${t.max} (${Math.round((t.score / t.max) * 100)}%)` : "—";
      rows += `<tr><td>${esc(formTitle[fid] || fid)}</td><td class="p-num">${subs.length}</td><td class="p-num">${cell}</td></tr>`;
    });
    body += `<table class="p-table"><thead><tr><th>แบบฟอร์ม</th><th class="p-num">จำนวนชุด</th><th class="p-num">คะแนนรวม (ล่าสุด)</th></tr></thead><tbody>${rows}</tbody></table>`;
  });
  printDoc("แดชบอร์ดสรุปผล DLTV", body);
}

function signBlock() {
  return `<div class="p-sign">
    <div class="p-sign__col">ลงชื่อ ........................................................<br>(........................................................)<br>ผู้ประเมิน</div>
    <div class="p-sign__col">ลงชื่อ ........................................................<br>(........................................................)<br>ผู้อำนวยการโรงเรียน</div>
  </div>`;
}

// ---------- helpers ----------
function fmtValue(f, v) {
  if (v == null || v === "") return "-";
  if (Array.isArray(v)) return v.join(", ") || "-";
  if (typeof v === "object") {
    if ("score" in v) return v.score == null ? "-" : String(v.score);
    return Object.entries(v).map(([k, val]) => (val ? k + ": " + val : "")).filter(Boolean).join(", ") || "-";
  }
  return String(v);
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function el2(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
function labelEl(text) { return el2("label", "field-label", text); }
function wrapTable(t) { const d = document.createElement("div"); d.className = "table-wrap table-wrap--eval"; d.append(t); return d; }
function header(title, sub) { const h = document.createElement("div"); h.className = "view-header"; h.innerHTML = `<h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}`; return h; }
function actionBar() { const d = document.createElement("div"); d.className = "action-bar"; return d; }
function primaryBtn(t, fn) { const b = document.createElement("button"); b.className = "btn btn--primary"; b.textContent = t; b.onclick = fn; return b; }
function ghostBtn(t, fn) { const b = document.createElement("button"); b.className = "btn btn--ghost"; b.textContent = t; b.onclick = fn; return b; }
function miniBtn(t, fn, extra = "") { const b = document.createElement("button"); b.className = "mini-btn " + extra; b.textContent = t; b.onclick = fn; return b; }
function infoBox(t) { const d = document.createElement("div"); d.className = "callout callout--info"; d.textContent = t; return d; }
function errorBox(t) { const d = document.createElement("div"); d.className = "callout callout--error"; d.textContent = t; return d; }

const PRINT_CSS = `
*{box-sizing:border-box}
body{font-family:"Sarabun",system-ui,"TH Sarabun New",sans-serif;color:#181b17;font-size:13px;line-height:1.5;margin:24px}
.p-head{margin-bottom:14px}
.p-foundation{text-align:center;font-size:12px;color:#444}
.p-title{text-align:center;font-size:16px;font-weight:700;margin:4px 0 10px}
.p-school{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
.p-school td{border:1px solid #bbb;padding:3px 6px}
.p-school td:nth-child(odd){background:#f3f4f1;width:90px;font-weight:600;white-space:nowrap}
.p-section{font-size:14px;margin:16px 0 6px;border-left:4px solid #2f6b4f;padding-left:8px}
.p-section small{font-weight:400;color:#777}
.p-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px}
.p-table th,.p-table td{border:1px solid #bbb;padding:4px 7px;vertical-align:top;text-align:left}
.p-table th{background:#ecf2ee}
.p-num{text-align:center;white-space:nowrap;width:64px}
.p-sub td{background:#f3f4f1;font-weight:600}
.p-kv .p-label{width:42%;font-weight:600;background:#fafafa}
.p-sug{color:#666;font-size:11px;margin-top:2px}
.p-subtotal{text-align:right;font-weight:600;margin:2px 0 8px;color:#265a42}
.p-total{font-weight:700;font-size:14px;background:#ecf2ee;border:1px solid #2f6b4f;border-radius:6px;padding:8px 12px;margin:14px 0;text-align:center}
.p-sign{display:flex;gap:40px;margin-top:42px;justify-content:space-around;text-align:center;font-size:12px}
@media print{body{margin:12mm}.p-section{break-after:avoid}.p-table{break-inside:auto}tr{break-inside:avoid}}
`;

boot().catch(e => {
  statusEl.textContent = "เริ่มต้นระบบไม่สำเร็จ: " + e.message;
  statusEl.className = "status status--offline";
});
