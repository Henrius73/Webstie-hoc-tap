// Gọi các hàm RPC phía server + đọc trạng thái phòng.
// Client không ghi trực tiếp vào rooms/players/answers (xem migration).
import { requireSupabase } from '../lib/supabase'
import type { AnswerRow, PlayerRow, RoomRow } from '../types/db'

export async function serverNow(): Promise<Date> {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('server_now')
  if (error) throw error
  return new Date(String(data))
}

export async function createRoom(quizId: string): Promise<RoomRow> {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('create_room', { p_quiz_id: quizId })
  if (error) throw error
  return data as RoomRow
}

export async function joinRoom(code: string, name: string): Promise<PlayerRow> {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('join_room', { p_code: code, p_name: name })
  if (error) throw error
  return data as PlayerRow
}

export async function nextQuestion(roomId: string): Promise<RoomRow> {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('host_next_question', { p_room_id: roomId })
  if (error) throw error
  return data as RoomRow
}

export async function revealAnswer(roomId: string): Promise<RoomRow> {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('host_reveal', { p_room_id: roomId })
  if (error) throw error
  return data as RoomRow
}

// Trả về false nếu đã trả lời câu này rồi.
export async function submitAnswer(roomId: string, choice: number): Promise<boolean> {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('submit_answer', { p_room_id: roomId, p_choice: choice })
  if (error) throw error
  return Boolean((data as { accepted?: boolean } | null)?.accepted)
}

export async function fetchRoomByCode(code: string): Promise<RoomRow | null> {
  const sb = requireSupabase()
  const { data, error } = await sb.from('rooms').select('*').eq('code', code).maybeSingle()
  if (error) throw error
  return (data as RoomRow | null) ?? null
}

export async function fetchRoomById(roomId: string): Promise<RoomRow | null> {
  const sb = requireSupabase()
  const { data, error } = await sb.from('rooms').select('*').eq('id', roomId).maybeSingle()
  if (error) throw error
  return (data as RoomRow | null) ?? null
}

export interface RoomSnapshot {
  room: RoomRow
  players: PlayerRow[]
  me: PlayerRow | null
  myAnswer: AnswerRow | null
}

// Dùng khi vào phòng, tải lại trang hoặc kết nối lại.
export async function fetchSnapshot(roomId: string, userId: string | null): Promise<RoomSnapshot> {
  const sb = requireSupabase()
  const [playersResult, roomResult] = await Promise.all([
    sb
      .from('players')
      .select('id,user_id,name,score,joined_at')
      .eq('room_id', roomId)
      .order('score', { ascending: false })
      .order('joined_at', { ascending: true }),
    sb.from('rooms').select('*').eq('id', roomId).maybeSingle(),
  ])
  if (playersResult.error) throw playersResult.error
  if (roomResult.error) throw roomResult.error

  const room = roomResult.data as RoomRow | null
  if (!room) throw new Error('room_not_found')

  const players = (playersResult.data ?? []) as PlayerRow[]
  const me = userId ? (players.find(player => player.user_id === userId) ?? null) : null

  let myAnswer: AnswerRow | null = null
  if (me && room.q_index >= 0) {
    const { data } = await sb
      .from('answers')
      .select('player_id,q_index,choice,is_correct,points')
      .eq('player_id', me.id)
      .eq('q_index', room.q_index)
      .maybeSingle()
    myAnswer = (data as AnswerRow | null) ?? null
  }

  return { room, players, me, myAnswer }
}

export interface AnswerStats {
  counts: number[]
  answeredIds: Set<string>
  total: number
  correctCount: number
}

// Giáo viên đọc bài làm của cả phòng cho câu hiện tại.
export async function fetchAnswerStats(roomId: string, qIndex: number): Promise<AnswerStats> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('answers')
    .select('player_id,choice,is_correct,points')
    .eq('room_id', roomId)
    .eq('q_index', qIndex)
  if (error) throw error

  const counts = [0, 0, 0, 0]
  const answeredIds = new Set<string>()
  let correctCount = 0

  for (const answer of (data ?? []) as AnswerRow[]) {
    answeredIds.add(answer.player_id)
    const index = Number(answer.choice)
    if (index >= 0 && index < 4) counts[index] += 1
    if (answer.is_correct) correctCount += 1
  }

  return { counts, answeredIds, total: (data ?? []).length, correctCount }
}
