# ระบบกรอกข้อมูลประเมินคุณภาพโรงเรียนปลายทาง DLTV

ระบบกรอกแบบฟอร์มประเมิน DLTV (DLTV-01 ถึง DLTV-06) แบบ data-driven
นิยามแต่ละแบบฟอร์มไว้เป็นไฟล์ JSON แยก แก้ไขเนื้อหาได้โดยไม่ต้องแตะโค้ด
และบันทึกข้อมูลขึ้น Firebase Firestore

## โครงสร้างไฟล์

```
dltv-system/
├── index.html              หน้าหลัก
├── css/
│   └── styles.css          สไตล์ทั้งหมด
├── js/
│   ├── firebase-config.js  ★ ใส่ค่าโปรเจกต์ Firebase ที่นี่
│   ├── firebase-service.js  บันทึก/ดึงข้อมูล (มีโหมดออฟไลน์)
│   ├── form-renderer.js     สร้างฟอร์มจาก JSON + คิดคะแนน
│   └── app.js               ตัวควบคุมหลัก
└── forms/                  ★ เนื้อหาแบบฟอร์ม (แก้ไขได้ง่าย)
    ├── index.json           ทะเบียนรวมแบบฟอร์ม
    ├── common.json          ข้อมูลพื้นฐานโรงเรียน
    ├── dltv01.json          ประเมินคุณภาพโรงเรียน (99 คะแนน)
    ├── dltv02.json          ครูปลายทางประเมินตนเอง (72 คะแนน)
    ├── dltv03.json          สำรวจการจัดการเรียนรู้ (99 คะแนน + ปลายเปิด)
    ├── dltv04.json          สำรวจการบริหารจัดการ ผู้บริหาร (ตาราง + ปลายเปิด)
    ├── dltv05.json          ประเมินครูห้องเรียนต้นทาง (75 คะแนน)
    └── dltv06.json          ครูต้นทางประเมินตนเอง (75 คะแนน)
```

## การใช้งานครั้งแรก (ทดสอบทันที)

ค่าเริ่มต้น `OFFLINE_MODE = true` ระบบจะทำงานได้เลยโดยไม่ต้องต่อ Firebase
(ข้อมูลเก็บในเครื่องชั่วคราว ดาวน์โหลดเป็น JSON ได้)

ต้องเปิดผ่านเว็บเซิร์ฟเวอร์ (เพราะใช้ ES modules + fetch) ห้ามเปิดไฟล์ตรง ๆ:

```bash
cd dltv-system
python3 -m http.server 8000
# เปิด http://localhost:8000
```

## เชื่อมต่อ Firebase (ใช้งานจริง)

1. สร้างโปรเจกต์ที่ https://console.firebase.google.com แล้วเปิดใช้ **Firestore Database**
2. เพิ่ม Web App แล้วคัดลอกค่า config มาใส่ใน `js/firebase-config.js`
3. ตั้ง `OFFLINE_MODE = false`

ตัวอย่างกฎความปลอดภัย Firestore (เริ่มต้น — ปรับตามนโยบายจริง):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /dltv_submissions/{doc} {
      allow create: if true;          // ให้กรอกส่งได้
      allow read: if request.auth != null;  // อ่านได้เฉพาะผู้ล็อกอิน (ผู้ดูแล)
      allow update, delete: if false;
    }
  }
}
```

## โครงสร้างข้อมูลที่บันทึก (1 เอกสาร = 1 การกรอก)

```json
{
  "formId": "dltv05",
  "formCode": "DLTV-05",
  "school": { "school_code": "...", "school_name": "...", ... },
  "data": {
    "origin_teacher_name": "...",
    "i1_1_1": { "score": 3, "suggestion": "..." }
  },
  "scores": {
    "cat1": { "title": "...", "score": 33, "max": 33, "level": null },
    "__total": { "score": 75, "max": 75 }
  },
  "submittedAt": "2569-..."
}
```

## การแก้ไข/เพิ่มแบบฟอร์ม

แก้เนื้อหาข้อคำถามได้ที่ไฟล์ใน `forms/` โดยตรง ชนิดฟิลด์ที่รองรับ:
`text`, `number`, `textarea`, `select`, `radio`, `checkbox`,
`rating` (ให้คะแนน 3/2/1), `table` (ตารางกรอกข้อมูล), `heading`, `note`

- ทำให้ section คิดคะแนน: ใส่ `"scored": true` และ `"maxScore"`
- กำหนดระดับคุณภาพ: ใส่ `"qualityBands"` (เช่น ดี/พอใช้/กำลังพัฒนา ตาม DLTV-00)
- เพิ่มฟอร์มใหม่: สร้างไฟล์ใน `forms/` แล้วเพิ่มรายการใน `forms/index.json`

## คะแนนเต็มตาม DLTV-00 (ตรวจสอบแล้ว)

| ฟอร์ม | องค์ประกอบ | คะแนนเต็ม |
|------|-----------|----------|
| DLTV-01 | คุณภาพผู้เรียน 39 + จัดการเรียนรู้ 33 + บริหารจัดการ 27 | 99 |
| DLTV-02 | คุณภาพผู้เรียน 39 + จัดการเรียนรู้ 33 | 72 |
| DLTV-03 | คุณภาพ/ประสิทธิภาพอุปกรณ์ 7 หมวด | 99 |
| DLTV-05/06 | จัดการเรียนรู้ 33 + ชั้นเรียน 15 + บุคลิกภาพ 12 + แผน/สื่อ 15 | 75 |
