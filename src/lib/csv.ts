// Đọc câu hỏi từ CSV hoặc bảng dán trực tiếp từ Excel (phân tách bằng tab).
// Định dạng mỗi dòng: câu hỏi, A, B, C, D, đáp án đúng (A–D hoặc 1–4), [thời gian giây]
import type { QuestionInput } from '../types/db'

export interface CsvParseResult {
  questions: QuestionInput[]
  errors: string[]
}

// Tách một dòng có hỗ trợ cột đặt trong dấu nháy kép ("A,B" vẫn là 1 cột).
function splitLine(line: string, sep: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === sep) {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells
}

// Ưu tiên tab (bảng dán từ Excel), rồi dấu chấm phẩy, rồi dấu phẩy.
function detectSep(line: string): string {
  let best = ','
  let bestCount = -1
  for (const sep of ['\t', ';', ','] as const) {
    const count = line.split(sep).length - 1
    if (count > bestCount) {
      best = sep
      bestCount = count
    }
  }
  return best
}

export function parseCsvQuestions(raw: string): CsvParseResult {
  const questions: QuestionInput[] = []
  const errors: string[] = []

  const lines = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
  if (lines.length === 0) {
    return { questions, errors: ['Chưa có dữ liệu nào.'] }
  }

  // Bỏ qua dòng tiêu đề nếu trông giống header.
  if (/^(câu hỏi|question|nội dung)/i.test(lines[0])) lines.shift()

  const sep = detectSep(lines[0])

  lines.forEach((line, i) => {
    const lineNo = i + 1
    const cells = splitLine(line, sep).map(cell => cell.trim())
    if (cells.length < 6) {
      errors.push(
        `Dòng ${lineNo}: cần ít nhất 6 cột — câu hỏi, 4 đáp án, đáp án đúng (A–D hoặc 1–4).`,
      )
      return
    }
    const [text, a, b, c, d, keyRaw, timeRaw] = cells
    if (!text) {
      errors.push(`Dòng ${lineNo}: thiếu nội dung câu hỏi.`)
      return
    }
    const options = [a, b, c, d]
    if (options.some(option => !option)) {
      errors.push(`Dòng ${lineNo}: cần đủ 4 đáp án, không để trống.`)
      return
    }
    const letter = keyRaw.toUpperCase()
    const correctIndex = 'ABCD'.includes(letter) ? 'ABCD'.indexOf(letter) : Number(keyRaw) - 1
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      errors.push(`Dòng ${lineNo}: đáp án đúng phải là A–D hoặc 1–4.`)
      return
    }
    const rawLimit = Math.round(Number(timeRaw) || 0)
    questions.push({
      text: text.slice(0, 2000),
      options: options.map(option => option.slice(0, 200)),
      correctIndex,
      timeLimit: rawLimit >= 5 ? Math.min(300, rawLimit) : 20,
      imageUrl: null,
    })
  })

  return { questions, errors }
}
