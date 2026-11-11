// Phòng chơi thử cục bộ — chạy hoàn toàn trên trình duyệt, KHÔNG cần Supabase/máy chủ.
// Trạng thái phòng lưu trong localStorage; các tab cùng trình duyệt đồng bộ qua
// BroadcastChannel + sự kiện 'storage'. Tab giáo viên là nơi điều khiển pha.
import type { PlayerRow, RoomPhase } from '../types/db'
import { normalizeCode } from './utils'
import type { QuestionInput } from '../types/db'

export interface DemoQuestion {
  text: string
  options: string[]
  correct_index: number
  image_url: string | null
  time_limit: number
}

// Cùng cấu trúc với PlayerRow để dùng lại PlayerChips / Leaderboard / Podium.
export type DemoPlayer = PlayerRow

export interface DemoAnswer {
  player_id: string
  room_id: string
  q_index: number
  choice: number
  is_correct: boolean
  points: number
  answered_at: string
}

export interface DemoRoom {
  id: string
  code: string
  title: string
  created_at: string
  phase: RoomPhase
  q_index: number
  total_questions: number
  questions: DemoQuestion[]
  question_started_at: string | null
  question_ends_at: string | null
  players: DemoPlayer[]
  answers: DemoAnswer[]
}

export interface DemoStats {
  counts: number[]
  answeredIds: Set<string>
  total: number
  correctCount: number
}

type DemoRoomMap = Record<string, DemoRoom>

const ROOMS_KEY = 'hocvui.demo.rooms'
const PLAYER_KEY_PREFIX = 'hocvui.demo.player.'
const CHANNEL_NAME = 'hocvui.demo'

// Dự phòng khi localStorage bị chặn — chỉ đồng bộ được trong cùng tab.
let fallbackRooms: DemoRoomMap = {}
let channel: BroadcastChannel | null = null

function makeId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function getChannel(): BroadcastChannel | null {
  if (channel) return channel
  try {
    if (typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel(CHANNEL_NAME)
  } catch {
    channel = null
  }
  return channel
}

function readRooms(): DemoRoomMap {
  try {
    const raw = localStorage.getItem(ROOMS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as DemoRoomMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return fallbackRooms
  }
}

function notify(code?: string): void {
  try {
    getChannel()?.postMessage({ type: 'update', code })
  } catch {
    // BroadcastChannel bị chặn — sự kiện 'storage' vẫn hoạt động ở tab khác.
  }
}

function writeRooms(rooms: DemoRoomMap, code?: string): void {
  fallbackRooms = rooms
  try {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms))
  } catch {
    // giữ trong bộ nhớ phiên
  }
  notify(code)
}

// Bỏ các phòng đã kết thúc quá lâu để localStorage không phình to.
function prune(rooms: DemoRoomMap): void {
  const cutoff = Date.now() - 12 * 60 * 60 * 1000
  for (const [code, room] of Object.entries(rooms)) {
    if (room.phase === 'finished' && new Date(room.created_at).getTime() < cutoff) {
      delete rooms[code]
    }
  }
}

function makeCode(rooms: DemoRoomMap): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    if (!rooms[code]) return code
  }
  // Gần như không xảy ra; vẫn đảm bảo không trùng.
  let code = String(Date.now()).slice(-6)
  while (rooms[code]) code = String(Number(code) + 1).padStart(6, '0')
  return code
}

function beginQuestion(room: DemoRoom, index: number): void {
  const question = room.questions[index]
  const started = Date.now()
  room.phase = 'question'
  room.q_index = index
  room.question_started_at = new Date(started).toISOString()
  room.question_ends_at = new Date(started + (question.time_limit || 20) * 1000).toISOString()
}

// ----- Đọc danh sách / phòng -----

