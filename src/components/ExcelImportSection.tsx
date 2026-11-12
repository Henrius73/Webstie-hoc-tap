// Khối nhập câu hỏi từ tệp Excel — dùng chung cho trình soạn của giáo viên
// (Supabase) và trình soạn luyện tập cục bộ (localStorage).
import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react'
import {
  CheckCircle2,
  CircleAlert,
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react'
import { downloadExcelTemplate, MAX_EXCEL_BYTES, parseExcelFile, type ExcelParseResult } from '../lib/excel'
import { cx } from '../lib/utils'
import { Btn, cardClasses, LETTERS } from './ui'
import type { QuestionInput } from '../types/db'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ExcelImportSection({
  onAdd,
  onClose,
}: {
  onAdd: (questions: QuestionInput[]) => void
  onClose: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState(0)
  const [parsing, setParsing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [result, setResult] = useState<ExcelParseResult | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  function reset() {
    setFileName(null)
    setFileSize(0)
    setParsing(false)
    setResult(null)
    setFileError(null)
    setDragging(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleFile(file: File) {
    setFileName(file.name)
    setFileSize(file.size)
    setResult(null)
    setFileError(null)
    setParsing(true)
    try {
      setResult(await parseExcelFile(file))
    } catch {
      setFileError('Không đọc được tệp Excel. Hãy kiểm tra lại định dạng rồi thử lại.')
    } finally {
      setParsing(false)
    }
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ''
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  function handleZoneKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  async function handleDownloadTemplate() {
    setDownloading(true)
    setFileError(null)
    try {
      await downloadExcelTemplate()
    } catch {
      setFileError('Không tạo được tệp mẫu. Hãy thử lại hoặc dùng tệp Excel có sẵn.')
    } finally {
      setDownloading(false)
    }
  }

  function handleAdd() {
    if (!result || result.errors.length > 0 || result.questions.length === 0) return
    onAdd(result.questions)
    reset()
    onClose()
  }

  const hasErrors = Boolean(result && result.errors.length > 0)

  return (
    <section className={cx(cardClasses, 'mt-3 p-4 sm:p-5 fade-in')}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Nhập câu hỏi từ Excel
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Hỗ trợ .xlsx và .xls · tối đa {formatSize(MAX_EXCEL_BYTES)} · mỗi dòng một câu hỏi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="ghost" onClick={() => void handleDownloadTemplate()} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? 'Đang tạo...' : 'Tải tệp mẫu'}
          </Btn>
          <Btn variant="ghost" onClick={onClose} title="Đóng khối nhập Excel">
            <X className="h-4 w-4" />
            Đóng
          </Btn>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Chọn tệp Excel để nhập câu hỏi"
        onClick={() => inputRef.current?.click()}
        onKeyDown={handleZoneKey}
        onDragOver={e => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cx(
          'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-8 text-center outline-none transition',
          dragging
            ? 'border-indigo-300 bg-indigo-50'
            : 'border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50',
          'focus-visible:border-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-500/30',
        )}
      >
        {parsing ? (
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        ) : (
          <Upload className="h-8 w-8 text-indigo-600" />
        )}
        <p className="font-semibold">
          {parsing ? 'Đang đọc tệp...' : fileName ? fileName : 'Kéo tệp Excel vào đây'}
        </p>
        <p className="text-xs text-slate-500">
          {parsing
            ? 'Vui lòng chờ trong giây lát.'
            : fileName
              ? `${formatSize(fileSize)} · bấm để chọn tệp khác`
              : 'hoặc bấm để chọn tệp từ máy'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {fileError ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {fileError}
        </p>
      ) : null}

      {result && result.questions.length > 0 && !hasErrors ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Đọc được {result.questions.length} câu hỏi
            {result.sheetName ? <span className="font-normal text-emerald-700/70">· trang “{result.sheetName}”</span> : null}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {result.questions.slice(0, 3).map((question, index) => (
              <li key={index} className="truncate">
                <span className="font-semibold text-slate-800">Câu {index + 1}:</span> {question.text}
                <span className="text-slate-500">
                  {' '}
                  · đáp án {LETTERS[question.correctIndex]} · {question.timeLimit} giây
                </span>
              </li>
            ))}
            {result.questions.length > 3 ? (
              <li className="text-slate-500">… và {result.questions.length - 3} câu khác</li>
            ) : null}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn onClick={handleAdd}>
              <Plus className="h-4 w-4" />
              Thêm {result.questions.length} câu vào bộ đề
            </Btn>
            <Btn variant="ghost" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              Chọn tệp khác
            </Btn>
          </div>
        </div>
      ) : null}

      {hasErrors && result ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p className="mb-2 flex items-center gap-2 font-semibold">
            <CircleAlert className="h-4 w-4" />
            Tệp có {result.errors.length} dòng chưa hợp lệ
          </p>
          <ul className="list-inside list-disc space-y-1 text-xs">
            {result.errors.slice(0, 6).map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
          {result.errors.length > 6 ? (
            <p className="mt-2 text-xs">… và {result.errors.length - 6} lỗi khác.</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Btn variant="ghost" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              Chọn tệp khác
            </Btn>
            <span className="text-xs text-rose-700/80">
              Sửa các dòng lỗi trong tệp rồi chọn lại — chưa có câu nào được thêm.
            </span>
          </div>
        </div>
      ) : null}
    </section>
  )
}
