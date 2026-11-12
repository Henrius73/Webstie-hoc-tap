// Làm bài luyện tập cục bộ — tính năng kiểu trang trắc nghiệm thông thường:
// cấu hình (chấm ngay/cuối bài, số câu, xáo trộn, giới hạn thời gian) → làm bài
// → kết quả + xem lại từng câu + làm lại câu sai. Hoàn toàn chạy trên client.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Dumbbell,
  FileText,
  Flag,
  Layers,
  PartyPopper,
  Pencil,
  Play,
  RotateCcw,
  ThumbsUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { AnswerPad } from '../components/AnswerPad'
import {
  Btn,
  ErrorCard,
  LETTERS,
  PageShell,
  QuestionBlock,
  SoundToggle,
  TimerBar,
  btnClasses,
} from '../components/ui'
import { useCountdown } from '../hooks/useCountdown'
import { getSet, recordResult } from '../lib/practiceStore'
import { play } from '../lib/sound'
import { formatClock, shuffleArray } from '../lib/utils'
import type { QuestionInput } from '../types/db'

interface RunItem {
  text: string
  imageUrl: string | null
  options: string[]
  correctIndex: number
  timeLimit: number
  picked: number | null
  timedOut: boolean
  correct: boolean
}

type Stage = 'config' | 'run' | 'result'

function buildItem(question: QuestionInput, shuffleOptions: boolean): RunItem {
  let options = [...question.options]
  let correctIndex = question.correctIndex
  if (shuffleOptions) {
    const perm = shuffleArray([0, 1, 2, 3])
    options = perm.map(i => question.options[i])
    correctIndex = perm.indexOf(question.correctIndex)
  }
  return {
    text: question.text,
    imageUrl: question.imageUrl ?? null,
    options,
    correctIndex,
    timeLimit: question.timeLimit || 20,
    picked: null,
    timedOut: false,
    correct: false,
  }
}