export function listDemoRooms(): DemoRoom[] {
  return Object.values(readRooms()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

export function getDemoRoomByCode(code: string): DemoRoom | null {
  const clean = normalizeCode(code)
  return readRooms()[clean] ?? null
}

export function getDemoRoomById(id: string): DemoRoom | null {
  return Object.values(readRooms()).find(room => room.id === id) ?? null
}

// ----- Tạo / xóa phòng -----

export function createDemoRoom(title: string, questions: QuestionInput[]): DemoRoom {
  const rooms = readRooms()
  prune(rooms)
  const room: DemoRoom = {
    id: makeId(),
    code: makeCode(rooms),
    title: title.trim().slice(0, 120) || 'Bộ câu hỏi',
    created_at: nowIso(),
    phase: 'lobby',
    q_index: -1,
    total_questions: questions.length,
    questions: questions.map(question => ({
      text: question.text,
      options: [...question.options],
      correct_index: question.correctIndex,
      image_url: question.imageUrl ?? null,
      time_limit: question.timeLimit || 20,
    })),
    question_started_at: null,
    question_ends_at: null,
    players: [],
    answers: [],
  }
  rooms[room.code] = room
  writeRooms(rooms, room.code)
  return room
}

export function deleteDemoRoom(code: string): void {
  const rooms = readRooms()
  delete rooms[normalizeCode(code)]
  writeRooms(rooms, normalizeCode(code))
}

// ----- Học sinh vào phòng / trả lời -----

export function getStoredDemoPlayerId(code: string): string | null {
  try {
    return localStorage.getItem(PLAYER_KEY_PREFIX + normalizeCode(code))
  } catch {
    return null
  }
}

function storeDemoPlayerId(code: string, playerId: string): void {
  try {
    localStorage.setItem(PLAYER_KEY_PREFIX + normalizeCode(code), playerId)
  } catch {
    // không lưu được — vẫn chơi được trong phiên này
  }
}

export type DemoJoinResult = { room: DemoRoom; player: DemoPlayer } | { error: string }

export function joinDemoRoom(code: string, name: string): DemoJoinResult {
  const cleanCode = normalizeCode(code)
  const rooms = readRooms()
  const room = rooms[cleanCode]
  if (!room) return { error: 'room_not_found' }
  if (room.phase === 'finished') return { error: 'room_finished' }

  const cleanName = name.trim().slice(0, 20)
  if (!cleanName) return { error: 'name_required' }

  const storedId = getStoredDemoPlayerId(cleanCode)
  let player = storedId ? room.players.find(item => item.id === storedId) : undefined
  if (player) {
    player.name = cleanName
  } else {
    player = {
      id: makeId(),
      room_id: room.id,
      user_id: `demo-${makeId()}`,
      name: cleanName,
      score: 0,
      joined_at: nowIso(),
    }
    room.players.push(player)
  }
  storeDemoPlayerId(cleanCode, player.id)
  writeRooms(rooms, cleanCode)
  return { room, player }
}

export interface DemoAnswerResult {
  ok: boolean
  error?: string
  isCorrect?: boolean
  points?: number
}

export function submitDemoAnswer(code: string, playerId: string, choice: number): DemoAnswerResult {
  const cleanCode = normalizeCode(code)
  const rooms = readRooms()
  const room = rooms[cleanCode]
  if (!room) return { ok: false, error: 'room_not_found' }
  if (room.phase !== 'question' || room.q_index < 0) return { ok: false, error: 'not_accepting' }

  const player = room.players.find(item => item.id === playerId)
  if (!player) return { ok: false, error: 'player_not_found' }
  if (room.answers.some(answer => answer.player_id === playerId && answer.q_index === room.q_index)) {
    return { ok: false, error: 'already_answered' }
  }

  const question = room.questions[room.q_index]
  if (!question) return { ok: false, error: 'no_question' }

  const now = Date.now()
  const endsAt = room.question_ends_at ? new Date(room.question_ends_at).getTime() : 0
  // Cho phép trễ tối đa 1,5 giây (độ trễ bấm chuột) nhưng điểm tốc độ tính theo giờ.
  if (endsAt && now > endsAt + 1500) return { ok: false, error: 'too_late' }

  const startedAt = room.question_started_at ? new Date(room.question_started_at).getTime() : now
  const duration = Math.max(1, endsAt - startedAt)
  const remaining = Math.max(0, Math.min(duration, endsAt - now))
  const isCorrect = choice === question.correct_index
  const points = isCorrect ? 500 + Math.round(500 * (remaining / duration)) : 0

  room.answers.push({
    player_id: playerId,
    room_id: room.id,
    q_index: room.q_index,
    choice,
    is_correct: isCorrect,
    points,
    answered_at: new Date(now).toISOString(),
  })
  if (isCorrect) player.score += points
  writeRooms(rooms, cleanCode)
  return { ok: true, isCorrect, points }
}

// ----- Điều khiển của giáo viên -----

export function startDemoRoom(code: string): DemoRoom | null {
  const cleanCode = normalizeCode(code)
  const rooms = readRooms()
  const room = rooms[cleanCode]
  if (!room || room.phase !== 'lobby' || room.questions.length === 0) return null
  beginQuestion(room, 0)
  writeRooms(rooms, cleanCode)
  return room
}

export function revealDemoRoom(code: string): DemoRoom | null {
  const cleanCode = normalizeCode(code)
  const rooms = readRooms()
  const room = rooms[cleanCode]
  if (!room || room.phase !== 'question') return null
  room.phase = 'reveal'
  room.question_ends_at = null
  writeRooms(rooms, cleanCode)
  return room
}

export function nextDemoQuestion(code: string): DemoRoom | null {
  const cleanCode = normalizeCode(code)
  const rooms = readRooms()
  const room = rooms[cleanCode]
  if (!room) return null

  if (room.phase === 'lobby') {
    beginQuestion(room, 0)
  } else if (room.phase === 'question' || room.phase === 'reveal') {
    const next = room.q_index + 1
    if (next >= room.questions.length) {
      room.phase = 'finished'
      room.question_ends_at = null
    } else {
      beginQuestion(room, next)
    }
  } else {
    return room
  }
  writeRooms(rooms, cleanCode)
  return room
}

export function endDemoRoom(code: string): DemoRoom | null {
  const cleanCode = normalizeCode(code)
  const rooms = readRooms()
  const room = rooms[cleanCode]
  if (!room) return null
  room.phase = 'finished'
  room.question_ends_at = null
  writeRooms(rooms, cleanCode)
  return room
}

// ----- Thống kê & đồng bộ -----

export function demoStats(room: DemoRoom, qIndex: number): DemoStats {
  const counts = [0, 0, 0, 0]
  const answeredIds = new Set<string>()
  let correctCount = 0
  for (const answer of room.answers) {
    if (answer.q_index !== qIndex) continue
    answeredIds.add(answer.player_id)
    if (answer.choice >= 0 && answer.choice < 4) counts[answer.choice] += 1
    if (answer.is_correct) correctCount += 1
  }
  return { counts, answeredIds, total: answeredIds.size, correctCount }
}

// Theo dõi thay đổi phòng (mọi tab cùng trình duyệt).
// code = null → theo dõi mọi phòng (dùng cho danh sách).
export function subscribeDemo(code: string | null, onChange: () => void): () => void {
  const cleanCode = code ? normalizeCode(code) : null
  const onMessage = (event: MessageEvent) => {
    const data = event.data as { type?: string; code?: string } | null
    if (!data) return
    if (cleanCode && data.code && data.code !== cleanCode) return
    onChange()
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === ROOMS_KEY) onChange()
  }

  const ch = getChannel()
  ch?.addEventListener('message', onMessage)
  window.addEventListener('storage', onStorage)
  return () => {
    ch?.removeEventListener('message', onMessage)
    window.removeEventListener('storage', onStorage)
  }
}
