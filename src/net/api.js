// Lớp giao tiếp với Supabase: mọi thao tác ghi đều đi qua hàm RPC ở
// supabase/migrations/0001_multiplayer.sql. Client không insert/update trực tiếp
// vào rooms, players hay answers.
import { getSupabase, getSessionUser } from '../lib/supabase.js';

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

// Đổi mã lỗi kỹ thuật thành câu tiếng Việt dễ hiểu.
export function friendlyError(err) {
  const raw = String(err?.message || err || '');
  const map = {
    room_not_found: 'Không tìm thấy phòng. Hãy kiểm tra lại mã phòng hoặc phòng đã kết thúc.',
    invalid_state: 'Phòng đang ở trạng thái khác, thao tác này chưa thực hiện được.',
    not_in_room: 'Em chưa ở trong phòng này. Hãy vào phòng lại bằng mã.',
    not_owner: 'Tài khoản này không phải chủ bộ câu hỏi.',
    closed: 'Đã hết giờ trả lời câu này.',
  };
  for (const [code, text] of Object.entries(map)) {
    if (raw.includes(code)) return text;
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) {
    return 'Không kết nối được tới Supabase. Hãy kiểm tra mạng rồi thử lại.';
  }
  if (/JWT|permission denied|row-level security/i.test(raw)) {
    return 'Tài khoản chưa có quyền thực hiện thao tác này. Hãy đăng nhập lại.';
  }
  return raw || 'Có lỗi xảy ra, hãy thử lại.';
}

// ---- Giờ server (đồng bộ đồng hồ đếm ngược) ----
export async function serverNow() {
  const supabase = await getSupabase();
  return unwrap(await supabase.rpc('server_now'));
}

// ---- Giáo viên ----
export const createRoom = async quizId => {
  const supabase = await getSupabase();
  return unwrap(await supabase.rpc('create_room', { p_quiz_id: quizId }));
};

export const nextQuestion = async roomId => {
  const supabase = await getSupabase();
  return unwrap(await supabase.rpc('host_next_question', { p_room_id: roomId }));
};

export const reveal = async roomId => {
  const supabase = await getSupabase();
  return unwrap(await supabase.rpc('host_reveal', { p_room_id: roomId }));
};

// ---- Học sinh ----
export const joinRoom = async (code, name) => {
  const supabase = await getSupabase();
  return unwrap(await supabase.rpc('join_room', { p_code: code, p_name: name }));
};

export const submitAnswer = async (roomId, choice) => {
  const supabase = await getSupabase();
  return unwrap(await supabase.rpc('submit_answer', { p_room_id: roomId, p_choice: choice }));
};

// ---- Bộ câu hỏi của giáo viên ----
export async function listQuizzes() {
  const supabase = await getSupabase();
  const data = unwrap(await supabase
    .from('quiz_sets')
    .select('id,title,created_at,questions(count)')
    .order('created_at', { ascending: false }));

  return data.map(row => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    count: Number(row.questions?.[0]?.count) || 0,
  }));
}

// Chỉ câu trắc nghiệm 4 đáp án được đưa lên phòng chơi trực tuyến
// (bảng questions của giai đoạn 2 yêu cầu đúng 4 lựa chọn).
function toOnlineQuestion(question) {
  if (!question || (question.type || 'choice') !== 'choice') return null;

  const options = (Array.isArray(question.options) ? question.options : [])
    .map(option => String(option ?? '').trim().slice(0, 200));
  if (options.length !== 4 || options.some(option => !option)) return null;

  const correctIndex = Number(question.correctIndex);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return null;

  const text = String(question.text ?? '').trim().slice(0, 2000);
  if (!text) return null;

  const rawLimit = Math.round(Number(question.timeLimit) || 0);
  const timeLimit = rawLimit >= 5 ? Math.min(300, rawLimit) : 20;

  return {
    text,
    options,
    correct_index: correctIndex,
    image_url: question.image ? String(question.image).trim().slice(0, 1200) : null,
    time_limit: timeLimit,
  };
}

