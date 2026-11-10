# PROJECT.md — Sân chơi học tập (tên tạm)

> **Cách dùng file này**
> - Đầu mỗi phiên làm việc với AI: dán toàn bộ file này (hoặc để Claude Code tự đọc) rồi nói rõ việc hôm nay.
> - Cuối mỗi phiên: cập nhật mục **12. Trạng thái hiện tại** và, nếu có, mục **10. Quyết định đã chốt**.
> - Chỗ nào ghi `[...]` là chỗ bạn cần điền hoặc xác nhận.

---

## 1. Tổng quan

**Mục tiêu:** Website game học tập. Giáo viên tạo bộ câu hỏi trắc nghiệm, học sinh chơi các mini-game (đua xe, kéo co, đua vịt...). Trả lời đúng thì nhân vật tiến lên.

**Người dùng chính**
- Giáo viên: tạo/nhập câu hỏi, chọn game, điều khiển lớp chơi.
- Học sinh: chơi trên màn hình chiếu chung (giai đoạn đầu) hoặc trên thiết bị riêng (giai đoạn sau).

**Tiêu chí thành công của dự án:** một giáo viên không rành công nghệ có thể tạo bộ câu hỏi và cho cả lớp chơi trong vòng 5 phút.

**Trong phạm vi (giai đoạn đầu)**
- Chạy hoàn toàn trên trình duyệt, không cần backend
- 2 đội chơi trên cùng một màn hình
- Câu hỏi trắc nghiệm 4 đáp án
- Lưu bộ câu hỏi ngay trên máy (ngoại tuyến)

**Ngoài phạm vi (làm sau)**
- Tài khoản, đăng nhập
- Phòng chơi online bằng mã
- Thống kê kết quả theo học sinh
- Thanh toán, quảng cáo

---

## 2. Quy tắc làm việc với AI

1. Mỗi lần chỉ làm **một nhiệm vụ nhỏ** có tiêu chí nghiệm thu rõ ràng.
2. Với việc chạm tới nhiều file: **đề xuất kế hoạch và danh sách file sẽ sửa trước**, chờ tôi duyệt rồi mới viết code.
3. **Không thêm thư viện** hoặc đổi cấu trúc thư mục khi chưa hỏi.
4. **Không sửa file ngoài phạm vi** nhiệm vụ. Nếu thấy cần sửa thêm, hãy báo lý do.
5. Khi báo lỗi, giải thích **nguyên nhân trước**, sau đó mới đề xuất cách sửa.
6. Giải thích bằng tiếng Việt, chú thích code bằng tiếng Việt, tên biến/hàm bằng tiếng Anh.
7. Nếu yêu cầu chưa rõ, hỏi lại tối đa 2 câu thay vì tự đoán.
8. Cuối phiên, tóm tắt: đã làm gì, còn dở gì, rủi ro nào.

---

## 3. Stack và môi trường

| Hạng mục | Lựa chọn | Ghi chú |
|---|---|---|
| Ngôn ngữ | HTML + CSS + JavaScript (ES modules) | Không dùng bước build ở Mốc 1 |
| Hoạt họa | CSS animation, nâng lên Canvas/Phaser khi cần | Quyết định ở Mốc 2 |
| Routing | Hash (`#/`, `#/play`, `#/edit`) | Host tĩnh được |
| Lưu dữ liệu | `localStorage` / IndexedDB | Giai đoạn ngoại tuyến |
| Ngoại tuyến | Service Worker (PWA) | Mốc 3 |
| Backend / phòng online | [Firebase / Supabase / Node + Socket.IO — chưa chọn] | Mốc 4 |
| Hosting | Cloudflare Pages (chính) / Netlify (thay thế) | Trang tĩnh, deploy từ GitHub; dùng chung `_headers` |
| Quản lý mã nguồn | Git + GitHub | Đã push nhánh `main` lên `Henrius73/Webstie-hoc-tap` |

