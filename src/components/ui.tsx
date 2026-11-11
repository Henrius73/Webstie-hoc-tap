// Các khối giao diện dùng chung (Tailwind).
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { colorFor, cx } from '../lib/utils'
import type { PlayerRow } from '../types/db'

export const LETTERS = ['A', 'B', 'C', 'D']

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-slate-100">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">{children}</div>
    </div>
  )
}

type Variant = 'primary' | 'ghost' | 'danger'
type Size = 'md' | 'lg'

const VARIANT_STYLES: Record<Variant, string> = {
  primary: 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400',
  ghost: 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
}

const SIZE_STYLES: Record<Size, string> = {
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function btnClasses(variant: Variant = 'primary', size: Size = 'md'): string {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition',
    'disabled:cursor-not-allowed disabled:opacity-50',
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
    <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
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
    <section className="mx-auto max-w-md rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-center fade-in">
      <div className="mb-3 text-4xl" aria-hidden>
        😕
      </div>
      <h2 className="mb-2 text-lg font-bold text-rose-200">{title}</h2>
      <p className="mb-4 text-sm text-slate-300">{message}</p>
      {onRetry ? (
        <Btn variant="ghost" onClick={onRetry}>
          Thử lại
        </Btn>
      ) : null}
    </section>
  )
}

export function SetupCard() {
  return (
    <section className="mt-10 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 fade-in">
      <h2 className="mb-2 text-lg font-bold text-amber-300">Cần cấu hình Supabase</h2>
      <p className="mb-4 text-sm text-slate-300">
        Phần chơi trực tuyến dùng Supabase (Postgres + Auth + Realtime). Làm lần lượt các bước sau:
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
        <li>
          Tạo project tại{' '}
          <a className="text-amber-300 underline" href="https://supabase.com" target="_blank" rel="noopener">
            supabase.com
          </a>
          .
        </li>
        <li>
          Vào <strong>Authentication → Sign In / Providers</strong>, bật <strong>Anonymous sign-ins</strong> (học sinh
          không cần tài khoản).
        </li>
        <li>
          Vào <strong>Authentication → URL Configuration</strong>: đặt <strong>Site URL</strong> là địa chỉ trang
          (ví dụ <code>http://localhost:5173</code>) và thêm <strong>Redirect URLs</strong> tương ứng
          (<code>http://localhost:5173/**</code> và tên miền deploy).
        </li>
        <li>
          Mở <strong>SQL Editor</strong>, dán và chạy toàn bộ file{' '}
          <code>supabase/migrations/0001_init.sql</code>.
        </li>
        <li>
          Sao chép <code>.env.example</code> thành <code>.env</code>, điền <strong>Project URL</strong> và{' '}
          <strong>Publishable key</strong> (Project Settings → API Keys), rồi chạy lại <code>npm run dev</code>.
        </li>
      </ol>
      <p className="mt-4 text-xs text-slate-400">
        Publishable key được phép công khai — bảo mật nằm ở RLS. Tuyệt đối không đặt secret key (sb_secret_...) trong
        .env.
      </p>
    </section>
  )
}

export function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <div
      className={cx(
        'fixed right-3 bottom-3 z-50 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg',
        connected ? 'bg-emerald-500/15 text-emerald-300' : 'blink-soft bg-rose-500/15 text-rose-300',
      )}
      role="status"
    >
      <span className={cx('h-2 w-2 rounded-full', connected ? 'bg-emerald-400' : 'bg-rose-400')} />
      {connected ? 'Realtime' : 'Mất kết nối, đang thử lại...'}
    </div>
  )
}

export function TimerBar({ msLeft, totalMs }: { msLeft: number; totalMs: number }) {
  const pct = totalMs > 0 ? Math.min(100, Math.max(0, (msLeft / totalMs) * 100)) : 0
  const urgent = msLeft <= 5000
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className={cx(
          'h-full rounded-full transition-[width] duration-200 ease-linear',
          urgent ? 'bg-rose-500' : 'bg-emerald-400',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function QuestionBlock({ text, imageUrl }: { text: string; imageUrl?: string | null }) {
  return (
    <div className="pop-in rounded-2xl border border-slate-700/60 bg-slate-800/80 p-6 text-center shadow-xl">
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
    return <p className="text-slate-400">Chưa có bạn nào vào phòng...</p>
  }
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {players.map(player => {
        const answered = answeredIds?.has(player.id)
        return (
          <span
            key={player.id}
            className={cx(
              'flex items-center gap-2 rounded-full border bg-slate-800/80 px-3 py-1.5 text-sm',
              player.id === meId ? 'border-indigo-400' : 'border-slate-700',
              answered ? 'opacity-100' : '',
            )}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorFor(player.id) }} />
            <span className="font-medium">
              {player.name}
              {player.id === meId ? ' (em)' : ''}
            </span>
            <span className="text-slate-400">{player.score}</span>
            {answered ? <span className="text-emerald-400">✓</span> : null}
          </span>
        )
      })}
    </div>
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
            player.id === meId ? 'border border-indigo-400/50 bg-indigo-500/20' : 'bg-slate-800/70',
          )}
        >
          <span className="w-7 text-center text-lg font-black">
            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
          </span>
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colorFor(player.id) }} />
          <span className="flex-1 truncate font-medium">{player.name}</span>
          <span className="font-mono font-bold">{player.score} điểm</span>
        </li>
      ))}
    </ol>
  )
}

export function Podium({ players }: { players: PlayerRow[] }) {
  const top = players.slice(0, 3)
  if (!top.length) return null

  const config = [
    { height: 'h-36 sm:h-44', label: '🥇' },
    { height: 'h-24 sm:h-28', label: '🥈' },
    { height: 'h-16 sm:h-20', label: '🥉' },
  ]
  // Xếp người thứ nhất đứng giữa khi đủ 3 người.
  const order = top.length >= 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0]

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6">
      {order.map(rank => {
        const player = top[rank]
        const conf = config[rank]
        return (
          <div key={player.id} className="flex w-24 flex-col items-center gap-2 sm:w-32">
            <div className="text-3xl" aria-hidden>
              {conf.label}
            </div>
            <div className="max-w-full truncate font-bold">{player.name}</div>
            <div className="font-mono text-sm text-slate-300">{player.score}</div>
            <div
              className={cx('w-full rounded-t-xl border-t-4 bg-slate-800/80', conf.height)}
              style={{ borderTopColor: colorFor(player.id) }}
            />
          </div>
        )
      })}
    </div>
  )
}
