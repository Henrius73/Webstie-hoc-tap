// Trạng thái phòng chơi trực tuyến, lưu trong bộ nhớ của server.
// Không phụ thuộc thư viện ngoài; server chỉ chuyển trạng thái, không lưu vào đĩa.
const crypto = require('crypto');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ I, O, 0, 1 cho dễ đọc
const CODE_LENGTH = 5;
const MAX_PLAYERS = 40;
const MIN_PLAYERS = 2;
const MAX_QUESTIONS = 100;
const DEFAULT_TIME_LIMIT = 30; // câu không đặt thời gian vẫn có 30 giây khi chơi trực tuyến
const ROOM_TTL = 2 * 60 * 60 * 1000; // tự dọn phòng sau 2 giờ

const COLORS = ['#7c3aed', '#db2777', '#0284c7', '#d97706', '#059669', '#dc2626', '#0891b2', '#9333ea'];

const GAMES = {
  race: 'Đua xe tri thức',
  tug: 'Kéo co tri thức',
  duck: 'Đua vịt tri thức',
  sack: 'Nhảy bao bố',
};

// Mã lỗi có status để server trả về đúng HTTP status
class RoomError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const rooms = new Map();
let notifier = () => {};

// Server đăng ký hàm phát sự kiện cho các client SSE
function setNotifier(fn) {
  notifier = typeof fn === 'function' ? fn : () => {};
}

function notify(room, event = 'update') {
  room.updatedAt = Date.now();
  notifier(room, event);
}

function token() {
  return crypto.randomBytes(18).toString('hex');
}