**Chạy thử ở máy:** `node serve.js` rồi mở `http://localhost:8000` (không mở trực tiếp `index.html` vì ES modules/service worker cần HTTP).

**Trình duyệt mục tiêu:** Chrome, Edge, Safari trên điện thoại và máy tính; ưu tiên chạy mượt trên điện thoại cấu hình thấp.

---

## 4. Cấu trúc thư mục

```
game-hoc-tap/
├── PROJECT.md
├── DECISIONS.md          (tùy chọn, nếu mục 10 quá dài)
├── index.html
├── specs/                mỗi mốc/tính năng một file spec
│   └── moc-1.md
├── src/
│   ├── main.js           khởi động, router
│   ├── core/
│   │   ├── quiz.js       bộ máy câu hỏi (lượt, điểm, kiểm tra đáp án)
│   │   ├── store.js      đọc/ghi bộ câu hỏi
│   │   └── audio.js      âm thanh
│   ├── games/
│   │   ├── race-car.js   đua xe
│   │   └── tug-of-war.js kéo co
│   ├── ui/               màn hình: trang chủ, soạn câu hỏi, chọn game, kết quả
│   └── styles/
├── assets/
│   ├── images/
│   └── sounds/
└── data/
    └── sample-questions.json
```

---

## 5. Mô hình dữ liệu

**Bộ câu hỏi**
```json
{
  "id": "bo-001",
  "title": "Ôn tập phép nhân lớp 3",
  "subject": "Toán",
  "questions": [
    {
      "id": "q1",
      "type": "choice",
      "text": "7 x 8 = ?",
      "options": ["54", "56", "58", "64"],
      "correctIndex": 1,
      "answers": [],
      "image": null,
      "timeLimit": 20
    }
  ]
}
```

**Ba loại câu hỏi** (`type`)
| Loại | `options` | `correctIndex` | `answers` |
|---|---|---|---|
| `choice` — trắc nghiệm 4 đáp án | 4 chuỗi | 0–3 | `[]` |
| `boolean` — đúng/sai | `["Đúng","Sai"]` | 0 (Đúng) hoặc 1 (Sai) | `[]` |
| `fill` — điền từ | `[]` | 0 (không dùng) | 1–5 cách viết được chấp nhận |

Dữ liệu cũ chưa có `type` được tự hiểu là `choice`. Câu `fill` được chấm sau khi cắt khoảng trắng, gộp khoảng trắng giữa, không phân biệt hoa/thường, chuẩn hóa NFC; **giữ dấu tiếng Việt**.

**Đội chơi**
```json
{ "id": "team-1", "name": "Đội Sao Mai", "color": "#e63946", "score": 0, "progress": 0 }
```

**Quy ước**
- `progress` chạy từ 0 đến 100.
- `correctIndex` tính từ 0.
- Mọi dữ liệu nhập từ ngoài (CSV, JSON) phải được kiểm tra hợp lệ trước khi dùng.

**Định dạng CSV cho phép nhập hàng loạt** (chỉ tạo câu `choice`)
```
Câu hỏi,Đáp án A,Đáp án B,Đáp án C,Đáp án D,Đáp án đúng (A-D)
```

---

## 6. Kiến trúc game

Mọi game dùng chung một interface, nhờ đó thêm game mới chỉ cần viết thêm một file trong `src/games/`.

```js
// Mỗi game export một đối tượng có dạng:
export default {
  id: "race-car",
  name: "Đua xe",

  // Dựng giao diện game vào container, nhận danh sách đội
  init(container, teams, options) {},

  // Gọi khi một đội trả lời; isCorrect = true thì tiến lên
  onAnswer(teamId, isCorrect) {},

  // Trả về true nếu ván đã kết thúc, kèm đội thắng
  checkWin() {},

  // Dọn dẹp khi thoát game
  destroy() {},
};
```

