// Góc Luyện tập: bộ câu hỏi tự soạn lưu ngay trên trình duyệt — không cần mạng,
// không cần tài khoản, không đụng tới Supabase (xem lib/practiceStore.ts).
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { BookOpen, Copy, Gift, Layers, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { Btn, ErrorCard, PageShell, btnClasses } from '../components/ui'
import {
  createSet,
  deleteSet,
  duplicateSet,
  getResult,
  listSets,
  makeSampleSet,
  type LocalQuizSet,
} from '../lib/practiceStore'

export default function Practice() {
  const navigate = useNavigate()
  const [version, setVersion] = useState(0)
  const sets = useMemo(() => listSets(), [version])
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    const clean = title.trim().slice(0, 120)
    if (!clean) {
      setError('Hãy đặt tên cho bộ luyện tập mới.')
      return
    }
    const set = createSet(clean, [])
    navigate(`/practice/edit/${set.id}`)
  }

  function refresh() {
    setVersion(value => value + 1)
  }

  function handleDelete(set: LocalQuizSet) {
    if (!window.confirm(`Xóa bộ "${set.title}"? (${set.questions.length} câu — không thể hoàn tác)`)) return
    deleteSet(set.id)
    refresh()
  }

  function handleSample() {
    const set = makeSampleSet()
    navigate(`/practice/run/${set.id}`)
  }

  return (
    <PageShell>
      <section className="mb-8 text-center fade-in">
        <BookOpen className="mx-auto mb-3 h-12 w-12 text-indigo-300" />
        <h1 className="text-3xl font-black sm:text-4xl">Luyện tập</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
          Tự soạn bộ câu hỏi và luyện ngay trên máy này — kiểu đề thi thông thường, có xem lại từng câu và
          thẻ ghi nhớ. <span className="text-slate-500">Dữ liệu lưu trong trình duyệt, không cần mạng hay tài khoản.</span>
        </p>
      </section>

      {error ? (
        <div className="mb-6">
          <ErrorCard message={error} />
        </div>
      ) : null}

      <form onSubmit={handleCreate} className="mb-8 flex flex-col gap-3 sm:flex-row">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Tên bộ luyện tập mới (ví dụ: Từ vựng tiếng Anh — Unit 1)"
          className="flex-1 rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 outline-none focus:border-indigo-400"
        />
        <Btn type="submit">
          <Plus className="h-4 w-4" />
          Tạo bộ mới
        </Btn>
      </form>

      {sets.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/60 px-6 py-12 text-center">
          <p className="mb-4 text-slate-400">
            Chưa có bộ luyện tập nào. Tạo bộ mới phía trên, hoặc thử nhanh với bộ câu hỏi mẫu.
          </p>
          <Btn size="lg" onClick={handleSample}>
            <Gift className="h-4 w-4" />
            Dùng bộ câu hỏi mẫu (8 câu)
          </Btn>
        </div>
      ) : (
        <ul className="space-y-3">
          {sets.map(set => {
            const result = getResult(set.id)
            return (
              <li
                key={set.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{set.title}</p>
                  <p className="text-xs text-slate-400">
                    {set.questions.length} câu hỏi
                    {result
                      ? ` · lần gần nhất ${result.last.correct}/${result.last.total} · tốt nhất ${Math.round(
                          (result.best.correct / result.best.total) * 100,
                        )}%`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/practice/run/${set.id}`} className={btnClasses('primary')}>
                    <Play className="h-4 w-4" />
                    Luyện tập
                  </Link>
                  <Link to={`/practice/flash/${set.id}`} className={btnClasses('ghost')}>
                    <Layers className="h-4 w-4" />
                    Thẻ ghi nhớ
                  </Link>
                  <Link to={`/practice/edit/${set.id}`} className={btnClasses('ghost')}>
                    <Pencil className="h-4 w-4" />
                    Sửa
                  </Link>
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      duplicateSet(set.id)
                      refresh()
                    }}
                    title="Tạo bản sao"
                  >
                    <Copy className="h-4 w-4" />
                  </Btn>
                  <Btn variant="danger" onClick={() => handleDelete(set)} title="Xóa bộ luyện tập">
                    <Trash2 className="h-4 w-4" />
                  </Btn>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-10 text-center text-xs text-slate-500">
        Luyện tập dùng bộ câu hỏi riêng trên máy này — muốn chơi đua điểm cùng cả lớp, hãy dùng mã phòng của
        giáo viên.
      </p>
    </PageShell>
  )
}
