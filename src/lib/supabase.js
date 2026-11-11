// Lớp kết nối Supabase dùng chung cho cả giáo viên và học sinh.
// Thư viện được tải động để trang vẫn mở được khi ngoại tuyến hoặc chưa cấu hình.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_CONFIGURED } from '../config.js';

// Ghim phiên bản cụ thể thay vì @2 để bản đang chạy không tự đổi.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';

export const isConfigured = SUPABASE_CONFIGURED;

export const CONFIG_MESSAGE =
  'Chưa cấu hình Supabase. Hãy điền SUPABASE_URL và SUPABASE_PUBLISHABLE_KEY trong src/config.js.';

let clientPromise = null;

// Trả về client Supabase dùng chung (khởi tạo một lần).
export function getSupabase() {
  if (!isConfigured) return Promise.reject(new Error(CONFIG_MESSAGE));

  if (!clientPromise) {
    clientPromise = import(SDK_URL)
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // PKCE dùng ?code=... trên query string, không đụng tới hash routing của app.
          flowType: 'pkce',
        },
      }))
      .catch(err => {
        clientPromise = null;
        console.error('Không tải được @supabase/supabase-js:', err);
        throw new Error('Không tải được thư viện Supabase. Hãy kiểm tra kết nối mạng rồi thử lại.');
      });
  }

  return clientPromise;
}

// Người dùng hiện tại (hoặc null). Không tự tạo phiên.
export async function getSessionUser() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user || null;
}

export function isAnonymousUser(user) {
  if (!user) return true;
  if (typeof user.is_anonymous === 'boolean') return user.is_anonymous;
  return user.app_metadata?.provider === 'anonymous';
}

// Học sinh: tự đăng nhập ẩn danh nếu chưa có phiên.
// Giáo viên: anonymous = false, không có phiên thì trả về null.
export async function ensureSession({ anonymous = true } = {}) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session?.user) return data.session.user;

  if (!anonymous) return null;

  const { data: signed, error: signError } = await supabase.auth.signInAnonymously();
  if (signError) {
    if (/anonymous/i.test(signError.message)) {
      throw new Error('Project Supabase chưa bật đăng nhập ẩn danh. Vào Authentication → Sign In / Providers → bật Anonymous sign-ins.');
    }
    throw signError;
  }
  return signed.user;
}

// Giáo viên: trả về tài khoản thật đang đăng nhập, hoặc null.
// Nếu đang có phiên ẩn danh (học sinh) thì không dùng làm giáo viên.
export async function ensureTeacher() {
  const user = await ensureSession({ anonymous: false });
  if (!user || isAnonymousUser(user)) return null;
  return user;
}

// Giáo viên: gửi mã đăng nhập qua email (magic link / OTP).
// redirectTo giữ nguyên trang hiện tại để sau khi bấm link quay lại đúng chỗ.
export async function teacherSignIn(email, redirectTo = location.href) {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

export async function signOut() {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Lắng nghe thay đổi phiên (đăng nhập xong qua magic link, đăng xuất...).
export function onAuthChange(callback) {
  let unsubscribe = () => {};
  let closed = false;

  getSupabase().then(supabase => {
    if (closed) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session?.user || null);
    });
    unsubscribe = () => data.subscription.unsubscribe();
  }).catch(() => { /* chưa cấu hình thì bỏ qua */ });

  return () => {
    closed = true;
    unsubscribe();
  };
}
