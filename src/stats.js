// Tổng hợp điểm & lịch sử trận đấu, lưu trong localStorage
import { uid } from './utils.js';

const KEY = 'hocvui.history.v1';
const LIMIT = 30; // chỉ giữ 30 trận gần nhất

export function getHistory() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function persist(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Không lưu được lịch sử trận đấu:', err);
  }
}

// Lưu một trận đã kết thúc, trận mới nhất đứng đầu
export function saveMatch(record) {
  const entry = { id: uid(), date: Date.now(), ...record };
  persist([entry, ...getHistory()].slice(0, LIMIT));
  return entry;
}

export function clearHistory() {
  persist([]);
}

// Thống kê tổng hợp: số trận, tổng câu, tỉ lệ đúng, bảng xếp hạng theo đội
export function summarize(history = getHistory()) {
  let totalQuestions = 0;
  let totalCorrect = 0;
  const byTeam = new Map();

  for (const match of history) {
    for (const t of match.teams || []) {
      const correct = t.correct || 0;
      const total = t.total || 0;
      totalQuestions += total;
      totalCorrect += correct;

      const agg = byTeam.get(t.name) || {
        name: t.name, color: t.color, matches: 0, wins: 0, correct: 0, total: 0,
      };
      agg.matches += 1;
      agg.correct += correct;
      agg.total += total;
      if (match.winner && match.winner.id === t.id) agg.wins += 1;
      byTeam.set(t.name, agg);
    }
  }

  const ranking = [...byTeam.values()]
    .map(t => ({ ...t, accuracy: t.total ? Math.round((t.correct / t.total) * 100) : 0 }))
    .sort((a, b) => b.correct - a.correct || b.accuracy - a.accuracy || b.wins - a.wins);

  return {
    matches: history.length,
    totalQuestions,
    totalCorrect,
    accuracy: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    ranking,
  };
}

// Định dạng ngày giờ kiểu Việt Nam
export function formatDate(ts) {
  try {
    return new Date(ts).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}