// Đăng một bộ câu hỏi đang lưu trên máy lên Supabase.
export async function importQuizSet(set) {
  const user = await getSessionUser();
  if (!user) throw new Error('Hãy đăng nhập bằng email giáo viên trước khi đăng bộ câu hỏi.');

  const questions = (Array.isArray(set?.questions) ? set.questions : [])
    .map(toOnlineQuestion)
    .filter(Boolean);

  if (!questions.length) {
    throw new Error('Bộ này không có câu trắc nghiệm 4 đáp án nào. Giai đoạn trực tuyến hiện chỉ hỗ trợ câu trắc nghiệm 4 đáp án.');
  }

  const supabase = await getSupabase();
  const title = String(set.title || 'Bộ câu hỏi').trim().slice(0, 120) || 'Bộ câu hỏi';

  const quiz = unwrap(await supabase
    .from('quiz_sets')
    .insert({ owner_id: user.id, title })
    .select()
    .single());

  const rows = questions.map((question, index) => ({
    quiz_id: quiz.id,
    q_index: index,
    ...question,
  }));

  const { error } = await supabase.from('questions').insert(rows);
  if (error) {
    // Không để lại bộ câu hỏi rỗng nếu phần câu hỏi lỗi.
    await supabase.from('quiz_sets').delete().eq('id', quiz.id);
    throw error;
  }

  return {
    quiz,
    imported: rows.length,
    skipped: (set.questions?.length || 0) - rows.length,
  };
}

export async function deleteQuiz(quizId) {
  const supabase = await getSupabase();
  const { error } = await supabase.from('quiz_sets').delete().eq('id', quizId);
  if (error) throw error;
}

// ---- Đọc trạng thái hiện tại ----
export async function fetchRoomByCode(code) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Dùng khi vào phòng, tải lại trang hoặc kết nối lại.
export async function fetchSnapshot(roomId) {
  const supabase = await getSupabase();
  const [sessionResult, roomResult, playersResult] = await Promise.all([
    supabase.auth.getSession(),
    supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
    supabase.from('players')
      .select('id,user_id,name,score,joined_at')
      .eq('room_id', roomId)
      .order('score', { ascending: false })
      .order('joined_at', { ascending: true }),
  ]);

  if (roomResult.error) throw roomResult.error;
  if (playersResult.error) throw playersResult.error;

  const room = roomResult.data;
  const players = playersResult.data || [];
  if (!room) {
    const err = new Error('room_not_found');
    throw err;
  }

  const userId = sessionResult.data?.session?.user?.id;
  const me = players.find(player => player.user_id === userId) || null;

  let myAnswer = null;
  if (me && room.q_index >= 0) {
    const { data } = await supabase
      .from('answers')
      .select('q_index,choice,is_correct,points')
      .eq('player_id', me.id)
      .eq('q_index', room.q_index)
      .maybeSingle();
    myAnswer = data || null;
  }

  return { room, players, me, myAnswer };
}

// Giáo viên đọc bài làm của cả phòng cho câu hiện tại (RLS cho phép chủ phòng).
export async function fetchAnswerStats(roomId, qIndex) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('answers')
    .select('player_id,choice,is_correct,points')
    .eq('room_id', roomId)
    .eq('q_index', qIndex);
  if (error) throw error;

  const counts = [0, 0, 0, 0];
  const answeredIds = new Set();
  let correctCount = 0;

  for (const answer of data || []) {
    answeredIds.add(answer.player_id);
    const index = Number(answer.choice);
    if (index >= 0 && index < 4) counts[index] += 1;
    if (answer.is_correct) correctCount += 1;
  }

  return { counts, answeredIds, total: (data || []).length, correctCount };
}

// ---- Nghe thay đổi theo thời gian thực ----
// Trả về hàm hủy đăng ký. Mỗi lần kênh thành SUBSCRIBED (kể cả sau khi nối lại),
// nơi gọi nên gọi lại fetchSnapshot để không bỏ sót thay đổi.
export async function subscribeRoom(roomId, { onRoom, onPlayers, onStatus, onSubscribed, onError } = {}) {
  const supabase = await getSupabase();

  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      payload => onRoom?.(payload.new || null, payload),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
      payload => onPlayers?.(payload),
    );

  channel.subscribe(status => {
    onStatus?.(status);
    if (status === 'SUBSCRIBED') onSubscribed?.();
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      onError?.(status);
    }
  });

  return () => {
    supabase.removeChannel(channel);
  };
}
