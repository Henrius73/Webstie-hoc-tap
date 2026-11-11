// Đồng hồ đếm ngược dùng giờ server, vì đồng hồ mỗi máy có thể lệch nhau.
import { serverNow as fetchServerNow } from './api.js';

let offsetMs = 0;
let hasSynced = false;
let inFlight = null;

// Bù độ lệch giữa máy người dùng và server (trừ nửa thời gian khứ hồi mạng).
export async function syncClock() {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const t0 = Date.now();
    const iso = await fetchServerNow();
    const t1 = Date.now();
    offsetMs = new Date(iso).getTime() - (t0 + t1) / 2;
    hasSynced = true;
    return offsetMs;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export const serverNow = () => Date.now() + offsetMs;
export const clockReady = () => hasSynced;

// Thời gian còn lại (ms) của câu hỏi hiện tại.
export function msLeft(room) {
  if (!room?.question_ends_at) return 0;
  return Math.max(0, new Date(room.question_ends_at).getTime() - serverNow());
}

// Đồng bộ lại định kỳ; trả về hàm dọn dẹp.
export function startClockSync(intervalMs = 5 * 60 * 1000) {
  const timer = setInterval(() => { syncClock().catch(() => { /* mất mạng thì giữ mức cũ */ }); }, intervalMs);
  return () => clearInterval(timer);
}
