// Âm thanh tổng hợp bằng Web Audio API — không cần tệp nhạc ngoài, nhẹ và miễn phí.
// Người dùng tắt/bật bằng nút âm thanh (lưu trong localStorage).

const STORAGE_KEY = 'hocvui.sound'

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // localStorage bị chặn — âm thanh vẫn dùng được trong phiên này
  }
}

// Một nốt ngắn: tần số (Hz), trễ (giây), thời lượng, kiểu sóng, âm lượng.
function beep(
  freq: number,
  when = 0,
  duration = 0.15,
  type: OscillatorType = 'sine',
  volume = 0.16,
): void {
  const ac = audio()
  if (!ac) return
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t0 = ac.currentTime + when
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

export type SoundName = 'pick' | 'correct' | 'wrong' | 'reveal' | 'finish' | 'join'

export function play(name: SoundName): void {
  if (!soundEnabled()) return
  try {
    switch (name) {
      case 'pick':
        beep(520, 0, 0.08, 'triangle', 0.12)
        break
      case 'join':
        beep(740, 0, 0.1, 'sine', 0.1)
        break
      case 'correct':
        beep(660, 0, 0.12)
        beep(880, 0.12, 0.2)
        break
      case 'wrong':
        beep(220, 0, 0.22, 'sawtooth', 0.1)
        beep(180, 0.1, 0.25, 'sawtooth', 0.09)
        break
      case 'reveal':
        beep(392, 0, 0.12, 'triangle')
        beep(523, 0.1, 0.12, 'triangle')
        beep(659, 0.2, 0.3, 'triangle')
        break
      case 'finish':
        for (const [index, freq] of [523, 659, 784, 1046].entries()) {
          beep(freq, index * 0.15, 0.24, 'triangle')
        }
        break
    }
  } catch {
    // Âm thanh không quan trọng — bỏ qua mọi lỗi (tab nền, thiết bị không có tiếng...)
  }
}
