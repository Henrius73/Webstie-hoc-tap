import { Link } from 'react-router'
import { BookOpen, GraduationCap, MonitorSmartphone, Presentation, Rocket, Sparkles } from 'lucide-react'
import { PageShell, btnClasses } from '../components/ui'
import { isConfigured } from '../lib/supabase'

export default function Home() {
  return (
    <PageShell>
      <section className="mx-auto max-w-2xl text-center fade-in">
        <GraduationCap className="mx-auto mb-4 h-16 w-16 text-indigo-300" />
        <h1 className="mb-3 text-4xl font-black tracking-tight sm:text-5xl">Học Vui</h1>
        <p className="mb-8 text-lg text-slate-300">
          Trò chơi trắc nghiệm cả lớp cùng chơi theo thời gian thực. Giáo viên tạo phòng, học sinh vào bằng mã — ai
          nhanh và đúng ghi nhiều điểm nhất.
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
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
            Luyện tập — tự học
          </Link>
        </div>
      </section>

      {!isConfigured ? (
        <section className="mx-auto mt-10 max-w-2xl rounded-2xl border border-indigo-400/40 bg-indigo-500/10 p-6 text-center fade-in">
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold tracking-widest text-indigo-200 uppercase">
            <Sparkles className="h-4 w-4" />
            Chế độ chơi thử
          </p>
          <h2 className="mb-2 text-xl font-bold">Dùng thử ngay, không cần máy chủ</h2>
          <p className="mx-auto mb-4 max-w-lg text-sm text-slate-300">
            Tạo phòng từ bộ câu hỏi lưu trên máy, rồi mở tab khác cùng trình duyệt để vào phòng bằng mã. Phòng thử
            chỉ hoạt động trên máy đã tạo.
          </p>
          <Link to="/demo" className={btnClasses('primary', 'lg')}>
            <MonitorSmartphone className="h-5 w-5" />
            Mở trang chơi thử
          </Link>
        </section>
      ) : null}

      <footer className="mt-12 text-center text-xs text-slate-500">
        Điểm do máy chủ chấm · Đáp án đúng chỉ công bố sau khi hết giờ · Học sinh không cần tài khoản
      </footer>
    </PageShell>
  )
}
