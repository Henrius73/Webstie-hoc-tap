// Các khối giao diện dùng chung (Tailwind).
import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import {
  Check,
  CircleAlert,
  GraduationCap,
  Home as HomeIcon,
  Medal,
  PartyPopper,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react'
import { colorFor, cx } from '../lib/utils'
import { play, setSoundEnabled, soundEnabled } from '../lib/sound'
import type { PlayerRow } from '../types/db'

export const LETTERS = ['A', 'B', 'C', 'D']

// Lớp dùng chung để các trang có cùng nhịp điệu thị giác.
export const cardClasses = 'rounded-2xl border border-slate-200 bg-white/90 shadow-sm shadow-slate-200/60'
export const fieldClasses =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50'
export const sectionLabelClasses = 'text-xs font-semibold tracking-widest text-slate-500 uppercase'

export function PageShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-50 via-white to-indigo-100 text-slate-900">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
        {isHome ? null : (
          <nav className="mb-8 flex items-center justify-between gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-black tracking-tight text-slate-800 transition hover:text-indigo-600"
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl border border-indigo-200 bg-indigo-100 text-indigo-600">
                <GraduationCap className="h-4 w-4" />
              </span>
              Học Vui
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
            >
              <HomeIcon className="h-3.5 w-3.5" />
              Trang chủ
            </Link>
          </nav>
        )}
        {children}
      </div>
    </div>
  )
}

type Variant = 'primary' | 'ghost' | 'danger'
type Size = 'md' | 'lg'

const VARIANT_STYLES: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500',
  ghost: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
}

const SIZE_STYLES: Record<Size, string> = {
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function btnClasses(variant: Variant = 'primary', size: Size = 'md'): string {
  return cx(
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold transition',
    'focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none',
    'active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0',
    VARIANT_STYLES[variant],
    SIZE_STYLES[size],
  )
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Btn({ variant = 'primary', size = 'md', className, type = 'button', ...rest }: BtnProps) {
  return <button type={type} className={cx(btnClasses(variant, size), className)} {...rest} />
}

export function Spinner({ label = 'Đang tải...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-slate-500">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function ErrorCard({
  title = 'Có lỗi xảy ra',
  message,
  onRetry,
}: {
  title?: string
  message: string
  onRetry?: () => void
}) {
  return (
    <section className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center fade-in">
      <CircleAlert className="mx-auto mb-3 h-10 w-10 text-rose-600" />
      <h2 className="mb-2 text-lg font-bold text-rose-700">{title}</h2>
      <p className="mb-4 text-sm text-slate-600">{message}</p>
      {onRetry ? (
        <Btn variant="ghost" onClick={onRetry}>
          Thử lại
        </Btn>
      ) : null}
    </section>
  )
}

export function EmptyState({
  icon: Icon = Sparkles,
  title,
  description,
  children,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className={cx(cardClasses, 'px-6 py-10 text-center fade-in')}>
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
        <Icon className="h-6 w-6" />
      </span>
      <p className="font-bold text-slate-900">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
      {children ? <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  )
}

export function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <div
      className={cx(
        'fixed right-3 bottom-3 z-50 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg',
        connected ? 'bg-emerald-50 text-emerald-700' : 'blink-soft bg-rose-50 text-rose-700',
      )}
      role="status"
    >
      <span className={cx('h-2 w-2 rounded-full', connected ? 'bg-emerald-500' : 'bg-rose-400')} />
      {connected ? 'Realtime' : 'Mất kết nối, đang thử lại...'}
    </div>
  )
}

export function SoundToggle() {
  const [on, setOn] = useState(() => soundEnabled())
  return (
    <button
      type="button"
      onClick={() => {
        const next = !on
        setOn(next)
        setSoundEnabled(next)
        if (next) play('join')
      }}
      className="fixed bottom-3 left-3 z-50 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-lg hover:bg-slate-100"
      aria-label={on ? 'Tắt âm thanh' : 'Bật âm thanh'}
      title={on ? 'Tắt âm thanh' : 'Bật âm thanh'}
    >
      {on ? (
        <>
          <Volume2 className="h-3.5 w-3.5" />
          Âm thanh
        </>
      ) : (
        <>
          <VolumeX className="h-3.5 w-3.5" />
          Đã tắt tiếng
        </>
      )}
    </button>
  )
}

// Con số điểm có hiệu ứng "nhảy" dần lên giá trị mới (dùng khi cộng điểm).
export function ScoreNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    const from = prevRef.current
    if (from === value) return
    const start = performance.now()
    const duration = 650
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (p < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        prevRef.current = value
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return <span className={className}>{display}</span>
}

const CONFETTI_ICONS: LucideIcon[] = [PartyPopper, Sparkles, Star, Medal]

// Pháo giấy nhẹ bằng CSS — chỉ hiện khi kết thúc ván.
export function Confetti({ count = 30 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        Icon: CONFETTI_ICONS[i % CONFETTI_ICONS.length],
        left: Math.random() * 100,
        delay: Math.random() * 2.2,
        duration: 2.8 + Math.random() * 2.4,
        size: Math.random() < 0.5 ? 'h-4 w-4' : 'h-6 w-6',
        color: ['text-amber-600', 'text-indigo-600', 'text-emerald-600', 'text-rose-600'][i % 4],
      })),
    [count],
  )
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {pieces.map(piece => (
        <span
          key={piece.id}
          className={cx('confetti absolute', piece.color)}
          style={{
            left: `${piece.left}%`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        >
          <piece.Icon className={piece.size} />
        </span>
      ))}
    </div>
  )
}

