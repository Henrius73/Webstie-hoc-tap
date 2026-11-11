# Plan — Học Vui (web trắc nghiệm kiểu Kahoot): các bước tiếp theo

> Dự án: `D:\Project\Web game hoc tap` · Repo: https://github.com/Henrius73/Webstie-hoc-tap (main = `41e83f0`)
> Stack: Vite 7 + React 19 + TypeScript strict + Tailwind CSS v4 + Supabase · Deploy: Vercel

## Trạng thái hiện tại (đã xong)

- ✅ M1–M5: toàn bộ app — auth giáo viên (magic link PKCE) + học sinh (ẩn danh), trình soạn bộ câu hỏi,
  phòng realtime (mã 6 số), điểm server (đúng 1000→500 theo tốc độ, sai 0), RLS + RPC-only writes,
  migration `supabase/migrations/0001_init.sql`, đồng hồ theo giờ server, podium + bảng xếp hạng.
- ✅ Build production: 98 module, 3 chunk (gzip ~162KB tổng) — đã kiểm chứng.
- ✅ Dev + build chạy bình thường tại `D:\Project\...` (đã rời khỏi đường dẫn chứa `#`).
- ✅ README đầy đủ; code đã push main; bản cũ giữ ở nhánh `backup/hocvui-2026-11-11`.
- ✅ M9 Polish (2026-11-11): âm thanh Web Audio + nút tắt/bật âm thanh, pháo giấy, điểm nhảy số, animation công bố,
  điều khiển phím (giáo viên Space/Enter, học sinh 1–4), tự khóa bảng chọn khi hết giờ, nhập đề CSV/Excel,
  cảnh báo rời trang khi đề chưa lưu.
- ✅ Quản lý phòng giáo viên (2026-11-11): bỏ khối hướng dẫn cấu hình khỏi giao diện (thông báo ngắn gọn),
  danh sách **phòng đang mở** ở trang giáo viên (tự cập nhật 5 giây), **kết thúc ván ngay** qua RPC
  `host_end_room` (migration `0002_host_room_controls.sql` — chạy sau 0001), cảnh báo tạo trùng phòng cùng bộ đề.
- ✅ Góc **Luyện tập** (2026-11-12): tính năng trang trắc nghiệm thông thường chạy 100% client
  (`localStorage`, không đụng Supabase) — soạn đề cục bộ + CSV, làm bài chấm ngay/cuối bài, số câu/xáo trộn/
  giờ mỗi câu, xem lại từng câu, làm lại câu sai, thẻ ghi nhớ, bộ mẫu 8 câu. Trích `QuestionForm` +
  `CsvImportSection` thành component dùng chung với trình soạn giáo viên.
- ✅ Chặn lỗ hổng lộ `is_correct` sớm: `fetchSnapshot` chỉ chọn `is_correct, points` khi pha reveal/finished
  (không cần đổi SQL — RLS vốn cho phép, giờ client tự hạn chế).
- ✅ Chế độ **chơi thử không cần Supabase** (2026-11-12): `/demo` tạo phòng từ bộ luyện tập cục bộ hoặc bộ
  mẫu, `/demo/room/:code` điều khiển, `/demo/play/:code` cho học sinh. Trạng thái trong `localStorage`,
  đồng bộ tab cùng trình duyệt bằng `BroadcastChannel` + sự kiện `storage` (`lib/demoRoom.ts`,
  `hooks/useDemoRoom.ts`). `/host` tự chuyển `/demo` khi chưa cấu hình; `/join` nhận cả mã phòng thử.
- ✅ Chuyển toàn bộ emoji/symbol trên giao diện sang **Lucide icon** (`lucide-react`); thêm nút
  **Trang chủ** ở mọi trang con (`PageShell`).
- ⛔ Chưa có project Supabase thật → auth/RLS/realtime/đồng hồ **chưa kiểm chứng đầu-cuối**.

---

## M6 — Kiểm chứng đầu-cuối với project Supabase thật (cần bạn tham gia)

1. Tạo project Supabase (vùng gần Việt Nam, ví dụ Singapore).
2. Authentication → Sign In / Providers: bật **Anonymous sign-ins**.
3. Authentication → URL Configuration: Site URL `http://localhost:5173`; Redirect URLs
   `http://localhost:5173/**` (+ domain Vercel sau khi deploy).
4. SQL Editor: chạy lần lượt `supabase/migrations/0001_init.sql` rồi `supabase/migrations/0002_host_room_controls.sql`.
5. Copy `.env.example` → `.env`, điền Project URL + Publishable key (KHÔNG dùng secret key).
6. Chạy thử luồng chuẩn:
   - Giáo viên: đăng nhập magic link (nhận email, bấm link) → tạo bộ đề → soạn 2–3 câu → tạo phòng.
   - Học sinh: cửa sổ ẩn danh/khác máy → `/join` nhập mã + tên → lobby → trả lời → công bố → podium.
7. Kiểm tra biên: mã sai, tên trùng, vào phòng đã kết thúc, hết giờ mới gửi (bị chặn),
   gửi 2 lần cùng câu (RPC trả `accepted: false`), học sinh tự load `/room/xxxxxx` trực tiếp.

## M7 — Giả lập tải & kiểm thử bảo mật (~40 học sinh)

- Viết script Node (dùng `@supabase/supabase-js`): 40 user `signInAnonymously` → `join_room` →
  `submit_answer` phân bố đúng/sai, đo độ trễ, kiểm tra bảng điểm cuối tổng đúng.
- Kiểm thử thủ công bằng DevTools (tư cách học sinh): đọc được `answers` người khác? Đọc được
  `correct_index` trước công bố? (lỗ hổng `is_correct` lộ sớm **đã chặn** ở `fetchSnapshot`).

## M8 — Deploy Vercel

- Import repo → thêm env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` → deploy
  (`vercel.json` đã có rewrite SPA).
- Thêm domain Vercel vào Redirect URLs của Supabase → chạy trọn 1 ván trên production.

## M9 — Polish

Đã làm xong phần chính (xem "Trạng thái hiện tại"). Còn lại (tùy chọn):
- Lưu ý thiết kế: **auto-reveal chạy trong tab máy giáo viên** — nếu máy giáo viên tắt giữa câu thì
  câu treo đến khi mở lại. v1 chấp nhận; sau này có thể chuyển sang Edge Function/cron.

## Ý tưởng sau này (chưa làm)

- Lưu lịch sử ván chơi/điểm lâu dài; xuất kết quả ra CSV.
- Quản lý nhiều lớp / danh sách lớp học sinh.
- Chơi thử qua nhiều máy (hiện chỉ cùng trình duyệt) — cần backend nhẹ hoặc Supabase.

## Hạn chế đã biết cần nhớ

- Thư mục dự án không được chứa `#` (Vite dev + build đều hỏng).
- Node ≥ 20.19 cho Vite 7.
- Thư mục cũ `D:\C#\Web game hoc tap` còn trống bị 1 tiến trình giữ — xóa sau khi khởi động lại máy.