**Luồng một ván chơi**
1. Chọn bộ câu hỏi → chọn game → đặt tên 2 đội.
2. `quiz.js` đưa từng câu cho đội đến lượt.
3. Đội chọn đáp án → `quiz.js` kiểm tra → gọi `game.onAnswer(teamId, isCorrect)`.
4. `game.checkWin()` → nếu có đội thắng thì sang màn hình kết quả.

**Nguyên tắc:** `quiz.js` không biết gì về hình ảnh game, game không biết gì về dữ liệu câu hỏi. Hai phần chỉ giao tiếp qua `onAnswer`.

---

## 7. Danh sách game

| Game | Cách chơi | Trạng thái |
|---|---|---|
| Đua xe | Đúng → xe tiến 10% | [x] đã xong |
| Kéo co | Đúng → dây kéo về phía mình | [x] đã xong |
| Đua vịt | Giống đua xe, đổi giao diện | [x] đã xong |
| Đua thuyền rồng | Giống đua xe, nhiều làn | [ ] chưa làm |
| Nhảy bao bố | Đúng → nhảy 1 bước | [x] đã xong |
| Tung xúc xắc | Đúng → tung xúc xắc, đi số ô tương ứng | [ ] chưa làm |

---

## 8. Quy ước code và giao diện

**Code**
- Tên file: `kebab-case.js`. Tên hàm/biến: `camelCase`. Hằng số: `UPPER_SNAKE_CASE`.
- Mỗi hàm làm một việc; hàm dài hơn khoảng 40 dòng thì cân nhắc tách.
- Không dùng biến toàn cục; trạng thái ván chơi nằm trong một đối tượng `gameState`.
- Có xử lý lỗi cho thao tác đọc/ghi `localStorage` (có thể bị chặn hoặc đầy).

**Giao diện**
- Thiết kế **ưu tiên điện thoại**, sau đó mở rộng lên máy tính/máy chiếu.
- Chữ câu hỏi to, đọc được từ cuối lớp học; nút đáp án đủ lớn để chạm (tối thiểu 48px).
- Không truyền đạt thông tin chỉ bằng màu sắc (đúng/sai cần thêm biểu tượng hoặc chữ).
- Có nút bật/tắt âm thanh và nút toàn màn hình.
- Toàn bộ chữ hiển thị bằng tiếng Việt, đặt trong một file chuỗi riêng để sau này dịch được.

---

## 9. Lộ trình

**Mốc 1: Quiz engine + game đua xe (khoảng 1 tuần)**
- [x] Dựng khung trang, router, định dạng dữ liệu, 5 câu mẫu
- [x] Quiz engine: lượt chơi, điểm, 2 đội
- [x] Game đua xe với hoạt họa CSS
- [x] Màn hình thắng, chơi lại, âm thanh cơ bản
- [ ] Deploy lên hosting và thử trên điện thoại

*Nghiệm thu:* chơi trọn một ván từ chọn bộ câu hỏi đến màn hình thắng, không lỗi Console.

**Mốc 2: Nhiều game + soạn câu hỏi**
- [x] Chuẩn hóa interface game theo mục 6
- [x] Thêm 3–4 game (đua xe, kéo co, đua vịt, nhảy bao bố)
- [x] Trình soạn câu hỏi, nhập từ CSV

**Mốc 3: Hoàn thiện trải nghiệm**
- [x] PWA chạy ngoại tuyến
- [x] Âm thanh, toàn màn hình (responsive đã xong)
- [x] Ảnh minh họa và giới hạn thời gian cho câu hỏi
- [x] Thêm dạng câu hỏi đúng/sai, điền từ

**Mốc 4: Chơi online**
- [ ] Chọn backend, thiết kế phòng chơi bằng mã
- [ ] Học sinh vào phòng bằng thiết bị riêng
- [ ] Tính điểm ở phía server

**Mốc 5 trở đi**
- [ ] Tài khoản giáo viên, thư viện bộ câu hỏi, thống kê

