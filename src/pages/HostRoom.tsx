// Màn điều khiển phòng của giáo viên: lobby → câu hỏi (thống kê) → công bố → kết thúc.
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { fetchAnswerStats, type AnswerStats } from '../api/rooms'
import { nextQuestion, revealAnswer } from '../api/rooms'
import {
  Btn,
  ConnectionBadge,
  ErrorCard,
  LETTERS,
  Leaderboard,
  PageShell,
  PlayerChips,
  Podium,
  QuestionBlock,
  Spinner,
  TimerBar,
  btnClasses,
} from '../components/ui'
import { useCountdown, useServerOffset } from '../hooks/useCountdown'
import { useRoom } from '../hooks/useRoom'
import { useAuth } from '../lib/auth'
import { friendlyError } from '../lib/errors'
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

  // Thống kê đáp án của câu hiện tại (chỉ giáo viên đọc được).
  useEffect(() => {
    if (!room || room.phase !== 'question' || room.q_index < 0) {
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

      {actionError ? (
        <div className="mb-4">
          <ErrorCard message={actionError} />
        </div>
      ) : null}

      {room.phase === 'lobby' ? (
        <section className="mx-auto max-w-2xl space-y-8 text-center fade-in">
          <div>
            <p className="text-sm tracking-[0.3em] text-slate-400 uppercase">Mã phòng — chiếu lên bảng</p>
            <p className="my-4 font-mono text-7xl font-black tracking-[0.2em] sm:text-8xl">{room.code}</p>
            <p className="text-slate-400">
              Học sinh vào <span className="font-mono text-slate-200">{joinUrl}</span> hoặc trang chủ rồi nhập mã.
            </p>
            <Btn variant="ghost" className="mt-2" onClick={() => void handleCopy(joinUrl)}>
              {copied ? '✓ Đã sao chép' : '📋 Sao chép liên kết'}
            </Btn>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold tracking-widest text-slate-400 uppercase">
              {players.length} học sinh trong phòng
            </h2>
            <PlayerChips players={players} />
          </div>

          <div>
            <Btn size="lg" onClick={() => void handleNext()} disabled={busy || players.length === 0}>
              {busy ? 'Đang bắt đầu...' : players.length === 0 ? 'Chờ học sinh vào phòng...' : '▶ Bắt đầu'}
            </Btn>
            <p className="mt-2 text-xs text-slate-500">
              Phòng có {room.total_questions} câu hỏi.
            </p>
          </div>
        </section>
      ) : null}

      {room.phase === 'question' && question ? (
        <section className="mx-auto max-w-3xl space-y-5 fade-in">
          <div className="text-center text-sm text-slate-400">
            Câu {room.q_index + 1}/{room.total_questions}
          </div>
          <TimerBar msLeft={msLeft} totalMs={question.time_limit * 1000} />
          <div className="text-center font-mono text-3xl font-black">{formatClock(msLeft)}</div>
          <QuestionBlock text={question.text} imageUrl={question.image_url} />

          <div className="space-y-2">
            <p className="text-center text-sm text-slate-400">
              <span className="font-bold text-slate-200">{answeredCount}</span>/{players.length} học sinh đã trả lời
            </p>
            {question.options.map((option, index) => {
              const count = stats?.counts[index] ?? 0
              const pct = players.length > 0 ? (count / players.length) * 100 : 0
              return (
                <div key={index} className="rounded-xl bg-slate-800/70 p-3">
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <span className="font-black">{LETTERS[index]}</span>
                    <span className="flex-1 truncate text-slate-300">{option}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-900">
                    <div
                      className="h-full rounded-full bg-indigo-400 transition-[width] duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="text-center">
            <Btn size="lg" onClick={() => void handleReveal()} disabled={busy}>
              {busy ? 'Đang chốt...' : '🔔 Công bố đáp án ngay'}
            </Btn>
            <p className="mt-2 text-xs text-slate-500">
              Hết giờ hệ thống tự công bố sau ~1 giây. Server vẫn chặn đáp án gửi muộn.
            </p>
          </div>
        </section>
      ) : null}

      {room.phase === 'reveal' && question ? (
        <section className="mx-auto max-w-3xl space-y-5 fade-in">
          <div className="text-center text-sm text-slate-400">
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
                    isCorrect ? 'border border-emerald-400/60 bg-emerald-500/15' : 'bg-slate-800/70',
                  )}
                >
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <span className="font-black">{LETTERS[index]}</span>
                    <span className="flex-1 truncate text-slate-200">{option}</span>
                    {isCorrect ? <span className="text-emerald-300">✓ đúng</span> : null}
                    <span className="font-mono">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-900">
                    <div
                      className={cx(
                        'h-full rounded-full transition-[width] duration-300',
                        isCorrect ? 'bg-emerald-400' : 'bg-indigo-400',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-center text-sm text-slate-300">
            Trả lời đúng:{' '}
            <span className="font-bold text-emerald-300">{stats?.correctCount ?? 0}</span>/{players.length} học sinh
          </p>

          <div>
            <h3 className="mb-2 text-center text-sm font-semibold tracking-widest text-slate-400 uppercase">
              Bảng xếp hạng
            </h3>
            <Leaderboard players={players} limit={5} />
          </div>

          <div className="text-center">
            <Btn size="lg" onClick={() => void handleNext()} disabled={busy}>
              {busy ? 'Đang chuyển...' : isLastQuestion ? '🏁 Kết thúc ván chơi' : '▶ Câu tiếp theo'}
            </Btn>
          </div>
        </section>
      ) : null}

      {room.phase === 'finished' ? (
        <section className="mx-auto max-w-2xl space-y-6 text-center fade-in">
          <h1 className="text-3xl font-black">🎉 Kết thúc ván chơi!</h1>
          <Podium players={players} />
          <div className="text-left">
            <h3 className="mb-2 text-center text-sm font-semibold tracking-widest text-slate-400 uppercase">
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
