# Học Vui — Trò chơi trắc nghiệm cả lớp (kiểu Kahoot)

Web app học tập realtime: giáo viên soạn bộ câu hỏi, tạo phòng chiếu mã lên bảng; học sinh vào bằng mã
phòng + tên, trả lời trắc nghiệm theo thời gian thực, điểm được tổng hợp và xếp hạng ngay trong lớp.

Xây bằng **Vite + React 19 + TypeScript + Tailwind CSS v4 + Supabase** (Postgres + Auth + Realtime),
deploy trên **Vercel**.

## Tính năng

**Giáo viên**
- Đăng nhập bằng email (magic link, không cần mật khẩu).
- Soạn bộ câu hỏi ngay trong app: nội dung, 4 đáp án, chọn đáp án đúng, thời gian 5–300 giây, ảnh (URL), sắp xếp thứ tự.
- **Nhập nhanh đề từ Excel**: kéo–thả hoặc chọn tệp `.xlsx`/`.xls`, tự nhận dòng tiêu đề, báo lỗi theo số dòng
  Excel, kèm nút **tải tệp mẫu** (2 trang: Câu hỏi + Hướng dẫn). Cột: câu hỏi, A, B, C, D, đáp án đúng, thời gian, ảnh (URL).
- Tạo phòng chơi — nhận mã 6 chữ số + liên kết để chiếu lên bảng.
- **Danh sách phòng đang mở** ngay tại trang chủ giáo viên (mã phòng, bộ đề, số học sinh, pha hiện tại) — lỡ tắt tab hay quay lại vẫn vào lại được.
- Điều khiển ván chơi: bắt đầu, xem thống kê trả lời theo thời gian thực (kèm chip ✓ ai đã trả lời), công bố sớm hoặc tự động, sang câu tiếp, kết thúc.
- **Kết thúc ván ngay** từ bất kỳ pha nào (có xác nhận) — dùng khi cần dừng sớm.
- **Điều khiển bằng phím**: `Space`/`Enter` = công bố hoặc sang câu tiếp — bấm từ xa được, không cần chuột.
- Xem podium top 3 + bảng tổng hợp điểm từng học sinh.

**Học sinh**
- Không cần tài khoản (đăng nhập ẩn danh tự động).
- Vào phòng bằng mã 6 số + tên (1–20 ký tự) — vào muộn vẫn được cho đến khi ván kết thúc.
- Đồng hồ đếm ngược theo **giờ server** (máy chậm/nhanh lệch giờ vẫn công bằng), mỗi câu chỉ gửi được 1 đáp án.
- **Chọn nhanh bằng phím 1–4** trên bàn phím máy tính.
- Xem đáp án đúng sau công bố, điểm nhận được, bảng xếp hạng và podium cuối ván.

