// Cấu hình Supabase.
// Hai giá trị dưới đây được phép công khai: bảo mật nằm ở RLS, không phải ở khóa.
// TUYỆT ĐỐI không đặt secret key (sb_secret_...) hoặc service_role ở đây.
//
// Cách điền:
//   1. Mở https://supabase.com → project của bạn → Project Settings → API Keys.
//   2. Dán Project URL và Publishable key vào hai hằng số bên dưới.
//   3. Bật Authentication → Anonymous sign-ins cho học sinh.
//   4. Chạy supabase/migrations/0001_multiplayer.sql trong SQL Editor.

export const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YOUR_KEY';

// Tự nhận biết còn placeholder hay đã điền thật.
export const SUPABASE_CONFIGURED =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL) &&
  SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_') &&
  !SUPABASE_URL.includes('YOUR-PROJECT') &&
  !SUPABASE_PUBLISHABLE_KEY.includes('YOUR_KEY');
