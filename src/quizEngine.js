// Quiz engine: xoay lượt từng học sinh và bốc câu hỏi ngẫu nhiên không lặp
import { shuffle } from './utils.js';

// So khớp câu điền từ: bỏ khoảng trắng thừa, không phân biệt hoa/thường, giữ dấu tiếng Việt
function normalizeFill(value) {
  return String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Chấm một câu trả lời: số thứ tự với trắc nghiệm/đúng-sai, chuỗi với điền từ
function isCorrectAnswer(question, response) {
  if (question.type === 'fill') {
    const value = normalizeFill(response);
    if (!value) return false;
    return (question.answers || []).some(answer => normalizeFill(answer) === value);
  }
  return response === question.correctIndex;
}

// Mỗi học sinh trả lời đúng 1 câu; hết danh sách là kết thúc trận
export function createQuiz(students, questions) {
  let deck = shuffle(questions);
  let turn = 0;
  let current = null;

  // Hết câu thì xáo lại toàn bộ để chơi tiếp
  function drawQuestion() {
    if (!deck.length) deck = shuffle(questions);
    return deck.pop();
  }

  return {
    // Học sinh đang tới lượt
    get player() {
      return students[turn] || null;
    },

    // Tổng số lượt = số học sinh trong trận
    get total() {
      return students.length;
    },

    // Số thứ tự lượt hiện tại (bắt đầu từ 0)
    get index() {
      return turn;
    },

    // Đã cho mọi học sinh trả lời xong chưa
    get finished() {
      return turn >= students.length;
    },

    // Bốc câu tiếp theo cho học sinh đang tới lượt
    next() {
      if (turn >= students.length) return null;
      current = { player: students[turn], index: turn, question: drawQuestion() };
      return current;
    },

    // Chấm đáp án, sau đó chuyển lượt sang học sinh kế tiếp
    answer(response) {
      if (!current) throw new Error('Chưa gọi next() trước khi answer()');
      const result = {
        player: current.player,
        index: current.index,
        question: current.question,
        isCorrect: isCorrectAnswer(current.question, response),
      };
      current = null;
      turn++;
      return result;
    },
  };
}
