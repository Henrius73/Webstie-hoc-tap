// Client Supabase dùng chung cho cả giáo viên và học sinh.
// Cấu hình nằm trong .env (xem .env.example); chỉ dùng publishable key.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = String(import.meta.env.VITE_SUPABASE_URL || '')
const key = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '')

// Tự nhận biết còn placeholder hay đã điền thật.
export const isConfigured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) &&
  key.startsWith('sb_publishable_') &&
  !url.includes('YOUR') &&
  !key.includes('YOUR')

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE dùng ?code= trên query string, không đụng tới SPA router.
        flowType: 'pkce',
      },
    })
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Chưa kết nối được máy chủ dữ liệu. Hãy thử lại sau ít phút.')
  }
  return supabase
}