---

## 10. Quyết định đã chốt

| Ngày | Quyết định | Lý do |
|---|---|---|
| 2026-11-10 | Dùng HTML/CSS/JS thuần ở Mốc 1 | Nhẹ, dễ học, không cần build |
| 2026-11-10 | Mỗi game là một module, hướng tới interface chung ở mục 6 | Thêm game mới không phải sửa lõi |
| 2026-11-10 | Chuẩn hóa bộ câu hỏi theo mục 5 và tự chuyển dữ liệu cũ | Thống nhất dữ liệu trước khi thêm CSV/game mới |
| 2026-11-10 | Giữ nhập/xuất JSON như tính năng phụ ngoài roadmap | Hữu ích để sao lưu/chia sẻ; CSV vẫn thuộc Mốc 2 |
| 2026-11-10 | Giữ cấu trúc file hiện tại (`src/main.js`, `src/games/...`) | Chưa cần xáo trộn; đổi sang `src/core`, `src/ui` sẽ hỏi riêng |
| 2026-11-10 | Game dùng `checkWin()` trả về đội thắng hoặc `null`; `onAnswer()` tự vẽ lại | Bám mục 6, bỏ các hàm riêng `render`/`isFinished`/`getWinner` |
| 2026-11-10 | Đua vịt dùng lại markup đường đua, chỉ thêm lớp `.duck` | Ít mã trùng lặp; vẫn tách module riêng để dễ đổi giao diện sau |
| 2026-11-10 | CSV nhận cả file có header mục 5 và file không header; dòng lỗi bị bỏ qua, câu hợp lệ vẫn được thêm | Giáo viên dễ dùng với dữ liệu xuất từ Excel; vẫn kiểm tra chặt từng dòng |
| 2026-11-10 | Ảnh câu hỏi dùng URL; hết giờ tính là trả lời sai; `timeLimit = 0` là không giới hạn | Đúng schema mục 5 (`image` là chuỗi/null), giữ công bằng khi tính điểm và không ép giáo viên tải ảnh lên |
| 2026-11-10 | Âm thanh tạo bằng Web Audio API trong `src/sound.js`; bật mặc định, tắt/bật được và ghi nhớ ở `hocvui.muted.v1` | Không cần tệp ngoài, không vướng bản quyền, chạy ngoại tuyến; AudioContext chỉ tạo ở lần phát đầu để không bị trình duyệt chặn |
| 2026-11-10 | Toàn màn hình áp dụng cho khung `.game`, không phải cả trang; overlay thắng nằm trong khung này | Giữ nguyên nút điều khiển và bảng điểm khi chiếu; ẩn nút nếu trình duyệt không hỗ trợ |
| 2026-11-10 | PWA dùng service worker cache sẵn app shell (phiên bản `hocvui-vN`, hiện là `hocvui-v3`); trang điều hướng ưu tiên mạng rồi mới lấy cache | Chạy được khi mất mạng mà vẫn nhận bản mới khi có mạng; chỉ cache tài nguyên cùng origin |
| 2026-11-10 | Icon PWA tạo sẵn bằng script Node và lưu trong `assets/icons/` | Không phụ thuộc thư viện/DVD, đủ 192, 512 và bản maskable để cài lên điện thoại |
| 2026-11-10 | Mở rộng schema với `type: choice / boolean / fill`; dữ liệu cũ tự nhận là `choice`; giữ nguyên `options`/`correctIndex`, thêm `answers` | Tương thích ngược, CSV 6 cột vẫn dùng được; JSON là cách chia sẻ câu đúng/sai và điền từ |
| 2026-11-10 | Điền từ so khớp sau khi cắt/gộp khoảng trắng, không phân biệt hoa/thường, giữ dấu tiếng Việt | Tránh lỗi gõ thừa khoảng trắng; giáo viên chủ động thêm cách viết không dấu vào `answers` nếu cần |
| 2026-11-10 | Đổi loại câu trong trình soạn sẽ đặt lại phần đáp án của loại mới, giữ nội dung/ảnh/thời gian | Tránh dữ liệu rác giữa các loại; giáo viên không phải nhập lại toàn bộ |
| 2026-11-10 | Deploy dạng trang tĩnh, không build; cấu hình `_headers` dùng chung cho Cloudflare Pages và Netlify | Hash router nên không cần rewrite; `_headers` giữ HTML/SW/manifest không cache và thêm header an toàn trên cả hai host |
| 2026-11-10 | Dữ liệu giáo viên chỉ nằm trong `localStorage` theo tên miền; chuyển host phải xuất/nhập JSON | Chưa có backend; tránh mất bộ câu hỏi khi đổi tên miền hoặc xóa dữ liệu trình duyệt |
| | | |

