// Thẻ ghi nhớ (flashcards) cho bộ luyện tập cục bộ: xem câu hỏi → lật thẻ xem
// đáp án → đánh dấu "biết rồi / chưa nhớ". Không đụng database.
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Check, Layers, Pencil, PartyPopper, RotateCcw, X } from 'lucide-react'
import { Btn, ErrorCard, LETTERS, PageShell, btnClasses } from '../components/ui'
import { getSet } from '../lib/practiceStore'
import { play } from '../lib/sound'
import { shuffleArray } from '../lib/utils'

export default function PracticeFlash() {
  const { id } = useParams<{ id: string }>()
  const set = useMemo(() => (id ? getSet(id) : null), [id])

  // Hàng thẻ đang chờ: mỗi thẻ chỉ tới câu hỏi gốc trong bộ đề.
  const [deck, setDeck] = useState<number[]>([])
  const [flipped, setFlipped] = useState(false)
  const [started, setStarted] = useState(false)
  const [shuffle, setShuffle] = useState(true)
  const [knownCount, setKnownCount] = useState(0)

  // Dựng bộ thẻ khi vào trang hoặc bấm "luyện lại từ đầu" (started về false).
  useEffect(() => {
    if (started) return
    setFlipped(false)
    setKnownCount(0)
    if (set) {
      const indices = set.questions.map((_, i) => i)
      setDeck(shuffle ? shuffleArray(indices) : indices)
    }
  }, [started, set, shuffle])

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
        <ErrorCard title="Bộ chưa có câu hỏi" message="Hãy thêm câu hỏi trước khi dùng thẻ ghi nhớ." />
        <p className="mt-4 text-center">
          <Link to={`/practice/edit/${set.id}`} className={btnClasses('primary')}>
            <Pencil className="h-4 w-4" />
            Soạn câu hỏi
          </Link>
        </p>
      </PageShell>
    )
  }

  const current = deck.length > 0 ? set.questions[deck[0]] : null

  function flip() {
    if (!current || flipped) return
    setFlipped(true)
    play('pick')
  }

  function markKnown() {
    if (!flipped) return
    setDeck(prev => prev.slice(1))
    setFlipped(false)
    setKnownCount(value => value + 1)
    play('correct')
  }

  function markAgain() {
    if (!flipped) return
    // Đưa thẻ này xuống cuối hàng để lặp lại sau.
    setDeck(prev => [...prev.slice(1), prev[0]])
    setFlipped(false)
    play('wrong')
  }

  function restart() {
    setStarted(false)
  }

  // Phím tắt: Space lật thẻ, 1 = chưa nhớ, 2 = biết rồi.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A' || tag === 'SELECT') return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        flip()
      } else if (e.key === '1') {
        e.preventDefault()
        markAgain()
      } else if (e.key === '2') {
        e.preventDefault()
        markKnown()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <PageShell>
      <section className="mx-auto max-w-2xl space-y-6">
        <div className="text-center fade-in">
          <p className="text-sm tracking-[0.3em] text-slate-500 uppercase">Thẻ ghi nhớ</p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">{set.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {started ? `Còn ${deck.length} thẻ · đã thuộc ${knownCount}` : `${set.questions.length} thẻ`}
          </p>
        </div>

        {!started ? (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/85 p-6 text-center">
            <p className="text-sm text-slate-600">
              Xem câu hỏi, tự nhủ đáp án, rồi lật thẻ để kiểm tra. Thẻ nào "chưa nhớ" sẽ quay lại cuối hàng.
            </p>
            <label className="flex items-center justify-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-indigo-600"
                checked={shuffle}
                onChange={e => setShuffle(e.target.checked)}
              />
              Xáo trộn thẻ
            </label>
            <Btn size="lg" onClick={() => setStarted(true)}>
              <Layers className="h-4 w-4" />
              Bắt đầu
            </Btn>
          </div>
        ) : deck.length === 0 ? (
          <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <PartyPopper className="mx-auto mb-2 h-12 w-12 text-amber-600" />
            <h2 className="text-2xl font-black">Bạn đã thuộc hết {knownCount} thẻ!</h2>
            <div className="flex flex-wrap justify-center gap-3">
              <Btn onClick={() => restart()}>
                <RotateCcw className="h-4 w-4" />
                Luyện lại từ đầu
              </Btn>
              <Link to="/practice" className={btnClasses('ghost')}>
                <ArrowLeft className="h-4 w-4" />
                Danh sách
              </Link>
            </div>
          </div>
        ) : current ? (
          <div className="space-y-4">
            <div
              onClick={flip}
              className="cursor-pointer select-none rounded-2xl border border-slate-200 bg-white/90 p-8 text-center shadow-xl transition hover:border-indigo-300"
            >
              {flipped ? (
                <div className="pop-in">
                  <p className="mb-2 text-xs font-semibold tracking-widest text-emerald-600 uppercase">
                    Đáp án đúng
                  </p>
                  <p className="text-2xl font-black text-emerald-700">
                    {LETTERS[current.correctIndex]}. {current.options[current.correctIndex]}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-widest text-slate-500 uppercase">
                    Câu hỏi — chớp rồi mới lật
                  </p>
                  <p className="text-xl font-bold sm:text-2xl">{current.text}</p>
                  <p className="mt-6 text-xs text-slate-500">Bấm vào thẻ (hoặc phím Space) để lật</p>
                </div>
              )}
            </div>

            {flipped ? (
              <div className="flex flex-wrap justify-center gap-3">
                <Btn size="lg" variant="danger" onClick={markAgain}>
                  <X className="h-4 w-4" />
                  Chưa nhớ (1)
                </Btn>
                <Btn size="lg" onClick={markKnown}>
                  <Check className="h-4 w-4" />
                  Biết rồi (2)
                </Btn>
              </div>
            ) : null}
          </div>
        ) : null}

        {started ? (
          <p className="text-center text-sm text-slate-500">
            <button type="button" className="underline" onClick={() => restart()}>
              Luyện lại từ đầu
            </button>
            {' · '}
            <Link to="/practice" className="underline">
              Danh sách luyện tập
            </Link>
          </p>
        ) : null}
      </section>
    </PageShell>
  )
}
