/* ============================================================
   firestore-service.js — ชั้นข้อมูล Firestore (ES Module)
   ------------------------------------------------------------
   ไฟล์นี้ต้องถูกโหลดด้วย <script type="module"> (ดู README.md)
   มันจะสร้าง window.fb ที่มีฟังก์ชันพร้อมใช้จาก classic script:

     await fb.signIn(email, password)   → ล็อกอิน
     fb.signOutUser()                   → ออกจากระบบ
     fb.onAuth(callback)                → เฝ้าดูสถานะล็อกอิน
     await fb.loadStudents()            → ดึงนักเรียนทั้งหมด (array)
     await fb.saveStudent(student)      → บันทึก/อัปเดตนักเรียน 1 คน
     await fb.saveAllStudents(students) → บันทึกทั้งชุด (batch)
     await fb.deleteStudent(id)         → ลบนักเรียนตามเลขบัตร ปชช.
     fb.watchStudents(callback)         → realtime: เรียก callback
                                          ทุกครั้งที่ข้อมูลเปลี่ยน
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, setDoc, deleteDoc,
  writeBatch, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const app  = initializeApp(window.FIREBASE_CONFIG);
const db   = getFirestore(app);
const auth = getAuth(app);

const COL = "students";   // ชื่อ collection ใน Firestore

/* ---- Auth ---- */
async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}
function signOutUser() { return signOut(auth); }
function onAuth(cb)    { return onAuthStateChanged(auth, cb); }

/* ---- อ่านนักเรียนทั้งหมด ---- */
async function loadStudents() {
  const snap = await getDocs(collection(db, COL));
  const students = [];
  snap.forEach(d => students.push(d.data()));
  // เรียงตามลำดับที่ (no) เหมือนระบบเดิม
  students.sort((a, b) => (a.no || 0) - (b.no || 0));
  return students;
}

/* ---- บันทึกนักเรียน 1 คน (ใช้เลขบัตร ปชช. เป็น doc id) ---- */
async function saveStudent(student) {
  if (!student || !student.id) throw new Error("student.id (เลขบัตร ปชช.) จำเป็นต้องมี");
  const clean = JSON.parse(JSON.stringify(student));   // ตัด undefined ออก
  clean._updatedAt = serverTimestamp();
  await setDoc(doc(db, COL, String(student.id)), clean, { merge: true });
}

/* ---- บันทึกทั้งชุดแบบ batch (สูงสุด 500 รายการ/batch) ---- */
async function saveAllStudents(students) {
  const chunks = [];
  for (let i = 0; i < students.length; i += 450) chunks.push(students.slice(i, i + 450));
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(s => {
      if (!s.id) return;
      const clean = JSON.parse(JSON.stringify(s));
      batch.set(doc(db, COL, String(s.id)), clean, { merge: true });
    });
    await batch.commit();
  }
}

/* ---- ลบนักเรียน ---- */
async function deleteStudent(id) {
  await deleteDoc(doc(db, COL, String(id)));
}

/* ---- realtime listener: ข้อมูลเปลี่ยนที่เครื่องไหน ทุกเครื่องเห็นทันที ---- */
function watchStudents(cb) {
  return onSnapshot(collection(db, COL), snap => {
    const students = [];
    snap.forEach(d => students.push(d.data()));
    students.sort((a, b) => (a.no || 0) - (b.no || 0));
    cb(students);
  });
}

window.fb = {
  auth, signIn, signOutUser, onAuth,
  loadStudents, saveStudent, saveAllStudents, deleteStudent, watchStudents
};
console.log("✅ Firestore service พร้อมใช้งาน (window.fb)");
