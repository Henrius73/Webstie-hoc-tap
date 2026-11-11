// Form soạn 1 câu hỏi — dùng chung cho trình soạn của giáo viên (Supabase)
// và trình soạn luyện tập cục bộ (localStorage).
import { useState, type FormEvent } from 'react'
import { Btn, LETTERS } from './ui'
import type { QuestionInput } from '../types/db'

export function QuestionForm({
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
