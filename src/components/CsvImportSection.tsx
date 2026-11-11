// Khối nhập câu hỏi từ CSV / bảng dán Excel — dùng chung cho trình soạn của
// giáo viên (Supabase) và trình soạn luyện tập cục bộ (localStorage).
import { useState, type ChangeEvent } from 'react'
import { Download, FileText, Plus, X } from 'lucide-react'
import { parseCsvQuestions } from '../lib/csv'
import { Btn, btnClasses } from './ui'
import type { QuestionInput } from '../types/db'

export function CsvImportSection({ onAdd }: { onAdd: (questions: QuestionInput[]) => void }) {
  const [open, setOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCsvText(String(reader.result ?? ''))
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  function handleImport() {
    const { questions, errors } = parseCsvQuestions(csvText)
    if (errors.length > 0) {
      setError(errors.slice(0, 5).join(' '))
      return
    }
    if (!questions.length) {
      setError('Không đọc được câu hỏi nào từ dữ liệu này.')
      return
    }
    setError(null)
    onAdd(questions)
    setCsvText('')
    setOpen(false)
  }

  return (
    <div className="mb-6">
      <Btn variant="ghost" onClick={() => setOpen(value => !value)}>
        <Download className="h-4 w-4" />
        Nhập từ CSV / Excel
      </Btn>

      {open ? (
        <section className="mt-3 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-4">
          <h2 className="mb-2 font-bold">Nhập câu hỏi từ CSV / bảng Excel</h2>
          <p className="mb-3 text-xs text-slate-400">
            Mỗi dòng một câu:{' '}
            <code className="font-mono">câu hỏi, A, B, C, D, đáp án đúng (A–D hoặc 1–4), thời gian giây</code>. Thời gian
            không bắt buộc (mặc định 20 giây). Có thể dán trực tiếp bảng từ Excel hoặc chọn tệp .csv.
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className={btnClasses('ghost') + ' cursor-pointer'}>
              <FileText className="h-4 w-4" />
              Chọn tệp .csv
              <input type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={handleFile} />
            </label>
            <Btn onClick={handleImport} disabled={!csvText.trim()}>
              <Plus className="h-4 w-4" />
              Thêm vào bộ đề
            </Btn>
            <Btn variant="ghost" onClick={() => setCsvText('')} disabled={!csvText}>
              <X className="h-4 w-4" />
              Xóa dữ liệu dán
            </Btn>
          </div>
          <textarea
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            rows={6}
            placeholder={'25 + 17 bằng bao nhiêu?,40,41,42,43,C,20\n"Nước sôi bao nhiêu độ C?",90,100,110,120,B,15'}
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 font-mono text-sm outline-none focus:border-indigo-400"
          />
          {error ? (
            <p className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
