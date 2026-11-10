// Đọc/ghi tệp Excel .xlsx tối giản, không dùng thư viện ngoài.
// Chỉ hỗ trợ .xlsx hiện đại (ZIP + XML), không hỗ trợ .xls cũ.
import { uid } from './utils.js';

const XML_DECODER = new TextDecoder('utf-8');
const XML_ENCODER = new TextEncoder();

// Thứ tự cột khi xuất Excel; dòng 1 luôn là tiêu đề này.
const COLUMNS = [
  'Loại câu hỏi',
  'Câu hỏi',
  'Đáp án A',
  'Đáp án B',
  'Đáp án C',
  'Đáp án D',
  'Đáp án đúng',
  'Các đáp án đúng',
  'Ảnh (URL)',
  'Thời gian (giây)',
];

const LETTERS = ['A', 'B', 'C', 'D'];
const MAX_ANSWERS = 5;

// ===== Tiện ích chung =====

// Bỏ dấu tiếng Việt + ký hiệu để so khớp tiêu đề/loại câu linh hoạt
function plain(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/[():*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAnswers(raw) {
  const seen = new Set();
  const answers = [];
  for (const item of raw) {
    const value = String(item ?? '').replace(/\s+/g, ' ').trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    answers.push(value);
    if (answers.length === MAX_ANSWERS) break;
  }
  return answers;
}

// Loại câu hỏi: để trống = trắc nghiệm; nhận cả tiếng Việt không dấu
function parseType(raw) {
  const text = plain(raw);
  if (!text) return 'choice';
  if (/dung\s*\/?\s*sai|boolean|true\s*\/?\s*false/.test(text)) return 'boolean';
  if (/dien\s*tu|dien|fill/.test(text)) return 'fill';
  if (/trac\s*nghiem|choice/.test(text)) return 'choice';
  return null;
}

function typeLabel(type) {
  if (type === 'boolean') return 'Đúng/Sai';
  if (type === 'fill') return 'Điền từ';
  return 'Trắc nghiệm';
}

// ===== Đọc ZIP =====

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

function findEocd(view) {
  const min = Math.max(0, view.byteLength - 65557);
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) === SIG_EOCD) return i;
  }
  return -1;
}

// Giải nén một entry kiểu "deflate-raw" bằng API có sẵn của trình duyệt
async function inflateRaw(data) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Trình duyệt không hỗ trợ giải nén .xlsx. Hãy dùng Chrome, Edge hoặc Safari phiên bản mới.');
  }

  try {
    const stream = new Blob([data]).stream()
      .pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    throw new Error('Không giải nén được tệp .xlsx. Tệp có thể bị hỏng hoặc là định dạng .xls cũ.');
  }
}

// Trả về Map<tên file, Uint8Array> cho các file cần đọc
async function unzip(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 22) throw new Error('Tệp không phải định dạng .xlsx hợp lệ.');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(view);
  if (eocd < 0) {
    throw new Error('Tệp không phải định dạng .xlsx hợp lệ (có thể là .xls cũ).');
  }

  const count = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  const files = new Map();
  let pos = cdOffset;

  for (let i = 0; i < count; i++) {
    if (pos + 46 > bytes.length || view.getUint32(pos, true) !== SIG_CENTRAL) break;

    const method = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = XML_DECODER.decode(bytes.subarray(pos + 46, pos + 46 + nameLength));
    pos += 46 + nameLength + extraLength + commentLength;

    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== SIG_LOCAL) continue;

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = bytes.subarray(start, start + compressedSize);

    try {
      if (method === 0) files.set(name, raw);
      else if (method === 8) files.set(name, await inflateRaw(raw));
    } catch (err) {
      throw new Error(err.message || `Không đọc được "${name}" trong tệp .xlsx.`);
    }
  }

  return files;
}

// ===== Đọc XML =====

function parseXml(bytes, label) {
  if (!bytes) throw new Error(`Tệp .xlsx thiếu "${label}".`);
  const doc = new DOMParser().parseFromString(XML_DECODER.decode(bytes), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error(`Tệp .xlsx bị lỗi định dạng ở "${label}".`);
  }
  return doc;
}

