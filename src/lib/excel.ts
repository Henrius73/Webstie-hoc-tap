// Đọc câu hỏi từ tệp Excel (.xlsx/.xls) và tạo tệp mẫu tải về.
// Thư viện SheetJS được nạp động (chunk riêng) để không làm nặng lần tải đầu.
import type { QuestionInput } from '../types/db'

export interface ExcelParseResult {
  questions: QuestionInput[]
  errors: string[]
  sheetName: string | null
}

export const MAX_EXCEL_BYTES = 5 * 1024 * 1024

const HEADER_RE = /^(câu hỏi|noi dung|nội dung|question|questions)$/i

function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value).replace(/\s+/g, ' ').trim()
}

function rowIsEmpty(row: unknown[]): boolean {
  return row.every(cell => cellText(cell) === '')
}

// Nhận diện dòng tiêu đề (có thể có ở vài dòng đầu).
function looksLikeHeader(row: unknown[]): boolean {
  const cells = row.map(cellText)
  if (HEADER_RE.test(cells[0] ?? '')) return true
  const joined = cells.join(' ').toLowerCase()
  return joined.includes('đáp án đúng') || joined.includes('correct answer')
}

// Đáp án đúng có thể là A–D, 1–4 hoặc đúng nguyên văn một trong bốn đáp án.
function parseCorrectIndex(raw: string, options: string[]): number {
  const value = raw.trim()
  const letter = value.toUpperCase()
  if (/^[A-D]$/.test(letter)) return letter.charCodeAt(0) - 65
  if (/^[1-4]$/.test(value)) return Number(value) - 1
  return options.findIndex(option => option.toLowerCase() === value.toLowerCase())
}

function parseRows(rows: unknown[][]): { questions: QuestionInput[]; errors: string[] } {
  const questions: QuestionInput[] = []
  const errors: string[] = []

  // Tìm dòng tiêu đề trong 10 dòng đầu; không có thì đọc từ dòng đầu tiên.
  let startIndex = 0
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (looksLikeHeader(rows[i])) {
      startIndex = i + 1
      break
    }
  }

  rows.slice(startIndex).forEach((row, offset) => {
    const rowNo = startIndex + offset + 1
    if (rowIsEmpty(row)) return

    const [text, a, b, c, d, keyRaw, timeRaw, imageRaw] = row.map(cellText)
    if (!text) {
      errors.push(`Dòng ${rowNo}: thiếu nội dung câu hỏi.`)
      return
    }
    const options = [a, b, c, d]
    if (options.some(option => !option)) {
      errors.push(`Dòng ${rowNo}: cần đủ 4 đáp án A–D, không để trống.`)
      return
    }
    const correctIndex = parseCorrectIndex(keyRaw ?? '', options)
    if (correctIndex < 0) {
      errors.push(`Dòng ${rowNo}: đáp án đúng phải là A–D, 1–4 hoặc đúng nội dung một đáp án.`)
      return
    }
    const rawLimit = Math.round(Number(timeRaw) || 0)
    questions.push({
      text: text.slice(0, 2000),
      options: options.map(option => option.slice(0, 200)),
      correctIndex,
      timeLimit: rawLimit >= 5 ? Math.min(300, rawLimit) : 20,
      imageUrl: imageRaw ? imageRaw.slice(0, 1200) : null,
    })
  })

  return { questions, errors }
}

export async function parseExcelFile(file: File): Promise<ExcelParseResult> {
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    return { questions: [], errors: ['Chỉ hỗ trợ tệp Excel (.xlsx hoặc .xls).'], sheetName: null }
  }
  if (file.size > MAX_EXCEL_BYTES) {
    return { questions: [], errors: ['Tệp lớn hơn 5 MB — hãy chia nhỏ bộ câu hỏi.'], sheetName: null }
  }

  const XLSX = await import('xlsx')

  let workbook: import('xlsx').WorkBook
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  } catch {
    return {
      questions: [],
      errors: ['Không mở được tệp. Tệp có thể bị hỏng, sai định dạng hoặc có mật khẩu.'],
      sheetName: null,
    }
  }

  // Chọn trang tính đầu tiên có dữ liệu.
  let sheetName: string | null = null
  let rows: unknown[][] = []
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue
    const candidate = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: true,
      defval: '',
      raw: false,
    })
    if (candidate.some(row => !rowIsEmpty(row))) {
      sheetName = name
      rows = candidate
      break
    }
  }

  if (!sheetName) {
    return { questions: [], errors: ['Tệp Excel không có dữ liệu.'], sheetName: null }
  }

  const { questions, errors } = parseRows(rows)
  if (!questions.length && !errors.length) {
    errors.push('Không đọc được câu hỏi nào. Hãy kiểm tra lại bố cục tệp hoặc dùng tệp mẫu.')
  }
  return { questions, errors, sheetName }
}

// Tải tệp mẫu .xlsx (2 trang: Câu hỏi + Hướng dẫn).
export async function downloadExcelTemplate(): Promise<void> {
  const XLSX = await import('xlsx')

  const header = [
    'Câu hỏi',
    'Đáp án A',
    'Đáp án B',
    'Đáp án C',
    'Đáp án D',
    'Đáp án đúng',
    'Thời gian (giây)',
    'Ảnh (URL)',
  ]
  const dataSheet = XLSX.utils.aoa_to_sheet([
    header,
    ['25 + 17 bằng bao nhiêu?', '40', '41', '42', '43', 'C', 20, ''],
    ['Thủ đô của Việt Nam là gì?', 'Hà Nội', 'Huế', 'Đà Nẵng', 'TP. Hồ Chí Minh', 'A', 15, ''],
  ])
  dataSheet['!cols'] = [
    { wch: 46 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 30 },
  ]

  const guideSheet = XLSX.utils.aoa_to_sheet([
    ['Hướng dẫn nhập câu hỏi từ Excel — Học Vui'],
    [],
    ['1. Mỗi dòng là một câu hỏi, bắt đầu từ dòng 2 (dòng 1 là tiêu đề).'],
    ['2. Cột A: nội dung câu hỏi.'],
    ['3. Cột B–E: bốn đáp án A, B, C, D (không được để trống).'],
    ['4. Cột F: đáp án đúng — nhập A/B/C/D, 1/2/3/4 hoặc đúng nguyên văn một đáp án.'],
    ['5. Cột G: thời gian trả lời tính bằng giây (5–300). Bỏ trống = 20 giây.'],
    ['6. Cột H: URL ảnh minh họa (không bắt buộc).'],
    [],
    ['Có thể xóa các dòng ví dụ trước khi nhập tệp của bạn.'],
    ['Hỗ trợ tệp .xlsx và .xls, dung lượng tối đa 5 MB.'],
  ])
  guideSheet['!cols'] = [{ wch: 92 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Câu hỏi')
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Hướng dẫn')
  XLSX.writeFile(workbook, 'mau-cau-hoi-hoc-vui.xlsx')
}
