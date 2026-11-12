// Góc Luyện tập: bộ câu hỏi tự soạn lưu ngay trên trình duyệt — không cần mạng,
// không cần tài khoản, không đụng tới Supabase (xem lib/practiceStore.ts).
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { BookOpen, Copy, Gift, Layers, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { Btn, EmptyState, ErrorCard, PageShell, btnClasses, cardClasses, fieldClasses } from '../components/ui'
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
        <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-600">
          <BookOpen className="h-7 w-7" />
        </span>
        <h1 className="text-3xl font-black sm:text-4xl">Luyện tập</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          Tự soạn bộ câu hỏi và luyện ngay trên máy này — kiểu đề thi thông thường, có xem lại từng câu và thẻ ghi
          nhớ. <span className="text-slate-500">Dữ liệu lưu trong trình duyệt, không cần mạng hay tài khoản.</span>
        </p>
      </section>

      {error ? (
        <div className="mb-6">
          <ErrorCard message={error} />
        </div>
      ) : null}

      <form onSubmit={handleCreate} className={`${cardClasses} mb-8 flex flex-col gap-3 p-4 sm:flex-row`}>
        <label className="flex-1">
          <span className="sr-only">Tên bộ luyện tập mới</span>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Tên bộ luyện tập mới (ví dụ: Từ vựng tiếng Anh — Unit 1)"
            className={`${fieldClasses} py-3`}
          />
        </label>
        <Btn type="submit">
          <Plus className="h-4 w-4" />
          Tạo bộ mới
        </Btn>
      </form>

      {sets.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Chưa có bộ luyện tập nào"
          description="Tạo bộ mới ở phía trên để tự soạn câu hỏi (hoặc nhập từ Excel), hay thử ngay với bộ câu hỏi mẫu."
        >
          <Btn size="lg" onClick={handleSample}>
            <Gift className="h-4 w-4" />
            Dùng bộ câu hỏi mẫu (8 câu)
          </Btn>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {sets.map(set => {
            const result = getResult(set.id)
            return (
              <li
                key={set.id}
                className={`${cardClasses} flex flex-wrap items-center gap-3 p-4 transition hover:border-indigo-300 hover:shadow-md`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{set.title}</p>
                  <p className="text-xs text-slate-500">
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