---

## 11. Tài nguyên và bản quyền

- Hình ảnh, âm thanh chỉ dùng nguồn **tự làm** hoặc **miễn phí có giấy phép rõ ràng** (Kenney.nl, OpenGameArt, ...). Ghi nguồn và giấy phép vào bảng dưới.
- **Không sao chép** code, hình ảnh, âm thanh hay giao diện từ trang tham khảo; chỉ lấy ý tưởng cơ chế chơi.

| Tài nguyên | Nguồn | Giấy phép |
|---|---|---|
| [ví dụ: xe đua sprite] | [Kenney.nl] | [CC0] |

---

## 12. Trạng thái hiện tại *(cập nhật cuối mỗi phiên)*

**Mốc đang làm:** Mốc 3 đã xong (ảnh + thời gian, âm thanh, toàn màn hình, PWA, dạng câu hỏi mới); tiếp theo deploy và thử trên điện thoại.

**Đã xong:**
- Khung trang, sidebar, router hash, responsive (desktop / tablet / mobile), icon Lucide ngoại tuyến.
- Quiz engine: chia lượt, chấm điểm, 2–4 đội (kéo co đúng 2 đội).
- Game đua xe + kéo co, màn thắng, chơi lại, tổng hợp điểm và lịch sử trận đấu.
- Game Đua vịt tri thức (`duck`): dùng lại khung đường đua, đổi sang mặt nước, vịt bơi 1 bước mỗi câu đúng, về đích sau 6 bước.
- Game Nhảy bao bố (`sack`): đường đua bao tải chia ô, nhảy 1 bước mỗi câu đúng, về đích sau 6 bước.
- Trình soạn câu hỏi: tạo/sửa/xóa bộ, lưu localStorage, bộ mẫu.
- Ảnh minh họa + thời gian cho từng câu: ô nhập URL ảnh (có xem trước), ô thời gian 0–600 giây; màn chơi hiện ảnh, đếm ngược theo `timeLimit`, hết giờ tính là trả lời sai và tự chuyển lượt; `timeLimit = 0` thì không hiện đồng hồ.
- Âm thanh hiệu ứng (`src/sound.js`): Web Audio tạo tiếng đúng (2 nốt đi lên), sai/hết giờ (1 nốt đi xuống), thắng (4 nốt); bật mặc định, nút tắt/bật ở màn chơi, ghi nhớ lựa chọn.
- Nút toàn màn hình ở màn chơi: áp dụng cho khung `.game`, đổi icon/chữ khi vào–ra, ẩn nếu trình duyệt không hỗ trợ; overlay thắng nằm trong khung nên vẫn hiện khi chiếu.
- PWA chạy ngoại tuyến: `manifest.webmanifest` + icon 192/512/maskable, service worker `sw.js` cache sẵn toàn bộ HTML/CSS/JS/icon; đăng ký trong `src/main.js`; trang điều hướng ưu tiên mạng rồi fallback cache; dữ liệu localStorage giữ nguyên khi mất mạng.
- Ba dạng câu hỏi: `choice` (4 đáp án — như cũ), `boolean` (Đúng/Sai, 2 nút lớn có biểu tượng), `fill` (ô nhập + nút Trả lời, Enter để gửi, 1–5 cách viết). Trình soạn có ô chọn loại; đổi loại đặt lại phần đáp án nhưng giữ nội dung/ảnh/thời gian. Chấm điền từ bỏ khoảng trắng thừa, không phân biệt hoa/thường, giữ dấu tiếng Việt. Dữ liệu cũ tự nhận là `choice`; CSV vẫn chỉ tạo câu 4 đáp án.
- Chuẩn bị deploy: thêm `_headers` (Cloudflare Pages/Netlify) giữ HTML/manifest/SW không cache và header an toàn; `README.md` hướng dẫn chạy local, deploy, sao lưu JSON và tăng cache SW; `.gitignore`; khởi tạo Git repo local với commit đầu tiên.
- Đã push mã nguồn lên GitHub: `https://github.com/Henrius73/Webstie-hoc-tap` (nhánh `main`, commit `ec6aaf0`).
- Nhập câu hỏi từ CSV (Mốc 2): hỗ trợ BOM, CRLF/LF, tiếng Việt, dấu phẩy/ngoặc kép/nội dung nhiều dòng trong ô; nhận header mục 5 hoặc file không header; báo lỗi từng dòng; thêm câu hợp lệ vào bộ đang soạn, không tự lưu.
- Chuẩn hóa dữ liệu theo mục 5: `{ id, title, subject, questions: [{ id, type, text, options, correctIndex, answers, image, timeLimit }] }`.
- Tự chuyển dữ liệu cũ dùng `name`: giữ id bộ cũ, cấp id câu, `type = 'choice'`, `answers = []`, `image = null`, `timeLimit = 0`; bỏ qua bộ hỏng thay vì làm sập app.
- Nhập/xuất JSON (tính năng phụ): xuất tất cả hoặc một bộ, nhập object/mảng/`{ sets }`, cấp id mới khi nhập, báo lỗi rõ ràng.
- Chuẩn hóa interface game theo mục 6: thêm registry `src/games/index.js`; mỗi game export `{ id, name, icon, teamLimit, init(container, teams, options), onAnswer(teamId, isCorrect), checkWin(), destroy() }`; `checkWin()` trả về đội thắng hoặc `null`.

