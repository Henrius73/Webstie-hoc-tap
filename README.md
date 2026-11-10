# Học Vui – Đấu trí cùng mini-game

Ứng dụng quiz trên trình duyệt cho lớp học: soạn bộ câu hỏi, chia đội, chọn mini-game và chơi. Không cần backend, dữ liệu lưu trong `localStorage`; chạy được ngoại tuyến sau lần mở đầu tiên.

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
src/quizEngine.js      lượt chơi và chấm đáp án
src/games/             các mini-game (đua xe, kéo co, đua vịt, nhảy bao bố)
assets/icons/          icon PWA 192/512/maskable
serve.js               server tĩnh để chạy local
```

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
- Dữ liệu câu hỏi nằm trong `localStorage` **theo từng tên miền**. Trước khi đổi tên miền hoặc xóa dữ liệu trình duyệt, hãy vào trình soạn và **Xuất JSON** để sao lưu; sau đó **Nhập JSON** ở tên miền mới.
- Khi sửa HTML/CSS/JS/SW: tăng số `CACHE` trong `sw.js` (ví dụ `hocvui-v3` → `hocvui-v4`) để buộc trình duyệt tải bản mới.

## Kiểm thử

Các bài kiểm thử CDP nằm ngoài repository (thư mục tạm của phiên làm việc). Quy trình tối thiểu trước khi deploy:

1. `node serve.js`, mở trang, không có lỗi đỏ trong Console.
2. Chơi trọn một ván, thử đủ 3 dạng câu hỏi, âm thanh và toàn màn hình.
3. Ngắt mạng rồi tải lại: trang chủ và game vẫn mở được.
4. Kiểm tra giao diện ở 390px (điện thoại) và 1280px (máy chiếu).
