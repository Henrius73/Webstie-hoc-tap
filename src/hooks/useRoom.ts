// Giữ trạng thái phòng: tải snapshot ban đầu, nghe Realtime, tự tải lại khi có thay đổi.
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSnapshot, type RoomSnapshot } from '../api/rooms'
import { subscribeRoom } from '../api/realtime'
import { friendlyError } from '../lib/errors'

export interface UseRoomResult {
  snapshot: RoomSnapshot | null
  error: string | null
  connected: boolean
  // Tăng mỗi khi có sự kiện realtime đến (dùng làm dependency cho các hiệu ứng khác).
  version: number
  refresh: () => Promise<void>
}

export function useRoom(roomId: string | null, userId: string | null): UseRoomResult {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [version, setVersion] = useState(0)
  const seqRef = useRef(0)

  const refresh = useCallback(async () => {
    if (!roomId) return
    const seq = ++seqRef.current
    try {
      const next = await fetchSnapshot(roomId, userId)
      if (seq !== seqRef.current) return // có bản mới hơn đang tới
      setSnapshot(next)
      setError(null)
    } catch (err) {
      if (seq !== seqRef.current) return
      setError(friendlyError(err))
    }
  }, [roomId, userId])

  useEffect(() => {
    if (!roomId) {
      setSnapshot(null)
      setError(null)
      setConnected(false)
      return
    }

    let alive = true
    setSnapshot(null)
    setError(null)
    setConnected(false)
    refresh()

    const onEvent = () => {
      if (!alive) return
      setVersion(v => v + 1)
      refresh()
    }

    const unsubscribe = subscribeRoom(roomId, {
      onRoom: onEvent,
      onPlayers: onEvent,
      onSubscribed: () => {
        if (!alive) return
        setConnected(true)
        onEvent()
      },
      onError: () => {
        if (alive) setConnected(false)
      },
    })

    return () => {
      alive = false
      unsubscribe()
    }
  }, [roomId, refresh])

  return { snapshot, error, connected, version, refresh }
}
