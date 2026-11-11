// Trình soạn bộ luyện tập cục bộ — tự động lưu vào localStorage sau mỗi thay đổi
// (không cần nút "Lưu" như bản Supabase của giáo viên).
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Clock,
  FileSpreadsheet,
  Pencil,
  Play,
  Plus,
  Trash2,
} from 'lucide-react'
import { ExcelImportSection } from '../components/ExcelImportSection'
import { QuestionForm } from '../components/QuestionForm'
import { Btn, EmptyState, ErrorCard, LETTERS, PageShell, btnClasses, cardClasses, fieldClasses } from '../components/ui'
import { getSet, updateSet } from '../lib/practiceStore'
import type { QuestionInput } from '../types/db'

export default function PracticeEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const initial = id ? getSet(id) : null

  const [missing] = useState(() => !initial)
  const [title, setTitle] = useState(() => initial?.title ?? '')
  const [questions, setQuestions] = useState<QuestionInput[]>(() => initial?.questions ?? [])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  if (missing) {
    return (
      <PageShell>
        <ErrorCard title="Không tìm thấy bộ luyện tập" message="Bộ này có thể đã bị xóa hoặc nằm trên trình duyệt khác." />
        <p className="mt-4 text-center">
          <Link to="/practice" className={btnClasses('ghost')}>
            <ArrowLeft className="h-4 w-4" />
            Danh sách luyện tập
          </Link>
        </p>
      </PageShell>
    )
  }

  // Mọi thay đổi ghi ngay vào localStorage.
  function save(nextTitle: string, nextQuestions: QuestionInput[]) {
    setTitle(nextTitle)
    setQuestions(nextQuestions)
    if (id) updateSet(id, { title: nextTitle, questions: nextQuestions })
  }

  function addQuestion(question: QuestionInput) {
    save(title, [...questions, question])
    setAdding(false)
  }

  function replaceQuestion(index: number, question: QuestionInput) {
    const next = [...questions]
    next[index] = question
    save(title, next)
    setEditingIndex(null)
  }

  function removeQuestion(index: number) {
    save(title, questions.filter((_, i) => i !== index))
    setEditingIndex(null)
  }

  function moveQuestion(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= questions.length) return
    const next = [...questions]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    save(title, next)
  }

  return (
    <PageShell>
      <div className="mb-6 flex items-center gap-3 fade-in">
        <Link to="/practice" className={btnClasses('ghost')}>
          <ArrowLeft className="h-4 w-4" />
          Luyện tập
        </Link>
        <h1 className="truncate text-2xl font-black">Soạn bộ luyện tập</h1>
      </div>

      <div className={`${cardClasses} mb-6 p-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={title}
            onChange={e => save(e.target.value, questions)}
            maxLength={120}
            placeholder="Tên bộ luyện tập"
            className={`${fieldClasses} flex-1 font-bold`}
          />
          <Btn
            onClick={() => navigate(`/practice/run/${id}`)}
            disabled={!questions.length}
            className="sm:ml-2"
          >
            <Play className="h-4 w-4" />
            Luyện tập ngay
          </Btn>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {questions.length} câu hỏi · tự động lưu trên máy này · mỗi câu đúng 4 đáp án, chọn 1 đáp án đúng
        </p>
      </div>

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
              onAdd={imported => save(title, [...questions, ...imported])}
            />
          ) : null}
        </div>
      )}

      {questions.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="Chưa có câu hỏi nào"
          description="Bấm “Thêm câu hỏi” để soạn từng câu, hoặc nhập nhanh cả bộ từ tệp Excel."
        />
      ) : (
        <ol className="space-y-4">
          {questions.map((question, index) =>
            editingIndex === index ? (
              <li key={index} className="rounded-2xl border border-indigo-400/50 bg-indigo-500/10 p-4">
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
                  <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                    Câu {index + 1}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <Btn variant="ghost" onClick={() => moveQuestion(index, -1)} disabled={index === 0} title="Đưa lên">
                      <ArrowUp className="h-4 w-4" />
                    </Btn>
                    <Btn
                      variant="ghost"
                      onClick={() => moveQuestion(index, 1)}
                      disabled={index === questions.length - 1}
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
                          ? 'rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-3 py-1.5 text-sm'
                          : 'rounded-lg bg-slate-900/60 px-3 py-1.5 text-sm text-slate-300'
                      }
                    >
                      <span className="font-black">{LETTERS[optionIndex]}.</span> {option}
                      {optionIndex === question.correctIndex ? (
                        <Check className="ml-1 inline h-3.5 w-3.5 text-emerald-300" aria-label="Đáp án đúng" />
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
