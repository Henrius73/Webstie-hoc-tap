// Gọi các hàm RPC phía server + đọc trạng thái phòng.
// Client không ghi trực tiếp vào rooms/players/answers (xem migration).
import { requireSupabase } from '../lib/supabase'
import type { AnswerRow, PlayerRow, RoomPhase, RoomRow } from '../types/db'

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

// Giáo viên: kết thúc ván chơi ngay từ bất kỳ pha nào chưa kết thúc.
export async function endRoom(roomId: string): Promise<RoomRow> {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('host_end_room', { p_room_id: roomId })
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

// Phòng đang mở của giáo viên (chưa kết thúc), dùng ở trang danh sách.
export interface ActiveRoom {
  id: string
  code: string
  quizId: string
  quizTitle: string
  phase: RoomPhase
  qIndex: number
  totalQuestions: number
  createdAt: string
  playerCount: number
}

interface ActiveRoomRow {
  id: string
  code: string
  phase: RoomPhase
  quiz_id: string
  total_questions: number
  q_index: number
  created_at: string
  quiz_sets: { title: string } | { title: string }[] | null
}

export async function fetchActiveRooms(): Promise<ActiveRoom[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('rooms')
    .select('id,code,phase,quiz_id,total_questions,q_index,created_at,quiz_sets(title)')
    .neq('phase', 'finished')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error

  const rows = (data ?? []) as ActiveRoomRow[]
  const roomIds = rows.map(row => row.id)

  // Đếm số học sinh từng phòng (RLS cho chủ phòng đọc được).
  const counts = new Map<string, number>()
  if (roomIds.length > 0) {
    const { data: playersData, error: playersError } = await sb
      .from('players')
      .select('room_id')
      .in('room_id', roomIds)
    if (playersError) throw playersError
    for (const player of (playersData ?? []) as Array<{ room_id: string }>) {
      counts.set(player.room_id, (counts.get(player.room_id) ?? 0) + 1)
    }
  }

  return rows.map(row => {
    const quizSet = Array.isArray(row.quiz_sets) ? row.quiz_sets[0] : row.quiz_sets
    return {
      id: row.id,
      code: row.code,
      quizId: row.quiz_id,
      quizTitle: quizSet?.title ?? 'Bộ câu hỏi',
      phase: row.phase,
      qIndex: row.q_index,
      totalQuestions: row.total_questions,
      createdAt: row.created_at,
      playerCount: counts.get(row.id) ?? 0,
    }
  })
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
    // Lỗ hổng đã biết: nếu đọc cả is_correct thì học sinh (mở DevTools) biết mình
    // đúng/sai ngay sau khi gửi. Chỉ chọn 2 cột này sau khi công bố (reveal/finished).
    const revealAll = room.phase === 'reveal' || room.phase === 'finished'
    const columns = revealAll ? 'player_id,q_index,choice,is_correct,points' : 'player_id,q_index,choice'
    const { data } = await sb
      .from('answers')
      .select(columns)
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
