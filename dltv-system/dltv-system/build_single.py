#!/usr/bin/env python3
# รวมระบบเป็นไฟล์ HTML เดียว (เปิดใช้ได้ทันทีโดยไม่ต้องมีเซิร์ฟเวอร์)
import json, re, os

ROOT = os.path.dirname(os.path.abspath(__file__))
def read(p): return open(os.path.join(ROOT, p), encoding="utf-8").read()

# 1) รวมไฟล์ JSON ทั้งหมดเป็น EMBEDDED
embedded = {}
embedded["forms/index.json"]  = json.loads(read("forms/index.json"))
embedded["forms/common.json"] = json.loads(read("forms/common.json"))
for f in embedded["forms/index.json"]["forms"]:
    embedded[f["file"]] = json.loads(read(f["file"]))
EMBEDDED_JS = "const EMBEDDED = " + json.dumps(embedded, ensure_ascii=False) + ";\n"

# 2) CSS
css = read("css/styles.css")

# 3) JS modules — ตัด import/export ออก
def strip_module(src):
    # ตัด import statement ทั้งก้อน (รองรับหลายบรรทัด: import ... from "...";)
    src = re.sub(r'^\s*import\b[\s\S]*?from\s+["\'][^"\']+["\']\s*;\s*$', '', src, flags=re.M)
    # ตัด import แบบไม่มี from (side-effect) ถ้ามี
    src = re.sub(r'^\s*import\s+["\'][^"\']+["\']\s*;\s*$', '', src, flags=re.M)
    # ตัดคำว่า export ต้นบรรทัด
    src = re.sub(r'^\s*export\s+', '', src, flags=re.M)
    return src

config = strip_module(read("js/firebase-config.js"))      # firebaseConfig, COLLECTION, OFFLINE_MODE
renderer = strip_module(read("js/form-renderer.js"))
service = strip_module(read("js/firebase-service.js"))
app = strip_module(read("js/app.js"))

# แทนที่ loadJSON ใน app ให้ดึงจาก EMBEDDED แทน fetch
app = re.sub(
    r'async function loadJSON\(path\)\s*\{.*?\n\}',
    'async function loadJSON(path){ const d = EMBEDDED[path]; if(!d) throw new Error("ไม่พบข้อมูล: "+path); return JSON.parse(JSON.stringify(d)); }',
    app, count=1, flags=re.S
)

script = "\n".join([EMBEDDED_JS, config, renderer, service, app])

html = f'''<!DOCTYPE html>
<html lang="th"><head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>ระบบกรอกข้อมูลประเมินคุณภาพ DLTV</title>
<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>{css}</style>
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">DLTV</div>
        <div>
          <h1>ระบบประเมินคุณภาพ</h1>
          <p>โรงเรียนปลายทาง DLTV · ปีงบประมาณ 2569</p>
        </div>
      </div>
      <div id="status" class="status">กำลังเริ่มต้น...</div>
      <nav id="nav" class="nav"></nav>
      <div class="sidebar-foot">
        มูลนิธิการศึกษาทางไกลผ่านดาวเทียม<br />ในพระบรมราชูปถัมภ์
      </div>
    </aside>
    <main class="content"><div id="view"></div></main>
  </div>
  <div id="toast" class="toast"></div>
<script type="module">
{script}
</script></body></html>'''

out = os.path.join(ROOT, "DLTV-ระบบกรอกข้อมูล.html")
open(out, "w", encoding="utf-8").write(html)
print("เขียนไฟล์:", out, "ขนาด", len(html), "ตัวอักษร")
