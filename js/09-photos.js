/* ============================================================
   09-photos.js — จัดการรูปนักเรียน: upload, drag-drop, URL
   (แยกมาจาก index.html เดิม บรรทัด 2830-2896 โดยรักษาลำดับโค้ดเดิม)
   ============================================================ */
function handlePhotoFile(input, idx) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('ไฟล์ใหญ่เกิน 5MB กรุณาเลือกรูปที่เล็กกว่านี้');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    setPhotoUrl(idx, dataUrl);
  };
  reader.readAsDataURL(file);
}

function handlePhotoDrop(event, idx) {
  event.preventDefault();
  event.currentTarget.style.borderColor = '';
  const file = event.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('ไฟล์ใหญ่เกิน 5MB');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) { setPhotoUrl(idx, e.target.result); };
  reader.readAsDataURL(file);
}

function setPhotoUrl(idx, url) {
  DB.students[idx].photoUrl = url;
  // Update preview box
  const box = document.getElementById('photo-preview-' + idx);
  if (box) {
    if (url) {
      box.innerHTML = `<img src="${fixDriveUrl(url)}" onerror="this.style.display='none';this.nextSibling.style.display='flex'" style="width:100px;height:100px;border-radius:var(--rad-lg);object-fit:cover;object-position:top center;border:2px solid var(--border2)">
        <div class="photo-avatar-lg" style="display:none">${initials(DB.students[idx].name)}</div>`;
      if (!box.nextElementSibling || !box.nextElementSibling.textContent.includes('ลบรูป')) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-danger';
        btn.style.cssText = 'margin-top:6px;width:100%';
        btn.textContent = '🗑 ลบรูป';
        btn.onclick = function() { removePhoto(idx); };
        box.parentNode.insertBefore(btn, box.nextSibling);
      }
    } else {
      box.innerHTML = `<div class="photo-avatar-lg">${initials(DB.students[idx].name)}</div>`;
      const nxt = box.nextElementSibling;
      if (nxt && nxt.textContent.includes('ลบรูป')) nxt.remove();
    }
  }
  refreshModalHeader(idx);
  saveToStorage();
}

function removePhoto(idx) {
  setPhotoUrl(idx, '');
}

function switchPhotoSource(type, btn, idx) {
  btn.closest('.photo-source-tabs').querySelectorAll('.photo-source-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('photo-src-upload-' + idx).style.display = type === 'upload' ? 'block' : 'none';
  document.getElementById('photo-src-url-' + idx).style.display = type === 'url' ? 'block' : 'none';
}

// ============ LOCAL STORAGE PERSISTENCE ============