export function TimerBar({ msLeft, totalMs }: { msLeft: number; totalMs: number }) {
  const pct = totalMs > 0 ? Math.min(100, Math.max(0, (msLeft / totalMs) * 100)) : 0
  const urgent = msLeft <= 5000
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className={cx(
          'h-full rounded-full transition-[width] duration-200 ease-linear',
          urgent ? 'bg-rose-500' : 'bg-emerald-500',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function QuestionBlock({ text, imageUrl }: { text: string; imageUrl?: string | null }) {
  return (
    <div className="pop-in rounded-2xl border border-slate-200 bg-white/90 p-6 text-center shadow-xl">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="mx-auto mb-4 max-h-56 rounded-xl object-contain" loading="lazy" />
      ) : null}
      <h2 className="text-xl leading-snug font-bold sm:text-2xl">{text}</h2>
    </div>
  )
}

export function PlayerChips({
  players,
  meId,
  answeredIds,
}: {
  players: PlayerRow[]
  meId?: string
  answeredIds?: Set<string>
}) {
  if (!players.length) {
    return <p className="text-slate-500">Chưa có bạn nào vào phòng...</p>
  }
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {players.map(player => {
        const answered = answeredIds?.has(player.id)
        return (
          <span
            key={player.id}
            className={cx(
              'flex items-center gap-2 rounded-full border bg-white/90 px-3 py-1.5 text-sm',
              player.id === meId ? 'border-indigo-300' : 'border-slate-200',
              answered ? 'opacity-100' : '',
            )}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorFor(player.id) }} />
            <span className="font-medium">
              {player.name}
              {player.id === meId ? ' (em)' : ''}
            </span>
            <span className="text-slate-500">{player.score}</span>
            {answered ? <Check className="h-4 w-4 text-emerald-600" /> : null}
          </span>
        )
      })}
    </div>
  )
}

const MEDAL_STYLES = ['text-amber-600', 'text-slate-600', 'text-orange-400']

// Huy chương vàng/bạc/đồng cho 3 hạng đầu; các hạng sau hiện số.
function RankMedal({ rank, size = 'sm' }: { rank: number; size?: 'sm' | 'lg' }) {
  if (rank > 3) {
    return <span className="text-lg font-black">{rank}</span>
  }
  return (
    <Medal
      className={cx(MEDAL_STYLES[rank - 1], size === 'lg' ? 'h-9 w-9' : 'h-6 w-6')}
      aria-label={`Hạng ${rank}`}
    />
  )
}

export function Leaderboard({
  players,
  meId,
  limit = 0,
}: {
  players: PlayerRow[]
  meId?: string
  limit?: number
}) {
  const list = limit > 0 ? players.slice(0, limit) : players
  return (
    <ol className="space-y-2">
      {list.map((player, index) => (
        <li
          key={player.id}
          className={cx(
            'flex items-center gap-3 rounded-xl px-4 py-2.5',
            player.id === meId ? 'border border-indigo-300 bg-indigo-50' : 'border border-slate-200 bg-white',
          )}
        >
          <span className="flex w-7 items-center justify-center">
            <RankMedal rank={index + 1} />
          </span>
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colorFor(player.id) }} />
          <span className="flex-1 truncate font-medium">{player.name}</span>
          <span className="font-mono font-bold">
            <ScoreNumber value={player.score} /> điểm
          </span>
        </li>
      ))}
    </ol>
  )
}

export function Podium({ players }: { players: PlayerRow[] }) {
  const top = players.slice(0, 3)
  if (!top.length) return null

  const config = [{ height: 'h-36 sm:h-44' }, { height: 'h-24 sm:h-28' }, { height: 'h-16 sm:h-20' }]
  // Xếp người thứ nhất đứng giữa khi đủ 3 người.
  const order = top.length >= 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0]

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6">
      {order.map(rank => {
        const player = top[rank]
        const conf = config[rank]
        return (
          <div key={player.id} className="flex w-24 flex-col items-center gap-2 sm:w-32">
            <RankMedal rank={rank + 1} size="lg" />
            <div className="max-w-full truncate font-bold">{player.name}</div>
            <div className="font-mono text-sm text-slate-600">
              <ScoreNumber value={player.score} />
            </div>
            <div
              className={cx('w-full rounded-t-xl border border-slate-200 border-t-4 bg-white', conf.height)}
              style={{ borderTopColor: colorFor(player.id) }}
            />
          </div>
        )
      })}
    </div>
  )
}
