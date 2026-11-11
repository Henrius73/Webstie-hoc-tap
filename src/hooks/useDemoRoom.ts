// Hook theo dõi một phòng chơi thử cục bộ (localStorage + BroadcastChannel).
import { useCallback, useEffect, useState } from 'react'
import { getDemoRoomByCode, subscribeDemo, type DemoRoom } from '../lib/demoRoom'

export function useDemoRoom(code: string | null) {
  const [room, setRoom] = useState<DemoRoom | null>(() => (code ? getDemoRoomByCode(code) : null))
  const [version, setVersion] = useState(0)

  const refresh = useCallback(() => {
    setRoom(code ? getDemoRoomByCode(code) : null)
    setVersion(value => value + 1)
  }, [code])

  useEffect(() => {
    if (!code) {
      setRoom(null)
      return
    }
    setRoom(getDemoRoomByCode(code))
    return subscribeDemo(code, refresh)
  }, [code, refresh])

  return { room, version, refresh }
}
