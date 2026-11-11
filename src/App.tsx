import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './lib/auth'
import DemoHost from './pages/DemoHost'
import DemoHostRoom from './pages/DemoHostRoom'
import DemoStudentRoom from './pages/DemoStudentRoom'
import Home from './pages/Home'
import HostPage from './pages/HostPage'
import HostRoom from './pages/HostRoom'
import Join from './pages/Join'
import Practice from './pages/Practice'
import PracticeEditor from './pages/PracticeEditor'
import PracticeFlash from './pages/PracticeFlash'
import PracticeRun from './pages/PracticeRun'
import QuizEditor from './pages/QuizEditor'
import StudentRoom from './pages/StudentRoom'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/join" element={<Join />} />
          <Route path="/room/:code" element={<StudentRoom />} />
          <Route path="/demo" element={<DemoHost />} />
          <Route path="/demo/room/:code" element={<DemoHostRoom />} />
          <Route path="/demo/play/:code" element={<DemoStudentRoom />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/practice/edit/:id" element={<PracticeEditor />} />
          <Route path="/practice/run/:id" element={<PracticeRun />} />
          <Route path="/practice/flash/:id" element={<PracticeFlash />} />
          <Route path="/host" element={<HostPage />} />
          <Route path="/host/quiz/:id" element={<QuizEditor />} />
          <Route path="/host/room/:id" element={<HostRoom />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
