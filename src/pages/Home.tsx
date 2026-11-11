import { Link } from 'react-router'
import { PageShell, SetupCard, btnClasses } from '../components/ui'
import { isConfigured } from '../lib/supabase'

export default function Home() {
  return (
    <PageShell>
      <section className="mx-auto max-w-2xl text-center fade-in">
        <div className="mb-4 text-6xl" aria-hidden>
          🎓
        </div>
        <h1 className="mb-3 text-4xl font-black tracking-tight sm:text-5xl">Học Vui</h1>
        <p className="mb-8 text-lg text-slate-300">
          Trò chơi trắc nghiệm cả lớp cùng chơi theo thời gian thực. Giáo viên tạo phòng, học sinh vào bằng mã — ai
          nhanh và đúng ghi nhiều điểm nhất.
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Link to="/join" className={btnClasses('primary', 'lg')}>
            🎮 Học sinh — vào phòng
          </Link>
          <Link to="/host" className={btnClasses('ghost', 'lg')}>
            🧑‍🏫 Giáo viên — tạo phòng
          </Link>
        </div>
      </section>

      {!isConfigured ? <SetupCard /> : null}

      <footer className="mt-12 text-center text-xs text-slate-500">
        Điểm do máy chủ chấm · Đáp án đúng chỉ công bố sau khi hết giờ · Học sinh không cần tài khoản
      </footer>
    </PageShell>
  )
}
