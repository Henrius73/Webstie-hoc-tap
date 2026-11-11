// Tiện ích nhỏ dùng chung.

// Ghép class có điều kiện cho gọn khi viết className.
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

// Mã phòng: bỏ khoảng trắng, viết hoa.
export function normalizeCode(value: string | undefined | null): string {
  return String(value ?? '').replace(/\s+/g, '').trim().toUpperCase()
}

// Định dạng "0:07" cho đồng hồ đếm ngược.
export function formatClock(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`
}

// Màu ổn định theo id người chơi (cùng một bạn luôn cùng một màu).
const COLORS = ['#7c3aed', '#db2777', '#0284c7', '#d97706', '#059669', '#dc2626', '#0891b2', '#9333ea']

export function colorFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return COLORS[hash % COLORS.length]
}
