# 🎓 Học Vui — Trò chơi trắc nghiệm cả lớp (kiểu Kahoot)

Web app học tập realtime: giáo viên soạn bộ câu hỏi, tạo phòng chiếu mã lên bảng; học sinh vào bằng mã
phòng + tên, trả lời trắc nghiệm theo thời gian thực, điểm được tổng hợp và xếp hạng ngay trong lớp.

Xây bằng **Vite + React 19 + TypeScript + Tailwind CSS v4 + Supabase** (Postgres + Auth + Realtime),
deploy trên **Vercel**.

## Tính năng

**Giáo viên**
- Đăng nhập bằng email (magic link, không cần mật khẩu).
- Soạn bộ câu hỏi ngay trong app: nội dung, 4 đáp án, chọn đáp án đúng, thời gian 5–300 giây, ảnh (URL), sắp xếp thứ tự.
- Tạo phòng chơi — nhận mã 6 chữ số + liên kết để chiếu lên bảng.
- Điều khiển ván chơi: bắt đầu, xem thống kê trả lời theo thời gian thực, công bố sớm hoặc tự động, sang câu tiếp, kết thúc.
- Xem podium top 3 + bảng tổng hợp điểm từng học sinh.

**Học sinh**
- Không cần tài khoản (đăng nhập ẩn danh tự động).
- Vào phòng bằng mã 6 số + tên (1–20 ký tự) — vào muộn vẫn được cho đến khi ván kết thúc.
- Đồng hồ đếm ngược theo **giờ server** (máy chậm/nhanh lệch giờ vẫn công bằng), mỗi câu chỉ gửi được 1 đáp án.
- Xem đáp án đúng sau công bố, điểm nhận được, bảng xếp hạng và podium cuối ván.

**Cách tính điểm (server chấm, không phía client):** trả lời đúng được **1000 điểm nếu bấm ngay**,
giảm dần còn **500 điểm khi hết giờ**; sai hoặc không trả lời: **0 điểm**.

## Yêu cầu môi trường

