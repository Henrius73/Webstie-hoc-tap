// Đồng bộ giờ server + đếm ngược cho câu hỏi.
import { useEffect, useState } from 'react'
import { serverNow } from '../api/rooms'

// Độ lệch giữa đồng hồ máy và giờ server (serverNow - Date.now).
export function useServerOffset(): number {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    let alive = true
    const sync = async () => {
      try {
        const server = await serverNow()
        if (alive) setOffset(server.getTime() - Date.now())
      } catch {
        // giữ lệch cũ nếu tạm mất mạng
      }
    }
    sync()
    const id = setInterval(sync, 60_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  return offset
}

// Số mili-giây còn lại tới thời điểm endsAt (theo giờ server), không bao giờ âm.
export function useCountdown(endsAt: string | null, offsetMs: number): number {
  const [now, setNow] = useState(() => Date.now() + offsetMs)

  useEffect(() => {
    setNow(Date.now() + offsetMs)
  }, [offsetMs])

  useEffect(() => {
    if (!endsAt) return
    const id = setInterval(() => setNow(Date.now() + offsetMs), 200)
    return () => clearInterval(id)
  }, [endsAt, offsetMs])

  if (!endsAt) return 0
  return Math.max(0, new Date(endsAt).getTime() - now)
}
