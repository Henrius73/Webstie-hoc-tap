// Màn hình phòng chơi thử của học sinh (cùng trình duyệt, không cần Supabase):
// nhập tên → lobby → câu hỏi → công bố → podium.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Hourglass, PartyPopper, TimerOff, Trophy } from 'lucide-react'
import { AnswerPad } from '../components/AnswerPad'
import {
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
  getStoredDemoPlayerId,
  joinDemoRoom,
  submitDemoAnswer,
  type DemoPlayer,
} from '../lib/demoRoom'
import { play } from '../lib/sound'
import { formatClock, normalizeCode } from '../lib/utils'

function joinErrorMessage(error: string): string {
  if (error === 'room_not_found') return 'Không tìm thấy phòng thử này trên máy. Hãy kiểm tra lại mã phòng.'
  if (error === 'room_finished') return 'Ván chơi này đã kết thúc. Hãy chờ giáo viên mở phòng mới.'
  if (error === 'name_required') return 'Hãy nhập tên của em (1–20 ký tự).'
  return 'Không vào được phòng thử. Hãy thử lại.'
}

export default function DemoStudentRoom() {
  const { code } = useParams<{ code: string }>()
  const cleanCode = normalizeCode(code)
  const { room, refresh } = useDemoRoom(cleanCode || null)

  const [joinName, setJoinName] = useState(() => localStorage.getItem('hocvui.name') ?? '')
  const [playerId, setPlayerId] = useState<string | null>(() =>
    cleanCode ? getStoredDemoPlayerId(cleanCode) : null,
  )
  const [joining, setJoining] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Đổi mã phòng trên URL → đọc lại người chơi đã lưu của phòng đó.
  useEffect(() => {
    setPlayerId(cleanCode ? getStoredDemoPlayerId(cleanCode) : null)
    setNotice(null)
  }, [cleanCode])

  const me: DemoPlayer | null = playerId
    ? (room?.players.find(player => player.id === playerId) ?? null)
    : null
  const myAnswer = me && room && room.q_index >= 0
    ? (room.answers.find(answer => answer.player_id === me.id && answer.q_index === room.q_index) ?? null)
    : null

  const endsAt = room?.phase === 'question' ? room.question_ends_at : null
  const msLeft = useCountdown(endsAt, 0)
  const question = room && room.q_index >= 0 ? (room.questions[room.q_index] ?? null) : null

  function handleJoin(e: FormEvent) {
    e.preventDefault()
    if (!room) return
    const cleanName = joinName.trim().slice(0, 20)
    if (!cleanName) {
      setNotice('Hãy nhập tên của em (1–20 ký tự).')
      return
    }
    setJoining(true)
    setNotice(null)
    const result = joinDemoRoom(room.code, cleanName)
    setJoining(false)
    if ('error' in result) {
      setNotice(joinErrorMessage(result.error))
      return
    }
    localStorage.setItem('hocvui.name', cleanName)
    setPlayerId(result.player.id)
    play('join')
    refresh()
  }

  function handlePick(index: number) {
    if (!room || !me || myAnswer || submitting) return
    setSubmitting(true)
    setNotice(null)
    play('pick')
    const result = submitDemoAnswer(room.code, me.id, index)
    setSubmitting(false)
    if (!result.ok) {
      if (result.error === 'already_answered') setNotice('Em đã trả lời câu này rồi.')
      else if (result.error === 'too_late') setNotice('Đã hết giờ trả lời câu này.')
      else setNotice('Chưa gửi được đáp án. Hãy thử lại.')
      return
    }
    refresh()
  }

  // Âm thanh khi chuyển pha: đúng/sai sau công bố, nhạc kết thúc.
  const prevPhaseRef = useRef<string | null | undefined>(room?.phase)
  useEffect(() => {
    const prev = prevPhaseRef.current
    if (room?.phase === 'reveal' && prev === 'question') {
      if (myAnswer?.is_correct) play('correct')
      else if (myAnswer) play('wrong')
      else play('reveal')
    }
    if (room?.phase === 'finished' && prev !== 'finished') play('finish')
    prevPhaseRef.current = room?.phase
  }, [room?.phase, myAnswer])

  // Chọn nhanh bằng phím 1–4 khi đang ở pha trả lời.
  useEffect(() => {
    if (room?.phase !== 'question' || myAnswer || submitting || msLeft <= 0) return
    const onKey = (e: KeyboardEvent) => {
      const index = ['1', '2', '3', '4'].indexOf(e.key)
      if (index >= 0) {
        e.preventDefault()
        handlePick(index)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [room?.phase, myAnswer, submitting, msLeft <= 0])

  // ----- Phòng không tồn tại -----

  if (!room) {
    return (
      <PageShell>
        <ErrorCard
          title="Không tìm thấy phòng thử"
          message="Phòng có thể đã bị xóa, hoặc được tạo trên trình duyệt khác. Phòng thử chỉ dùng được trên cùng máy đã tạo phòng."
        />
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link to="/join" className={btnClasses('ghost')}>
            <ArrowLeft className="h-4 w-4" />
            Thử mã khác
          </Link>
          <Link to="/demo" className={btnClasses('ghost')}>
            Tạo phòng thử
          </Link>
        </div>
      </PageShell>
    )
  }

  // ----- Chưa vào phòng (chưa có tên trong phòng này) -----

  if (!me) {
    if (room.phase === 'finished') {
      return (
        <PageShell>
          <ErrorCard title="Ván chơi đã kết thúc" message="Phòng này đã đóng. Hãy chờ giáo viên mở phòng mới." />
          <p className="mt-4 text-center">
            <Link to="/" className={btnClasses('ghost')}>
              <ArrowLeft className="h-4 w-4" />
              Về trang chủ
            </Link>
          </p>
        </PageShell>
      )
    }
    return (
      <PageShell>
        <section className="mx-auto max-w-md fade-in">
          <h1 className="mb-2 text-center text-2xl font-black">
            Phòng <span className="font-mono tracking-widest">{room.code}</span>
          </h1>
          <p className="mb-6 text-center text-sm text-slate-500">Nhập tên của em để vào phòng.</p>
          <form
            onSubmit={handleJoin}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white/85 p-6 shadow-xl"
          >
            <input
              value={joinName}
              onChange={e => setJoinName(e.target.value)}
              maxLength={20}
              autoComplete="nickname"
              placeholder="Tên của em"
              disabled={joining}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg outline-none focus:border-indigo-500 disabled:opacity-50"
            />
            {notice ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {notice}
              </p>
            ) : null}
            <button type="submit" disabled={joining} className={btnClasses('primary', 'lg') + ' w-full'}>
              {joining ? 'Đang vào...' : 'Vào phòng'}
            </button>
          </form>
        </section>
      </PageShell>
    )
  }

  // ----- Đã vào phòng: render theo pha -----

  const players = room.players
  const myRank = players.findIndex(player => player.id === me.id) + 1

  return (
    <PageShell>
      <SoundToggle />

      {notice ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="underline">
            Đóng
          </button>
        </div>
      ) : null}

      {room.phase === 'lobby' ? (
        <section className="mx-auto max-w-2xl text-center fade-in">
          <p className="text-sm tracking-[0.3em] text-slate-500 uppercase">Mã phòng</p>
          <p className="my-4 font-mono text-6xl font-black tracking-[0.25em] sm:text-7xl">{room.code}</p>
          <p className="mb-6 flex flex-wrap items-center justify-center gap-2 text-lg">
            Chào <span className="font-bold text-indigo-600">{me.name}</span>!
            <span className="blink-soft inline-flex items-center gap-1 text-slate-500">
              <Hourglass className="h-4 w-4" />
              Chờ giáo viên bắt đầu...
            </span>
          </p>
          <PlayerChips players={players} meId={me.id} />
          <p className="mt-4 text-sm text-slate-500">{players.length} bạn đang trong phòng</p>
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
          {myAnswer ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-emerald-700">
              Đã gửi đáp án <strong>{LETTERS[myAnswer.choice]}</strong> — chờ cả lớp trả lời xong nhé!
            </p>
          ) : msLeft <= 0 ? (
            <p className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-amber-700">
              <TimerOff className="h-4 w-4" />
              Đã hết giờ — chờ thầy/cô công bố đáp án nhé!
            </p>
          ) : (
            <AnswerPad options={question.options} myChoice={null} onPick={handlePick} disabled={submitting} />
          )}
          {!myAnswer && msLeft > 0 ? (
            <p className="text-center text-xs text-slate-500">Mẹo: bấm phím 1–4 để chọn nhanh.</p>
          ) : null}
        </section>
      ) : null}

      {room.phase === 'reveal' && question ? (
        <section className="mx-auto max-w-3xl space-y-5 fade-in">
          <div className="text-center text-sm text-slate-500">
            Câu {room.q_index + 1}/{room.total_questions}
          </div>
          <QuestionBlock text={question.text} imageUrl={question.image_url} />
          <AnswerPad
            options={question.options}
            myChoice={myAnswer?.choice ?? null}
            correctIndex={question.correct_index}
          />
          {myAnswer ? (
            myAnswer.is_correct ? (
              <p className="pop-in rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-lg font-bold text-emerald-600">
                Chính xác! +{myAnswer.points} điểm
              </p>
            ) : (
              <p className="shake-soft rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-lg font-bold text-rose-600">
                Chưa đúng lần này, thử câu sau nhé!
              </p>
            )
          ) : (
            <p className="rounded-xl border border-slate-300 bg-white/85 px-4 py-3 text-center text-slate-600">
              Em chưa kịp trả lời câu này.
            </p>
          )}

          <div>
            <h3 className="mb-2 text-center text-sm font-semibold tracking-widest text-slate-500 uppercase">
              Bảng xếp hạng
            </h3>
            <Leaderboard players={players} meId={me.id} limit={5} />
          </div>
          <p className="blink-soft text-center text-sm text-slate-500">Chờ câu tiếp theo...</p>
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
          <p className="flex flex-wrap items-center justify-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-amber-600" />
            Em đạt <span className="font-black text-indigo-600">{me.score} điểm</span>
            {myRank > 0 ? <span>— hạng {myRank}/{players.length}</span> : null}
          </p>
          <Leaderboard players={players} meId={me.id} />
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/" className={btnClasses('ghost', 'lg')}>
              <ArrowLeft className="h-4 w-4" />
              Về trang chủ
            </Link>
            <Link to="/join" className={btnClasses('ghost', 'lg')}>
              Vào phòng khác
            </Link>
          </div>
        </section>
      ) : null}
    </PageShell>
  )
}
