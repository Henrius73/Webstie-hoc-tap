# Học Vui – Trắc nghiệm cùng cả lớp

Ứng dụng quiz trên trình duyệt cho lớp học. Có hai cách dùng:

- **Một máy (ngoại tuyến):** soạn bộ câu hỏi, nhập tên học sinh và cho cả lớp làm bài theo lượt trên cùng một thiết bị. Bộ câu hỏi và điểm lưu trong `localStorage`; trang vẫn mở được sau lần tải đầu tiên khi không có mạng.
- **Nhiều thiết bị (trực tuyến):** giáo viên tạo phòng, học sinh vào bằng mã 6 số trên điện thoại của mình. Dùng Supabase (Postgres + Auth + Realtime); máy chủ chấm điểm và giữ đáp án đúng cho tới khi công bố.

Phần trực tuyến cần cấu hình Supabase theo hướng dẫn bên dưới. Khi chưa cấu hình, ứng dụng vẫn chạy bình thường ở chế độ một máy và hiện hướng dẫn thiết lập ở trang **Chơi cùng lớp**.

## Chạy thử ở máy

Yêu cầu: Node.js (chỉ để chạy server tĩnh local) và trình duyệt hiện đại.

```powershell
node serve.js
```

Mở <http://localhost:8000>.

> Không mở trực tiếp `index.html` bằng `file://`: ES modules và service worker cần chạy qua HTTP/HTTPS.

## Cấu trúc chính

```
index.html             khung trang + điều hướng
styles.css             toàn bộ giao diện, responsive
manifest.webmanifest   cấu hình PWA
sw.js                  service worker cache app shell
src/main.js            router và các màn hình
src/config.js          URL + publishable key của Supabase (điền tay)
src/store.js           lưu/chuẩn hóa bộ câu hỏi (localStorage)
src/csv.js             nhập câu hỏi từ CSV
src/xlsx.js            nhập/xuất câu hỏi từ Excel .xlsx (không cần thư viện)
src/quizEngine.js      lượt làm bài một máy và chấm đáp án
src/lib/supabase.js    tải Supabase SDK, đăng nhập ẩn danh/giáo viên
src/net/api.js         gọi RPC, đọc dữ liệu, nghe Realtime
src/net/clock.js       đồng bộ đồng hồ đếm ngược với giờ server
src/ui/                giao diện phòng chơi trực tuyến (giáo viên + học sinh)
src/games/raceLive.js  mini-game đua xe cho chế độ trực tuyến
src/games/             mini-game một máy (đua xe, kéo co, đua vịt, nhảy bao bố)
supabase/migrations/   SQL tạo bảng, RPC, RLS và Realtime
src/live.js            bản LAN cũ (giữ lại, không còn nối vào giao diện)
src/liveViews.js       giao diện LAN cũ (giữ lại, không còn nối vào giao diện)
server/rooms.js        server LAN cũ (giữ lại, không còn nối vào giao diện)
assets/icons/          icon PWA 192/512/maskable
serve.js               server tĩnh để chạy local
```

## Nhập / xuất câu hỏi

- **Excel (.xlsx)** là định dạng chính để soạn hàng loạt: hỗ trợ đủ 3 loại câu (trắc nghiệm, đúng/sai, điền từ), ảnh và thời gian.
- **CSV** 6 cột vẫn dùng được cho câu trắc nghiệm.

### Định dạng Excel

Mỗi sheet là một bộ câu hỏi, dòng 1 là tiêu đề gồm 10 cột:

| Cột | Nội dung |
|---|---|
| `Loại câu hỏi` | `Trắc nghiệm`, `Đúng/Sai`, `Điền từ` (để trống = trắc nghiệm) |
| `Câu hỏi` | Nội dung câu hỏi |
| `Đáp án A` … `Đáp án D` | Dùng cho câu trắc nghiệm |
| `Đáp án đúng` | `A`–`D` với trắc nghiệm; `Đúng`/`Sai` với đúng/sai |
| `Các đáp án đúng` | Với điền từ: các cách viết cách nhau bằng `\|` |
| `Ảnh (URL)` | Không bắt buộc |
| `Thời gian (giây)` | 0–600, để trống = 0 (không giới hạn) |

- **Nhập Excel** đọc sheet đầu tiên, thêm câu hợp lệ vào bộ đang soạn và báo lỗi theo số dòng Excel. Vẫn nhận file 6 cột cũ (có hoặc không có tiêu đề).
- **Xuất Excel** ở từng bộ tạo file một sheet; nút **Excel** ở danh sách bộ tạo workbook nhiều sheet (mỗi bộ một sheet).
- Chỉ hỗ trợ `.xlsx` hiện đại; file `.xls` cũ cần lưu lại thành `.xlsx` trước khi nhập.

## Làm bài cùng cả lớp