function uid(prefix) {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

function makeCode() {
  let code = '';
  do {
    code = Array.from({ length: CODE_LENGTH }, () =>
      CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function normalizeCode(value) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20);
}

function normalizeFill(value) {
  return String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Chỉ giữ các trường cần thiết và kiểm tra câu hỏi trước khi đưa vào phòng
function sanitizeQuestion(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const type = ['choice', 'boolean', 'fill'].includes(raw.type) ? raw.type : 'choice';
  const text = String(raw.text ?? '').trim().slice(0, 1200);
  if (!text) return null;

  const image = typeof raw.image === 'string' ? raw.image.trim().slice(0, 1200) : '';
  const timeLimit = Math.max(0, Math.min(600, Math.floor(Number(raw.timeLimit) || 0)));

  if (type === 'fill') {
    const answers = (Array.isArray(raw.answers) ? raw.answers : [])
      .map(a => String(a ?? '').trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, 5);
    if (!answers.length) return null;
    return { id: String(raw.id || uid('q')), type, text, options: [], correctIndex: 0, answers, image, timeLimit };
  }

  if (type === 'boolean') {
    const correctIndex = Number(raw.correctIndex) === 1 ? 1 : 0;
    return { id: String(raw.id || uid('q')), type, text, options: ['Đúng', 'Sai'], correctIndex, answers: [], image, timeLimit };
  }

  const options = (Array.isArray(raw.options) ? raw.options : [])
    .map(o => String(o ?? '').trim().slice(0, 200));
  const correctIndex = Number(raw.correctIndex);
  if (options.length !== 4 || options.some(o => !o)) return null;
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return null;
  return { id: String(raw.id || uid('q')), type, text, options, correctIndex, answers: [], image, timeLimit };
}

function isCorrect(question, response) {
  if (question.type === 'fill') {
    const value = normalizeFill(response);
    if (!value) return false;
    return question.answers.some(answer => normalizeFill(answer) === value);
  }
  return response === question.correctIndex;
}

function correctText(question) {
  if (question.type === 'fill') return question.answers.join(' hoặc ');
  if (question.type === 'boolean') {
    return question.options[question.correctIndex] || (question.correctIndex === 0 ? 'Đúng' : 'Sai');
  }
  return `${'ABCD'[question.correctIndex]}. ${question.options[question.correctIndex]}`;
}

function questionSeconds(question) {
  return question.timeLimit > 0 ? question.timeLimit : DEFAULT_TIME_LIMIT;
}

function getRoom(code) {
  const room = rooms.get(normalizeCode(code));
  if (!room) throw new RoomError('Không tìm thấy phòng. Mã phòng có thể đã sai hoặc phòng đã đóng.', 404);
  return room;
}

function findPlayer(room, playerToken) {
  if (!playerToken) return null;
  for (const player of room.players.values()) {
    if (player.token === playerToken) return player;
  }
  return null;
}

function requireHost(room, hostToken) {
  if (!hostToken || hostToken !== room.hostToken) {
    throw new RoomError('Bạn không phải giáo viên điều khiển phòng này.', 403);
  }
}

function requirePlayer(room, playerToken) {
  const player = findPlayer(room, playerToken);
  if (!player) throw new RoomError('Phiên của học sinh không hợp lệ. Hãy vào lại phòng.', 403);
  return player;
}

// Tạo phòng mới từ bộ câu hỏi giáo viên gửi lên
function createRoom(payload = {}) {
  cleanupExpired();

  const rawQuestions = Array.isArray(payload.questions) ? payload.questions : [];
  if (!rawQuestions.length) throw new RoomError('Bộ câu hỏi đang trống.');
  if (rawQuestions.length > MAX_QUESTIONS) {
    throw new RoomError(`Mỗi phòng tối đa ${MAX_QUESTIONS} câu hỏi.`);
  }

  const questions = rawQuestions.map(sanitizeQuestion).filter(Boolean);
  if (!questions.length) throw new RoomError('Không có câu hỏi hợp lệ để tạo phòng.');

  const gameId = GAMES[payload.gameId] ? payload.gameId : 'race';
  const room = {
    code: makeCode(),
    hostToken: token(),
    setId: String(payload.setId || '').slice(0, 80),
    setName: String(payload.setName || 'Bộ câu hỏi').trim().slice(0, 120) || 'Bộ câu hỏi',
    gameId,
    gameName: GAMES[gameId],
    questions, // giữ đúng thứ tự giáo viên đã soạn
    phase: 'lobby',
    index: -1,
    players: new Map(),
    currentResults: new Map(),
    answerCounts: {},
    deadlineAt: null,
    timer: null,
    roundId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  rooms.set(room.code, room);
  return { code: room.code, hostToken: room.hostToken, gameId, gameName: room.gameName, questionCount: questions.length };
}

// Thông tin công khai để trang vào phòng kiểm tra mã
function publicRoom(code) {
  const room = getRoom(code);
  return {
    code: room.code,
    phase: room.phase,
    players: room.players.size,
    capacity: MAX_PLAYERS,
    minPlayers: MIN_PLAYERS,
    setName: room.setName,
    gameId: room.gameId,
    gameName: room.gameName,
  };
}

// Học sinh vào phòng; nếu có token cũ thì vào lại đúng chỗ
function joinRoom(code, payload = {}) {
  const room = getRoom(code);
  const name = normalizeName(payload.name);
  const oldToken = typeof payload.token === 'string' ? payload.token : '';
  const existing = findPlayer(room, oldToken);

  if (existing) {
    existing.connected = true;
    notify(room);
    return { playerId: existing.id, playerToken: existing.token };
  }

  if (!name) throw new RoomError('Hãy nhập tên học sinh.');
  if (room.phase !== 'lobby') throw new RoomError('Phòng đã bắt đầu. Hãy nhờ giáo viên mở phòng mới.', 409);
  if (room.players.size >= MAX_PLAYERS) throw new RoomError(`Phòng đã đủ ${MAX_PLAYERS} học sinh.`, 409);
  if ([...room.players.values()].some(p => p.name.toLowerCase() === name.toLowerCase())) {
    throw new RoomError(`"${name}" đã có trong phòng.`, 409);
  }

  const player = {
    id: uid('student'),
    token: token(),
    name,
    color: COLORS[room.players.size % COLORS.length],
    connected: true,
    score: 0,
    wrong: 0,
  };
  room.players.set(player.id, player);
  notify(room);
  return { playerId: player.id, playerToken: player.token };
}

function clearRoomTimer(room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}

function resetScores(room) {
  for (const player of room.players.values()) {
    player.score = 0;
    player.wrong = 0;
  }
}

function startQuestion(room) {
  clearRoomTimer(room);
  room.phase = 'question';
  room.currentResults = new Map();
  room.answerCounts = {};
  room.deadlineAt = Date.now() + questionSeconds(room.questions[room.index]) * 1000;

  // Hết giờ thì tự chốt đáp án; server là nơi quyết định thời điểm
  room.timer = setTimeout(() => {
    if (room.phase === 'question') revealInternal(room);
  }, questionSeconds(room.questions[room.index]) * 1000 + 20);
  if (room.timer.unref) room.timer.unref();
}

function countAnswers(room) {
  const counts = {};
  for (const result of room.currentResults.values()) {
    if (typeof result.answer === 'number') counts[result.answer] = (counts[result.answer] || 0) + 1;
    else counts.fill = (counts.fill || 0) + 1;
  }
  return counts;
}

function revealInternal(room) {
  if (room.phase !== 'question') return;
  clearRoomTimer(room);
  const question = room.questions[room.index];

  // Bạn không trả lời trước khi hết giờ cũng bị tính là sai
  for (const player of room.players.values()) {
    if (!room.currentResults.has(player.id)) {
      room.currentResults.set(player.id, { answer: null, correct: false });
      player.wrong += 1;
    }
  }

  room.answerCounts = countAnswers(room);
  room.phase = 'reveal';
  room.deadlineAt = null;
  notify(room);
}

function startRoom(code, hostToken) {
  const room = getRoom(code);
  requireHost(room, hostToken);
  if (room.phase !== 'lobby') throw new RoomError('Phòng đang chơi hoặc đã kết thúc.', 409);
  if (room.players.size < MIN_PLAYERS) throw new RoomError(`Cần ít nhất ${MIN_PLAYERS} học sinh để bắt đầu.`, 409);

  resetScores(room);
  room.roundId = uid('round');
  room.index = 0;
  room.startedAt = Date.now();
  startQuestion(room);
  notify(room);
}

function answerRoom(code, payload = {}) {
  const room = getRoom(code);
  const player = requirePlayer(room, payload.token);
  if (room.phase !== 'question') throw new RoomError('Câu hỏi này đã chốt đáp án.', 409);
  if (Number(payload.index) !== room.index) throw new RoomError('Câu hỏi đã thay đổi. Hãy tải lại.', 409);
  if (room.currentResults.has(player.id)) throw new RoomError('Bạn đã trả lời câu này rồi.', 409);

  const question = room.questions[room.index];
  let response = payload.answer;

  if (question.type === 'fill') {
    response = String(response ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!response) throw new RoomError('Hãy nhập câu trả lời.');
  } else {
    response = Number(response);
    if (!Number.isInteger(response) || response < 0 || response >= question.options.length) {
      throw new RoomError('Đáp án không hợp lệ.');
    }
  }

  const correct = isCorrect(question, response);
  room.currentResults.set(player.id, { answer: response, correct });
  if (correct) player.score += 1;
  else player.wrong += 1;

  notify(room);

  // Cả phòng trả lời xong thì công bố luôn, không phải chờ hết giờ
  if (room.currentResults.size >= room.players.size) revealInternal(room);
  return { ok: true };
}

function revealRoom(code, hostToken) {
  const room = getRoom(code);
  requireHost(room, hostToken);
  revealInternal(room);
}

function ranking(room) {
  return [...room.players.values()]
    .map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      score: p.score,
      total: room.questions.length,
      connected: p.connected,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'vi'));
}

function finishRoom(room) {
  clearRoomTimer(room);
  room.phase = 'finished';
  room.deadlineAt = null;
  room.finishedAt = Date.now();
  notify(room);
}

function nextRoom(code, hostToken) {
  const room = getRoom(code);
  requireHost(room, hostToken);
  if (room.phase !== 'reveal') throw new RoomError('Chưa tới lúc chuyển câu.', 409);

  if (room.index + 1 >= room.questions.length) {
    finishRoom(room);
    return;
  }
  room.index += 1;
  startQuestion(room);
  notify(room);
}

function restartRoom(code, hostToken) {
  const room = getRoom(code);
  requireHost(room, hostToken);
  clearRoomTimer(room);
  resetScores(room);
  room.phase = 'lobby';
  room.index = -1;
  room.roundId = null;
  room.currentResults = new Map();
  room.answerCounts = {};
  room.deadlineAt = null;
  room.startedAt = null;
  room.finishedAt = null;
  notify(room);
}

function removePlayer(code, hostToken, playerId) {
  const room = getRoom(code);
  requireHost(room, hostToken);
  if (room.phase !== 'lobby') throw new RoomError('Chỉ xóa được học sinh khi phòng đang chờ.', 409);
  if (!room.players.delete(String(playerId))) throw new RoomError('Không tìm thấy học sinh.', 404);
  notify(room);
}

// Xác định người đang xem từ token: giáo viên hoặc học sinh
function resolveViewer(room, { hostToken, playerToken } = {}) {
  if (hostToken && hostToken === room.hostToken) return { role: 'host' };
  const player = findPlayer(room, playerToken);
  if (!player) return null;
  return { role: 'player', playerId: player.id };
}

function markDisconnected(code, playerToken) {
  try {
    const room = getRoom(code);
    const player = findPlayer(room, playerToken);
    if (!player) return;
    player.connected = false;
    notify(room);
  } catch { /* phòng đã đóng thì bỏ qua */ }
}

function closeRoom(code, hostToken) {
  const room = getRoom(code);
  requireHost(room, hostToken);
  clearRoomTimer(room);
  rooms.delete(room.code);
  notifier(room, 'closed');
}

function cleanupExpired() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.updatedAt <= ROOM_TTL) continue;
    clearRoomTimer(room);
    rooms.delete(code);
    notifier(room, 'closed');
  }
}

