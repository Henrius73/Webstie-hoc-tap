// Trình soạn bộ câu hỏi: thêm/sửa/xóa/sắp xếp câu, nhập từ Excel, lưu, mở phòng.
// (Form soạn câu và khối nhập Excel nằm ở components/QuestionForm.tsx và ExcelImportSection.tsx.)
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Clock,
  FileSpreadsheet,
  Lock,
  Pencil,
  Plus,
  Rocket,
  Save,
  Trash2,
} from 'lucide-react'
import { createRoom } from '../api/rooms'
import { fetchQuiz, updateQuizSet } from '../api/quizzes'
import { ExcelImportSection } from '../components/ExcelImportSection'
import { QuestionForm } from '../components/QuestionForm'
import {
  Btn,
  EmptyState,
  ErrorCard,
  LETTERS,
  PageShell,
  Spinner,
  btnClasses,
  cardClasses,
  fieldClasses,
} from '../components/ui'
import { friendlyError } from '../lib/errors'
import { useAuth } from '../lib/auth'
import type { QuestionInput } from '../types/db'

export default function QuizEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [notOwner, setNotOwner] = useState(false)
  const [title, setTitle] = useState('')
  const [drafts, setDrafts] = useState<QuestionInput[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  // Cảnh báo khi rời trang (F5/đóng tab) trong khi còn thay đổi chưa lưu.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const { quiz, questions } = await fetchQuiz(id)
      // Bộ đề dùng chung: máy khác xem được nhưng không sửa được (RLS chỉ mở bảng câu hỏi cho chủ).
      if (user && quiz.owner_id !== user.id) {
        setNotOwner(true)
        setError(null)
        return
      }
      setNotOwner(false)
      setTitle(quiz.title)
      setDrafts(
        questions.map(question => ({
          text: question.text,
          options: [...question.options],
          correctIndex: question.correct_index,
          timeLimit: question.time_limit,
          imageUrl: question.image_url,
        })),
      )
      setError(null)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [id, user])

  useEffect(() => {
    void load()
  }, [load])

  function touch(next: QuestionInput[]) {
    setDrafts(next)
    setDirty(true)
    setNotice(null)
  }

  function addQuestion(question: QuestionInput) {
    touch([...drafts, question])
    setAdding(false)
  }

  function replaceQuestion(index: number, question: QuestionInput) {
    const next = [...drafts]
    next[index] = question
    touch(next)
    setEditingIndex(null)
  }

  function removeQuestion(index: number) {
    touch(drafts.filter((_, i) => i !== index))
    setEditingIndex(null)
  }

  function moveQuestion(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= drafts.length) return
    const next = [...drafts]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    touch(next)
  }

  async function handleSave() {
    if (!id) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await updateQuizSet(id, title, drafts)
      setDirty(false)
      setNotice('Đã lưu bộ câu hỏi.')
      await load()
      setDirty(false)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleOpenRoom() {
    if (!id) return
    if (dirty) {
      setNotice('Hãy bấm "Lưu" trước khi mở phòng.')
      return
    }
    if (!drafts.length) {
      setNotice('Bộ chưa có câu hỏi nào — thêm câu trước khi mở phòng.')
      return
    }
    setOpening(true)
    setError(null)
    try {
      const room = await createRoom(id)
      navigate(`/host/room/${room.id}`)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setOpening(false)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <Spinner label="Đang tải bộ câu hỏi..." />
      </PageShell>
    )
  }

  if (notOwner) {
    return (
      <PageShell>
        <section className="mx-auto max-w-xl space-y-4 text-center fade-in">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm">
            <Lock className="h-8 w-8" />
          </span>
          <h1 className="text-2xl font-black">Bộ câu hỏi này thuộc máy khác</h1>
          <p className="text-sm text-slate-500">
            Bộ đề đã được tạo trên một trình duyệt khác nên chỉ máy đó mới sửa/xóa được. Bạn vẫn mở phòng
            cho cả lớp bình thường từ thư viện.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/host" className={btnClasses('primary')}>
              <ArrowLeft className="h-4 w-4" />
              Về thư viện
            </Link>
          </div>
        </section>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="mb-6 flex items-center gap-3 fade-in">
        <button
          type="button"
          className={btnClasses('ghost')}
          onClick={() => {
            if (!dirty || window.confirm('Có thay đổi chưa lưu — vẫn rời khỏi trang?')) navigate('/host')
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Danh sách
        </button>
        <h1 className="truncate text-2xl font-black">Soạn bộ câu hỏi</h1>
      </div>

      <div className={`${cardClasses} mb-6 p-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={title}
            onChange={e => {
              setTitle(e.target.value)
              setDirty(true)
            }}
            maxLength={120}
            placeholder="Tên bộ câu hỏi"
            className={`${fieldClasses} flex-1 font-bold`}
          />
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => void handleSave()} disabled={saving || !drafts.length}>
              <Save className="h-4 w-4" />
              {saving ? 'Đang lưu...' : dirty ? 'Lưu*' : 'Lưu'}
            </Btn>
            <Btn onClick={() => void handleOpenRoom()} disabled={opening || !drafts.length}>
              <Rocket className="h-4 w-4" />
              {opening ? 'Đang mở...' : 'Mở phòng'}
            </Btn>
          </div>
        </div>
        {dirty ? (
          <p className="mt-2 text-xs text-amber-600">Có thay đổi chưa lưu (*)</p>
        ) : notice ? (
          <p className="mt-2 text-xs text-emerald-600">{notice}</p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            {drafts.length} câu hỏi · mỗi câu đúng 4 đáp án, chọn 1 đáp án đúng, thời gian 5–300 giây
          </p>
        )}
      </div>

      {error ? (
        <div className="mb-6">
          <ErrorCard message={error} />
        </div>
      ) : null}

      {adding ? (
        <section className="mb-6">
          <h2 className="mb-2 font-bold">Câu hỏi mới</h2>
          <QuestionForm submitLabel="Thêm câu hỏi" onSubmit={addQuestion} onCancel={() => setAdding(false)} />
        </section>
      ) : (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" />
              Thêm câu hỏi
            </Btn>
            <Btn variant="ghost" onClick={() => setImportOpen(open => !open)}>
              <FileSpreadsheet className="h-4 w-4" />
              Nhập từ Excel
            </Btn>
          </div>
          {importOpen ? (
            <ExcelImportSection
              onClose={() => setImportOpen(false)}
              onAdd={questions => {
                touch([...drafts, ...questions])
                setNotice(`Đã thêm ${questions.length} câu từ Excel.`)
              }}
            />
          ) : null}
        </div>
      )}

      {drafts.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="Chưa có câu hỏi nào"
          description="Bấm “Thêm câu hỏi” để soạn từng câu, hoặc nhập nhanh cả bộ từ tệp Excel."
        />
      ) : (
        <ol className="space-y-4">
          {drafts.map((question, index) =>
            editingIndex === index ? (
              <li key={index} className="rounded-2xl border border-indigo-300 bg-indigo-50 p-4">
                <QuestionForm
                  initial={question}
                  submitLabel="Lưu câu hỏi"
                  onSubmit={q => replaceQuestion(index, q)}
                  onCancel={() => setEditingIndex(null)}
                />
              </li>
            ) : (
              <li key={index} className={`${cardClasses} p-4`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">
                    Câu {index + 1}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <Btn variant="ghost" onClick={() => moveQuestion(index, -1)} disabled={index === 0} title="Đưa lên">
                      <ArrowUp className="h-4 w-4" />
                    </Btn>
                    <Btn
                      variant="ghost"
                      onClick={() => moveQuestion(index, 1)}
                      disabled={index === drafts.length - 1}
                      title="Đưa xuống"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Btn>
                    <Btn variant="ghost" onClick={() => setEditingIndex(index)}>
                      <Pencil className="h-4 w-4" />
                      Sửa
                    </Btn>
                    <Btn variant="danger" onClick={() => removeQuestion(index)} title="Xóa câu hỏi">
                      <Trash2 className="h-4 w-4" />
                    </Btn>
                  </div>
                </div>
                {question.imageUrl ? (
                  <img
                    src={question.imageUrl}
                    alt=""
                    className="mb-2 max-h-32 rounded-lg object-contain"
                    loading="lazy"
                  />
                ) : null}
                <p className="mb-2 font-semibold">{question.text}</p>
                <ul className="mb-2 grid gap-1.5 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => (
                    <li
                      key={optionIndex}
                      className={
                        optionIndex === question.correctIndex
                          ? 'rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm'
                          : 'rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600'
                      }
                    >
                      <span className="font-black">{LETTERS[optionIndex]}.</span> {option}
                      {optionIndex === question.correctIndex ? (
                        <Check className="ml-1 inline h-3.5 w-3.5 text-emerald-600" aria-label="Đáp án đúng" />
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  {question.timeLimit || 20} giây
                </p>
              </li>
            ),
          )}
        </ol>
      )}
    </PageShell>
  )
}
