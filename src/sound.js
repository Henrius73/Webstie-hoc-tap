// Âm thanh hiệu ứng tạo bằng Web Audio API — không cần tệp ngoài, không phụ thuộc mạng.
// Trạng thái tắt/bật được ghi nhớ trong localStorage.

const MUTE_KEY = 'hocvui.muted.v1';
let ctx = null;

// Đang tắt tiếng?
export function isMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

// Bật/tắt tiếng, trả về trạng thái mới
export function toggleMuted() {
  const next = !isMuted();
  try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* trình duyệt chặn lưu thì bỏ qua */ }
  return next;
}

// Chỉ tạo AudioContext khi thật sự cần, vì trình duyệt chặn phát trước thao tác người dùng
function audioContext() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try { ctx = new Ctor(); } catch { ctx = null; }
  return ctx;
}

// Phát một nốt ngắn với âm lượng tăng/giảm mượt để không bị "cụp"
function tone(c, { freq, duration = 0.16, delay = 0, type = 'sine', volume = 0.16, slideTo = null }) {
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);

  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

function play(notes, type) {
  if (isMuted()) return;
  const c = audioContext();
  if (!c) return;
  // AudioContext có thể ở trạng thái suspended cho tới thao tác đầu tiên
  if (c.state === 'suspended') c.resume?.();
  for (const note of notes) tone(c, { type, ...note });
}

// Trả lời đúng: hai nốt đi lên
export function playCorrect() {
  play([
    { freq: 660, duration: 0.12 },
    { freq: 990, delay: 0.11, duration: 0.16 },
  ], 'triangle');
}

// Trả lời sai hoặc hết giờ: một nốt trầm đi xuống
export function playWrong() {
  play([
    { freq: 220, duration: 0.28, volume: 0.12, slideTo: 140 },
  ], 'sawtooth');
}

// Thắng cuộc: chuỗi nốt rộn ràng
export function playWin() {
  play([
    { freq: 523, duration: 0.14 },
    { freq: 659, delay: 0.12, duration: 0.14 },
    { freq: 784, delay: 0.24, duration: 0.14 },
    { freq: 1047, delay: 0.36, duration: 0.3 },
  ], 'triangle');
}
