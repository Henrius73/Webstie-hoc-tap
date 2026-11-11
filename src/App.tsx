import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './lib/auth'
import Home from './pages/Home'
import HostPage from './pages/HostPage'
import HostRoom from './pages/HostRoom'
import Join from './pages/Join'
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
          <Route path="/host" element={<HostPage />} />
          <Route path="/host/quiz/:id" element={<QuizEditor />} />
          <Route path="/host/room/:id" element={<HostRoom />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
