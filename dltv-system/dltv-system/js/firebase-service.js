// ============================================================
// firebase-service.js
// จัดการการบันทึก/แก้ไข/ลบ/ดึงข้อมูลจาก Firebase Firestore
// โหมดออฟไลน์: เก็บใน localStorage (อยู่ถาวรแม้ปิด/รีเฟรชหน้า) + ดาวน์โหลด/นำเข้า JSON
// ============================================================

import { firebaseConfig, COLLECTION, OFFLINE_MODE } from "./firebase-config.js";

let db = null;
let fsApi = null;                       // ฟังก์ชัน firestore ที่ import มา
const LS_KEY = "dltv_offline_submissions";
let offlineStore = loadLocal();         // อาเรย์ของ record ที่เก็บในเครื่อง

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("[DLTV] อ่าน localStorage ไม่ได้:", e);
    return [];
  }
}
function saveLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(offlineStore));
  } catch (e) {
    console.warn("[DLTV] บันทึก localStorage ไม่ได้:", e);
  }
}

// เริ่มต้น Firebase (เรียกครั้งเดียวตอนแอปโหลด)
export async function initFirebase() {
  if (OFFLINE_MODE) {
    console.info("[DLTV] ทำงานในโหมดออฟไลน์ (เก็บข้อมูลในเครื่องด้วย localStorage)");
    return { offline: true };
  }
  try {
    const appMod = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    fsApi = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const app = appMod.initializeApp(firebaseConfig);
    db = fsApi.getFirestore(app);
    console.info("[DLTV] เชื่อมต่อ Firebase สำเร็จ");
    return { offline: false };
  } catch (err) {
    console.error("[DLTV] เชื่อมต่อ Firebase ไม่สำเร็จ:", err);
    return { offline: true, error: err };
  }
}

// บันทึกข้อมูลหนึ่งรายการ (สร้างใหม่)
export async function saveSubmission(payload) {
  const record = { ...payload, submittedAt: new Date().toISOString() };

  if (OFFLINE_MODE || !db) {
    record.id = "offline_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    offlineStore.push(record);
    saveLocal();
    return { ok: true, id: record.id, offline: true };
  }
  try {
    const ref = await fsApi.addDoc(
      fsApi.collection(db, COLLECTION),
      { ...record, submittedAt: fsApi.serverTimestamp() }
    );
    return { ok: true, id: ref.id, offline: false };
  } catch (err) {
    console.error("[DLTV] บันทึกข้อมูลไม่สำเร็จ:", err);
    return { ok: false, error: err.message };
  }
}

// แก้ไขข้อมูลรายการเดิม
export async function updateSubmission(id, payload) {
  if (OFFLINE_MODE || !db) {
    const idx = offlineStore.findIndex(r => r.id === id);
    if (idx === -1) return { ok: false, error: "ไม่พบรายการที่จะแก้ไข" };
    offlineStore[idx] = {
      ...offlineStore[idx],
      ...payload,
      id,
      updatedAt: new Date().toISOString()
    };
    saveLocal();
    return { ok: true, id, offline: true };
  }
  try {
    await fsApi.updateDoc(
      fsApi.doc(db, COLLECTION, id),
      { ...payload, updatedAt: fsApi.serverTimestamp() }
    );
    return { ok: true, id, offline: false };
  } catch (err) {
    console.error("[DLTV] แก้ไขข้อมูลไม่สำเร็จ:", err);
    return { ok: false, error: err.message };
  }
}

// ลบข้อมูลรายการ
export async function deleteSubmission(id) {
  if (OFFLINE_MODE || !db) {
    const before = offlineStore.length;
    offlineStore = offlineStore.filter(r => r.id !== id);
    saveLocal();
    return { ok: offlineStore.length < before, offline: true };
  }
  try {
    await fsApi.deleteDoc(fsApi.doc(db, COLLECTION, id));
    return { ok: true, offline: false };
  } catch (err) {
    console.error("[DLTV] ลบข้อมูลไม่สำเร็จ:", err);
    return { ok: false, error: err.message };
  }
}

// ดึงรายการที่บันทึกไว้ (กรองตาม formId ได้)
export async function listSubmissions(formId = null) {
  if (OFFLINE_MODE || !db) {
    return offlineStore
      .filter(r => !formId || r.formId === formId)
      .map(r => JSON.parse(JSON.stringify(r)));
  }
  try {
    let q = fsApi.collection(db, COLLECTION);
    if (formId) q = fsApi.query(q, fsApi.where("formId", "==", formId));
    const snap = await fsApi.getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("[DLTV] ดึงข้อมูลไม่สำเร็จ:", err);
    return [];
  }
}

// ส่งออกข้อมูลออฟไลน์ทั้งหมดเป็นไฟล์ JSON
export function exportOffline() {
  const blob = new Blob([JSON.stringify(offlineStore, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dltv_offline_submissions.json";
  a.click();
  URL.revokeObjectURL(url);
}

// นำเข้าข้อมูลจากไฟล์ JSON (รวมกับข้อมูลเดิม) — ใช้กับโหมดออฟไลน์
export function importOffline(records, { replace = false } = {}) {
  if (!Array.isArray(records)) return { ok: false, error: "ไฟล์ไม่ถูกต้อง" };
  if (replace) offlineStore = [];
  let added = 0;
  records.forEach(r => {
    if (!r || typeof r !== "object") return;
    if (!r.id) r.id = "offline_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    if (!offlineStore.some(x => x.id === r.id)) { offlineStore.push(r); added++; }
  });
  saveLocal();
  return { ok: true, added };
}
