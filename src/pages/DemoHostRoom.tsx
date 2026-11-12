// Màn điều khiển phòng chơi thử (không cần Supabase): lobby → câu hỏi → công bố → kết thúc.
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  ArrowLeft,
  BellRing,
  Check,
  Copy,
  Flag,
  MonitorSmartphone,
  PartyPopper,
  Play,
  Square,
  Users,
} from 'lucide-react'
import {
  Btn,
  Confetti,
  ErrorCard,
  LETTERS,
  Leaderboard,
  PageShell,
  PlayerChips,
  Podium,
  QuestionBlock,
  SoundToggle,
  TimerBar,
  btnClasses,
} from '../components/ui'
import { useCountdown } from '../hooks/useCountdown'
import { useDemoRoom } from '../hooks/useDemoRoom'
import {
  demoStats,
  endDemoRoom,
  nextDemoQuestion,
  revealDemoRoom,
  startDemoRoom,
} from '../lib/demoRoom'
import { play } from '../lib/sound'
import { cx, formatClock } from '../lib/utils'

export default function DemoHostRoom() {
  const { code } = useParams<{ code: string }>()
  const { room, refresh } = useDemoRoom(code ?? null)

  const [copied, setCopied] = useState(false)
  const revealedRef = useRef(false)

  const endsAt = room?.phase === 'question' ? room.question_ends_at : null
  const msLeft = useCountdown(endsAt, 0)
  const question = room && room.q_index >= 0 ? (room.questions[room.q_index] ?? null) : null
  const stats = room && room.q_index >= 0 ? demoStats(room, room.q_index) : null
  const isLastQuestion = room ? room.q_index + 1 >= room.total_questions : false

  // Reset cờ "đã công bố" khi sang câu mới / đổi pha.
  useEffect(() => {
    revealedRef.current = false
  }, [room?.q_index, room?.phase])

  // Tự công bố khi hết giờ (+1,2 giây); giáo viên vẫn bấm sớm được.
  useEffect(() => {
    if (!room || room.phase !== 'question' || !room.question_ends_at) return
    if (revealedRef.current) return

    const roomCode = room.code
    const delay = Math.max(0, new Date(room.question_ends_at).getTime() - Date.now()) + 1200
    const timer = setTimeout(() => {
      if (revealedRef.current) return
      revealedRef.current = true
      revealDemoRoom(roomCode)
      refresh()
    }, delay)
    return () => clearTimeout(timer)
  }, [room?.code, room?.phase, room?.q_index, room?.question_ends_at, refresh])

  // Âm thanh khi chuyển pha / có học sinh mới.
  const prevPhaseRef = useRef<string | null | undefined>(room?.phase)
  useEffect(() => {
    const prev = prevPhaseRef.current
    if (room?.phase === 'reveal' && prev === 'question') play('reveal')
    if (room?.phase === 'finished' && prev !== 'finished') play('finish')
    prevPhaseRef.current = room?.phase
  }, [room?.phase])

  const playersCountRef = useRef(0)
  useEffect(() => {
    if (room && room.players.length > playersCountRef.current) play('join')
    playersCountRef.current = room?.players.length ?? 0
  }, [room?.players.length])

  // Phím tắt: Space/Enter = bắt đầu / công bố / câu tiếp theo.
  useEffect(() => {
    if (!room) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key !== 'Enter' && e.key !== ' ') return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A') return
      e.preventDefault()
      if (room.phase === 'question') handleReveal()
      else if (room.phase === 'reveal') handleNext()
      else if (room.phase === 'lobby' && room.players.length > 0) handleStart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [room?.phase, room?.players.length])

  function handleStart() {
    if (!room || room.players.length === 0) return
    startDemoRoom(room.code)
    refresh()
  }

  function handleReveal() {
    if (!room || room.phase !== 'question') return
    revealedRef.current = true
    revealDemoRoom(room.code)
    refresh()
  }

  function handleNext() {
    if (!room) return
    nextDemoQuestion(room.code)
    refresh()
  }

  function handleEnd() {
    if (!room) return
    if (
      !window.confirm(
        'Kết thúc ván chơi ngay bây giờ? Bảng xếp hạng sẽ dùng điểm đã công bố đến thời điểm này.',
      )
    ) {
      return
    }
    endDemoRoom(room.code)
    refresh()
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // trình duyệt chặn clipboard — copy thủ công
    }
  }

  if (!room) {
    return (
      <PageShell>
        <ErrorCard
          title="Không tìm thấy phòng thử"
          message="Phòng có thể đã bị xóa, hoặc được tạo trên trình duyệt khác."
        />
        <p className="mt-4 text-center">
          <Link to="/demo" className={btnClasses('ghost')}>
            <ArrowLeft className="h-4 w-4" />
            Danh sách phòng thử
          </Link>
        </p>
      </PageShell>
    )
  }

  const joinUrl = `${location.origin}/demo/play/${room.code}`
  const answeredCount = stats?.total ?? 0

  return (
    <PageShell>
      <SoundToggle />

      {room.phase !== 'finished' ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span>
              Phòng{' '}
              <span className="font-mono font-black tracking-[0.2em] text-slate-800">{room.code}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600">
              <MonitorSmartphone className="h-3.5 w-3.5" />
              Chơi thử trên máy này
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/demo" className={btnClasses('ghost')}>
              <ArrowLeft className="h-4 w-4" />
              Danh sách
            </Link>
            <Btn variant="danger" onClick={handleEnd}>
              <Square className="h-4 w-4" />
              Kết thúc ngay
            </Btn>
          </div>
        </div>
      ) : null}

      {room.phase === 'lobby' ? (
        <section className="mx-auto max-w-2xl space-y-8 text-center fade-in">
          <div>
            <p className="text-sm tracking-[0.3em] text-slate-500 uppercase">Mã phòng — chiếu lên bảng</p>
            <p className="my-4 font-mono text-7xl font-black tracking-[0.2em] sm:text-8xl">{room.code}</p>
            <p className="text-slate-500">
              Học sinh mở tab khác và vào{' '}
              <span className="font-mono text-slate-800">{joinUrl}</span>, hoặc trang chủ rồi nhập mã.
            </p>
            <Btn variant="ghost" className="mt-2" onClick={() => void handleCopy(joinUrl)}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Đã sao chép' : 'Sao chép liên kết'}
            </Btn>
          </div>

          <div>
            <h2 className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold tracking-widest text-slate-500 uppercase">
              <Users className="h-4 w-4" />
              {room.players.length} học sinh trong phòng
            </h2>
            <PlayerChips players={room.players} />
          </div>

          <div>
            <Btn size="lg" onClick={handleStart} disabled={room.players.length === 0}>
              <Play className="h-4 w-4" />
              {room.players.length === 0 ? 'Chờ học sinh vào phòng...' : 'Bắt đầu'}
            </Btn>
            <p className="mt-2 text-xs text-slate-500">
              Phòng có {room.total_questions} câu hỏi · Mẹo: bấm <kbd className="font-mono">Space</kbd> để bắt
              đầu.
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
              <span className="font-bold text-slate-800">{answeredCount}</span>/{room.players.length} học sinh
              đã trả lời
            </p>
            <PlayerChips players={room.players} answeredIds={stats?.answeredIds} />
            {question.options.map((option, index) => {
              const count = stats?.counts[index] ?? 0
              const pct = room.players.length > 0 ? (count / room.players.length) * 100 : 0
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
            <Btn size="lg" onClick={handleReveal}>
              <BellRing className="h-4 w-4" />
              Công bố đáp án ngay
            </Btn>
            <p className="mt-2 text-xs text-slate-500">
              Hết giờ tự công bố sau ~1 giây · Mẹo: bấm <kbd className="font-mono">Space</kbd> để công bố.
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
              const isCorrect = question.correct_index === index
              const pct = room.players.length > 0 ? (count / room.players.length) * 100 : 0
              return (
                <div
                  key={index}
                  className={cx(
                    'rounded-xl p-3',
                    isCorrect ? 'pulse-ring border border-emerald-300 bg-emerald-50' : 'bg-white/85',
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
            <span className="font-bold text-emerald-600">{stats?.correctCount ?? 0}</span>/{room.players.length}{' '}
            học sinh
          </p>

          <div>
            <h3 className="mb-2 text-center text-sm font-semibold tracking-widest text-slate-500 uppercase">
              Bảng xếp hạng
            </h3>
            <Leaderboard players={room.players} limit={5} />
          </div>

          <div className="text-center">
            <Btn size="lg" onClick={handleNext}>
              {isLastQuestion ? <Flag className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isLastQuestion ? 'Kết thúc ván chơi' : 'Câu tiếp theo'}
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
          <Podium players={room.players} />
          <div className="text-left">
            <h3 className="mb-2 text-center text-sm font-semibold tracking-widest text-slate-500 uppercase">
              Tổng hợp điểm từng học sinh
            </h3>
            <Leaderboard players={room.players} />
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/demo" className={btnClasses('primary', 'lg')}>
              <ArrowLeft className="h-4 w-4" />
              Danh sách phòng thử
            </Link>
            <Link to="/" className={btnClasses('ghost', 'lg')}>
              Trang chủ
            </Link>
          </div>
        </section>
      ) : null}
    </PageShell>
  )
}
