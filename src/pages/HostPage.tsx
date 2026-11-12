// Trang giáo viên: quản lý bộ câu hỏi lưu trên Supabase + phòng đang mở.
// Không cần tài khoản: app tự tạo phiên ẩn danh gắn với trình duyệt này.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { BookOpen, Database, Pencil, Plus, Presentation, Rocket, Trash2, Undo2 } from 'lucide-react'
import { createRoom, fetchActiveRooms, type ActiveRoom } from '../api/rooms'
import { createQuizSet, deleteQuizSet, listQuizzes, type QuizSummary } from '../api/quizzes'
import {
  Btn,
  EmptyState,
  ErrorCard,
  PageShell,
  Spinner,
  btnClasses,
  cardClasses,
  fieldClasses,
  sectionLabelClasses,
} from '../components/ui'
import { useAuth } from '../lib/auth'
import { friendlyError } from '../lib/errors'
import { isConfigured } from '../lib/supabase'

export default function HostPage() {
  const { ready, user, ensureAnonymous } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const askedRef = useRef(false)

  // Tự tạo phiên ẩn danh để lưu bộ câu hỏi lên Supabase mà không cần đăng nhập.
  useEffect(() => {
    if (!isConfigured || !ready || user || askedRef.current) return
    askedRef.current = true
    setPreparing(true)
    ensureAnonymous()
      .catch(err => setError(friendlyError(err)))
      .finally(() => setPreparing(false))
  }, [ready, user, ensureAnonymous])

  if (!isConfigured) {
    // Chưa cấu hình Supabase → dùng chế độ chơi thử cục bộ.
    return <Navigate to="/demo" replace />
  }

  if (error) {
    return (
      <PageShell>
        <ErrorCard message={error} onRetry={() => location.reload()} />
      </PageShell>
    )
  }

  if (!ready || preparing || !user) {
    return (
      <PageShell>
        <Spinner label="Đang chuẩn bị chỗ lưu bộ câu hỏi..." />
      </PageShell>
    )
  }

  return <HostDashboard />
}

// ----- Nhãn pha cho phòng đang mở -----

function roomPhaseLabel(room: ActiveRoom): string {
  if (room.phase === 'lobby') return 'Đang chờ học sinh'
  if (room.phase === 'question') return `Đang hỏi câu ${room.qIndex + 1}/${room.totalQuestions}`
  return `Đang công bố câu ${room.qIndex + 1}/${room.totalQuestions}`
}

// ----- Bảng điều khiển -----

