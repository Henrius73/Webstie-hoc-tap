// Tiện ích dùng chung

// Chống chèn HTML khi hiển thị dữ liệu người dùng nhập
export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

// Sinh id ngẫu nhiên đủ dài để tránh trùng
export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Xáo trộn mảng (Fisher–Yates), trả về mảng mới
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Thông báo nhỏ ở cuối màn hình
let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2200);
}