1. Vào **Làm bài**, chọn bộ câu hỏi.
2. Nhập tên từng học sinh rồi bấm **Thêm** (hoặc Enter). Cần ít nhất 2 bạn, tối đa 40 bạn; tên trùng sẽ bị bỏ qua.
3. Bấm **Bắt đầu làm bài**: mỗi học sinh trả lời 1 câu theo lượt, có đồng hồ và phản hồi đúng/sai ngay sau mỗi câu.
4. Khi mọi bạn đã trả lời, màn kết quả hiện bảng điểm từng học sinh; lượt làm bài được lưu vào **Tổng hợp điểm** (xếp hạng theo học sinh).

## Phòng chơi trực tuyến (Supabase)

### Cấu hình lần đầu

1. Tạo project miễn phí tại <https://supabase.com>.
2. Vào **Authentication → Sign In / Providers**, bật **Anonymous sign-ins** (học sinh vào nhanh, không cần tài khoản). Giữ **Email** bật để giáo viên đăng nhập bằng liên kết gửi tới email.
3. Vào **Authentication → URL Configuration**:
   - **Site URL:** địa chỉ trang web (ví dụ `http://localhost:8000` hoặc tên miền đã deploy).
   - **Redirect URLs:** thêm cả địa chỉ local và tên miền deploy, ví dụ `http://localhost:8000/**`, `https://ten-mien-cua-ban/**`. Thiếu bước này, liên kết đăng nhập của giáo viên sẽ báo lỗi.
4. Mở **SQL Editor**, dán và chạy toàn bộ file `supabase/migrations/0001_multiplayer.sql`. File tạo 5 bảng, các hàm RPC, bật RLS và thêm `rooms`/`players` vào publication Realtime. Nếu file báo không tìm thấy publication, vào **Database → Replication** bật Realtime cho hai bảng này.
5. Vào **Project Settings → API Keys**, lấy **Project URL** và **Publishable key** (`sb_publishable_...`) rồi điền vào `src/config.js`:

```js
export const SUPABASE_URL = 'https://abcdefgh.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_...';
```

6. Tải lại trang. Nếu vẫn còn chữ `YOUR-PROJECT`/`YOUR_KEY`, trang **Chơi cùng lớp** sẽ hiện lại hướng dẫn.

> Publishable key được phép công khai: bảo mật nằm ở RLS và RPC. **Không bao giờ** đặt secret key (`sb_secret_...`) hay `service_role` trong mã chạy trên trình duyệt.

### Cách chơi

1. Giáo viên mở **Chơi cùng lớp** (`#/play`), nhập email và bấm gửi liên kết đăng nhập. Mở email trên cùng trình duyệt rồi bấm liên kết để quay lại trang.
2. Chọn một bộ câu hỏi đang lưu trên máy và bấm đăng lên Supabase, hoặc dùng bộ đã đăng trước đó. Chỉ câu **trắc nghiệm đủ 4 đáp án** được đưa lên; câu đúng/sai và điền từ bị bỏ qua (có thông báo). Thời gian mỗi câu từ 5–300 giây, để trống hoặc dưới 5 giây sẽ thành 20 giây.
3. Bấm tạo phòng: hệ thống sinh **mã 6 số** và liên kết `#/room/MÃ`. Chiếu mã lên màn hình hoặc gửi liên kết cho học sinh.
4. Học sinh mở liên kết (hoặc vào **Chơi cùng lớp**), nhập mã và tên (1–20 ký tự). Không cần tài khoản; tên trùng vẫn chơi được.
5. Giáo viên bấm bắt đầu/chuyển câu. Học sinh trả lời trên máy của mình; khi hết giờ, máy giáo viên tự gọi công bố sau khoảng 1,2 giây, máy chủ chấm và cộng điểm (đáp án gửi sau hạn vẫn bị từ chối). Giáo viên xem được số người đã trả lời và tỉ lệ từng đáp án.
6. Kết thúc: bảng xếp hạng hiện trên cả máy giáo viên và học sinh.

Tải lại trang giữa chừng (hoặc mất mạng rồi có lại) sẽ tự lấy lại trạng thái phòng; học sinh đã vào phòng vẫn giữ tên và bài đã trả lời.

### Giới hạn của chế độ trực tuyến

- Chỉ hỗ trợ câu **trắc nghiệm 4 đáp án**. Đúng/sai và điền từ chỉ dùng được ở chế độ một máy.
- Mỗi học sinh chỉ gửi **một đáp án cho mỗi câu**; không đổi được sau khi gửi.
- Điểm do server tính trong `submit_answer` (đúng: 1000 điểm nếu trả lời ngay, giảm dần còn 500 khi hết giờ; sai: 0) và chỉ cộng vào bảng điểm khi `host_reveal`. Học sinh không thấy đáp án đúng trước khi công bố.
- Bộ câu hỏi trên Supabase thuộc về tài khoản email đã đăng; bộ trên máy vẫn nằm trong `localStorage`.

### Kiểm tra bảo mật

Mở một cửa sổ ẩn danh (phiên học sinh), bấm F12 → Console và làm thử từng mục. Có thể dùng client đã tải trong trang hoặc gọi REST bằng `src/config.js`; mọi thao tác dưới đây **phải bị chặn hoặc trả về rỗng**.

