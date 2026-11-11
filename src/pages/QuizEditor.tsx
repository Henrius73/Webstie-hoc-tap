// Trình soạn bộ câu hỏi: thêm/sửa/xóa/sắp xếp câu, lưu, mở phòng.
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { createRoom } from '../api/rooms'
import { fetchQuiz, updateQuizSet } from '../api/quizzes'
import { Btn, ErrorCard, LETTERS, PageShell, Spinner, btnClasses } from '../components/ui'
import { friendlyError } from '../lib/errors'
import type { QuestionInput } from '../types/db'

export default function QuizEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [drafts, setDrafts] = useState<QuestionInput[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const { quiz, questions } = await fetchQuiz(id)
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
  }, [id])

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

  return (
    <PageShell>
      <div className="mb-6 flex items-center gap-3 fade-in">
        <Link to="/host" className={btnClasses('ghost')}>
          ← Danh sách
        </Link>
        <h1 className="truncate text-2xl font-black">Soạn bộ câu hỏi</h1>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={title}
            onChange={e => {
              setTitle(e.target.value)
              setDirty(true)
            }}
            maxLength={120}
            placeholder="Tên bộ câu hỏi"
            className="flex-1 rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 font-bold outline-none focus:border-indigo-400"
          />
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => void handleSave()} disabled={saving || !drafts.length}>
              {saving ? 'Đang lưu...' : dirty ? '💾 Lưu*' : '💾 Lưu'}
            </Btn>
            <Btn onClick={() => void handleOpenRoom()} disabled={opening || !drafts.length}>
              {opening ? 'Đang mở...' : '🚀 Mở phòng'}
            </Btn>
          </div>
        </div>
        {dirty ? (
          <p className="mt-2 text-xs text-amber-300">Có thay đổi chưa lưu (*)</p>
        ) : notice ? (
          <p className="mt-2 text-xs text-emerald-300">{notice}</p>
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
        <Btn onClick={() => setAdding(true)} className="mb-6">
          + Thêm câu hỏi
        </Btn>
      )}

      {drafts.length === 0 ? (
        <p className="rounded-2xl border border-slate-700/60 bg-slate-800/60 px-6 py-10 text-center text-slate-400">
          Chưa có câu hỏi. Bấm "Thêm câu hỏi" để bắt đầu soạn.
        </p>
      ) : (
        <ol className="space-y-4">
          {drafts.map((question, index) =>
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
              <li key={index} className="rounded-2xl border border-slate-700/60 bg-slate-800/70 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                    Câu {index + 1}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <Btn variant="ghost" onClick={() => moveQuestion(index, -1)} disabled={index === 0}>
                      ↑
                    </Btn>
                    <Btn
                      variant="ghost"
                      onClick={() => moveQuestion(index, 1)}
                      disabled={index === drafts.length - 1}
                    >
                      ↓
                    </Btn>
                    <Btn variant="ghost" onClick={() => setEditingIndex(index)}>
                      ✏️ Sửa
                    </Btn>
                    <Btn variant="danger" onClick={() => removeQuestion(index)}>
                      🗑
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
                      {optionIndex === question.correctIndex ? ' ✓' : ''}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500">⏱ {question.timeLimit || 20} giây</p>
              </li>
            ),
          )}
        </ol>
      )}
    </PageShell>
  )
}

// ----- Form soạn 1 câu hỏi -----

function QuestionForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: QuestionInput
  submitLabel: string
  onSubmit: (question: QuestionInput) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(initial?.text ?? '')
  const [options, setOptions] = useState<string[]>(
    initial?.options?.length === 4 ? [...initial.options] : ['', '', '', ''],
  )
  const [correctIndex, setCorrectIndex] = useState(initial?.correctIndex ?? 0)
  const [timeLimit, setTimeLimit] = useState(String(initial?.timeLimit ?? 20))
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const cleanText = text.trim()
    if (!cleanText) {
      setError('Hãy nhập nội dung câu hỏi.')
      return
    }
    const cleanOptions = options.map(option => option.trim())
    if (cleanOptions.some(option => !option)) {
      setError('Cần đủ 4 đáp án, không để trống.')
      return
    }
    const rawLimit = Math.round(Number(timeLimit) || 0)
    onSubmit({
      text: cleanText,
      options: cleanOptions,
      correctIndex,
      timeLimit: rawLimit >= 5 ? Math.min(300, rawLimit) : 20,
      imageUrl: imageUrl.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Nội dung câu hỏi</span>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Ví dụ: 25 + 17 bằng bao nhiêu?"
          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 outline-none focus:border-indigo-400"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-slate-300">
          4 đáp án — chọn ô tròn cạnh đáp án đúng
        </legend>
        {options.map((option, index) => (
          <label key={index} className="flex items-center gap-3">
            <input
              type="radio"
              name={`correct-${initial?.text ?? 'new'}`}
              checked={correctIndex === index}
              onChange={() => setCorrectIndex(index)}
              className="h-5 w-5 shrink-0 accent-emerald-400"
              aria-label={`Đáp án ${LETTERS[index]} đúng`}
            />
            <span className="w-5 shrink-0 text-center font-black text-slate-400">{LETTERS[index]}</span>
            <input
              value={option}
              onChange={e => {
                const next = [...options]
                next[index] = e.target.value
                setOptions(next)
              }}
              maxLength={200}
              placeholder={index === 0 ? 'Đáp án thứ nhất' : `Đáp án ${LETTERS[index]}`}
              className="flex-1 rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 outline-none focus:border-indigo-400"
            />
          </label>
        ))}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-300">Thời gian (giây, 5–300)</span>
          <input
            type="number"
            min={5}
            max={300}
            value={timeLimit}
            onChange={e => setTimeLimit(e.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 outline-none focus:border-indigo-400"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-300">Ảnh (URL, không bắt buộc)</span>
          <input
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            maxLength={1200}
            placeholder="https://..."
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 outline-none focus:border-indigo-400"
          />
        </label>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Btn type="submit">{submitLabel}</Btn>
        <Btn type="button" variant="ghost" onClick={onCancel}>
          Hủy
        </Btn>
      </div>
    </form>
  )
}
