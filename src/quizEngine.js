// Quiz engine: xoay lượt từng đội và bốc câu hỏi ngẫu nhiên không lặp
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

export function createQuiz(teams, questions) {
  let deck = shuffle(questions);
  let turn = 0;
  let current = null;

  // Hết câu thì xáo lại toàn bộ để chơi tiếp
  function drawQuestion() {
    if (!deck.length) deck = shuffle(questions);
    return deck.pop();
  }

  return {
    // Đội đang tới lượt
    get team() {
      return teams[turn % teams.length];
    },

    // Bốc câu tiếp theo cho đội đang tới lượt
    next() {
      current = { team: teams[turn % teams.length], question: drawQuestion() };
      return current;
    },

    // Chấm đáp án, sau đó chuyển lượt sang đội kế tiếp
    answer(response) {
      if (!current) throw new Error('Chưa gọi next() trước khi answer()');
      const result = {
        team: current.team,
        question: current.question,
        isCorrect: isCorrectAnswer(current.question, response),
      };
      turn++;
      return result;
    },
  };
}
