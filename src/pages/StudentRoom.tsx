// Màn hình phòng chơi của học sinh: lobby → câu hỏi → công bố → podium.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { PartyPopper, TimerOff, Trophy } from 'lucide-react'
import { fetchRoomByCode, joinRoom, submitAnswer } from '../api/rooms'
import { AnswerPad } from '../components/AnswerPad'
import {
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
import { formatClock, normalizeCode } from '../lib/utils'

export default function StudentRoom() {
  const { code } = useParams<{ code: string }>()
  const { ensureAnonymous } = useAuth()
  const offset = useServerOffset()

  const [userId, setUserId] = useState<string | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [roomError, setRoomError] = useState<string | null>(null)

  const [joinName, setJoinName] = useState(() => localStorage.getItem('hocvui.name') ?? '')
  const [joining, setJoining] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Tạo phiên ẩn danh cho học sinh.
  useEffect(() => {
    let alive = true
    ensureAnonymous()
      .then(user => {
        if (alive) setUserId(user.id)
      })
      .catch(err => {
        if (alive) setSessionError(friendlyError(err))
      })
    return () => {
      alive = false
    }
  }, [ensureAnonymous])

  // Tìm phòng theo mã.
  useEffect(() => {
    if (!userId || !code) return
    let alive = true
    fetchRoomByCode(normalizeCode(code))
      .then(room => {
        if (!alive) return
        if (!room) setRoomError('room_not_found')
        else setRoomId(room.id)
      })
      .catch(err => {
        if (alive) setRoomError(friendlyError(err))
      })
    return () => {
      alive = false
    }
  }, [userId, code])

  const { snapshot, error, connected, refresh } = useRoom(roomId, userId)
  const room = snapshot?.room ?? null
  const me = snapshot?.me ?? null
  const myAnswer = snapshot?.myAnswer ?? null
  const msLeft = useCountdown(room?.phase === 'question' ? room.question_ends_at : null, offset)

  async function handleJoin(e: FormEvent) {
    e.preventDefault()
    if (!room) return
    const cleanName = joinName.trim().slice(0, 20)
    if (!cleanName) {
      setNotice('Hãy nhập tên của em (1–20 ký tự).')
      return
    }
    setJoining(true)
    setNotice(null)
    try {
      await joinRoom(room.code, cleanName)
      localStorage.setItem('hocvui.name', cleanName)
      await refresh()
    } catch (err) {
      setNotice(friendlyError(err))
    } finally {
      setJoining(false)
    }
  }

  async function handlePick(index: number) {
    if (!room || myAnswer || submitting) return
    setSubmitting(true)
    setNotice(null)
    play('pick')
    try {
      await submitAnswer(room.id, index)
      await refresh()
    } catch (err) {
      setNotice(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
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
        void handlePick(index)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [room?.phase, myAnswer, submitting, msLeft <= 0])

  // ----- Trạng thái lỗi / chờ -----

  if (sessionError || roomError) {
    return (
      <PageShell>
        <ErrorCard
          title="Không vào được phòng"
          message={friendlyError(sessionError ?? roomError)}
        />
        <p className="mt-4 text-center">
          <Link to="/join" className={btnClasses('ghost')}>
            Thử mã khác
          </Link>
        </p>
      </PageShell>
    )
  }

  if (!userId || (!roomId && !roomError)) {
    return (
      <PageShell>
        <Spinner label="Đang vào phòng..." />
      </PageShell>
    )
  }

  if (error && !room) {
    return (
      <PageShell>
        <ErrorCard message={error} onRetry={() => void refresh()} />
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

  // ----- Chưa vào phòng (chưa có tên trong phòng này) -----

  if (!me) {
    if (room.phase === 'finished') {
      return (
        <PageShell>
          <ErrorCard title="Ván chơi đã kết thúc" message="Phòng này đã đóng. Hãy chờ giáo viên mở phòng mới." />
          <p className="mt-4 text-center">
            <Link to="/" className={btnClasses('ghost')}>
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
          <p className="mb-6 text-center text-sm text-slate-400">Nhập tên của em để vào phòng.</p>
          <form
            onSubmit={handleJoin}
            className="space-y-4 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-6 shadow-xl"
          >
            <input
              value={joinName}
              onChange={e => setJoinName(e.target.value)}
              maxLength={20}
              autoComplete="nickname"
              placeholder="Tên của em"
              disabled={joining}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-lg outline-none focus:border-indigo-400 disabled:opacity-50"
            />
            {notice ? (
              <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
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

  const players = snapshot?.players ?? []
  const myRank = players.findIndex(player => player.id === me.id) + 1
  const question = room.question

  return (
    <PageShell>
      <ConnectionBadge connected={connected} />
      <SoundToggle />

      {notice ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="underline">
            Đóng
          </button>
        </div>
      ) : null}

      {room.phase === 'lobby' ? (
        <section className="mx-auto max-w-2xl text-center fade-in">
          <p className="text-sm tracking-[0.3em] text-slate-400 uppercase">Mã phòng</p>
          <p className="my-4 font-mono text-6xl font-black tracking-[0.25em] sm:text-7xl">{room.code}</p>
          <p className="mb-6 text-lg">
            Chào <span className="font-bold text-indigo-300">{me.name}</span>!{' '}
            <span className="blink-soft">Chờ giáo viên bắt đầu...</span>
          </p>
          <PlayerChips players={players} meId={me.id} />
          <p className="mt-4 text-sm text-slate-500">{players.length} bạn đang trong phòng</p>
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
          {myAnswer ? (
            <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-center text-emerald-200">
              Đã gửi đáp án <strong>{LETTERS[myAnswer.choice]}</strong> — chờ cả lớp trả lời xong nhé!
            </p>
          ) : msLeft <= 0 ? (
            <p className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-amber-200">
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
          <div className="text-center text-sm text-slate-400">
            Câu {room.q_index + 1}/{room.total_questions}
          </div>
          <QuestionBlock text={question.text} imageUrl={question.image_url} />
          <AnswerPad
            options={question.options}
            myChoice={myAnswer?.choice ?? null}
            correctIndex={room.correct_index}
          />
          {myAnswer ? (
            myAnswer.is_correct ? (
              <p className="pop-in flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-center text-lg font-bold text-emerald-300">
                <Trophy className="h-5 w-5" />
                Chính xác! +{myAnswer.points} điểm
              </p>
            ) : (
              <p className="shake-soft rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-center text-lg font-bold text-rose-300">
                Chưa đúng lần này, thử câu sau nhé!
              </p>
            )
          ) : (
            <p className="rounded-xl border border-slate-600 bg-slate-800/70 px-4 py-3 text-center text-slate-300">
              Em chưa kịp trả lời câu này.
            </p>
          )}

          <div>
            <h3 className="mb-2 text-center text-sm font-semibold tracking-widest text-slate-400 uppercase">
              Bảng xếp hạng
            </h3>
            <Leaderboard players={players} meId={me.id} limit={5} />
          </div>
          <p className="blink-soft text-center text-sm text-slate-400">Chờ câu tiếp theo...</p>
        </section>
      ) : null}

      {room.phase === 'finished' ? (
        <section className="mx-auto max-w-2xl space-y-6 text-center fade-in">
          <Confetti />
          <h1 className="flex items-center justify-center gap-3 text-3xl font-black">
            <PartyPopper className="h-8 w-8 text-amber-300" />
            Kết thúc ván chơi!
          </h1>
          <Podium players={players} />
          <p className="text-lg">
            Em đạt <span className="font-black text-indigo-300">{me.score} điểm</span>
            {myRank > 0 ? <> — hạng {myRank}/{players.length}</> : null}
          </p>
          <Leaderboard players={players} meId={me.id} />
          <Link to="/" className={btnClasses('ghost', 'lg')}>
            Về trang chủ
          </Link>
        </section>
      ) : null}
    </PageShell>
  )
}
