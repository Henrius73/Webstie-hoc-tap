// Trang giáo viên — chế độ chơi thử: tạo phòng từ bộ câu hỏi lưu trên máy,
// không cần Supabase. Học sinh vào bằng mã ở tab khác cùng trình duyệt.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Check,
  Copy,
  Gift,
  ListChecks,
  MonitorSmartphone,
  Pencil,
  Play,
  Plus,
  Rocket,
  Trash2,
  Users,
} from 'lucide-react'
import { Btn, PageShell, btnClasses } from '../components/ui'
import {
  createDemoRoom,
  deleteDemoRoom,
  listDemoRooms,
  subscribeDemo,
  type DemoRoom,
} from '../lib/demoRoom'
import { listSets, makeSampleSet, SAMPLE_QUESTIONS, type LocalQuizSet } from '../lib/practiceStore'

function phaseLabel(room: DemoRoom): string {
  if (room.phase === 'lobby') return 'Đang chờ học sinh'
  if (room.phase === 'question') return `Đang hỏi câu ${room.q_index + 1}/${room.total_questions}`
  if (room.phase === 'reveal') return `Đang công bố câu ${room.q_index + 1}/${room.total_questions}`
  return 'Đã kết thúc'
}

function phaseColor(room: DemoRoom): string {
  if (room.phase === 'finished') return 'text-slate-500'
  if (room.phase === 'question') return 'text-emerald-600'
  if (room.phase === 'reveal') return 'text-amber-600'
  return 'text-indigo-600'
}

