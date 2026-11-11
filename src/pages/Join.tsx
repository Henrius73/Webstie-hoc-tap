import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, Gamepad2, MonitorSmartphone } from 'lucide-react'
import { joinRoom } from '../api/rooms'
import { Btn, PageShell, btnClasses } from '../components/ui'
import { useAuth } from '../lib/auth'
import { getDemoRoomByCode, joinDemoRoom } from '../lib/demoRoom'
import { friendlyError } from '../lib/errors'
import { isConfigured } from '../lib/supabase'
import { normalizeCode } from '../lib/utils'

export default function Join() {
  const navigate = useNavigate()
  const { ensureAnonymous } = useAuth()
  const [code, setCode] = useState('')
  const [name, setName] = useState(() => localStorage.getItem('hocvui.name') ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const cleanCode = normalizeCode(code)
    const cleanName = name.trim().slice(0, 20)
    if (!/^\d{6}$/.test(cleanCode)) {
      setError('Mã phòng gồm đúng 6 chữ số.')
      return
    }
    if (!cleanName) {
      setError('Hãy nhập tên của em (1–20 ký tự).')
      return
    }

    setBusy(true)
    try {
      // Ưu tiên phòng chơi thử lưu trên máy này (không cần Supabase).
      if (getDemoRoomByCode(cleanCode)) {
        const result = joinDemoRoom(cleanCode, cleanName)
        if ('error' in result) {
          setError(
            result.error === 'room_finished'
              ? 'Ván chơi thử này đã kết thúc. Hãy chờ giáo viên mở phòng mới.'
              : 'Không vào được phòng thử. Hãy thử lại.',
          )
          return
        }
        localStorage.setItem('hocvui.name', cleanName)
        navigate(`/demo/play/${cleanCode}`)
        return
      }

      if (!isConfigured) {
        setError(
          'Không tìm thấy phòng thử này trên máy. Chế độ chơi thử chỉ dùng được trên trình duyệt đã tạo phòng — hãy nhờ giáo viên tạo phòng thử mới.',
        )
        return
      }

      await ensureAnonymous()
      await joinRoom(cleanCode, cleanName)
      localStorage.setItem('hocvui.name', cleanName)
      navigate(`/room/${cleanCode}`)
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
          <Gamepad2 className="mx-auto mb-3 h-12 w-12 text-indigo-300" />
          <h1 className="text-3xl font-black">Vào phòng chơi</h1>
          <p className="mt-2 text-sm text-slate-400">Nhập mã phòng do giáo viên chiếu trên bảng.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-6 shadow-xl"
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-300">Mã phòng (6 chữ số)</span>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              placeholder="123456"
              disabled={busy}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-center text-3xl font-black tracking-[0.3em] outline-none focus:border-indigo-400 disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-300">Tên của em</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={20}
              autoComplete="nickname"
              placeholder="Ví dụ: Minh Anh"
              disabled={busy}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-lg outline-none focus:border-indigo-400 disabled:opacity-50"
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          <Btn type="submit" size="lg" disabled={busy} className="w-full">
            {busy ? 'Đang vào phòng...' : 'Vào phòng'}
          </Btn>

          <p className="text-center text-xs text-slate-500">
            Không cần tài khoản. Tên trùng vẫn chơi được, nhưng nên dùng tên khác cho dễ phân biệt.
          </p>
        </form>

        {!isConfigured ? (
          <div className="mt-6 rounded-2xl border border-indigo-400/40 bg-indigo-500/10 p-4 text-center text-sm">
            <p className="mb-2 inline-flex items-center gap-2 font-semibold text-indigo-200">
              <MonitorSmartphone className="h-4 w-4" />
              Chế độ chơi thử
            </p>
            <p className="mb-3 text-slate-300">
              Chưa kết nối máy chủ dữ liệu. Giáo viên có thể tạo phòng thử ngay trên máy này.
            </p>
            <Link to="/demo" className={btnClasses('ghost')}>
              <ArrowLeft className="h-4 w-4" />
              Trang tạo phòng thử
            </Link>
          </div>
        ) : null}

        <p className="mt-6 text-center text-sm text-slate-400">
          Là giáo viên?{' '}
          <Link to="/host" className="text-indigo-300 underline">
            Vào trang giáo viên
          </Link>
        </p>
      </section>
    </PageShell>
  )
}
