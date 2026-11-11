// Trang giáo viên: đăng nhập email (magic link) + quản lý bộ câu hỏi.
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { createRoom } from '../api/rooms'
import { createQuizSet, deleteQuizSet, listQuizzes, type QuizSummary } from '../api/quizzes'
import { Btn, ErrorCard, PageShell, SetupCard, Spinner, btnClasses } from '../components/ui'
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
    return (
      <PageShell>
        <h1 className="mb-6 text-center text-3xl font-black">Trang giáo viên</h1>
        <SetupCard />
      </PageShell>
    )
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
          <div className="mb-3 text-5xl" aria-hidden>
            🧑‍🏫
          </div>
          <h1 className="text-3xl font-black">Giáo viên đăng nhập</h1>
          <p className="mt-2 text-sm text-slate-400">
            Nhập email để nhận liên kết đăng nhập. Bộ câu hỏi sẽ được lưu vào tài khoản của thầy/cô.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-6 shadow-xl"
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="giaoVien@truong.edu.vn"
              disabled={busy || sent}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 outline-none focus:border-indigo-400 disabled:opacity-50"
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          {sent ? (
            <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              <p className="font-semibold">Đã gửi liên kết đăng nhập! 📬</p>
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
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 fade-in">
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">Bộ câu hỏi của thầy/cô</h1>
          <p className="text-sm text-slate-400">{email}</p>
        </div>
        <Btn variant="ghost" onClick={onSignOut}>
          Đăng xuất
        </Btn>
      </header>

      {error ? (
        <div className="mb-6">
          <ErrorCard message={error} onRetry={() => void load()} />
        </div>
      ) : null}

      <form onSubmit={handleCreate} className="mb-8 flex flex-col gap-3 sm:flex-row">
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          maxLength={120}
          placeholder="Tên bộ câu hỏi mới (ví dụ: Toán lớp 5 — phép cộng)"
          disabled={creating}
          className="flex-1 rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 outline-none focus:border-indigo-400 disabled:opacity-50"
        />
        <Btn type="submit" disabled={creating}>
          {creating ? 'Đang tạo...' : '+ Tạo bộ mới'}
        </Btn>
      </form>

      {quizzes === null ? (
        <Spinner label="Đang tải danh sách..." />
      ) : quizzes.length === 0 ? (
        <p className="rounded-2xl border border-slate-700/60 bg-slate-800/60 px-6 py-10 text-center text-slate-400">
          Chưa có bộ câu hỏi nào. Tạo bộ mới phía trên, soạn câu hỏi rồi mở phòng cho cả lớp!
        </p>
      ) : (
        <ul className="space-y-3">
          {quizzes.map(quiz => (
            <li
              key={quiz.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{quiz.title}</p>
                <p className="text-xs text-slate-400">
                  {quiz.count} câu hỏi · tạo ngày {new Date(quiz.createdAt).toLocaleDateString('vi-VN')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/host/quiz/${quiz.id}`} className={btnClasses('ghost')}>
                  ✏️ Sửa
                </Link>
                <Btn disabled={busyId === quiz.id || quiz.count === 0} onClick={() => void handleStartRoom(quiz.id)}>
                  {busyId === quiz.id ? 'Đang mở...' : '🚀 Tạo phòng'}
                </Btn>
                <Btn variant="danger" disabled={busyId === quiz.id} onClick={() => void handleDelete(quiz)}>
                  🗑
                </Btn>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  )
}