export default function DemoHost() {
  const navigate = useNavigate()
  const [version, setVersion] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const sets = useMemo(() => listSets(), [version])
  const rooms = useMemo(() => listDemoRooms(), [version])

  function refresh() {
    setVersion(value => value + 1)
  }

  // Đồng bộ khi tab khác thay đổi phòng + nhịp dự phòng.
  useEffect(() => subscribeDemo(null, refresh), [])
  useEffect(() => {
    const timer = setInterval(refresh, 5000)
    return () => clearInterval(timer)
  }, [])

  function openRoom(room: DemoRoom) {
    navigate(`/demo/room/${room.code}`)
  }

  function handleCreate(set: LocalQuizSet) {
    if (set.questions.length === 0) {
      setNotice('Bộ này chưa có câu hỏi — hãy soạn thêm trước khi mở phòng.')
      return
    }
    const room = createDemoRoom(set.title, set.questions)
    navigate(`/demo/room/${room.code}`)
  }

  function handleSample() {
    const room = createDemoRoom('Bộ câu hỏi mẫu — kiến thức chung', SAMPLE_QUESTIONS)
    navigate(`/demo/room/${room.code}`)
  }

  function handleCreateSampleSet() {
    const set = makeSampleSet()
    refresh()
    setNotice(`Đã tạo bộ mẫu "${set.title}" trong mục Luyện tập.`)
  }

  function handleDelete(room: DemoRoom) {
    if (!window.confirm(`Xóa phòng thử ${room.code}? (không thể hoàn tác)`)) return
    deleteDemoRoom(room.code)
    refresh()
  }

  async function handleCopy(room: DemoRoom) {
    const url = `${location.origin}/demo/play/${room.code}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedCode(room.code)
      setTimeout(() => setCopiedCode(value => (value === room.code ? null : value)), 2000)
    } catch {
      setNotice(`Không sao chép được tự động. Liên kết học sinh: ${url}`)
    }
  }

  return (
    <PageShell>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 fade-in">
        <div>
          <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-emerald-600 uppercase">
            <MonitorSmartphone className="h-4 w-4" />
            Chế độ chơi thử
          </p>
          <h1 className="text-2xl font-black sm:text-3xl">Phòng chơi thử trên máy này</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Không cần Supabase, không cần mạng. Tạo phòng từ bộ câu hỏi đã lưu trong trình duyệt, rồi mở
            tab khác cùng trình duyệt để vào phòng bằng mã.
          </p>
        </div>
        <Link to="/practice" className={btnClasses('ghost')}>
          <ListChecks className="h-4 w-4" />
          Quản lý bộ câu hỏi
        </Link>
      </header>

      {notice ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {notice}
        </div>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold tracking-widest text-slate-500 uppercase">
          Tạo phòng từ bộ câu hỏi
        </h2>

        {sets.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-6 py-10 text-center">
            <Gift className="mx-auto mb-3 h-10 w-10 text-indigo-600" />
            <p className="mb-1 font-bold">Chưa có bộ câu hỏi nào trên máy này</p>
            <p className="mb-4 text-sm text-slate-500">
              Dùng bộ câu hỏi mẫu để chơi thử ngay, hoặc tự soạn bộ mới trong mục Luyện tập.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Btn size="lg" onClick={handleSample}>
                <Rocket className="h-4 w-4" />
                Tạo phòng với bộ mẫu (8 câu)
              </Btn>
              <Btn variant="ghost" onClick={handleCreateSampleSet}>
                <Plus className="h-4 w-4" />
                Tạo bộ mẫu để sửa
              </Btn>
            </div>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {sets.map(set => (
                <li
                  key={set.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/85 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{set.title}</p>
                    <p className="text-xs text-slate-500">
                      {set.questions.length} câu hỏi
                      {set.questions.length === 0 ? ' · chưa thể mở phòng' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/practice/edit/${set.id}`} className={btnClasses('ghost')}>
                      <Pencil className="h-4 w-4" />
                      Sửa
                    </Link>
                    <Btn onClick={() => handleCreate(set)} disabled={set.questions.length === 0}>
                      <Play className="h-4 w-4" />
                      Mở phòng thử
                    </Btn>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Btn variant="ghost" onClick={handleSample}>
                <Gift className="h-4 w-4" />
                Hoặc tạo phòng với bộ câu hỏi mẫu
              </Btn>
            </div>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-widest text-slate-500 uppercase">
          Phòng thử gần đây
        </h2>

        {rooms.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white/80 px-6 py-8 text-center text-slate-500">
            Chưa có phòng thử nào. Tạo phòng ở phía trên để bắt đầu.
          </p>
        ) : (
          <ul className="space-y-3">
            {rooms.map(room => (
              <li
                key={room.id}
                className={
                  'flex flex-wrap items-center gap-3 rounded-2xl border p-4 ' +
                  (room.phase === 'finished'
                    ? 'border-slate-200 bg-white/60'
                    : 'border-indigo-200 bg-indigo-50')
                }
              >
                <span className="font-mono text-2xl font-black tracking-[0.2em] text-indigo-700">
                  {room.code}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{room.title}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {room.players.length} học sinh
                    </span>
                    <span>·</span>
                    <span className={phaseColor(room)}>{phaseLabel(room)}</span>
                    <span>·</span>
                    <span>
                      mở lúc{' '}
                      {new Date(room.created_at).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Btn variant="ghost" onClick={() => void handleCopy(room)} title="Sao chép liên kết học sinh">
                    {copiedCode === room.code ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copiedCode === room.code ? 'Đã chép' : 'Chép link'}
                  </Btn>
                  <a
                    href={`/demo/play/${room.code}`}
                    target="_blank"
                    rel="noreferrer"
                    className={btnClasses('ghost')}
                  >
                    <MonitorSmartphone className="h-4 w-4" />
                    Tab học sinh
                  </a>
                  {room.phase !== 'finished' ? (
                    <Btn onClick={() => openRoom(room)}>
                      <Play className="h-4 w-4" />
                      Điều khiển
                    </Btn>
                  ) : (
                    <Btn variant="ghost" onClick={() => openRoom(room)}>
                      Xem lại
                    </Btn>
                  )}
                  <Btn variant="danger" onClick={() => handleDelete(room)} title="Xóa phòng">
                    <Trash2 className="h-4 w-4" />
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 text-center text-xs text-slate-500">
        Phòng thử chỉ hoạt động trong cùng trình duyệt trên máy này (các tab chia sẻ localStorage).
        Muốn chơi giữa nhiều máy, cần kết nối Supabase.
      </p>
    </PageShell>
  )
}
