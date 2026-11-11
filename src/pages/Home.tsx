import { Link } from 'react-router'
import {
  BookOpen,
  GraduationCap,
  MonitorSmartphone,
  Presentation,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { PageShell, btnClasses, cardClasses } from '../components/ui'
import { isConfigured } from '../lib/supabase'

const FEATURES = [
  {
    icon: Rocket,
    title: 'Học sinh',
    text: 'Vào phòng bằng mã 6 số, trả lời trên điện thoại — không cần tài khoản.',
  },
  {
    icon: Presentation,
    title: 'Giáo viên',
    text: 'Soạn bộ câu hỏi, mở phòng và điều khiển ván chơi theo thời gian thực.',
  },
  {
    icon: BookOpen,
    title: 'Luyện tập',
    text: 'Tự học trên máy với đề tự soạn, chấm điểm, xem lại và thẻ ghi nhớ.',
  },
]

export default function Home() {
  return (
    <PageShell>
      <section className="mx-auto max-w-3xl text-center fade-in">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold tracking-widest text-indigo-200 uppercase">
          <Sparkles className="h-3.5 w-3.5" />
          Trò chơi học tập tương tác
        </span>

        <div className="mb-5 flex justify-center">
          <span className="grid h-20 w-20 place-items-center rounded-3xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/30 to-sky-500/10 text-indigo-200 shadow-2xl shadow-indigo-500/20">
            <GraduationCap className="h-10 w-10" />
          </span>
        </div>

        <h1 className="mb-3 bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
          Học Vui
        </h1>
        <p className="mx-auto mb-8 max-w-xl text-base text-slate-300 sm:text-lg">
          Trò chơi trắc nghiệm cả lớp cùng chơi theo thời gian thực. Giáo viên tạo phòng, học sinh vào bằng mã — ai
          nhanh và đúng ghi nhiều điểm nhất.
        </p>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/join" className={btnClasses('primary', 'lg')}>
            <Rocket className="h-5 w-5" />
            Học sinh — vào phòng
          </Link>
          <Link to="/host" className={btnClasses('ghost', 'lg')}>
            <Presentation className="h-5 w-5" />
            Giáo viên — tạo phòng
          </Link>
          <Link to="/practice" className={btnClasses('ghost', 'lg')}>
            <BookOpen className="h-5 w-5" />
            Luyện tập
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
        {FEATURES.map(feature => (
          <div
            key={feature.title}
            className={`${cardClasses} p-5 text-left transition hover:border-indigo-400/40 hover:bg-slate-800`}
          >
            <feature.icon className="mb-3 h-6 w-6 text-indigo-300" />
            <h2 className="mb-1 font-bold">{feature.title}</h2>
            <p className="text-sm leading-relaxed text-slate-400">{feature.text}</p>
          </div>
        ))}
      </section>

      {!isConfigured ? (
        <section className="mx-auto mt-10 max-w-3xl fade-in">
          <div className="rounded-2xl border border-indigo-400/40 bg-indigo-500/10 p-6 text-center sm:p-8">
            <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-indigo-200 uppercase">
              <MonitorSmartphone className="h-4 w-4" />
              Chế độ chơi thử
            </p>
            <h2 className="mb-2 text-xl font-bold">Dùng thử ngay, không cần máy chủ</h2>
            <p className="mx-auto mb-5 max-w-xl text-sm text-slate-300">
              Tạo phòng từ bộ câu hỏi lưu trên máy, rồi mở tab khác cùng trình duyệt để vào phòng bằng mã. Phòng
              thử chỉ hoạt động trên máy đã tạo.
            </p>
            <Link to="/demo" className={btnClasses('primary', 'lg')}>
              <MonitorSmartphone className="h-5 w-5" />
              Mở trang chơi thử
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mx-auto mt-12 grid max-w-4xl gap-3 text-sm text-slate-400 sm:grid-cols-3">
        <p className="flex items-center justify-center gap-2 rounded-xl bg-slate-800/40 px-4 py-3">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          Điểm do máy chủ chấm
        </p>
        <p className="flex items-center justify-center gap-2 rounded-xl bg-slate-800/40 px-4 py-3">
          <Zap className="h-4 w-4 text-amber-300" />
          Công bố đáp án sau khi hết giờ
        </p>
        <p className="flex items-center justify-center gap-2 rounded-xl bg-slate-800/40 px-4 py-3">
          <Users className="h-4 w-4 text-indigo-300" />
          Học sinh không cần tài khoản
        </p>
      </section>

      <footer className="mt-12 flex flex-col items-center gap-2 text-center text-xs text-slate-500">
        <p className="inline-flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5" />
          Học Vui — học mà chơi, chơi mà học
        </p>
      </footer>
    </PageShell>
  )
}
