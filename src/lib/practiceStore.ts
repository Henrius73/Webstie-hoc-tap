// Kho "Luyện tập" cục bộ: bộ câu hỏi tự soạn + kết quả, lưu trong localStorage
// của trình duyệt này (không dùng Supabase, không cần mạng/tài khoản).
// Nếu localStorage bị chặn (chép私密 tab...), dùng bộ nhớ trong phiên để app vẫn chạy.
import type { QuestionInput } from '../types/db'

export interface LocalQuizSet {
  id: string
  title: string
  questions: QuestionInput[]
  createdAt: number
  updatedAt: number
}

export interface PracticeResult {
  // last: lần gần nhất; best: theo phần trăm đúng cao nhất.
  last: { correct: number; total: number; at: number }
  best: { correct: number; total: number; at: number }
}

const SETS_KEY = 'hocvui.practice.sets'
const RESULTS_KEY = 'hocvui.practice.results'

// Dự phòng khi localStorage không dùng được (trình duyệt chặn, ...).
let memorySets: LocalQuizSet[] | null = null
let memoryResults: Record<string, PracticeResult> | null = null

function makeId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

function readSets(): LocalQuizSet[] {
  if (memorySets) return memorySets
  try {
    const raw = localStorage.getItem(SETS_KEY)
    const parsed = raw ? (JSON.parse(raw) as LocalQuizSet[]) : []
    memorySets = Array.isArray(parsed) ? parsed.filter(set => set && set.id) : []
  } catch {
    memorySets = []
  }
  return memorySets
}

function writeSets(sets: LocalQuizSet[]): void {
  memorySets = sets
  try {
    localStorage.setItem(SETS_KEY, JSON.stringify(sets))
  } catch {
    // giữ trong bộ nhớ phiên — không lưu được lâu dài
  }
}

function readResults(): Record<string, PracticeResult> {
  if (memoryResults) return memoryResults
  try {
    const raw = localStorage.getItem(RESULTS_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, PracticeResult>) : {}
    memoryResults = parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    memoryResults = {}
  }
  return memoryResults
}

function writeResults(results: Record<string, PracticeResult>): void {
  memoryResults = results
  try {
    localStorage.setItem(RESULTS_KEY, JSON.stringify(results))
  } catch {
    // như trên
  }
}

export function listSets(): LocalQuizSet[] {
  return [...readSets()].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getSet(id: string): LocalQuizSet | null {
  return readSets().find(set => set.id === id) ?? null
}

export function createSet(title: string, questions: QuestionInput[] = []): LocalQuizSet {
  const now = Date.now()
  const set: LocalQuizSet = {
    id: makeId(),
    title: title.trim().slice(0, 120) || 'Bộ luyện tập',
    questions,
    createdAt: now,
    updatedAt: now,
  }
  writeSets([...readSets(), set])
  return set
}

export function updateSet(id: string, patch: Partial<Pick<LocalQuizSet, 'title' | 'questions'>>): LocalQuizSet | null {
  const sets = readSets()
  const index = sets.findIndex(set => set.id === id)
  if (index < 0) return null
  const next = { ...sets[index], ...patch, updatedAt: Date.now() }
  sets[index] = next
  writeSets(sets)
  return next
}

export function deleteSet(id: string): void {
  writeSets(readSets().filter(set => set.id !== id))
  const results = readResults()
  delete results[id]
  writeResults(results)
}

export function duplicateSet(id: string): LocalQuizSet | null {
  const source = getSet(id)
  if (!source) return null
  return createSet(`${source.title} (bản sao)`, source.questions)
}

// Ghi nhận kết quả làm bài: cập nhật lần gần nhất + lần tốt nhất.
export function recordResult(setId: string, correct: number, total: number): void {
  if (total <= 0) return
  const at = Date.now()
  const results = readResults()
  const prev = results[setId]
  const entry: PracticeResult = {
    last: { correct, total, at },
    best: prev
      ? correct / total > prev.best.correct / prev.best.total
        ? { correct, total, at }
        : prev.best
      : { correct, total, at },
  }
  results[setId] = entry
  writeResults(results)
}

export function getResult(setId: string): PracticeResult | null {
  return readResults()[setId] ?? null
}

// Bộ câu hỏi mẫu dùng chung cho Luyện tập và phòng chơi thử.
export const SAMPLE_QUESTIONS: QuestionInput[] = [
  {
    text: 'Thủ đô của Việt Nam là thành phố nào?',
    options: ['Hà Nội', 'Huế', 'Đà Nẵng', 'Thành phố Hồ Chí Minh'],
    correctIndex: 0,
    timeLimit: 20,
    imageUrl: null,
  },
  {
    text: '2 + 2 × 2 = ?',
    options: ['6', '8', '4', '2'],
    correctIndex: 0,
    timeLimit: 15,
    imageUrl: null,
  },
  {
    text: 'Sông Nile chảy qua châu lục nào?',
    options: ['Châu Phi', 'Châu Á', 'Châu Âu', 'Châu Đại Dương'],
    correctIndex: 0,
    timeLimit: 20,
    imageUrl: null,
  },
  {
    text: 'Nước sôi ở nhiệt độ bao nhiêu độ C (điều kiện thường)?',
    options: ['90', '100', '110', '120'],
    correctIndex: 1,
    timeLimit: 15,
    imageUrl: null,
  },
  {
    text: 'Hành tinh nào lớn nhất Hệ Mặt Trời?',
    options: ['Sao Hỏa', 'Trái Đất', 'Sao Mộc', 'Sao Kim'],
    correctIndex: 2,
    timeLimit: 20,
    imageUrl: null,
  },
  {
    text: 'Ngày Quốc khánh nước CHXHCN Việt Nam là ngày nào?',
    options: ['30/4', '1/5', '2/9', '1/6'],
    correctIndex: 2,
    timeLimit: 15,
    imageUrl: null,
  },
  {
    text: 'Đơn vị đo lực trong hệ SI là gì?',
    options: ['Jun (J)', 'Niutơn (N)', 'Oát (W)', 'Pascal (P)'],
    correctIndex: 1,
    timeLimit: 20,
    imageUrl: null,
  },
  {
    text: 'Đồng hồ có 1 giờ bằng bao nhiêu phút?',
    options: ['100 phút', '30 phút', '24 phút', '60 phút'],
    correctIndex: 3,
    timeLimit: 10,
    imageUrl: null,
  },
]

// Bộ câu hỏi mẫu để dùng thử ngay khi lần đầu vào trang luyện tập.
export function makeSampleSet(): LocalQuizSet {
  return createSet(
    'Bộ câu hỏi mẫu — kiến thức chung',
    SAMPLE_QUESTIONS.map(question => ({ ...question, options: [...question.options] })),
  )
}
