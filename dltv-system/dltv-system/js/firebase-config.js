// ============================================================
// firebase-config.js
// ใส่ค่าจากโปรเจกต์ Firebase ของคุณที่นี่
// ดูได้จาก: Firebase Console > Project settings > General > Your apps > Web app
// ============================================================

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ชื่อ collection หลักใน Firestore ที่ใช้เก็บข้อมูลทุกแบบฟอร์ม
export const COLLECTION = "dltv_submissions";

// ตั้งเป็น true เพื่อทดสอบระบบแบบไม่ต่อ Firebase (บันทึกลงเครื่องชั่วคราว/ดาวน์โหลด JSON)
// ตั้งเป็น false เมื่อกรอกค่า firebaseConfig ด้านบนเรียบร้อยและพร้อมใช้งานจริง
export const OFFLINE_MODE = true;