// Ghép các đoạn chữ trong một ô (bỏ phần phiên âm rPh của tiếng Nhật/Trung)
function nodeText(node) {
  let text = '';
  const parts = node.getElementsByTagName('t');
  for (const part of parts) {
    let parent = part.parentNode;
    let phonetic = false;
    while (parent && parent !== node) {
      if (parent.nodeName === 'rPh') { phonetic = true; break; }
      parent = parent.parentNode;
    }
    if (!phonetic) text += part.textContent || '';
  }
  return text;
}

function readSharedStrings(doc) {
  const list = [];
  if (!doc) return list;
  for (const item of doc.getElementsByTagName('si')) list.push(nodeText(item));
  return list;
}

function columnIndex(ref) {
  const match = /^([A-Z]+)/i.exec(ref || '');
  if (!match) return -1;
  let index = 0;
  for (const ch of match[1].toUpperCase()) {
    index = index * 26 + (ch.charCodeAt(0) - 64);
  }
  return index - 1;
}

function cellValue(cell, sharedStrings) {
  const type = cell.getAttribute('t') || 'n';

  if (type === 'inlineStr') {
    const inline = cell.getElementsByTagName('is')[0];
    return inline ? nodeText(inline) : '';
  }

  const valueEl = cell.getElementsByTagName('v')[0];
  const raw = valueEl?.textContent ?? '';

  if (type === 's') return sharedStrings[Number(raw)] ?? '';
  if (type === 'b') return raw === '1' ? 'TRUE' : 'FALSE';
  return raw;
}

// Đọc toàn bộ dòng của sheet; giữ số dòng Excel để báo lỗi chính xác
function readSheetRows(doc, sharedStrings) {
  const rows = [];
  let autoLine = 0;

  for (const rowEl of doc.getElementsByTagName('row')) {
    const declared = Number(rowEl.getAttribute('r'));
    const line = Number.isFinite(declared) && declared > 0 ? declared : autoLine + 1;
    autoLine = line;

    const cells = [];
    for (const cellEl of rowEl.getElementsByTagName('c')) {
      const index = columnIndex(cellEl.getAttribute('r'));
      if (index < 0) continue;
      while (cells.length <= index) cells.push('');
      cells[index] = cellValue(cellEl, sharedStrings);
    }

    rows.push({ cells, line });
  }

  return rows;
}

// Tìm đường dẫn worksheet đầu tiên từ workbook.xml + quan hệ
function firstSheetPath(zip) {
  const fallback = [...zip.keys()]
    .filter(name => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0] || '';

  const workbookBytes = zip.get('xl/workbook.xml');
  if (!workbookBytes) return fallback;

  const workbook = parseXml(workbookBytes, 'xl/workbook.xml');
  const sheet = workbook.getElementsByTagName('sheet')[0];
  if (!sheet) return fallback;

  const relId = sheet.getAttribute('r:id') || sheet.getAttribute('relationshipId');
  const relBytes = zip.get('xl/_rels/workbook.xml.rels');
  if (!relId || !relBytes) return fallback;

  const rels = parseXml(relBytes, 'xl/_rels/workbook.xml.rels');
  for (const rel of rels.getElementsByTagName('Relationship')) {
    if (rel.getAttribute('Id') !== relId) continue;
    const target = String(rel.getAttribute('Target') || '').replace(/\\/g, '/');
    if (!target) return fallback;
    if (target.startsWith('/')) return target.slice(1);
    if (target.startsWith('xl/')) return target;
    return `xl/${target.replace(/^\.\//, '')}`;
  }

  return fallback;
}

// ===== Chuyển dòng Excel thành câu hỏi =====

