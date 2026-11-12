// Màn điều khiển phòng của giáo viên: lobby → câu hỏi (thống kê) → công bố → kết thúc.
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, BellRing, Check, ClipboardCopy, Flag, PartyPopper, Play, Square } from 'lucide-react'
import { endRoom, fetchAnswerStats, nextQuestion, revealAnswer, type AnswerStats } from '../api/rooms'
import {
  Btn,
  Confetti,
  ConnectionBadge,
  ErrorCard,
  LETTERS,
  Leaderboard,
  PageShell,
  PlayerChips,
  Podium,
  QuestionBlock,
  SoundToggle,
  Spinner,
  TimerBar,
  btnClasses,
} from '../components/ui'
import { useCountdown, useServerOffset } from '../hooks/useCountdown'
import { useRoom } from '../hooks/useRoom'
import { useAuth } from '../lib/auth'
import { friendlyError } from '../lib/errors'
import { play } from '../lib/sound'
import { cx, formatClock } from '../lib/utils'

export default function HostRoom() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const offset = useServerOffset()

  const { snapshot, error, connected, version, refresh } = useRoom(id ?? null, user?.id ?? null)
  const room = snapshot?.room ?? null
  const players = snapshot?.players ?? []
  const msLeft = useCountdown(room?.phase === 'question' ? room.question_ends_at : null, offset)

  const [stats, setStats] = useState<AnswerStats | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const revealedRef = useRef(false)

  // Reset cờ "đã công bố" khi chuyển sang câu mới.
  useEffect(() => {
    revealedRef.current = false
  }, [room?.q_index])

  // Tự công bố khi hết giờ (+1,2 giây); giáo viên vẫn bấm được sớm hơn.
  useEffect(() => {
    if (room?.phase !== 'question' || !room.question_ends_at) return
    if (revealedRef.current) return

    const roomId = room.id
    const endsAt = new Date(room.question_ends_at).getTime()
    const remaining = endsAt - (Date.now() + offset)

    const fire = async () => {
      if (revealedRef.current) return
      revealedRef.current = true
      try {
        await revealAnswer(roomId)
        await refresh()
      } catch (err) {
        setActionError(friendlyError(err))
      }
    }

    const delay = remaining <= 0 ? 1200 : remaining + 1200
    const timer = setTimeout(() => void fire(), delay)
    return () => clearTimeout(timer)
  }, [room?.id, room?.phase, room?.q_index, room?.question_ends_at, offset, refresh])

  // Thống kê đáp án của câu hiện tại (chỉ giáo viên đọc được) — cả pha question lẫn reveal.
  useEffect(() => {
    if (!room || (room.phase !== 'question' && room.phase !== 'reveal') || room.q_index < 0) {
      setStats(null)
      return
    }
    let alive = true
    const load = async () => {
      try {
        const next = await fetchAnswerStats(room.id, room.q_index)
        if (alive) setStats(next)
      } catch {
        // bỏ qua nhịp lỗi, nhịp sau thử lại
      }
    }
    void load()
    const timer = setInterval(load, 2000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [room, room?.phase, room?.q_index, version])

  // Âm thanh: công bố, kết thúc, học sinh mới vào phòng.
  const prevPhaseRef = useRef<string | null | undefined>(room?.phase)
  useEffect(() => {
    const prev = prevPhaseRef.current
    if (room?.phase === 'reveal' && prev === 'question') play('reveal')
    if (room?.phase === 'finished' && prev !== 'finished') play('finish')
    prevPhaseRef.current = room?.phase
  }, [room?.phase])

  const playersCountRef = useRef(0)
  useEffect(() => {
    if (players.length > playersCountRef.current) play('join')
    playersCountRef.current = players.length
  }, [players.length])

  // Điều khiển bằng phím: Space/Enter = công bố (đang hỏi) hoặc sang câu tiếp / bắt đầu.
  useEffect(() => {
    if (!room) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || busy) return
      if (e.key !== 'Enter' && e.key !== ' ') return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A') return
      e.preventDefault()
      if (room.phase === 'question') void handleReveal()
      else if (room.phase === 'reveal') void handleNext()
      else if (room.phase === 'lobby' && players.length > 0) void handleNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [room, busy, players.length])

  async function handleReveal() {
    if (!room || busy) return
    setBusy(true)
    revealedRef.current = true
    setActionError(null)
    try {
      await revealAnswer(room.id)
      await refresh()
    } catch (err) {
      setActionError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleNext() {
    if (!room || busy) return
    setBusy(true)
    setActionError(null)
    try {
      await nextQuestion(room.id)
      await refresh()
    } catch (err) {
      setActionError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleEndRoom() {
    if (!room || busy) return
    if (
      !window.confirm(
        'Kết thúc ván chơi ngay bây giờ? Bảng xếp hạng sẽ dùng điểm đã công bố đến thời điểm này.',
      )
    ) {
      return
    }
    setBusy(true)
    setActionError(null)
    try {
      await endRoom(room.id)
      await refresh()
    } catch (err) {
      setActionError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // trình duyệt chặn clipboard — thầy/cô copy thủ công
    }
  }

  if (error && !room) {
    return (
      <PageShell>
        <ErrorCard title="Không mở được phòng" message={error} />
        <p className="mt-4 text-center">
          <Link to="/host" className={btnClasses('ghost')}>
            Về trang giáo viên
          </Link>
        </p>
      </PageShell>
    )
  }

  if (!room) {
    return (
      <PageShell>
        <Spinner label="Đang tải phòng..." />
      </PageShell>
    )
  }

  const question = room.question
  const joinUrl = `${location.origin}/room/${room.code}`
  const answeredCount = stats?.total ?? 0
  const isLastQuestion = room.q_index + 1 >= room.total_questions

  return (
    <PageShell>
      <ConnectionBadge connected={connected} />
      <SoundToggle />

      {room.phase !== 'finished' ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
          <p className="text-sm text-slate-500">
            Phòng <span className="font-mono font-black tracking-[0.2em] text-slate-800">{room.code}</span>
          </p>
          <div className="flex gap-2">
            <Link to="/host" className={btnClasses('ghost')}>
              <ArrowLeft className="h-4 w-4" />
              Danh sách
            </Link>
            <Btn variant="danger" onClick={() => void handleEndRoom()} disabled={busy}>
              <Square className="h-4 w-4" />
              Kết thúc ngay
            </Btn>
          </div>
        </div>
      ) : null}

      {actionError ? (
        <div className="mb-4">
          <ErrorCard message={actionError} />
        </div>
      ) : null}

      {room.phase === 'lobby' ? (
        <section className="mx-auto max-w-2xl space-y-8 text-center fade-in">
          <div>
            <p className="text-sm tracking-[0.3em] text-slate-500 uppercase">Mã phòng — chiếu lên bảng</p>
            <p className="my-4 font-mono text-7xl font-black tracking-[0.2em] sm:text-8xl">{room.code}</p>
            <p className="text-slate-500">
              Học sinh vào <span className="font-mono text-slate-800">{joinUrl}</span> hoặc trang chủ rồi nhập mã.
            </p>
            <Btn variant="ghost" className="mt-2" onClick={() => void handleCopy(joinUrl)}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <ClipboardCopy className="h-4 w-4" />}
              {copied ? 'Đã sao chép' : 'Sao chép liên kết'}
            </Btn>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold tracking-widest text-slate-500 uppercase">
              {players.length} học sinh trong phòng
            </h2>
            <PlayerChips players={players} />
          </div>

          <div>
            <Btn size="lg" onClick={() => void handleNext()} disabled={busy || players.length === 0}>
              {busy ? (
                'Đang bắt đầu...'
              ) : players.length === 0 ? (
                'Chờ học sinh vào phòng...'
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Bắt đầu
                </>
              )}
            </Btn>
            <p className="mt-2 text-xs text-slate-500">
              Phòng có {room.total_questions} câu hỏi · Mẹo: bấm <kbd className="font-mono">Space</kbd> để bắt đầu.
            </p>
          </div>
        </section>
      ) : null}

      {room.phase === 'question' && question ? (
        <section className="mx-auto max-w-3xl space-y-5 fade-in">
          <div className="text-center text-sm text-slate-500">
            Câu {room.q_index + 1}/{room.total_questions}
          </div>
          <TimerBar msLeft={msLeft} totalMs={question.time_limit * 1000} />
          <div className="text-center font-mono text-3xl font-black">{formatClock(msLeft)}</div>
          <QuestionBlock text={question.text} imageUrl={question.image_url} />

          <div className="space-y-2">
            <p className="text-center text-sm text-slate-500">
              <span className="font-bold text-slate-800">{answeredCount}</span>/{players.length} học sinh đã trả lời
            </p>
            <PlayerChips players={players} answeredIds={stats?.answeredIds} />
            {question.options.map((option, index) => {
              const count = stats?.counts[index] ?? 0
              const pct = players.length > 0 ? (count / players.length) * 100 : 0
              return (
                <div key={index} className="rounded-xl bg-white/85 p-3">
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <span className="font-black">{LETTERS[index]}</span>
                    <span className="flex-1 truncate text-slate-600">{option}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-[width] duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="text-center">
            <Btn size="lg" onClick={() => void handleReveal()} disabled={busy}>
              {busy ? (
                'Đang chốt...'
              ) : (
                <>
                  <BellRing className="h-4 w-4" />
                  Công bố đáp án ngay
                </>
              )}
            </Btn>
            <p className="mt-2 text-xs text-slate-500">
              Hết giờ hệ thống tự công bố sau ~1 giây · Mẹo: bấm <kbd className="font-mono">Space</kbd> để công bố.
            </p>
          </div>
        </section>
      ) : null}

      {room.phase === 'reveal' && question ? (
        <section className="mx-auto max-w-3xl space-y-5 fade-in">
          <div className="text-center text-sm text-slate-500">
            Câu {room.q_index + 1}/{room.total_questions}
          </div>
          <QuestionBlock text={question.text} imageUrl={question.image_url} />

          <div className="space-y-2">
            {question.options.map((option, index) => {
              const count = stats?.counts[index] ?? 0
              const isCorrect = room.correct_index === index
              const pct = players.length > 0 ? (count / players.length) * 100 : 0
              return (
                <div
                  key={index}
                  className={cx(
                    'rounded-xl p-3',
                    isCorrect
                      ? 'pulse-ring border border-emerald-300 bg-emerald-50'
                      : 'bg-white/85',
                  )}
                >
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <span className="font-black">{LETTERS[index]}</span>
                    <span className="flex-1 truncate text-slate-800">{option}</span>
                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <Check className="h-4 w-4" />
                        đúng
                      </span>
                    ) : null}
                    <span className="font-mono">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={cx(
                        'h-full rounded-full transition-[width] duration-300',
                        isCorrect ? 'bg-emerald-500' : 'bg-indigo-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-center text-sm text-slate-600">
            Trả lời đúng:{' '}
            <span className="font-bold text-emerald-600">{stats?.correctCount ?? 0}</span>/{players.length} học sinh
          </p>

          <div>
            <h3 className="mb-2 text-center text-sm font-semibold tracking-widest text-slate-500 uppercase">
              Bảng xếp hạng
            </h3>
            <Leaderboard players={players} limit={5} />
          </div>

          <div className="text-center">
            <Btn size="lg" onClick={() => void handleNext()} disabled={busy}>
              {busy ? (
                'Đang chuyển...'
              ) : isLastQuestion ? (
                <>
                  <Flag className="h-4 w-4" />
                  Kết thúc ván chơi
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Câu tiếp theo
                </>
              )}
            </Btn>
          </div>
        </section>
      ) : null}

      {room.phase === 'finished' ? (
        <section className="mx-auto max-w-2xl space-y-6 text-center fade-in">
          <Confetti />
          <h1 className="flex items-center justify-center gap-3 text-3xl font-black">
            <PartyPopper className="h-8 w-8 text-amber-600" />
            Kết thúc ván chơi!
          </h1>
          <Podium players={players} />
          <div className="text-left">
            <h3 className="mb-2 text-center text-sm font-semibold tracking-widest text-slate-500 uppercase">
              Tổng hợp điểm từng học sinh
            </h3>
            <Leaderboard players={players} />
          </div>
          <Link to="/host" className={btnClasses('ghost', 'lg')}>
            Về trang giáo viên
          </Link>
        </section>
      ) : null}
    </PageShell>
  )
}
