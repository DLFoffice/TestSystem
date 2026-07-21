/* ============================================================
   16-photo-urls.js — สคริปต์อัปเดต URL รูปภาพจาก Excel อัตโนมัติ
   (แยกมาจาก index.html เดิม บรรทัด 5373-5461 โดยรักษาลำดับโค้ดเดิม)
   ============================================================ */
(function(){
  // URL รูปภาพทั้ง 72 คน จาก Excel (ตัด =S4000 และใช้ sz=w200)
  const photoUrlsFromExcel = [
    "https://drive.google.com/thumbnail?id=1Q6wCn-0vucPnTXpHzro07tjVVZs1KYbW&sz=w200",
    "https://drive.google.com/thumbnail?id=1ubeTNzOq38OUL3jLhjHuv1TLsYxMTFdd&sz=w200",
    "https://drive.google.com/thumbnail?id=1dUiUxThilCIPiT86pcImjkN0fst3yPct&sz=w200",
    "https://drive.google.com/thumbnail?id=1fF1Kqco9_n6YD0-IT4BUqSEjgMlHrwOL&sz=w200",
    "https://drive.google.com/thumbnail?id=1TRQ-0kuMH0vr_DQjKZVcbMoVJQA6kkGl&sz=w200",
    "https://drive.google.com/thumbnail?id=1kDmY0XaKbR7enxVJs_teGuEUnpfb7bIF&sz=w200",
    "https://drive.google.com/thumbnail?id=10zPKECD2Lf3JoCbaSfE4veOVItswlpus&sz=w200",
    "https://drive.google.com/thumbnail?id=1L4ATsUHasZItZ08p5lM3fBeHF6JYqp1K&sz=w200",
    "https://drive.google.com/thumbnail?id=1R8zCcT_FXxXK2nJmlETpwUHpLNwjG0Ah&sz=w200",
    "https://drive.google.com/thumbnail?id=1wU0pSdXuje2ADEhjd5FSSp91XZKC09eQ&sz=w200",
    "https://drive.google.com/thumbnail?id=1NrcinTgOxEawXKFDXVRpV8gS--T1e4iT&sz=w200",
    "https://drive.google.com/thumbnail?id=1asIER2reTlk15F_xPhoWEQ0KmqUaWPDD&sz=w200",
    "https://drive.google.com/thumbnail?id=1BQsqJa36wEYDm4HAo3jSHVeWnI_Dg20t&sz=w200",
    "https://drive.google.com/thumbnail?id=1kk0_yFvgqwB3E4DDpablOtKgclhBOMH0&sz=w200",
    "https://drive.google.com/thumbnail?id=1AKsMsydrBQMcetD56mnstqVMPfVzNDwg&sz=w200",
    "https://drive.google.com/thumbnail?id=1AOWk3IsF4lxbJTSjOK7Lzq8mFq_dqZYB&sz=w200",
    "https://drive.google.com/thumbnail?id=1RwmjvywFMOtY2iBME-5Bl2mh7IKysqE8&sz=w200",
    "https://drive.google.com/thumbnail?id=1PZ8kJ3N3IWutXxfeE5UYr7Rj2YuhB-90&sz=w200",
    "https://drive.google.com/thumbnail?id=1T2GEPJ5eiKwhaOfoeFQpECF5xRwi0Lyr&sz=w200",
    "https://drive.google.com/thumbnail?id=1TNf_lDcbMAtN2eQHXz9YAjzuLsht0CFZ&sz=w200",
    "https://drive.google.com/thumbnail?id=1veb-xWbUgdgEHssxeEsDHRXp4JcFJxZQ&sz=w200",
    "https://drive.google.com/thumbnail?id=1VLAHbvhYKLYAQGU4Z87Z3CiT17E-Adql&sz=w200",
    "https://drive.google.com/thumbnail?id=1bRgrhavXlwNuo9vozkfx_qVXsrsW-O0r&sz=w200",
    "https://drive.google.com/thumbnail?id=1xTM71du_NRQkgjPQBPFuWksF9eHVYE-M&sz=w200",
    "https://drive.google.com/thumbnail?id=1VGRqTdDbICl1ffFz5KqyX-q0KztbhJG9&sz=w200",
    "https://drive.google.com/thumbnail?id=1HI131ZvstIiINYmYU6fpXAYvjcILanTC&sz=w200",
    "https://drive.google.com/thumbnail?id=18oJA-iixktkFyYVZ6FjRiAaTNWmu6f7S&sz=w200",
    "https://drive.google.com/thumbnail?id=1AN5d71hdEvfkHW5MEOBEIAfvRy_jEkZU&sz=w200",
    "https://drive.google.com/thumbnail?id=1aE9xqo74qGyvcnZxJte-ERNUu5-tmucP&sz=w200",
    "https://drive.google.com/thumbnail?id=1Pvg3-ZCPBazTgxbHRtqUVNBqLFQb1UvN&sz=w200",
    "https://drive.google.com/thumbnail?id=1g97rI8QpxGHC6Y2QxhoaTzsx0vJIjc-x&sz=w200",
    "https://drive.google.com/thumbnail?id=10rUYBTFhvLsHBk365KVKGzEkbIk_aOtN&sz=w200",
    "https://drive.google.com/thumbnail?id=1bVKo_vGY82z299xId6v1urZa9LnjB2Kl&sz=w200",
    "https://drive.google.com/thumbnail?id=1-XARUr9nacgWQWUY1G48x7pTy-LVaB-1&sz=w200",
    "https://drive.google.com/thumbnail?id=1hJ7B1UMHBoD7orkHV1PYha9r9Ob5M9UL&sz=w200",
    "https://drive.google.com/thumbnail?id=1O1BXeUHDDw6JLuobw7prI3VI8hLnjUjO&sz=w200",
    "https://drive.google.com/thumbnail?id=16xor5ceeHcjMYM7wZdmAisbgopFo0Y9E&sz=w200",
    "https://drive.google.com/thumbnail?id=1KhJDE6aUkCgKvLumoS1CG5Riko7XrOMq&sz=w200",
    "https://drive.google.com/thumbnail?id=17cNuqjr4FXydJxL5pi9Y61xflULWcQVE&sz=w200",
    "https://drive.google.com/thumbnail?id=1so_lGjpOvsGdVD7XZlPknZgvuxBXena1&sz=w200",
    "https://drive.google.com/thumbnail?id=1vzllCZ_DqabWBUZWLwGtUCzyoOxCgukD&sz=w200",
    "https://drive.google.com/thumbnail?id=1aW37cvlrB-0k4TUAL01McH6A9DY0lSmN&sz=w200",
    "https://drive.google.com/thumbnail?id=1gfb2IvyjrHrsreOe9RTfmJVUQkD58hZV&sz=w200",
    "https://drive.google.com/thumbnail?id=1C3lDKx-1_IfX7t1EJPAcGNPlkoMmNTTn&sz=w200",
    "https://drive.google.com/thumbnail?id=1BdtNQc2WkkC6D0wCVbFqu9GwkHQZ5TL2&sz=w200",
    "https://drive.google.com/thumbnail?id=14HeDQMpLRkV1qzqJDvih1x3nCRTwUqxH&sz=w200",
    "https://drive.google.com/thumbnail?id=1DQxwuMsayniCXxqnCU8SU1Fr1dJxLS6S&sz=w200",
    "https://drive.google.com/thumbnail?id=1SaDpIHPwXTiWl24I6hHjtcdI6ftTdSx2&sz=w200",
    "https://drive.google.com/thumbnail?id=1s3NgXJUHqazbXC3Dp0_-LnZcc_a01_DF&sz=w200",
    "https://drive.google.com/thumbnail?id=1qHARyYqpWvVApaEBis-Ajuj4VObWuorh&sz=w200",
    "https://drive.google.com/thumbnail?id=1k4HHLBcaLDsJWctDBYmRxt6IEBotBqnb&sz=w200",
    "https://drive.google.com/thumbnail?id=1XJaey4lZbItD_lveLRphA1cpcJytsVrN&sz=w200",
    "https://drive.google.com/thumbnail?id=1R5F_AAf0UyWkiKY_UYaUHGjn70LeI-Ui&sz=w200",
    "https://drive.google.com/thumbnail?id=1JNaiDNt38ezz9kMg8aNiYnkmVdKRUF8V&sz=w200",
    "https://drive.google.com/thumbnail?id=1rXkhI-9MCxP4MrEGtZnL-hT_TMOtKg91&sz=w200",
    "https://drive.google.com/thumbnail?id=1_em8bKzGshIRmUQ2HpHaW3t8viYWq4rr&sz=w200",
    "https://drive.google.com/thumbnail?id=1ecMLWjeNt_MgPvrzfl1xDSezOaqB33sB&sz=w200",
    "https://drive.google.com/thumbnail?id=1urrRdAAeJ57L0L6sNoOivBvJR2dZSJRi&sz=w200",
    "https://drive.google.com/thumbnail?id=1t6jDbq8B_zj-PVnSW2hMBXn6Z8TOSsE8&sz=w200",
    "https://drive.google.com/thumbnail?id=1iDyEfVjV_Uv2qzkeubLJo9SvPCRfpUKE&sz=w200",
    "https://drive.google.com/thumbnail?id=1E5tdPtVi4JQrdZTg3DuYJlcD3oam35n-&sz=w200",
    "https://drive.google.com/thumbnail?id=15HcE0IXk7MUFw9jXIwEcORpX8-vRrv78&sz=w200",
    "https://drive.google.com/thumbnail?id=11qE51aUjNf_s52YFaWHIGpBeNUBuLFsu&sz=w200",
    "https://drive.google.com/thumbnail?id=1WwQ2wPpwk0lHata67KaTlW2GwY7gj0O4&sz=w200",
    "https://drive.google.com/thumbnail?id=14S-skAWgeG9HyFEZz5gpq9YHFNN8YIr4&sz=w200",
    "https://drive.google.com/thumbnail?id=19JvGo9AFXcO9aj8WWw41VC3hRCY5QNap&sz=w200",
    "https://drive.google.com/thumbnail?id=1W8Ikb8s4-B2ZOxaH6jBeJqeU1jVtAJ-R&sz=w200",
    "https://drive.google.com/thumbnail?id=1rWBTBizQlvxwUNhCOdQoxUG1KExpaUa-&sz=w200",
    "https://drive.google.com/thumbnail?id=1gNSymQh8s3Jh9Ksa4JqKW80Y28CFJBD0&sz=w200",
    "https://drive.google.com/thumbnail?id=1PHSZImj2RfkPLa9pi76TPo-Ok0m1FrUU&sz=w200",
    "https://drive.google.com/thumbnail?id=1pW3YwRQwq3senV74AJxSnfZuzdL-O9a3&sz=w200",
    "https://drive.google.com/thumbnail?id=1Ir7LnGJvCKvY2OjmSQ65BQR6QgzMFh0N&sz=w200"
  ];

  // ⛔ ปิดการ "จับคู่รูปอัตโนมัติ" ทั้งหมด
  // เหตุผล: รูปของนักเรียนที่ถูกต้องคือ photoUrl ในระเบียนของแต่ละคนเอง
  // (มาจากตอนสมัคร/จาก Google Sheet ที่ผูกกับตัวบุคคล) การเดารูปจาก "ตำแหน่งในอาร์เรย์"
  // หรือแม้แต่ "ลำดับ (no)" ล้วนไม่ปลอดภัย เพราะลำดับของรายการรูปชุดนี้ไม่รับประกันว่าตรงกับ
  // ลำดับจริงของนักเรียน → ทำให้รูปสลับคน ดังนั้นเวอร์ชันนี้จะ "ไม่แตะ" photoUrl ของใครเลย
  //
  // ถ้าต้องการซ่อมรูปที่ผิดอยู่ ให้ดึงรูปกลับจากแหล่งที่ผูกกับตัวบุคคล (ปุ่ม Sync / Google Sheet)
  // หรือแก้รายคนในหน้ารายละเอียดนักเรียน — ไม่มีการเขียนทับอัตโนมัติอีกต่อไป
  window.applyExcelPhotosByNo = function () { return false; };  // คงชื่อไว้กันโค้ดเก่าเรียกแล้ว error
  console.log('ℹ️ ปิดการจับคู่รูปอัตโนมัติแล้ว — ใช้ photoUrl ของนักเรียนแต่ละคนตามจริง');
})();