function HostDashboard() {
  const navigate = useNavigate()
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([])

  const load = useCallback(async () => {
    try {
      setQuizzes(await listQuizzes())
      setError(null)
    } catch (err) {
      setError(friendlyError(err))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Phòng đang mở: cập nhật nhẹ mỗi 5 giây (học sinh vào phòng, pha đổi...).
  const loadRooms = useCallback(async () => {
    try {
      setActiveRooms(await fetchActiveRooms())
    } catch {
      // giữ danh sách cũ, không đè lỗi của phần bộ câu hỏi
    }
  }, [])

  useEffect(() => {
    void loadRooms()
    const timer = setInterval(() => void loadRooms(), 5000)
    return () => clearInterval(timer)
  }, [loadRooms])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    const title = newTitle.trim().slice(0, 120)
    if (!title) {
      setError('Hãy đặt tên cho bộ câu hỏi mới.')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const id = await createQuizSet(title, [])
      navigate(`/host/quiz/${id}`)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setCreating(false)
    }
  }

  async function handleStartRoom(quizId: string) {
    // Cảnh báo nếu bộ này đã có phòng đang mở.
    const openRoom = activeRooms.find(room => room.quizId === quizId)
    if (openRoom && !window.confirm(`Bộ này đã có phòng đang mở (mã ${openRoom.code}). Tạo thêm phòng mới?`)) {
      return
    }
    setBusyId(quizId)
    setError(null)
    try {
      const room = await createRoom(quizId)
      navigate(`/host/room/${room.id}`)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(quiz: QuizSummary) {
    if (!window.confirm(`Xóa bộ "${quiz.title}"? (${quiz.count} câu — không thể hoàn tác)`)) return
    setBusyId(quiz.id)
    setError(null)
    try {
      await deleteQuizSet(quiz.id)
      await load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageShell>
      <header className={`${cardClasses} mb-4 flex flex-wrap items-start justify-between gap-4 p-5 fade-in`}>
        <div>
          <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-indigo-600 uppercase">
            <Presentation className="h-4 w-4" />
            Khu vực giáo viên
          </p>
          <h1 className="text-2xl font-black sm:text-3xl">Bộ câu hỏi của bạn</h1>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
            <Database className="h-4 w-4 text-emerald-600" />
            Đã lưu trên Supabase
          </p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          Không cần tài khoản
        </span>
      </header>

      <p className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        Bộ câu hỏi gắn với trình duyệt này (phiên ẩn danh). Dùng cùng trình duyệt để mở lại; xóa dữ liệu
        trình duyệt sẽ mất quyền truy cập các bộ đã tạo.
      </p>

      {error ? (
        <div className="mb-6">
          <ErrorCard message={error} onRetry={() => void load()} />
        </div>
      ) : null}

      <form onSubmit={handleCreate} className={`${cardClasses} mb-8 flex flex-col gap-3 p-4 sm:flex-row`}>
        <label className="flex-1">
          <span className="sr-only">Tên bộ câu hỏi mới</span>
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            maxLength={120}
            placeholder="Tên bộ câu hỏi mới (ví dụ: Toán lớp 5 — phép cộng)"
            disabled={creating}
            className={`${fieldClasses} py-3`}
          />
        </label>
        <Btn type="submit" disabled={creating}>
          <Plus className="h-4 w-4" />
          {creating ? 'Đang tạo...' : 'Tạo bộ mới'}
        </Btn>
      </form>

      {activeRooms.length > 0 ? (
        <section className="mb-8">
          <h2 className={`${sectionLabelClasses} mb-3`}>
            Phòng đang mở
          </h2>
          <ul className="space-y-3">
            {activeRooms.map(room => (
              <li
                key={room.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4"
              >
                <span className="font-mono text-2xl font-black tracking-[0.2em] text-indigo-700">
                  {room.code}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{room.quizTitle}</p>
                  <p className="text-xs text-slate-500">
                    {room.playerCount} học sinh · {roomPhaseLabel(room)} · mở lúc{' '}
                    {new Date(room.createdAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <Link to={`/host/room/${room.id}`} className={btnClasses('primary')}>
                  <Undo2 className="h-4 w-4" />
                  Vào phòng
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className={`${sectionLabelClasses} mb-3`}>Bộ câu hỏi đã tạo</h2>
        {quizzes === null ? (
          <Spinner label="Đang tải danh sách..." />
        ) : quizzes.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Chưa có bộ câu hỏi nào"
            description="Tạo bộ mới ở phía trên, soạn câu hỏi (hoặc nhập từ Excel) rồi mở phòng cho cả lớp."
          />
        ) : (
          <ul className="space-y-3">
            {quizzes.map(quiz => (
              <li
                key={quiz.id}
                className={`${cardClasses} flex flex-wrap items-center gap-3 p-4 transition hover:border-indigo-300 hover:shadow-md`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{quiz.title}</p>
                  <p className="text-xs text-slate-500">
                    {quiz.count} câu hỏi · tạo ngày {new Date(quiz.createdAt).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/host/quiz/${quiz.id}`} className={btnClasses('ghost')}>
                    <Pencil className="h-4 w-4" />
                    Sửa
                  </Link>
                  <Btn disabled={busyId === quiz.id || quiz.count === 0} onClick={() => void handleStartRoom(quiz.id)}>
                    {busyId === quiz.id ? (
                      'Đang mở...'
                    ) : (
                      <>
                        <Rocket className="h-4 w-4" />
                        Tạo phòng
                      </>
                    )}
                  </Btn>
                  <Btn variant="danger" disabled={busyId === quiz.id} onClick={() => void handleDelete(quiz)}>
                    <Trash2 className="h-4 w-4" />
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  )
}
