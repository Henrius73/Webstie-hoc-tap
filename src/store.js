// Lưu bộ câu hỏi vào localStorage (chưa có backend)
import { uid } from './utils.js';

const KEY = 'hocvui.sets.v1';

// Một câu hỏi hợp lệ theo mục 5 của project.md.
// timeLimit = 0 nghĩa là không giới hạn.
const QUESTION_TYPES = ['choice', 'boolean', 'fill'];

// Gộp các cách viết trùng nhau, bỏ ô trống; giữ tối đa 5 cách
function normalizeAnswers(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const answers = [];
  for (const item of raw) {
    const value = String(item ?? '').replace(/\s+/g, ' ').trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    answers.push(value);
    if (answers.length === 5) break;
  }
  return answers;
}

function normalizeQuestion(raw, index, usedIds) {
  const label = `Câu ${index + 1}`;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${label}: dữ liệu không hợp lệ`);
  }
  if (typeof raw.text !== 'string' || !raw.text.trim()) {
    throw new Error(`${label}: thiếu nội dung`);
  }

  // Dữ liệu cũ chưa có type thì coi là trắc nghiệm 4 đáp án
  if (raw.type !== undefined && !QUESTION_TYPES.includes(raw.type)) {
    throw new Error(`${label}: loại câu hỏi không hợp lệ`);
  }
  const type = raw.type || 'choice';

  let options;
  let correctIndex;
  let answers = [];

  if (type === 'fill') {
    answers = normalizeAnswers(raw.answers);
    if (!answers.length) throw new Error(`${label}: cần ít nhất 1 đáp án đúng`);
    options = [];
    correctIndex = 0;
  } else if (type === 'boolean') {
    options = ['Đúng', 'Sai'];
    correctIndex = Number(raw.correctIndex);
    if (correctIndex !== 0 && correctIndex !== 1) {
      throw new Error(`${label}: đáp án đúng/sai phải là 0 hoặc 1`);
    }
  } else {
    if (!Array.isArray(raw.options) || raw.options.length !== 4) {
      throw new Error(`${label}: cần đúng 4 đáp án`);
    }

    options = raw.options.map(o => String(o ?? '').trim());
    if (options.some(o => !o)) throw new Error(`${label}: đáp án không được để trống`);

    correctIndex = Number(raw.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      throw new Error(`${label}: correctIndex phải từ 0 đến 3`);
    }
  }

  // Giữ id cũ nếu hợp lệ; dữ liệu cũ chưa có id thì cấp mới
  let id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id || usedIds.has(id)) id = uid();
  usedIds.add(id);

  const timeLimit = Number(raw.timeLimit);

  return {
    id,
    type,
    text: raw.text.trim(),
    options,
    correctIndex,
    answers,
    image: typeof raw.image === 'string' && raw.image.trim() ? raw.image.trim() : null,
    timeLimit: Number.isFinite(timeLimit) && timeLimit >= 0 ? Math.round(timeLimit) : 0,
  };
}

// Chuẩn hóa một bộ câu hỏi; giữ id cũ để không phá dữ liệu đang dùng.
// Chấp nhận cả name (dữ liệu cũ) và title (mục 5 project.md).
export function normalizeSet(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Mỗi bộ câu hỏi phải là một object');
  }

  const title = String(raw.title ?? raw.name ?? '').trim();
  if (!title) throw new Error('Thiếu tiêu đề bộ câu hỏi (title)');

  if (!Array.isArray(raw.questions) || !raw.questions.length) {
    throw new Error('Bộ câu hỏi phải có ít nhất 1 câu');
  }

  const usedIds = new Set();
  const questions = raw.questions.map((q, i) => normalizeQuestion(q, i, usedIds));
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : uid();

  return {
    id,
    title,
    subject: String(raw.subject ?? '').trim(),
    questions,
  };
}

// Đọc dữ liệu cũ và tự chuyển sang cấu trúc mới; bỏ qua bộ hỏng thay vì làm sập app
export function getSets() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(data)) return [];

    return data.map(raw => {
      try {
        return normalizeSet(raw);
      } catch (err) {
        console.warn('Bỏ qua bộ câu hỏi không hợp lệ:', err.message);
        return null;
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function persist(sets) {
  try {
    localStorage.setItem(KEY, JSON.stringify(sets));
  } catch (err) {
    console.warn('Không lưu được vào localStorage:', err);
  }
}

export function getSet(id) {
  return getSets().find(s => s.id === id) || null;
}

// Thêm mới hoặc cập nhật theo id
export function saveSet(set) {
  const normalized = normalizeSet(set);
  const sets = getSets();
  const index = sets.findIndex(s => s.id === normalized.id);
  if (index >= 0) sets[index] = normalized;
  else sets.unshift(normalized);
  persist(sets);
  return normalized;
}

export function deleteSet(id) {
  persist(getSets().filter(s => s.id !== id));
}

// Câu hỏi trống theo đúng cấu trúc quy ước
export function blankQuestion(type = 'choice') {
  const base = {
    id: uid(),
    type,
    text: '',
    image: null,
    timeLimit: 0,
  };

  if (type === 'boolean') {
    return { ...base, options: ['Đúng', 'Sai'], correctIndex: 0, answers: [] };
  }
  if (type === 'fill') {
    return { ...base, options: [], correctIndex: 0, answers: [''] };
  }
  return { ...base, options: ['', '', '', ''], correctIndex: 0, answers: [] };
}

export function blankSet() {
  return { id: uid(), title: '', subject: '', questions: [blankQuestion()] };
}

// ===== Nhập / xuất JSON =====

// Cấp id mới cho bộ và từng câu để nhập thành bản sao, không ghi đè dữ liệu đang có
function withFreshIds(set) {
  return {
    ...set,
    id: uid(),
    questions: set.questions.map(q => ({ ...q, id: uid() })),
  };
}

// Đọc JSON: chấp nhận một bộ, mảng bộ, hoặc object { sets: [...] }
export function parseSetsJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Tệp không phải JSON hợp lệ');
  }

  const list = Array.isArray(data) ? data : Array.isArray(data?.sets) ? data.sets : [data];
  if (!list.length) throw new Error('Tệp không có bộ câu hỏi nào');
  return list.map(raw => withFreshIds(normalizeSet(raw)));
}

// Gói dữ liệu xuất kèm thông tin phiên bản để sau này dễ nâng cấp
export function buildExportData(sets = getSets()) {
  return {
    app: 'HocVui',
    type: 'question-sets',
    version: 1,
    exportedAt: new Date().toISOString(),
    sets,
  };
}

// Bộ mẫu để chơi thử nhanh
export function sampleSet() {
  return {
    id: uid(),
    title: 'Bộ câu hỏi mẫu – Kiến thức chung',
    subject: 'Tổng hợp',
    questions: [
      {
        id: uid(),
        text: 'Thủ đô của Việt Nam là thành phố nào?',
        options: ['Hà Nội', 'Huế', 'Đà Nẵng', 'TP. Hồ Chí Minh'],
        correctIndex: 0,
        image: null,
        timeLimit: 0,
      },
      {
        id: uid(),
        text: '5 + 7 bằng bao nhiêu?',
        options: ['10', '11', '12', '13'],
        correctIndex: 2,
        image: null,
        timeLimit: 0,
      },
      {
        id: uid(),
        text: 'Hành tinh nào gần Mặt Trời nhất?',
        options: ['Kim Tinh', 'Thủy Tinh', 'Hỏa Tinh', 'Mộc Tinh'],
        correctIndex: 1,
        image: null,
        timeLimit: 0,
      },
      {
        id: uid(),
        text: 'Con vật nào được gọi là "chúa sơn lâm"?',
        options: ['Voi', 'Gấu', 'Hổ', 'Sư tử'],
        correctIndex: 2,
        image: null,
        timeLimit: 0,
      },
      {
        id: uid(),
        text: 'Một ngày có bao nhiêu giờ?',
        options: ['12 giờ', '20 giờ', '24 giờ', '36 giờ'],
        correctIndex: 2,
        image: null,
        timeLimit: 0,
      },
      {
        id: uid(),
        text: 'Quốc kỳ Canada có hình gì?',
        options: ['Ngôi sao', 'Lá phong', 'Chim ưng', 'Mặt trăng'],
        correctIndex: 1,
        image: null,
        timeLimit: 0,
      },
    ],
  };
}