// Nhận diện tiêu đề cột; trả về map khóa -> chỉ số cột
function headerMap(cells) {
  const map = {};
  cells.forEach((cell, index) => {
    const text = plain(cell);
    if (!text) return;

    const option = /^dap an ([a-d])$/.exec(text);
    if (option) {
      const key = `option${LETTERS.indexOf(option[1].toUpperCase())}`;
      if (map[key] === undefined) map[key] = index;
      return;
    }

    let key = '';
    if (text === 'loai cau hoi' || text === 'dang cau hoi' || text === 'type') key = 'type';
    else if (text === 'cau hoi' || text === 'noi dung' || text === 'noi dung cau hoi' || text === 'question') key = 'text';
    else if (text === 'dap an dung' || text === 'dap an') key = 'answer';
    else if (text === 'cac dap an dung' || text === 'dap an dung khac') key = 'answers';
    else if (text.startsWith('anh')) key = 'image';
    else if (text.startsWith('thoi gian')) key = 'timeLimit';

    if (key && map[key] === undefined) map[key] = index;
  });
  return map;
}

function readField(cells, map, key) {
  const index = map[key];
  return index === undefined ? '' : String(cells[index] ?? '');
}

// Xác định cách đọc cột cho file không có tiêu đề
function detectLayout(cells) {
  if (parseType(cells[0] ?? '')) return 'wide';
  if (cells.length >= 10) return 'wide';
  if (!String(cells[0] ?? '').trim() && cells.length >= 7 && String(cells[1] ?? '').trim()) return 'wide';
  return 'legacy';
}

function rowFields(row, layout, map) {
  const cells = row.cells;

  if (layout === 'mapped') {
    return {
      type: readField(cells, map, 'type'),
      text: readField(cells, map, 'text'),
      options: [0, 1, 2, 3].map(i => readField(cells, map, `option${i}`)),
      answer: readField(cells, map, 'answer'),
      answers: readField(cells, map, 'answers'),
      image: readField(cells, map, 'image'),
      time: readField(cells, map, 'timeLimit'),
    };
  }

  if (layout === 'wide') {
    return {
      type: String(cells[0] ?? ''),
      text: String(cells[1] ?? ''),
      options: [2, 3, 4, 5].map(i => String(cells[i] ?? '')),
      answer: String(cells[6] ?? ''),
      answers: String(cells[7] ?? ''),
      image: String(cells[8] ?? ''),
      time: String(cells[9] ?? ''),
    };
  }

  return {
    type: '',
    text: String(cells[0] ?? ''),
    options: [1, 2, 3, 4].map(i => String(cells[i] ?? '')),
    answer: String(cells[5] ?? ''),
    answers: '',
    image: '',
    time: '',
  };
}

function buildQuestion(fields, line) {
  const text = fields.text.trim();
  if (!text) return { error: { line, message: 'Nội dung câu hỏi đang trống.' } };

  const type = parseType(fields.type);
  if (!type) {
    return {
      error: {
        line,
        message: `Loại câu hỏi "${fields.type}" không hợp lệ. Dùng Trắc nghiệm, Đúng/Sai hoặc Điền từ.`,
      },
    };
  }

  const image = fields.image.trim() || null;
  const timeText = fields.time.trim();
  let timeLimit = 0;

  if (timeText) {
    const parsed = Number(timeText.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: { line, message: `Thời gian "${timeText}" không hợp lệ. Dùng số từ 0 đến 600 giây.` } };
    }
    timeLimit = Math.min(600, Math.round(parsed));
  }

  const question = {
    id: uid(),
    type,
    text,
    image,
    timeLimit,
  };

  if (type === 'fill') {
    const rawAnswers = fields.answers.trim() || fields.answer.trim();
    const answers = normalizeAnswers(rawAnswers.split('|'));
    if (!answers.length) {
      return { error: { line, message: 'Câu điền từ cần ít nhất 1 đáp án đúng (cột "Các đáp án đúng").' } };
    }
    return { question: { ...question, options: [], correctIndex: 0, answers } };
  }

  if (type === 'boolean') {
    const answer = plain(fields.answer);
    let correctIndex;
    if (!answer || answer === 'a' || /^(dung|true|1|yes|co)$/.test(answer)) correctIndex = 0;
    else if (answer === 'b' || /^(sai|false|0|no|khong)$/.test(answer)) correctIndex = 1;
    else {
      return { error: { line, message: `Đáp án đúng của câu Đúng/Sai phải là Đúng hoặc Sai (đang là "${fields.answer}").` } };
    }
    return { question: { ...question, options: ['Đúng', 'Sai'], correctIndex, answers: [] } };
  }

  const options = fields.options.map(option => option.trim());
  const missing = LETTERS.filter((_, index) => !options[index]);
  if (missing.length) {
    return { error: { line, message: `Đáp án ${missing.join(', ')} đang trống.` } };
  }

  // Chấp nhận "A", "a.", "B)", "C "… nhưng không nhận nhầm chữ khác
  const match = /^([A-Da-d])(?:[.)\s]|$)/.exec(fields.answer.trim());
  if (!match) {
    return {
      error: {
        line,
        message: `Đáp án đúng phải là A, B, C hoặc D (đang là "${fields.answer || 'trống'}").`,
      },
    };
  }

  return {
    question: {
      ...question,
      options,
      correctIndex: LETTERS.indexOf(match[1].toUpperCase()),
      answers: [],
    },
  };
}