**Đang dở:**
- Chưa deploy thật lên hosting.
- Chưa thử trên điện thoại thật.

**Việc tiếp theo (tối đa 3 việc):**
1. Kết nối Vercel (hoặc Cloudflare Pages/Netlify) với repo GitHub và deploy.
2. Thử trên điện thoại thật: cài PWA, chơi ngoại tuyến.
3. Rà soát giao diện desktop/mobile sau khi có bản chạy thật.

**Lỗi/vấn đề đã biết:**
- Chưa có Git repo nên các thay đổi chưa được commit.
- Lịch sử trận vẫn dùng khóa `setName` để tương thích dữ liệu cũ.

**Ghi chú cho phiên sau:**
- Cấu trúc file hiện tại được giữ nguyên; đổi sang `src/core`, `src/ui`, tên file kebab-case cần hỏi riêng.
- JSON là tính năng phụ ngoài spec; CSV vẫn thuộc Mốc 2.
- Thêm game mới: tạo module export object theo mục 6 rồi khai báo trong `src/games/index.js`; trang thiết lập tự sinh danh sách game.
- Ảnh câu hỏi là URL (không tải tệp lên); đồng hồ dùng mốc thời gian tuyệt đối nên không lệch sau khi tab bị treo, dừng khi đã trả lời hoặc rời trang.
- Âm thanh nằm ở `src/sound.js`; muốn thêm hiệu ứng mới thì thêm hàm `play...` rồi gọi ở `src/main.js`. Toàn màn hình gắn với `.game` và có dọn listener khi rời trang.
- PWA: sửa danh sách file trong `sw.js` hoặc muốn buộc tải bản mới thì tăng `CACHE` (hiện `hocvui-v3`). Chỉ tài nguyên cùng origin được cache; ảnh câu hỏi dùng URL ngoài vẫn cần mạng.
- Deploy: chạy local bằng `node serve.js` → `http://localhost:8000`. `_headers` chỉ có tác dụng trên Cloudflare Pages/Netlify, server local bỏ qua. Trước khi đổi tên miền phải xuất JSON vì dữ liệu nằm trong `localStorage` theo từng origin.
- Dạng câu hỏi: `src/store.js` chuẩn hóa cả 3 loại và có `blankQuestion(type)`; `src/quizEngine.js` chấm số thứ tự (choice/boolean) hoặc chuỗi (`fill`). Muốn thêm loại mới: mở rộng `QUESTION_TYPES`, phần render trong `src/main.js` và `normalizeQuestion`.
- Đã kiểm thử bằng CDP: chuẩn hóa dữ liệu, interface game (registry + vòng đời init/onAnswer/checkWin/destroy), đua xe, kéo co, đua vịt, nhảy bao bố (giao diện, trọn ván, hiệu ứng nhảy, chơi lại, mobile), nhập CSV (BOM/CRLF/ngoặc kép/nội dung nhiều dòng/dòng lỗi/headerless/lưu bộ), ảnh + thời gian (lưu/load, xem trước, đếm ngược, hết giờ tính sai, dừng đồng hồ khi trả lời, `timeLimit = 0`, mobile), âm thanh + toàn màn hình (đúng/sai/thắng phát đúng số nốt, tắt tiếng chặn âm và ghi nhớ, vào/ra toàn màn hình đúng khung chơi, mobile ẩn chữ giữ nút), PWA (manifest + icon 192/512/maskable, service worker activated, cache đủ app shell, chơi game và mở trình soạn khi ngắt mạng hoàn toàn, dữ liệu localStorage còn nguyên), ba dạng câu hỏi (soạn/lưu/mở lại, migration dữ liệu cũ, chấm đúng/sai, điền từ khớp biến thể và sai, Enter, hết giờ, đổi loại giữ nội dung, mobile), tổng hợp điểm, sidebar/responsive, nhập/xuất JSON — không lỗi Console.
- Kiểm tra chuẩn bị deploy: không có đường dẫn tuyệt đối; 23 tài nguyên (HTML/CSS/JS/manifest/SW/icon) trả 200 qua `node serve.js`; chạy lại PWA offline — pass.