- **Node.js ≥ 20.19** (khuyến nghị 22 LTS) và npm.
- Một project [Supabase](https://supabase.com) (miễn phí là đủ).
- Tài khoản [Vercel](https://vercel.com) nếu muốn deploy.

## ⚠️ Quan trọng: thư mục dự án KHÔNG được chứa ký tự `#`

Vite xử lý đường dẫn qua URL nên ký tự `#` (như `D:\C#\...`) làm **hỏng cả `npm run dev` lẫn
`npm run build`** trên máy local:

- `npm run build` lỗi `Failed to resolve /src/main.tsx`.
- `npm run dev` **trông như chạy bình thường** (HTTP 200) nhưng thực ra trả về file *nguyên xi chưa
  biên dịch* — trình duyệt nhận cú pháp JSX không hợp lệ và trang trắng. Đừng bị nhầm như vậy.

**Khắc phục:** đặt dự án ở đường dẫn không có `#` (ví dụ `D:\CSharp\Web game hoc tap`), hoặc copy
source sang thư mục tạm sạch rồi chạy ở đó. Junction/subst **không** khắc phục được (Node tự resolves
về đường dẫn thật). Deploy trên Vercel không bị ảnh hưởng (Vercel clone về đường dẫn sạch).

## Chạy local

```bash
npm install
npm run dev        # http://localhost:5173
```

Build production: `npm run build` (kiểm tra type + đóng gói vào `dist/`), xem thử: `npm run preview`.

## Cấu hình Supabase (làm 1 lần)

1. Tạo project tại [supabase.com](https://supabase.com) (chọn vùng gần Việt Nam cho đỡ lag).
2. **Authentication → Sign In / Providers**: bật **Anonymous sign-ins** (học sinh không cần tài khoản).
3. **Authentication → URL Configuration**: đặt **Site URL** = `http://localhost:5173` (hoặc domain sau khi
   deploy), thêm **Redirect URLs**: `http://localhost:5173/**` và domain deploy (`https://ten-mien.vercel.app/**`).
4. **SQL Editor**: tạo query mới, dán toàn bộ file [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   rồi **Run**. File này tạo bảng, RPC và RLS — mọi thứ nằm trong 1 file.
5. Tạo file `.env` ở gốc dự án (sao chép từ `.env.example`) và điền:

   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   Lấy ở **Project Settings → API Keys**. Publishable key được phép công khai (bảo mật nằm ở RLS),
   **tuyệt đối không đặt secret key (`sb_secret_...`) trong `.env`**.

Chưa cấu hình xong thì app vẫn mở được và hiện thẻ hướng dẫn từng bước.

## Deploy lên Vercel

1. Push code lên GitHub rồi vào [vercel.com](https://vercel.com) → **Add New → Project** → import repo.
2. Framework Preset: **Vite** (tự nhận). Không cần chỉnh build command.
3. **Environment Variables**: thêm `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` (giá trị thật).
4. Deploy. File `vercel.json` đã có sẵn rewrite SPA (vào `/room/123456` trực tiếp không bị 404).
5. Sau khi có domain: quay lại Supabase **Authentication → URL Configuration**, thêm domain vào
   **Site URL / Redirect URLs** (bước 3 ở trên).

## Luồng chơi nhanh

1. Giáo viên mở `/host`, đăng nhập bằng email, tạo bộ câu hỏi, soạn câu.
2. Bấm **Tạo phòng** → nhận mã 6 số + liên kết, chiếu lên bảng cho lớp.
3. Học sinh mở liên kết (hoặc `/join`), nhập mã + tên.
4. Giáo viên bấm **Bắt đầu** → mỗi câu: đếm ngược → giáo viên xem thống kê → hết giờ hệ thống tự
   công bố sau ~1 giây (hoặc bấm công bố sớm) → bấm **Câu tiếp theo**.
5. Hết câu: podium + bảng tổng hợp điểm từng học sinh.

## Bảo mật — nằm ở đâu?

Tất cả ghi dữ liệu phòng chơi đều đi qua **RPC** (hàm Postgres `security definer`), client không ghi
trực tiếp bảng nào. Chi tiết:

| Học sinh KHÔNG thể                                         | Cơ chế chặn                                            |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| Xem đáp án đúng trước khi giáo viên công bố                 | `rooms.correct_index` chỉ được ghi lúc `host_reveal`    |
| Tự cộng điểm / sửa điểm                                     | `players` không có policy ghi, chỉ RPC mới ghi được    |
| Gửi đáp án thứ 2 cho cùng 1 câu                             | khóa duy nhất `(player_id, q_index)` + RPC trả `false`  |
| Gửi đáp án sau khi hết giờ                                  | RPC `submit_answer` kiểm tra giờ **server**             |
| Chuyển câu / công bố thay giáo viên                         | RPC kiểm tra `host_id = auth.uid()`                     |
| Đọc bộ câu hỏi / phòng của giáo viên khác                   | RLS `quiz_sets`, `questions` chỉ chủ sở hữu đọc được    |
| Xem bài làm của học sinh khác                               | RLS `answers`: chỉ bản thân + giáo viên chủ phòng       |
| Dùng tool ngoài để thao tác                                 | Không có secret key trong client; mọi thứ qua RLS       |

Giới hạn đã biết (nhỏ): học sinh tinh mắt có thể mở DevTools đọc *kết quả chấm của chính mình*
(`is_correct`) ngay sau khi gửi, trước khi công bố — chỉ biết mình đúng/sai sớm vài giây, không biết
đáp án đúng là gì và không thấy bài người khác. Muốn chặn tuyệt đối thì bỏ `is_correct, points` khỏi
SELECT trong `fetchSnapshot`/`fetchAnswerStats` cho pha chưa công bố.

## Cấu trúc thư mục

```
src/
  api/        # quizzes.ts, rooms.ts, realtime.ts — lớp gọi Supabase
  components/ # ui.tsx (khối giao diện chung), AnswerPad.tsx
  hooks/      # useRoom.ts (snapshot + realtime), useCountdown.ts (đồng hồ server)
  lib/        # supabase.ts (client), auth.tsx (giáo viên/học sinh), errors.ts, utils.ts
  pages/      # Home, Join, StudentRoom, HostPage, QuizEditor, HostRoom
  types/      # db.ts — kiểu dữ liệu các bảng
supabase/
  migrations/ # 0001_init.sql — schema + RPC + RLS (chạy trong SQL Editor)
```

## Giới hạn hiện tại & hướng phát triển

- Chưa test đầu-cuối trên project Supabase thật (auth, RLS, realtime, đồng hồ server) — cần tạo
  project và chạy thử theo các bước trên. Khuyến nghị thử giả lập ~40 học sinh trước khi dùng thật.
- Chưa có import câu hỏi từ Excel/CSV (soạn tay trong app).
- Chưa có âm thanh, chỉ hiệu ứng CSS.
- Điểm/phiên chơi không lưu lịch sử lâu dài (phòng `finished` vẫn đọc được cho đến khi dọn).

---

*Bản web cũ (vanilla JS) được giữ nguyên ở nhánh `backup/hocvui-2026-11-11`.*
