/* ============================================================
   firebase-config.js — ค่าเชื่อมต่อโปรเจกต์ Firebase ของคุณ
   ------------------------------------------------------------
   วิธีหาค่าเหล่านี้:
   1. เข้า https://console.firebase.google.com แล้วสร้างโปรเจกต์ใหม่
   2. เพิ่มแอปแบบ Web (ไอคอน </>) ตั้งชื่อ เช่น "dltv-app"
   3. Firebase จะแสดง firebaseConfig — คัดลอกมาวางแทนค่าด้านล่าง
   4. เปิดใช้ Firestore Database (โหมด production) และ
      Authentication → Sign-in method → Email/Password

   หมายเหตุ: apiKey ของ Firebase ฝั่ง client ไม่ใช่ความลับ
   ความปลอดภัยที่แท้จริงอยู่ที่ Security Rules (ดู firestore.rules)
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyBU7f7eoBXF_SqRQ9EFscw8RpObz6spM2A",
  authDomain: "dltvfund.firebaseapp.com",
  projectId: "dltvfund",
  storageBucket: "dltvfund.firebasestorage.app",
  messagingSenderId: "905094534078",
  appId: "1:905094534078:web:1203d86a3142c3c36ddfef",
};

// ให้ไฟล์อื่น (ทั้ง module และ classic script) เข้าถึงได้
window.FIREBASE_CONFIG = firebaseConfig;
