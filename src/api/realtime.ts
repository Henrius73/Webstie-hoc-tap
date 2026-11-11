// Đăng ký Realtime (Postgres Changes) cho phòng + người chơi.
// Mỗi lần kênh SUBSCRIBED lại (kể cả sau mất mạng), nơi gọi nên lấy lại snapshot.
import { supabase } from '../lib/supabase'

export interface RoomSubscriptionHandlers {
  onRoom?: () => void
  onPlayers?: () => void
  onSubscribed?: () => void
  onError?: () => void
}

export function subscribeRoom(roomId: string, handlers: RoomSubscriptionHandlers): () => void {
  const sb = supabase
  if (!sb) return () => {}

  const channel = sb.channel(`room:${roomId}`)

  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
    () => handlers.onRoom?.(),
  )
  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
    () => handlers.onPlayers?.(),
  )
  channel.on('system', { event: 'disconnect' }, () => handlers.onError?.())

  channel.subscribe(status => {
    if (status === 'SUBSCRIBED') handlers.onSubscribed?.()
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') handlers.onError?.()
  })

  return () => {
    sb.removeChannel(channel)
  }
}
