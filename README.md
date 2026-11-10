# Học Vui – Trắc nghiệm cùng cả lớp

Ứng dụng quiz trên trình duyệt cho lớp học: soạn bộ câu hỏi, nhập tên học sinh và cho cả lớp làm bài theo lượt. Điểm từng bạn được tổng hợp sau giờ làm bài. Không cần backend, dữ liệu lưu trong `localStorage`; chạy được ngoại tuyến sau lần mở đầu tiên.

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
src/store.js           lưu/chuẩn hóa bộ câu hỏi
src/csv.js             nhập câu hỏi từ CSV
src/xlsx.js            nhập/xuất câu hỏi từ Excel .xlsx (không cần thư viện)
src/quizEngine.js      lượt làm bài và chấm đáp án
src/games/             mini-game cũ (đua xe, kéo co, đua vịt, nhảy bao bố) — đang tạm ngắt khỏi giao diện
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

- PWA yêu cầu **HTTPS** (Cloudflare Pages/Netlify đều tự cấp).
- Mở trang trên điện thoại, kiểm tra nút cài ứng dụng của trình duyệt và thử tắt mạng rồi mở lại.
- Dữ liệu câu hỏi nằm trong `localStorage` **theo từng tên miền**. Trước khi đổi tên miền hoặc xóa dữ liệu trình duyệt, hãy vào trình soạn và **Xuất Excel** để sao lưu. Khi chuyển sang tên miền mới, tạo bộ mới rồi **Nhập Excel** từng sheet (mỗi sheet là một bộ) và bấm Lưu.
- Khi sửa HTML/CSS/JS/SW: tăng số `CACHE` trong `sw.js` (ví dụ `hocvui-v6` → `hocvui-v7`) để buộc trình duyệt tải bản mới.

## Kiểm thử

Các bài kiểm thử CDP nằm ngoài repository (thư mục tạm của phiên làm việc). Quy trình tối thiểu trước khi deploy:

1. `node serve.js`, mở trang, không có lỗi đỏ trong Console.
2. Làm trọn một lượt, thử đủ 3 dạng câu hỏi, âm thanh và toàn màn hình.
3. Ngắt mạng rồi tải lại: trang chủ và màn làm bài vẫn mở được.
4. Nhập một file Excel mẫu, xuất Excel rồi mở lại bằng Excel/Google Sheets.
5. Kiểm tra giao diện ở 390px (điện thoại) và 1280px (máy chiếu).
