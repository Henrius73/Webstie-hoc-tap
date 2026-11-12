// CRUD bộ câu hỏi của giáo viên (RLS chỉ cho chủ bộ).
import { requireSupabase } from '../lib/supabase'
import type { QuestionInput, QuestionRow, QuizSetRow } from '../types/db'

export interface QuizSummary {
  id: string
  title: string
  count: number
  createdAt: string
  ownerId: string
}

export interface QuestionDraft {
  text: string
  options: string[]
  correct_index: number
  image_url: string | null
  time_limit: number
}

// Kiểm tra + chuẩn hóa câu hỏi trước khi ghi lên Supabase.
export function normalizeQuestions(questions: QuestionInput[]): QuestionDraft[] {
  return questions.map(question => {
    const text = String(question.text ?? '').trim().slice(0, 2000)
    if (!text) throw new Error('Có câu hỏi chưa nhập nội dung.')

    const options = (Array.isArray(question.options) ? question.options : []).map(option =>
      String(option ?? '').trim().slice(0, 200),
    )
    if (options.length !== 4 || options.some(option => !option)) {
      throw new Error('Mỗi câu hỏi cần đúng 4 đáp án và không để trống.')
    }

    const correctIndex = Number(question.correctIndex)
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      throw new Error('Câu hỏi cần chọn 1 trong 4 đáp án đúng.')
    }

    const rawLimit = Math.round(Number(question.timeLimit) || 0)
    const timeLimit = rawLimit >= 5 ? Math.min(300, rawLimit) : 20

    const imageUrl = String(question.imageUrl ?? '').trim().slice(0, 1200)

    return {
      text,
      options,
      correct_index: correctIndex,
      image_url: imageUrl || null,
      time_limit: timeLimit,
    }
  })
}

interface QuizSummaryRow {
  id: string
  title: string
  created_at: string
  question_count: number | string | null
  owner_id: string
}

// Danh sách bộ câu hỏi dùng chung cho mọi máy (RPC đếm câu dù RLS câu hỏi chỉ mở cho chủ).
export async function listQuizzes(): Promise<QuizSummary[]> {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('list_quiz_summaries')
  if (error) throw error

  return ((data ?? []) as QuizSummaryRow[]).map(row => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    count: Number(row.question_count) || 0,
    ownerId: row.owner_id,
  }))
}

export async function fetchQuiz(id: string): Promise<{ quiz: QuizSetRow; questions: QuestionRow[] }> {
  const sb = requireSupabase()
  const { data: quiz, error: quizError } = await sb
    .from('quiz_sets')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (quizError) throw quizError
  if (!quiz) throw new Error('room_not_found')

  const { data: questions, error: questionsError } = await sb
    .from('questions')
    .select('*')
    .eq('quiz_id', id)
    .order('q_index', { ascending: true })
  if (questionsError) throw questionsError

  return { quiz: quiz as QuizSetRow, questions: (questions ?? []) as QuestionRow[] }
}

export async function createQuizSet(title: string, questions: QuestionInput[]): Promise<string> {
  const sb = requireSupabase()
  const drafts = normalizeQuestions(questions)
  const cleanTitle = title.trim().slice(0, 120) || 'Bộ câu hỏi'

  // Gán chủ sở hữu ngay khi tạo: RLS bắt buộc owner_id = auth.uid().
  const { data: sessionData } = await sb.auth.getSession()
  const ownerId = sessionData.session?.user.id
  if (!ownerId) throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.')

  const { data: quiz, error } = await sb
    .from('quiz_sets')
    .insert({ title: cleanTitle, owner_id: ownerId })
    .select('id')
    .single()
  if (error) throw error

  try {
    await insertQuestions(sb, quiz.id as string, drafts)
  } catch (err) {
    // Không để lại bộ rỗng nếu phần câu hỏi lỗi.
    await sb.from('quiz_sets').delete().eq('id', quiz.id as string)
    throw err
  }
  return quiz.id as string
}

export async function updateQuizSet(id: string, title: string, questions: QuestionInput[]): Promise<void> {
  const sb = requireSupabase()
  const drafts = normalizeQuestions(questions)
  const cleanTitle = title.trim().slice(0, 120) || 'Bộ câu hỏi'

  const { error: titleError } = await sb.from('quiz_sets').update({ title: cleanTitle }).eq('id', id)
  if (titleError) throw titleError

  const { error: deleteError } = await sb.from('questions').delete().eq('quiz_id', id)
  if (deleteError) throw deleteError

  await insertQuestions(sb, id, drafts)
}

export async function deleteQuizSet(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('quiz_sets').delete().eq('id', id)
  if (error) throw error
}

async function insertQuestions(
  sb: ReturnType<typeof requireSupabase>,
  quizId: string,
  drafts: QuestionDraft[],
): Promise<void> {
  if (!drafts.length) return
  const rows = drafts.map((draft, index) => ({ quiz_id: quizId, q_index: index, ...draft }))
  const { error } = await sb.from('questions').insert(rows)
  if (error) throw error
}