---

## 13. Định nghĩa "xong" cho mỗi tính năng

Một tính năng chỉ được coi là xong khi:
- [ ] Đạt đúng tiêu chí nghiệm thu đã viết trong spec
- [ ] Tôi đã tự chạy thử trên trình duyệt (và điện thoại nếu liên quan giao diện)
- [ ] Không có lỗi đỏ trong Console
- [ ] Không làm hỏng tính năng cũ
- [ ] Đã commit với thông điệp rõ ràng
- [ ] Đã cập nhật mục 12 của file này

---

## 14. Mẫu prompt nhanh

**Mở phiên**
> Đây là PROJECT.md: [dán]. Hôm nay làm: [việc]. Tiêu chí xong: [...]. Hãy đề xuất kế hoạch các bước và file cần sửa, chưa viết code.

**Giao việc**
> Làm bước [n] của kế hoạch. Chỉ sửa [file]. Giữ nguyên interface ở mục 6.

**Báo lỗi**
> Lỗi: [dán nguyên văn Console]. Tôi đã làm: [thao tác]. Mong đợi: [...]. Thực tế: [...]. Giải thích nguyên nhân trước rồi mới sửa.

**Đóng phiên**
> Tóm tắt đã làm gì, còn dở gì, rủi ro gì, và viết sẵn nội dung để tôi dán vào mục 12.