**Trải nghiệm chung**
- Giao diện dùng icon [Lucide](https://lucide.dev) (không dùng emoji), nút **Trang chủ** ở mọi trang con.
- Âm thanh hiệu ứng tổng hợp (Web Audio, không cần tệp nhạc) + nút tắt/bật âm thanh.
- Pháo giấy + điểm "nhảy số" khi tổng kết, animation khi công bố đáp án đúng.
- Hết giờ tự khóa bảng chọn đáp án của học sinh (server vẫn chặn gửi muộn ở lớp bảo vệ thứ 2).

**Chế độ chơi thử (không cần Supabase)**
- Mở `/demo` để tạo phòng từ bộ câu hỏi đã lưu trên máy (hoặc bộ mẫu 8 câu) — chạy 100% trên trình duyệt.
- Trạng thái phòng lưu trong `localStorage`; các tab **cùng trình duyệt** đồng bộ qua `BroadcastChannel`
  + sự kiện `storage`. Tab giáo viên điều khiển pha, tab học sinh vào bằng mã như phòng thật.
- Đầy đủ lobby → câu hỏi (đồng hồ, thống kê) → công bố → podium, âm thanh và phím tắt giống chế độ Supabase.
- Giới hạn: chỉ chơi được trên máy đã tạo phòng. Muốn chơi giữa nhiều máy vẫn cần cấu hình Supabase.

**Luyện tập (tự học — chạy hoàn toàn trên trình duyệt, không cần mạng/Supabase)**
- Tự soạn bộ câu hỏi lưu trong `localStorage` (tự động lưu sau mỗi thay đổi), nhập nhanh từ tệp Excel,
  nhân bản/xóa bộ, kèm bộ câu hỏi mẫu để dùng thử ngay.
- Làm bài kiểu trang trắc nghiệm thông thường: **chấm ngay sau mỗi câu** hoặc **chấm cuối bài (kiểu đề thi)**,
  chọn số câu, xáo trộn câu/đáp án, giới hạn thời gian mỗi câu, phím tắt 1–4 và Enter.
- Kết quả: điểm %, thống kê đúng/sai/hết giờ, **xem lại từng câu với đáp án đúng**, **làm lại chỉ những câu sai**,
  lưu lần gần nhất + lần tốt nhất của từng bộ.
- **Thẻ ghi nhớ (flashcards)**: lật thẻ câu hỏi → đáp án, đánh dấu "biết rồi / chưa nhớ", thẻ chưa nhớ lặp lại cuối hàng.

**Cách tính điểm (server chấm, không phía client):** trả lời đúng được **1000 điểm nếu bấm ngay**,
giảm dần còn **500 điểm khi hết giờ**; sai hoặc không trả lời: **0 điểm**.

## Yêu cầu môi trường

- **Node.js ≥ 20.19** (khuyến nghị 22 LTS) và npm.
- Một project [Supabase](https://supabase.com) (miễn phí là đủ).
- Tài khoản [Vercel](https://vercel.com) nếu muốn deploy.

> Thư viện đọc Excel là [`xlsx` 0.20.3](https://sheetjs.com) cài trực tiếp từ CDN chính thức của SheetJS
> (khai báo trong `package.json`), nên `npm install` cần truy cập được `cdn.sheetjs.com`.

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
4. **SQL Editor**: chạy lần lượt **cả hai** file migration theo thứ tự —
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) (bảng, RPC, RLS) rồi
   [`supabase/migrations/0002_host_room_controls.sql`](supabase/migrations/0002_host_room_controls.sql)
   (kết thúc phòng sớm + index phòng đang mở).
5. Tạo file `.env` ở gốc dự án (sao chép từ `.env.example`) và điền:

   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   Lấy ở **Project Settings → API Keys**. Publishable key được phép công khai (bảo mật nằm ở RLS),
   **tuyệt đối không đặt secret key (`sb_secret_...`) trong `.env`**.

Chưa cấu hình Supabase thì app tự chuyển sang **chế độ chơi thử** (`/demo`) — vẫn dùng được đầy đủ
trên một máy. Khi điền đủ biến môi trường, `/host` quay lại luồng đăng nhập giáo viên như bình thường.

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

**Chưa có Supabase?** Mở `/demo` → chọn bộ câu hỏi (hoặc bộ mẫu) → **Mở phòng thử** → mở tab khác
cùng trình duyệt vào `/demo/play/<mã>` (hoặc `/join`) và nhập mã. Các bước điều khiển giống hệt trên.

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
  components/ # ui.tsx (khối giao diện chung), AnswerPad.tsx, QuestionForm.tsx, ExcelImportSection.tsx
  hooks/      # useRoom.ts (snapshot + realtime), useDemoRoom.ts (phòng thử),
               # useCountdown.ts (đồng hồ server)
  lib/        # supabase.ts (client), auth.tsx (giáo viên/học sinh), errors.ts, utils.ts,
               # excel.ts (đọc đề Excel + tạo tệp mẫu), sound.ts (âm thanh Web Audio),
               # practiceStore.ts (luyện tập cục bộ), demoRoom.ts (phòng thử localStorage)
  pages/      # Home, Join, StudentRoom, HostPage, QuizEditor, HostRoom,
               # DemoHost, DemoHostRoom, DemoStudentRoom (chế độ chơi thử),
               # Practice, PracticeEditor, PracticeRun, PracticeFlash (góc luyện tập)
  types/      # db.ts — kiểu dữ liệu các bảng
supabase/
  migrations/ # 0001_init.sql — schema + RPC + RLS · 0002_host_room_controls.sql — kết thúc phòng sớm
```

## Giới hạn hiện tại & hướng phát triển

- Chưa test đầu-cuối trên project Supabase thật (auth, RLS, realtime, đồng hồ server) — cần tạo
  project và chạy thử theo các bước trên. Khuyến nghị thử giả lập ~40 học sinh trước khi dùng thật.
- Chế độ chơi thử chỉ hoạt động trong **cùng trình duyệt/máy** (dữ liệu trong `localStorage`).
  Chơi giữa nhiều máy cần cấu hình Supabase.
- Điểm/phiên chơi không lưu lịch sử lâu dài (phòng `finished` vẫn đọc được cho đến khi dọn).
- Chưa có quản lý lớp học sinh, ngân hàng câu hỏi dùng chung hay xuất kết quả ra file.

---

*Bản web cũ (vanilla JS) được giữ nguyên ở nhánh `backup/hocvui-2026-11-11`.*
