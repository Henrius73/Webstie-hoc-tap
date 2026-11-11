import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, Gamepad2, Info, ListOrdered, MonitorSmartphone } from 'lucide-react'
import { joinRoom } from '../api/rooms'
import { Btn, PageShell, btnClasses, cardClasses, fieldClasses } from '../components/ui'
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
      <section className="mx-auto max-w-4xl fade-in">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-indigo-400/30 bg-indigo-500/15 text-indigo-300">
            <Gamepad2 className="h-7 w-7" />
          </span>
          <h1 className="text-3xl font-black sm:text-4xl">Vào phòng chơi</h1>
          <p className="mt-2 text-sm text-slate-400">Nhập mã phòng do giáo viên chiếu trên bảng để bắt đầu.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <form onSubmit={handleSubmit} className={`${cardClasses} space-y-4 p-6`}>
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
                  className={`${fieldClasses} text-center text-3xl font-black tracking-[0.3em]`}
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
                  className={`${fieldClasses} text-lg`}
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
              <div className="mt-4 rounded-2xl border border-indigo-400/40 bg-indigo-500/10 p-4 text-sm">
                <p className="mb-1 inline-flex items-center gap-2 font-semibold text-indigo-200">
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
          </div>

          <aside className="space-y-4">
            <div className={`${cardClasses} p-5`}>
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-widest text-slate-300 uppercase">
                <ListOrdered className="h-4 w-4 text-indigo-300" />
                Cách vào phòng
              </h2>
              <ol className="space-y-3 text-sm text-slate-300">
                <li className="flex gap-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-500/20 text-xs font-black text-indigo-200">
                    1
                  </span>
                  Nhập mã 6 số giáo viên chiếu trên bảng.
                </li>
                <li className="flex gap-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-500/20 text-xs font-black text-indigo-200">
                    2
                  </span>
                  Nhập tên của em — không cần tài khoản.
                </li>
                <li className="flex gap-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-500/20 text-xs font-black text-indigo-200">
                    3
                  </span>
                  Chờ giáo viên bắt đầu và chọn đáp án thật nhanh.
                </li>
              </ol>
            </div>

            <div className={`${cardClasses} p-5 text-sm text-slate-400`}>
              <p className="mb-1 flex items-center gap-2 font-semibold text-slate-300">
                <Info className="h-4 w-4 text-sky-300" />
                Lưu ý
              </p>
              <p>Điểm được chấm theo độ chính xác và tốc độ trả lời. Đáp án đúng chỉ hiện sau khi hết giờ.</p>
            </div>
          </aside>
        </div>

        <p className="mt-8 text-center text-sm text-slate-400">
          Là giáo viên?{' '}
          <Link to="/host" className="text-indigo-300 underline hover:text-indigo-200">
            Vào trang giáo viên
          </Link>
        </p>
      </section>
    </PageShell>
  )
}