// Đọc tệp Excel thành danh sách câu hỏi hợp lệ; dòng lỗi bị bỏ qua và ghi vào errors.
// Chỉ đọc sheet đầu tiên (mỗi bộ câu hỏi nằm trên một sheet khi xuất).
export async function parseXlsxQuestions(buffer) {
  const zip = await unzip(buffer);
  const sheetPath = firstSheetPath(zip);
  if (!sheetPath || !zip.has(sheetPath)) {
    throw new Error('Không tìm thấy trang tính nào trong tệp .xlsx.');
  }

  const sharedDoc = zip.has('xl/sharedStrings.xml')
    ? parseXml(zip.get('xl/sharedStrings.xml'), 'xl/sharedStrings.xml')
    : null;
  const sharedStrings = readSharedStrings(sharedDoc);
  const rows = readSheetRows(parseXml(zip.get(sheetPath), sheetPath), sharedStrings);

  const questions = [];
  const errors = [];
  const dataRows = rows.filter(row => row.cells.some(cell => String(cell).trim()));
  if (!dataRows.length) {
    return { questions, errors: [{ line: 0, message: 'Tệp Excel không có dòng dữ liệu nào.' }] };
  }

  const first = dataRows[0];
  const map = headerMap(first.cells);
  const hasHeader = map.text !== undefined && Object.keys(map).length >= 2;
  let layout = 'mapped';

  if (!hasHeader) {
    layout = detectLayout(first.cells);
  } else if (map.text === undefined) {
    return {
      questions,
      errors: [{ line: first.line, message: 'Dòng tiêu đề thiếu cột "Câu hỏi".' }],
    };
  }

  for (let i = hasHeader ? 1 : 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const fields = rowFields(row, layout, map);
    const result = buildQuestion(fields, row.line);
    if (result.question) questions.push(result.question);
    else errors.push(result.error);
  }

  if (!questions.length && !errors.length) {
    errors.push({ line: 0, message: 'Tệp Excel không có dòng dữ liệu nào.' });
  }

  return { questions, errors };
}

// ===== Ghi ZIP =====

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Tạo ZIP không nén (method 0) – đủ để Excel mở file
function buildZip(files) {
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9)
    | ((now.getMonth() + 1) << 5) | now.getDate();

  const entries = [];
  const parts = [];
  let offset = 0;

  for (const [name, content] of files) {
    const nameBytes = XML_ENCODER.encode(name);
    const data = typeof content === 'string' ? XML_ENCODER.encode(content) : content;
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, SIG_LOCAL, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true); // tên file UTF-8
    localView.setUint16(8, 0, true);      // không nén
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    parts.push(local, data);
    entries.push({ nameBytes, data, crc, offset });
    offset += local.length + data.length;
  }

  const cdOffset = offset;
  const centrals = entries.map(entry => {
    const central = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(central.buffer);
    view.setUint32(0, SIG_CENTRAL, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, dosTime, true);
    view.setUint16(14, dosDate, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.data.length, true);
    view.setUint32(24, entry.data.length, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, entry.offset, true);
    central.set(entry.nameBytes, 46);
    return central;
  });

  const cdSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, SIG_EOCD, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, cdSize, true);
  eocdView.setUint32(16, cdOffset, true);
  eocdView.setUint16(20, 0, true);

  const total = parts.reduce((sum, part) => sum + part.length, 0) + cdSize + eocd.length;
  const output = new Uint8Array(total);
  let pos = 0;
  for (const part of [...parts, ...centrals, eocd]) {
    output.set(part, pos);
    pos += part.length;
  }
  return output;
}