export default function PracticeRun() {
  const { id } = useParams<{ id: string }>()
  const set = useMemo(() => (id ? getSet(id) : null), [id])

  const [stage, setStage] = useState<Stage>('config')
  const [items, setItems] = useState<RunItem[]>([])
  const [cursor, setCursor] = useState(0)
  const [runId, setRunId] = useState(0)

  // Tùy chọn làm bài.
  const [instant, setInstant] = useState(true)
  const [shuffleQuestions, setShuffleQuestions] = useState(true)
  const [shuffleOptions, setShuffleOptions] = useState(true)
  const [timed, setTimed] = useState(false)
  const [countChoice, setCountChoice] = useState<string>('all')

  const [deadline, setDeadline] = useState<number | null>(null)
  const endsAt = useMemo(() => (deadline ? new Date(deadline).toISOString() : null), [deadline])
  const msLeft = useCountdown(stage === 'run' && timed ? endsAt : null, 0)

  // Luôn tham chiếu dữ liệu mới nhất cho các hàm gọi trễ (hết giờ, tự chuyển câu).
  const itemsRef = useRef(items)
  const cursorRef = useRef(cursor)
  itemsRef.current = items
  cursorRef.current = cursor
  const autoTimerRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    },
    [],
  )

  // Đặt lại đồng hồ mỗi khi vào run mới hoặc sang câu mới.
  useEffect(() => {
    if (stage !== 'run') return
    const item = items[cursor]
    setDeadline(timed && item ? Date.now() + item.timeLimit * 1000 : null)
    // items đọc tại thời điểm chạy — không đưa vào deps để tránh đặt lại khi bấm chọn.
  }, [stage, runId, cursor, timed])

  const current = stage === 'run' ? items[cursor] : null
  const answered = !!current && (current.picked !== null || current.timedOut)

  function scheduleAdvance(delay: number) {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    autoTimerRef.current = window.setTimeout(() => {
      autoTimerRef.current = null
      advance()
    }, delay)
  }

  function finish() {
    const list = itemsRef.current
    const correct = list.filter(item => item.correct).length
    setStage('result')
    setDeadline(null)
    play('finish')
    if (id) recordResult(id, correct, list.length)
  }

  function advance() {
    if (stage !== 'run') return
    if (cursorRef.current + 1 >= itemsRef.current.length) {
      finish()
    } else {
      setCursor(cursorRef.current + 1)
    }
  }

  function pick(index: number) {
    if (stage !== 'run') return
    const item = itemsRef.current[cursorRef.current]
    if (!item || item.picked !== null || item.timedOut) return
    const correct = index === item.correctIndex
    const at = cursorRef.current
    setItems(prev => prev.map((it, i) => (i === at ? { ...it, picked: index, correct } : it)))
    if (instant) {
      play(correct ? 'correct' : 'wrong')
    } else {
      play('pick')
      scheduleAdvance(700)
    }
  }

  function handleTimeout() {
    if (stage !== 'run') return
    const item = itemsRef.current[cursorRef.current]
    if (!item || item.picked !== null || item.timedOut) return
    const at = cursorRef.current
    setItems(prev => prev.map((it, i) => (i === at ? { ...it, timedOut: true, correct: false } : it)))
    if (instant) {
      play('reveal')
    } else {
      scheduleAdvance(400)
    }
  }

  // Hết giờ: tự chuyển sang câu tiếp.
  useEffect(() => {
    if (stage !== 'run' || !timed || msLeft > 0) return
    handleTimeout()
  }, [msLeft])

  // Phím tắt: 1–4 chọn đáp án, Enter sang câu (khi đã chấm).
  useEffect(() => {
    if (stage !== 'run') return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A' || tag === 'SELECT') return
      if (e.key === 'Enter') {
        if (instant && answered) {
          e.preventDefault()
          advance()
        }
        return
      }
      const index = ['1', '2', '3', '4'].indexOf(e.key)
      if (index >= 0 && !answered) {
        e.preventDefault()
        pick(index)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function launch(nextItems: RunItem[]) {
    setItems(nextItems)
    setCursor(0)
    setRunId(value => value + 1)
    setStage('run')
  }

  function startFresh() {
    if (!set) return
    let pool = [...set.questions]
    if (shuffleQuestions) pool = shuffleArray(pool)
    const count = countChoice === 'all' ? pool.length : Math.min(Number(countChoice), pool.length)
    launch(pool.slice(0, count).map(question => buildItem(question, shuffleOptions)))
  }

  function retryWrong() {
    launch(
      itemsRef.current
        .filter(item => !item.correct)
        .map(item => ({ ...item, picked: null, timedOut: false, correct: false })),
    )
  }

  // ----- Sàng lọc -----

  if (!set) {
    return (
      <PageShell>
        <ErrorCard
          title="Không tìm thấy bộ luyện tập"
          message="Bộ này có thể đã bị xóa hoặc nằm trên trình duyệt khác."
        />
        <p className="mt-4 text-center">
          <Link to="/practice" className={btnClasses('ghost')}>
            <ArrowLeft className="h-4 w-4" />
            Danh sách luyện tập
          </Link>
        </p>
      </PageShell>
    )
  }

  if (set.questions.length === 0) {
    return (
      <PageShell>
        <ErrorCard title="Bộ chưa có câu hỏi" message="Hãy thêm câu hỏi trước khi luyện tập." />
        <p className="mt-4 text-center">
          <Link to={`/practice/edit/${set.id}`} className={btnClasses('primary')}>
            <Pencil className="h-4 w-4" />
            Soạn câu hỏi
          </Link>
        </p>
      </PageShell>
    )
  }

  const correctCount = items.filter(item => item.correct).length
  const wrongCount = items.length - correctCount
  const skippedCount = items.filter(item => item.timedOut).length
  const percent = items.length > 0 ? Math.round((correctCount / items.length) * 100) : 0

  const allCounts: Array<'all' | number> = ['all', 5, 10, 20]
  const countChoices: Array<'all' | number> = allCounts.filter(
    value => value === 'all' || value <= set.questions.length,
  )

  return (
    <PageShell>
      <SoundToggle />

      {/* ----- Cấu hình ----- */}
      {stage === 'config' ? (
        <section className="mx-auto max-w-xl space-y-6 fade-in">
          <div className="text-center">
            <p className="text-sm tracking-[0.3em] text-slate-500 uppercase">Luyện tập</p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">{set.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{set.questions.length} câu hỏi</p>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/85 p-5">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-600">Cách chấm điểm</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label
                  className={
                    'cursor-pointer rounded-xl border p-3 transition ' +
                    (instant ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300 bg-white')
                  }
                >
                  <input
                    type="radio"
                    name="mode"
                    className="hidden"
                    checked={instant}
                    onChange={() => setInstant(true)}
                  />
                  <span className="inline-flex items-center gap-1.5 font-bold">
                    <Zap className="h-4 w-4 text-amber-600" />
                    Chấm ngay
                  </span>
                  <p className="mt-1 text-xs text-slate-500">Biết đúng/sai sau mỗi câu, kiểu Kahoot.</p>
                </label>
                <label
                  className={
                    'cursor-pointer rounded-xl border p-3 transition ' +
                    (!instant ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300 bg-white')
                  }
                >
                  <input
                    type="radio"
                    name="mode"
                    className="hidden"
                    checked={!instant}
                    onChange={() => setInstant(false)}
                  />
                  <span className="inline-flex items-center gap-1.5 font-bold">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    Chấm cuối bài
                  </span>
                  <p className="mt-1 text-xs text-slate-500">Làm hết mới xem điểm, kiểu đề thi.</p>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-indigo-600"
                  checked={shuffleQuestions}
                  onChange={e => setShuffleQuestions(e.target.checked)}
                />
                Xáo trộn câu hỏi
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-indigo-600"
                  checked={shuffleOptions}
                  onChange={e => setShuffleOptions(e.target.checked)}
                />
                Xáo trộn đáp án
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-indigo-600"
                  checked={timed}
                  onChange={e => setTimed(e.target.checked)}
                />
                Giới hạn thời gian mỗi câu
              </label>
            </div>

            {countChoices.length > 1 ? (
              <label className="flex items-center gap-3 text-sm">
                <span className="text-slate-600">Số câu hỏi</span>
                <select
                  value={countChoice}
                  onChange={e => setCountChoice(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none focus:border-indigo-500"
                >
                  {countChoices.map(value => (
                    <option key={String(value)} value={String(value)}>
                      {value === 'all' ? `Tất cả (${set.questions.length} câu)` : `${value} câu`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="text-center">
            <Btn size="lg" onClick={startFresh}>
              <Play className="h-4 w-4" />
              Bắt đầu luyện tập
            </Btn>
            <p className="mt-2 text-xs text-slate-500">Bấm phím 1–4 để chọn, Enter để sang câu tiếp.</p>
          </div>

          <p className="text-center">
            <Link to="/practice" className={btnClasses('ghost')}>
              <ArrowLeft className="h-4 w-4" />
              Danh sách luyện tập
            </Link>
          </p>
        </section>
      ) : null}

      {/* ----- Làm bài ----- */}
      {stage === 'run' && current ? (
        <section className="mx-auto max-w-3xl space-y-5 fade-in">
          <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
            <span>
              Câu <span className="font-bold text-slate-800">{cursor + 1}</span>/{items.length}
            </span>
            <span>
              Đúng: <span className="font-bold text-emerald-600">{correctCount}</span> · Sai:{' '}
              <span className="font-bold text-rose-600">{items.filter(i => i.picked !== null && !i.correct).length}</span>
            </span>
          </div>

          {timed ? (
            <>
              <TimerBar msLeft={msLeft} totalMs={current.timeLimit * 1000} />
              <div className="text-center font-mono text-3xl font-black">{formatClock(msLeft)}</div>
            </>
          ) : (
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-indigo-500 transition-[width] duration-300"
                style={{ width: `${(cursor / items.length) * 100}%` }}
              />
            </div>
          )}

          <QuestionBlock text={current.text} imageUrl={current.imageUrl} />

          <AnswerPad
            options={current.options}
            myChoice={current.picked}
            correctIndex={instant && answered ? current.correctIndex : undefined}
            onPick={pick}
            disabled={false}
          />

          {answered && instant ? (
            current.picked !== null && current.correct ? (
              <p className="pop-in flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-lg font-bold text-emerald-600">
                <Check className="h-5 w-5" />
                Chính xác!
              </p>
            ) : current.timedOut ? (
              <p className="pop-in flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-lg font-bold text-amber-700">
                <Clock className="h-5 w-5" />
                Hết giờ! Đáp án đúng là {LETTERS[current.correctIndex]}.
              </p>
            ) : (
              <p className="shake-soft flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-lg font-bold text-rose-600">
                <X className="h-5 w-5" />
                Chưa đúng — đáp án đúng là {LETTERS[current.correctIndex]}.
              </p>
            )
          ) : null}

          {answered && !instant ? (
            <p className="rounded-xl border border-slate-300 bg-white/85 px-4 py-3 text-center text-sm text-slate-600">
              {current.timedOut
                ? 'Hết giờ — chuyển câu...'
                : `Đã chọn ${LETTERS[current.picked ?? 0]} — chấm điểm cuối bài.`}
            </p>
          ) : null}

          {answered && instant ? (
            <div className="text-center">
              <Btn size="lg" onClick={advance}>
                {cursor + 1 >= items.length ? (
                  <>
                    <Flag className="h-4 w-4" />
                    Xem kết quả
                  </>
                ) : (
                  <>
                    Tiếp theo
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Btn>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ----- Kết quả ----- */}
      {stage === 'result' ? (
        <section className="mx-auto max-w-3xl space-y-6 fade-in">
          <div className="rounded-2xl border border-slate-200 bg-white/85 p-8 text-center">
            {percent >= 90 ? (
              <Trophy className="mx-auto h-12 w-12 text-amber-600" />
            ) : percent >= 70 ? (
              <PartyPopper className="mx-auto h-12 w-12 text-amber-600" />
            ) : percent >= 50 ? (
              <ThumbsUp className="mx-auto h-12 w-12 text-indigo-600" />
            ) : (
              <Dumbbell className="mx-auto h-12 w-12 text-indigo-600" />
            )}
            <h1 className="mt-2 text-3xl font-black">
              {percent >= 90 ? 'Tuyệt vời!' : percent >= 70 ? 'Khá tốt!' : percent >= 50 ? 'Cố thêm nhé!' : 'Cần luyện thêm!'}
            </h1>
            <p className="mt-3 font-mono text-4xl font-black text-indigo-600">
              {correctCount}/{items.length}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {percent}% đúng{skippedCount > 0 ? ` · ${skippedCount} câu hết giờ/bỏ trống` : ''}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Btn size="lg" onClick={startFresh}>
              <RotateCcw className="h-4 w-4" />
              Làm lại toàn bộ
            </Btn>
            {wrongCount > 0 ? (
              <Btn size="lg" variant="ghost" onClick={retryWrong}>
                <AlertCircle className="h-4 w-4" />
                Làm lại câu sai ({wrongCount})
              </Btn>
            ) : null}
            <Link to={`/practice/flash/${set.id}`} className={btnClasses('ghost', 'lg')}>
              <Layers className="h-4 w-4" />
              Thẻ ghi nhớ
            </Link>
            <Link to="/practice" className={btnClasses('ghost', 'lg')}>
              <ArrowLeft className="h-4 w-4" />
              Danh sách
            </Link>
          </div>

          <div>
            <h2 className="mb-2 text-center text-sm font-semibold tracking-widest text-slate-500 uppercase">
              Xem lại từng câu
            </h2>
            <ol className="space-y-4">
              {items.map((item, index) => (
                <li
                  key={index}
                  className={
                    'rounded-2xl border p-4 ' +
                    (item.correct
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-rose-200 bg-rose-50')
                  }
                >
                  <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                    <span className="font-bold tracking-widest text-slate-600 uppercase">Câu {index + 1}</span>
                    <span
                      className={
                        'inline-flex items-center gap-1 ' +
                        (item.correct ? 'font-bold text-emerald-600' : 'font-bold text-rose-600')
                      }
                    >
                      {item.correct ? (
                        <>
                          <Check className="h-4 w-4" />
                          Đúng
                        </>
                      ) : item.timedOut ? (
                        <>
                          <Clock className="h-4 w-4" />
                          Hết giờ
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4" />
                          Sai
                        </>
                      )}
                    </span>
                  </div>
                  <p className="mb-2 font-semibold">{item.text}</p>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {item.options.map((option, optionIndex) => (
                      <li
                        key={optionIndex}
                        className={
                          'rounded-lg px-3 py-1.5 text-sm ' +
                          (optionIndex === item.correctIndex
                            ? 'border border-emerald-300 bg-emerald-100'
                            : 'bg-slate-100 text-slate-600')
                        }
                      >
                        <span className="font-black">{LETTERS[optionIndex]}.</span> {option}
                        {optionIndex === item.correctIndex ? (
                          <Check className="ml-1 inline h-3.5 w-3.5 text-emerald-600" aria-label="Đáp án đúng" />
                        ) : null}
                        {optionIndex === item.picked && optionIndex !== item.correctIndex ? (
                          <span className="ml-1 inline-flex items-center gap-1 text-rose-600">
                            <X className="h-3.5 w-3.5" />
                            (em chọn)
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}
    </PageShell>
  )
}