| Học sinh không được… | Cách kiểm tra | Kết quả đúng |
|---|---|---|
| Đọc đáp án đúng trong `questions` | `select * from questions` bằng phiên ẩn danh | Rỗng hoặc lỗi RLS |
| Thấy `rooms.correct_index` khi đang hỏi | Đọc phòng trong pha `question` | `correct_index` là `null` |
| Tự sửa điểm/tên trong `players` | `update players set score = 999` | Lỗi RLS |
| Tự tạo phòng hoặc đổi trạng thái `rooms` | `insert`/`update` trực tiếp | Lỗi RLS |
| Tự thêm/sửa `answers` | `insert`/`update` trực tiếp | Lỗi RLS |
| Điều khiển phòng của lớp khác | Gọi `host_next_question`/`host_reveal` với phòng không phải của mình | Bị từ chối (`invalid_state`) |
| Trả lời hai lần hoặc sau khi hết giờ | Gọi `submit_answer` lần hai / sau `question_ends_at` | Lỗi `invalid_state`/`closed` |
| Đọc bài của bạn khác trước khi công bố | `select * from answers` | Chỉ thấy bài của mình; giáo viên thấy cả phòng |
| Xem phòng của lớp khác | Đọc `rooms`/`players` với mã khác | Không thấy dữ liệu |
| Tạo bộ câu hỏi bằng tài khoản ẩn danh | Insert vào `quiz_sets` | Lỗi RLS |

Danh sách đầy đủ và kịch bản kiểm thử nằm ở mục 10 của `PROJECT.md`.

## Deploy

Ứng dụng là trang tĩnh, **không có bước build**. Routing dùng hash (`#/...`) nên không cần cấu hình rewrite. Mọi đường dẫn đều tương đối, chạy được ở tên miền gốc hoặc thư mục con.

### Cloudflare Pages

1. Đưa mã nguồn lên một repository GitHub.
2. Vào Cloudflare Pages → **Create a project** → kết nối repository.
3. Framework preset: **None**; Build command: để trống; Output directory: `/` (gốc repository).
4. Deploy. File `_headers` được Cloudflare Pages áp dụng tự động.

### Netlify

1. Đưa mã nguồn lên GitHub.
2. Netlify → **Add new site** → **Import an existing project** → chọn repository.
3. Build command: để trống; Publish directory: `.`.
4. Deploy. File `_headers` được Netlify áp dụng tự động.

### Sau khi deploy

- Điền `src/config.js` **trước khi deploy** (hoặc sửa rồi deploy lại), và thêm tên miền thật vào **Authentication → URL Configuration → Redirect URLs** để liên kết đăng nhập của giáo viên quay về đúng trang.
- PWA yêu cầu **HTTPS** (Cloudflare Pages/Netlify đều tự cấp).
- Mở trang trên điện thoại, kiểm tra nút cài ứng dụng của trình duyệt và thử tắt mạng rồi mở lại.
- Dữ liệu câu hỏi nằm trong `localStorage` **theo từng tên miền**. Trước khi đổi tên miền hoặc xóa dữ liệu trình duyệt, hãy vào trình soạn và **Xuất Excel** để sao lưu. Khi chuyển sang tên miền mới, tạo bộ mới rồi **Nhập Excel** từng sheet (mỗi sheet là một bộ) và bấm Lưu.
- Khi sửa HTML/CSS/JS/SW: tăng số `CACHE` trong `sw.js` (ví dụ `hocvui-v9` → `hocvui-v10`) để buộc trình duyệt tải bản mới.

## Kiểm thử

Các bài kiểm thử CDP nằm ngoài repository (thư mục tạm của phiên làm việc). Quy trình tối thiểu trước khi deploy:

1. `node serve.js`, mở trang, không có lỗi đỏ trong Console.
2. Làm trọn một lượt một máy, thử đủ 3 dạng câu hỏi, âm thanh và toàn màn hình.
3. Ngắt mạng rồi tải lại: trang chủ và màn làm bài vẫn mở được.
4. Nhập một file Excel mẫu, xuất Excel rồi mở lại bằng Excel/Google Sheets.
5. Kiểm tra giao diện ở 390px (điện thoại) và 1280px (máy chiếu).

Riêng chế độ trực tuyến, cần một project Supabase thật và ít nhất 3 cửa sổ ẩn danh:

1. Giáo viên đăng nhập email, đăng một bộ 5 câu trắc nghiệm, tạo phòng; học sinh vào bằng mã.
2. Chơi trọn 5 câu với 3 thiết bị, có một bạn không trả lời và một bạn trả lời sai; đối chiếu điểm với cách tính tay (đúng + nhanh hơn = nhiều điểm hơn).
3. Tải lại trang học sinh ngay khi đang có câu hỏi: phải quay lại đúng câu, đồng hồ còn đúng thời gian, bài đã gửi không gửi lại được.
4. Tắt mạng một máy rồi bật lại: phải tự lấy lại trạng thái phòng.
5. Chạy bảng **Kiểm tra bảo mật** ở trên; mọi mục phải bị chặn.
6. Thử vào bằng mã sai, mã của phòng đã kết thúc và tên trùng.