// ===== Ghi XML =====

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
    }[ch]));
}

function colName(index) {
  let name = '';
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function textCell(ref, value, style = 0) {
  const styleAttr = style ? ` s="${style}"` : '';
  return `<c r="${ref}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function numberCell(ref, value) {
  return `<c r="${ref}"><v>${Number(value) || 0}</v></c>`;
}

function sheetXml(questions) {
  const rows = [
    `<row r="1">${COLUMNS.map((title, index) => textCell(`${colName(index)}1`, title, 1)).join('')}</row>`,
  ];

  questions.forEach((question, index) => {
    const line = index + 2;
    const type = question.type || 'choice';
    const correctLetter = type === 'choice'
      ? LETTERS[Number(question.correctIndex) || 0]
      : type === 'boolean'
        ? (Number(question.correctIndex) === 1 ? 'Sai' : 'Đúng')
        : '';
    const optionCells = [0, 1, 2, 3].map(optionIndex => textCell(
      `${colName(2 + optionIndex)}${line}`,
      type === 'choice' ? (question.options?.[optionIndex] || '') : '',
    ));

    rows.push(`<row r="${line}">${[
      textCell(`A${line}`, typeLabel(type)),
      textCell(`B${line}`, question.text || ''),
      ...optionCells,
      textCell(`G${line}`, correctLetter),
      textCell(`H${line}`, type === 'fill' ? (question.answers || []).join(' | ') : ''),
      textCell(`I${line}`, question.image || ''),
      numberCell(`J${line}`, Number(question.timeLimit) || 0),
    ].join('')}</row>`);
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>
<col min="1" max="1" width="16" customWidth="1"/>
<col min="2" max="2" width="46" customWidth="1"/>
<col min="3" max="6" width="20" customWidth="1"/>
<col min="7" max="7" width="14" customWidth="1"/>
<col min="8" max="8" width="32" customWidth="1"/>
<col min="9" max="9" width="32" customWidth="1"/>
<col min="10" max="10" width="14" customWidth="1"/>
</cols>
<sheetData>${rows.join('')}</sheetData>
</worksheet>`;
}

function safeSheetName(title, used) {
  const base = String(title || 'Bộ câu hỏi')
    .replace(/[\\/?*[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31) || 'Bộ câu hỏi';

  let name = base;
  let index = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${index++})`;
    name = base.slice(0, 31 - suffix.length).trim() + suffix;
  }
  used.add(name.toLowerCase());
  return name;
}

// Tạo workbook .xlsx; mỗi bộ câu hỏi là một sheet.
export function buildXlsxWorkbook(sets) {
  const list = (Array.isArray(sets) ? sets : []).filter(Boolean);
  if (!list.length) throw new Error('Chưa có bộ câu hỏi để xuất Excel.');

  const used = new Set();
  const sheets = list.map((set, index) => ({
    name: safeSheetName(set.title, used),
    path: `xl/worksheets/sheet${index + 1}.xml`,
    xml: sheetXml(Array.isArray(set.questions) ? set.questions : []),
  }));

  const files = [];
  files.push(['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map(sheet => `<Override PartName="/${sheet.path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`]);

  files.push(['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`]);

  files.push(['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets>
</workbook>`]);

  files.push(['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((sheet, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${sheet.path.slice(3)}"/>`).join('')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`]);

  files.push(['xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="2">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
</fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`]);

  for (const sheet of sheets) files.push([sheet.path, sheet.xml]);

  return new Blob([buildZip(files)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// Tiện ích cho kiểm thử: các tiêu đề cột đang dùng
export const XLSX_COLUMNS = [...COLUMNS];
