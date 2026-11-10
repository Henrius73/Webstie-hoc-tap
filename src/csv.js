// Nhập câu hỏi hàng loạt từ CSV theo định dạng ở mục 5 của project.md.
import { uid } from './utils.js';

const COLUMNS = 6;

// Dòng tiêu đề đúng mục 5; chấp nhận khác hoa/thường và khoảng trắng thừa
function looksLikeHeader(cells) {
  const c = cells.map(x => x.trim().toLowerCase());
  return c[0] === 'câu hỏi'
    && c[1]?.startsWith('đáp án')
    && c[5]?.startsWith('đáp án đúng');
}

// Tách văn bản CSV thành từng dòng, mỗi dòng là { cells, line }.
// Hỗ trợ ô trong ngoặc kép: dấu phẩy, xuống dòng và dấu ngoặc kép lặp "".
export function parseCsvRows(text) {
  const input = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let cells = [];
  let field = '';
  let inQuotes = false;
  let fieldStarted = false;
  let line = 1;
  let rowLine = 1;

  // Kết thúc một dòng dữ liệu
  function pushRow() {
    cells.push(field);
    rows.push({ cells, line: rowLine });
    cells = [];
    field = '';
    fieldStarted = false;
  }

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else if (ch === '\n') {
        field += '\n';
        line++;
      } else if (ch === '\r') {
        if (input[i + 1] === '\n') i++;
        field += '\n';
        line++;
      } else {
        field += ch;
      }
      continue;
    }

    // Ngoặc kép chỉ mở ô khi đứng ở đầu ô
    if (ch === '"' && field === '') {
      inQuotes = true;
      fieldStarted = true;
      continue;
    }

    if (ch === ',') {
      cells.push(field);
      field = '';
      fieldStarted = false;
      continue;
    }

    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      pushRow();
      line++;
      rowLine = line;
      continue;
    }

    field += ch;
    fieldStarted = true;
  }

  if (fieldStarted || field !== '' || cells.length) pushRow();
  return rows;
}

// Đọc CSV thành danh sách câu hỏi hợp lệ; dòng lỗi được bỏ qua và ghi vào errors.
export function parseCsvQuestions(text) {
  const rows = parseCsvRows(text);
  const questions = [];
  const errors = [];
  let firstRow = true;

  for (const row of rows) {
    const cells = row.cells.map(c => c.trim());

    // Bỏ các cột trống dư ở cuối do bảng tính tự thêm
    while (cells.length > COLUMNS && cells[cells.length - 1] === '') cells.pop();
    if (cells.every(c => c === '')) continue; // bỏ dòng trống

    if (firstRow) {
      firstRow = false;
      if (looksLikeHeader(cells)) {
        if (cells.length !== COLUMNS) {
          errors.push({ line: row.line, message: `Dòng tiêu đề có ${cells.length} cột, cần đúng ${COLUMNS} cột.` });
        }
        continue;
      }
    }

    if (cells.length !== COLUMNS) {
      errors.push({ line: row.line, message: `Có ${cells.length} cột, cần đúng ${COLUMNS} cột.` });
      continue;
    }

    const [question, a, b, c, d, answer] = cells;
    const options = [a, b, c, d];

    if (!question) {
      errors.push({ line: row.line, message: 'Nội dung câu hỏi đang trống.' });
      continue;
    }

    const missing = ['A', 'B', 'C', 'D'].filter((_, i) => !options[i]);
    if (missing.length) {
      errors.push({ line: row.line, message: `Đáp án ${missing.join(', ')} đang trống.` });
      continue;
    }

    const key = answer.toUpperCase();
    if (!/^[A-D]$/.test(key)) {
      errors.push({
        line: row.line,
        message: `Đáp án đúng phải là A, B, C hoặc D (đang là "${answer || 'trống'}").`,
      });
      continue;
    }

    questions.push({
      id: uid(),
      text: question,
      options,
      correctIndex: 'ABCD'.indexOf(key),
      image: null,
      timeLimit: 0,
    });
  }

  if (!questions.length && !errors.length) {
    errors.push({ line: 0, message: 'Tệp CSV không có dòng dữ liệu nào.' });
  }

  return { questions, errors };
}
