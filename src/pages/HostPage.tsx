// Trang giáo viên: đăng nhập email (magic link) + quản lý bộ câu hỏi và phòng đang mở.
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { BookOpen, GraduationCap, LogOut, MailCheck, Pencil, Plus, Presentation, Rocket, Trash2, Undo2 } from 'lucide-react'
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
  const { ready, user, isTeacher, sendTeacherLink, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Dọn ?code= trên URL sau khi magic link quay lại.
  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(location.search)
    if (params.has('code')) navigate(location.pathname, { replace: true })
  }, [user, location.search, location.pathname, navigate])

  if (!isConfigured) {
    // Chưa cấu hình Supabase → dùng chế độ chơi thử cục bộ.
    return <Navigate to="/demo" replace />
  }

  if (!ready) {
    return (
      <PageShell>
        <Spinner label="Đang kiểm tra đăng nhập..." />
      </PageShell>
    )
  }

  if (!isTeacher || !user) return <TeacherLogin sendTeacherLink={sendTeacherLink} signOut={signOut} />

  return <HostDashboard email={user.email ?? ''} onSignOut={() => void signOut()} />
}

// ----- Nhãn pha cho phòng đang mở -----

function roomPhaseLabel(room: ActiveRoom): string {
  if (room.phase === 'lobby') return 'Đang chờ học sinh'
  if (room.phase === 'question') return `Đang hỏi câu ${room.qIndex + 1}/${room.totalQuestions}`
  return `Đang công bố câu ${room.qIndex + 1}/${room.totalQuestions}`
}

// ----- Đăng nhập -----

function TeacherLogin({
  sendTeacherLink,
  signOut,
}: {
  sendTeacherLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const clean = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError('Hãy nhập địa chỉ email hợp lệ.')
      return
    }
    setBusy(true)
    try {
      await sendTeacherLink(clean)
      setSent(true)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell>
      <section className="mx-auto max-w-md fade-in">
        <div className="mb-6 text-center">
          <GraduationCap className="mx-auto mb-3 h-12 w-12 text-indigo-300" />
          <h1 className="text-3xl font-black">Giáo viên đăng nhập</h1>
          <p className="mt-2 text-sm text-slate-400">
            Nhập email để nhận liên kết đăng nhập. Bộ câu hỏi sẽ được lưu vào tài khoản của thầy/cô.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={`${cardClasses} space-y-4 p-6 shadow-xl`}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="giaoVien@truong.edu.vn"
              disabled={busy || sent}
              className={`${fieldClasses} py-3`}
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          {sent ? (
            <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              <p className="inline-flex items-center gap-2 font-semibold">
                <MailCheck className="h-4 w-4" />
                Đã gửi liên kết đăng nhập!
              </p>
              <p>
                Mở hộp thư email của thầy/cô <strong>trên trình duyệt này</strong> và bấm vào liên kết để quay lại
                trang. (Nhớ thêm địa chỉ trang web vào Redirect URLs trong Supabase nếu chưa làm.)
              </p>
            </div>
          ) : (
            <Btn type="submit" size="lg" disabled={busy} className="w-full">
              {busy ? 'Đang gửi...' : 'Gửi liên kết đăng nhập'}
            </Btn>
          )}
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          Đang đăng nhập bằng tài khoản học sinh?{' '}
          <button
            type="button"
            className="underline"
            onClick={() => void signOut().catch(() => {})}
          >
            Đăng xuất
          </button>{' '}
          rồi đăng nhập lại bằng email.
        </p>
      </section>
    </PageShell>
  )
}

// ----- Bảng điều khiển -----

function HostDashboard({ email, onSignOut }: { email: string; onSignOut: () => void }) {
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
      <header className={`${cardClasses} mb-8 flex flex-wrap items-center justify-between gap-4 p-5 fade-in`}>
        <div>
          <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-indigo-300 uppercase">
            <Presentation className="h-4 w-4" />
            Khu vực giáo viên
          </p>
          <h1 className="text-2xl font-black sm:text-3xl">Bộ câu hỏi của thầy/cô</h1>
          <p className="text-sm text-slate-400">{email}</p>
        </div>
        <Btn variant="ghost" onClick={onSignOut}>
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </Btn>
      </header>

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
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-400/40 bg-indigo-500/10 p-4"
              >
                <span className="font-mono text-2xl font-black tracking-[0.2em] text-indigo-200">
                  {room.code}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{room.quizTitle}</p>
                  <p className="text-xs text-slate-400">
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
                className={`${cardClasses} flex flex-wrap items-center gap-3 p-4 transition hover:border-indigo-400/40 hover:bg-slate-800`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{quiz.title}</p>
                  <p className="text-xs text-slate-400">
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