// Dữ liệu gửi cho một client; ẩn đáp án đúng và điểm của người khác khi chưa tới lúc
function snapshot(room, viewer = {}) {
  const isHost = viewer.role === 'host';
  const me = viewer.playerId ? room.players.get(viewer.playerId) : null;
  const question = room.phase === 'question' || room.phase === 'reveal'
    ? room.questions[room.index]
    : null;

  const data = {
    code: room.code,
    setId: room.setId,
    setName: room.setName,
    gameId: room.gameId,
    gameName: room.gameName,
    phase: room.phase,
    index: room.index,
    total: room.questions.length,
    capacity: MAX_PLAYERS,
    minPlayers: MIN_PLAYERS,
    serverNow: Date.now(),
    deadlineAt: room.deadlineAt,
    roundId: room.roundId,
    answeredCount: room.phase === 'question' ? room.currentResults.size : 0,
    players: [...room.players.values()].map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      connected: p.connected,
      answered: room.phase === 'question' && room.currentResults.has(p.id),
      ...(isHost ? { score: p.score, wrong: p.wrong } : {}),
    })),
  };

  if (me) {
    data.me = {
      id: me.id,
      name: me.name,
      color: me.color,
      // Giấu điểm trong lúc đang trả lời để không lộ sớm đúng/sai
      ...(room.phase === 'question' ? {} : { score: me.score }),
      answered: room.phase === 'question' && room.currentResults.has(me.id),
    };
  }

  if (question) {
    data.question = {
      text: question.text,
      type: question.type,
      options: question.options,
      image: question.image,
      timeLimit: question.timeLimit,
    };

    if (room.phase === 'reveal') {
      data.reveal = {
        correctIndex: question.correctIndex,
        correctText: correctText(question),
        accepted: question.type === 'fill' ? question.answers.slice() : [],
        answerCounts: room.answerCounts,
        results: isHost
          ? [...room.currentResults.entries()].map(([id, result]) => ({
              id, answer: result.answer, correct: result.correct,
            }))
          : undefined,
      };
      if (me) {
        const result = room.currentResults.get(me.id) || { answer: null, correct: false };
        data.me.result = result;
      }
    }
  }

  if (room.phase === 'finished') {
    data.ranking = ranking(room);
    data.correctText = null;
    const top = data.ranking[0];
    data.winner = top && top.score > 0 ? { id: top.id, name: top.name, color: top.color } : null;
    if (me) {
      data.me.rank = data.ranking.findIndex(p => p.id === me.id) + 1;
    }
  }

  return data;
}

// Tự dọn phòng cũ; unref để không giữ process sống khi test
const sweeper = setInterval(cleanupExpired, 10 * 60 * 1000);
if (sweeper.unref) sweeper.unref();

module.exports = {
  RoomError,
  MAX_PLAYERS,
  MIN_PLAYERS,
  setNotifier,
  createRoom,
  publicRoom,
  joinRoom,
  startRoom,
  answerRoom,
  revealRoom,
  nextRoom,
  restartRoom,
  removePlayer,
  markDisconnected,
  resolveViewer,
  closeRoom,
  snapshot,
  getRoom,
};
