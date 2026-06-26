// ============================================================
// firebase-service.js
// จัดการการบันทึก/ดึงข้อมูลจาก Firebase Firestore
// ถ้า OFFLINE_MODE = true จะทำงานแบบออฟไลน์ (เก็บในหน่วยความจำ + ดาวน์โหลด JSON)
// ============================================================

import { firebaseConfig, COLLECTION, OFFLINE_MODE } from "./firebase-config.js";

let db = null;
let fsApi = null;          // เก็บฟังก์ชัน firestore ที่ import มา
const offlineStore = [];   // ที่เก็บข้อมูลชั่วคราวเมื่อทำงานออฟไลน์

// เริ่มต้น Firebase (เรียกครั้งเดียวตอนแอปโหลด)
export async function initFirebase() {
  if (OFFLINE_MODE) {
    console.info("[DLTV] ทำงานในโหมดออฟไลน์ (ยังไม่เชื่อมต่อ Firebase)");
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

// บันทึกข้อมูลหนึ่งรายการ
// payload = { formId, formCode, school:{...}, data:{...}, scores:{...}, meta:{...} }
export async function saveSubmission(payload) {
  const record = {
    ...payload,
    submittedAt: new Date().toISOString()
  };

  if (OFFLINE_MODE || !db) {
    record.id = "offline_" + Date.now();
    offlineStore.push(record);
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

// ดึงรายการที่บันทึกไว้ (กรองตาม formId ได้)
export async function listSubmissions(formId = null) {
  if (OFFLINE_MODE || !db) {
    return offlineStore.filter(r => !formId || r.formId === formId);
  }
  try {
    let q = fsApi.collection(db, COLLECTION);
    if (formId) {
      q = fsApi.query(q, fsApi.where("formId", "==", formId));
    }
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
