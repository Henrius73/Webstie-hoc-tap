// Kiểu dữ liệu cho các dòng bảng Supabase (xem supabase/migrations/0001_init.sql).

export type RoomPhase = 'lobby' | 'question' | 'reveal' | 'finished'

export interface QuizSetRow {
  id: string
  owner_id: string
  title: string
  created_at: string
}

export interface QuestionRow {
  id: string
  quiz_id: string
  q_index: number
  text: string
  options: string[]
  correct_index: number
  image_url: string | null
  time_limit: number
}

export interface RoomQuestion {
  text: string
  options: string[]
  image_url: string | null
  time_limit: number
}

export interface RoomRow {
  id: string
  code: string
  host_id: string
  quiz_id: string
  phase: RoomPhase
  total_questions: number
  q_index: number
  question: RoomQuestion | null
  correct_index: number | null
  question_started_at: string | null
  question_ends_at: string | null
  created_at: string
}

export interface PlayerRow {
  id: string
  room_id: string
  user_id: string
  name: string
  score: number
  joined_at: string
}

export interface AnswerRow {
  player_id: string
  room_id: string
  q_index: number
  choice: number
  is_correct: boolean
  points: number
}

// Dạng câu hỏi khi soạn/chỉnh sửa trong trình soạn thảo.
export interface QuestionInput {
  text: string
  options: string[]
  correctIndex: number
  timeLimit: number
  imageUrl?: string | null
}
