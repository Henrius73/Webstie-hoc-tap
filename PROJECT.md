# PROJECT.md — Giai đoạn 2: Trắc nghiệm nhiều người chơi cùng lúc (Supabase)

> **Cách dùng file này**
> - Đầu mỗi phiên làm việc với AI: dán toàn bộ file (hoặc để Claude Code tự đọc), rồi nói rõ việc hôm nay.
> - Cuối mỗi phiên: cập nhật mục **13. Trạng thái hiện tại** và mục **12. Quyết định đã chốt**.
> - Chỗ nào ghi `[...]` hoặc `<...>` là chỗ bạn cần điền.
> - File này nối tiếp bản PROJECT.md của giai đoạn 1 (chơi offline 2 đội trên một màn hình). Phần mini-game, dữ liệu câu hỏi, quy ước code giữ nguyên trừ chỗ được nói rõ ở đây.

---

## 1. Tổng quan giai đoạn 2

**Mục tiêu:** chuyển hệ thống từ "2 đội chơi trên cùng một màn hình" sang **nhiều học sinh chơi cùng lúc, mỗi người một thiết bị**. Giáo viên điều khiển ván chơi, tất cả học sinh cùng thấy một câu hỏi tại cùng một thời điểm, trả lời trong thời gian giới hạn, rồi cùng xem đáp án và bảng xếp hạng.

**Cách chơi (giống kiểu phòng chơi bằng mã)**
1. Giáo viên đăng nhập, chọn bộ câu hỏi, bấm **Tạo phòng** → nhận mã 6 số.
2. Học sinh mở web, nhập mã và tên, vào phòng chờ.
3. Giáo viên bấm **Bắt đầu** → mọi người thấy câu 1 cùng lúc, đồng hồ đếm ngược chạy.
4. Hết giờ (hoặc giáo viên bấm chốt) → công bố đáp án đúng, cộng điểm, cập nhật bảng xếp hạng / hoạt họa mini-game.
5. Giáo viên bấm **Câu tiếp** → lặp lại đến hết, hiện bảng xếp hạng cuối.

**Tiêu chí thành công**
- 40 học sinh vào phòng bằng mã và chơi trọn 10 câu mà không ai bị kẹt.
- Học sinh thấy câu hỏi mới trong khoảng 1 giây sau khi giáo viên bấm.
- **Học sinh không thể xem đáp án đúng trước khi giáo viên công bố**, kể cả khi mở công cụ dành cho nhà phát triển của trình duyệt.
- Điểm tính ở phía server, không sửa được từ trình duyệt.

**Trong phạm vi**
- Backend dùng Supabase (Postgres + Auth + Realtime), frontend vẫn là HTML/CSS/JS thuần
- Phòng chơi bằng mã, danh sách người chơi, bảng xếp hạng thời gian thực
- Chấm điểm theo tốc độ trả lời, tính ở server
- Các mini-game (đua xe, ...) hiển thị tiến độ của **tất cả người chơi**
- Khôi phục khi học sinh mất mạng hoặc tải lại trang

**Ngoài phạm vi (làm sau)**
- Thanh toán, quảng cáo
- Thống kê dài hạn theo học sinh/lớp
- Thư viện bộ câu hỏi dùng chung giữa nhiều giáo viên
- Chế độ tự học (mỗi học sinh tự chạy theo tốc độ riêng)

---

## 2. Quy tắc làm việc với AI

Giữ các quy tắc của giai đoạn 1 (một nhiệm vụ nhỏ mỗi lần, kế hoạch trước khi viết code, không thêm thư viện khi chưa hỏi, không sửa file ngoài phạm vi, giải thích bằng tiếng Việt). Bổ sung các quy tắc **bảo mật** sau, AI phải tuân thủ:

1. **Không bao giờ** đưa secret key (`sb_secret_...`) hoặc `service_role` vào code chạy ở trình duyệt, vào repo, hay vào đoạn chat. Chỉ dùng URL và **publishable key**.
2. **Không tắt RLS** để "cho nhanh". Nếu gặp lỗi quyền, hãy sửa policy hoặc `grant`, rồi giải thích lý do.
3. **Đáp án đúng không bao giờ nằm trong dữ liệu gửi cho học sinh** trước khi công bố (xem mục 6).
4. **Mọi thao tác ghi** (tạo phòng, vào phòng, gửi đáp án, chuyển câu) đi qua hàm RPC trong mục 6. Client không `insert/update` trực tiếp vào `rooms`, `players`, `answers`.
5. Mọi thay đổi cấu trúc DB phải ghi thành **file migration** trong `supabase/migrations/` (không chỉ sửa tay trên Dashboard), kèm mô tả.
6. Trước khi báo "xong" một tính năng liên quan đến quyền, AI phải liệt kê **những gì học sinh KHÔNG được làm** và chỉ cách kiểm tra từng điều đó.

---

## 3. Luồng ván chơi (máy trạng thái)

```
 lobby ──(giáo viên: Bắt đầu / Câu tiếp)──▶ question ──(hết giờ hoặc giáo viên chốt)──▶ reveal
   ▲                                            ▲                                          │
   │                                            └────────────(Câu tiếp)────────────────────┤
   │                                                                                        │
   └──────────────────────────────── (hết câu) ──────────────────────────────▶ finished ◀──┘
```

| Trạng thái (`rooms.phase`) | Học sinh thấy | Ai chuyển trạng thái |
|---|---|---|
| `lobby` | Danh sách người vào phòng | Giáo viên: `host_next_question` |
| `question` | Câu hỏi + 4 đáp án + đồng hồ đếm ngược | Giáo viên: `host_reveal` |
| `reveal` | Đáp án đúng, điểm vừa được cộng, bảng xếp hạng | Giáo viên: `host_next_question` |
| `finished` | Bảng xếp hạng cuối | — |

**Nguyên tắc:** trạng thái ván chơi **nằm trong Postgres** (bảng `rooms`). Realtime chỉ có nhiệm vụ báo cho client biết "dữ liệu vừa đổi". Nhờ vậy học sinh mất mạng hay tải lại trang vẫn đọc lại được trạng thái hiện tại.

---

## 4. Kiến trúc

```
 Giáo viên (trình duyệt)                         Học sinh (trình duyệt)
   │  đăng nhập email                              │  đăng nhập ẩn danh (tự động)
   │  RPC: create_room / host_next_question /      │  RPC: join_room / submit_answer
   │       host_reveal                             │
   └───────────────┬───────────────────────────────┴──────────────┐
                   ▼                                              ▼
        ┌────────────────────────── Supabase ──────────────────────────┐
        │  Auth   → mỗi người có một user id (học sinh là ẩn danh)     │
        │  Postgres → quiz_sets, questions, rooms, players, answers    │
        │             + hàm RPC chấm điểm + RLS                        │
        │  Realtime → đẩy thay đổi của rooms / players xuống client    │
        └──────────────────────────────────────────────────────────────┘
```

**Vì sao chọn cách này**
- **Server chấm điểm:** đáp án đúng chỉ tồn tại trong bảng `questions` (chỉ giáo viên đọc được). Học sinh gửi lựa chọn, hàm `submit_answer` so với đáp án đúng và tính điểm.
- **Đăng nhập ẩn danh cho học sinh:** học sinh không cần tài khoản, nhưng vẫn có `user id` riêng để RLS phân biệt người này với người khác và chống mạo danh.
- **Giai đoạn đầu dùng Postgres Changes** (nghe thay đổi của bảng `rooms`, `players`). Cách này dễ làm, an toàn vì tự áp dụng RLS, và đủ cho một lớp học. Tài liệu Supabase khuyến nghị **Broadcast** làm lựa chọn mặc định khi cần mở rộng lớn, và dùng **Presence** khi thật sự cần (ví dụ hiện ai đang online); nếu sau này vượt quy mô lớp học, hãy cân nhắc chuyển sang Broadcast from Database.

---

## 5. Kết nối tới Supabase

### 5.1 Tạo project
1. Vào supabase.com, đăng nhập, tạo **New project** (đặt tên, mật khẩu database, chọn region gần người dùng nhất).
2. Chờ project khởi tạo xong. Ghi lại **Project URL** dạng `https://<project-ref>.supabase.co`.

### 5.2 Lấy khóa API
Trong Dashboard, mở phần **API Keys** của Project Settings. Các loại khóa:

| Khóa | Dạng | Đặt ở đâu | RLS |
|---|---|---|---|
| Project URL | `https://<project-ref>.supabase.co` | Trình duyệt và server | — |
| **Publishable key** | `sb_publishable_...` | **Trình duyệt, được phép công khai** | Có áp dụng |
| Secret key | `sb_secret_...` | **Chỉ server, tuyệt đối không đưa vào trình duyệt/repo** | Bỏ qua RLS |
| `anon` / `service_role` (cũ) | chuỗi JWT dài bắt đầu bằng `eyJ` | Tương ứng publishable / secret | — |

- Dự án mới: **dùng publishable key**. Các khóa `anon`/`service_role` cũ vẫn chạy nhưng Supabase đã thông báo ngừng vào cuối năm 2026, nên hãy kiểm tra thông báo mới nhất trước khi dùng.
- Dự án này **không cần** secret key ở đâu cả. Mọi việc đặc quyền đã nằm trong hàm RPC (`security definer`).

### 5.3 Bật đăng nhập ẩn danh
Trong mục **Authentication** của Dashboard, bật tùy chọn **Anonymous sign-ins**. Nếu không bật, học sinh sẽ gặp lỗi khi gọi `signInAnonymously()`.

### 5.4 Tạo cấu trúc database
Mở **SQL Editor**, dán toàn bộ SQL ở mục 6 và chạy. Lưu thành file `supabase/migrations/0001_multiplayer.sql` trong repo.

### 5.5 Bật Realtime cho bảng
Chạy thêm lệnh sau (một lần):
```sql
alter publication supabase_realtime add table public.rooms, public.players;
```

### 5.6 Cấu hình đăng nhập giáo viên
Giáo viên cần tài khoản thật (không ẩn danh) để lưu bộ câu hỏi. Cách đơn giản: đăng nhập bằng email (mã OTP/magic link). Trong **Authentication → URL Configuration**, thêm địa chỉ trang web của bạn (cả `http://localhost:...` khi phát triển và tên miền thật) vào danh sách địa chỉ chuyển hướng được phép.

### 5.7 Kết nối từ code (HTML/JS thuần, ES modules)

**`src/config.js`** — hai giá trị này công khai được; sức mạnh bảo mật nằm ở RLS.
```js
export const SUPABASE_URL = 'https://<project-ref>.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_...';
// KHÔNG BAO GIỜ đặt secret key ở đây.
```

**`src/lib/supabase.js`**
```js
// Nên ghim phiên bản cụ thể thay vì @2 khi đưa vào sản phẩm thật
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Học sinh: tự đăng nhập ẩn danh nếu chưa có phiên. Giáo viên: anonymous = false.
export async function ensureSession({ anonymous = true } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session.user;
  if (!anonymous) return null;                       // giáo viên phải đăng nhập bằng email
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

// Giáo viên: gửi mã đăng nhập qua email
export async function teacherSignIn(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email, options: { emailRedirectTo: location.origin },
  });
  if (error) throw error;
}
```

**Thử kết nối** (chạy ở Console của trình duyệt hoặc trong một trang test):
```js
import { supabase, ensureSession } from './src/lib/supabase.js';
const user = await ensureSession();
console.log('user id:', user.id);
console.log('giờ server:', (await supabase.rpc('server_now')).data);   // có giá trị = kết nối OK
```

### 5.8 Lỗi thường gặp

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `Anonymous sign-ins are disabled` | Chưa bật ở mục 5.3 | Bật Anonymous sign-ins |
| `permission denied for table ...` | Thiếu `grant` cho role `authenticated` | Kiểm tra phần "Quyền bảng" trong SQL |
| Truy vấn trả về mảng rỗng dù có dữ liệu | RLS chặn (không phải thành viên phòng) | Kiểm tra đã gọi `join_room` chưa |
| `Could not find the function ...` | Sai tên/tham số RPC, hoặc chưa chạy SQL | Kiểm tra tên tham số `p_...` khớp SQL |
| Không nhận được sự kiện realtime | Chưa chạy lệnh `alter publication` ở 5.5 | Chạy lại lệnh và kiểm tra bảng trong publication |
| Lỗi 401 khi dùng secret key trên web | Supabase chặn secret key ở trình duyệt | Đừng dùng secret key ở client |

---

## 6. Cơ sở dữ liệu (SQL)

Dán nguyên khối này vào SQL Editor. Thiết kế dựa trên 4 ý:

1. **Bảng `questions` (có đáp án đúng) chỉ giáo viên chủ bộ câu hỏi đọc được.**
2. Khi giáo viên chuyển câu, hàm `host_next_question` chép phần đề **không có đáp án** vào `rooms.question`. Chỉ khi chốt (`host_reveal`) mới điền `rooms.correct_index`.
3. **Client không có quyền ghi** vào `rooms`, `players`, `answers`. Mọi việc đi qua hàm RPC kiểm tra quyền và chấm điểm trong server.
4. Điểm của người chơi chỉ được cộng lúc `host_reveal`, để không ai suy ra được kết quả của người khác trước khi công bố.

**Cách tính điểm:** trả lời đúng ngay lập tức = 1000 điểm, giảm dần tuyến tính còn 500 điểm khi sát giờ; sai hoặc không trả lời = 0. Chỉnh công thức trong hàm `submit_answer`.

```sql
-- =====================================================================
-- 1. BẢNG
-- =====================================================================
create table public.quiz_sets (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.questions (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references public.quiz_sets(id) on delete cascade,
  q_index       int  not null check (q_index >= 0),          -- thứ tự câu, bắt đầu từ 0
  text          text not null,
  options       jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_index int  not null check (correct_index between 0 and 3),
  image_url     text,
  time_limit    int  not null default 20 check (time_limit between 5 and 300),
  unique (quiz_id, q_index)
);

create table public.rooms (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,                   -- mã 6 số để học sinh vào phòng
  host_id             uuid not null references auth.users(id),
  quiz_id             uuid not null references public.quiz_sets(id),
  phase               text not null default 'lobby'
                        check (phase in ('lobby','question','reveal','finished')),
  total_questions     int  not null default 0,                -- tổng số câu của bộ câu hỏi
  q_index             int  not null default -1,               -- -1 = chưa bắt đầu
  question            jsonb,                                  -- đề đang hiển thị, KHÔNG chứa đáp án đúng
  correct_index       int,                                    -- chỉ được điền khi phase = 'reveal'
  question_started_at timestamptz,
  question_ends_at    timestamptz,
  created_at          timestamptz not null default now()
);

create table public.players (
  id        uuid primary key default gen_random_uuid(),
  room_id   uuid not null references public.rooms(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  name      text not null check (char_length(name) between 1 and 20),
  score     int  not null default 0,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table public.answers (
  player_id   uuid not null references public.players(id) on delete cascade,
  room_id     uuid not null references public.rooms(id) on delete cascade,
  q_index     int  not null,
  choice      int  not null check (choice between 0 and 3),
  is_correct  boolean not null,
  points      int  not null default 0,
  answered_at timestamptz not null default now(),
  primary key (player_id, q_index)
);

create index on public.players (room_id);
create index on public.answers (room_id, q_index);

-- =====================================================================
-- 2. HÀM TIỆN ÍCH
-- =====================================================================
-- Kiểm tra người dùng hiện tại là giáo viên hoặc học sinh của phòng.
-- SECURITY DEFINER để dùng trong policy mà không bị đệ quy RLS.
create or replace function public.is_room_member(p_room uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.players where room_id = p_room and user_id = auth.uid())
      or exists (select 1 from public.rooms   where id      = p_room and host_id = auth.uid());
$$;

-- Giờ của server, để client đồng bộ đồng hồ đếm ngược.
create or replace function public.server_now()
returns timestamptz
language sql stable
as $$ select now(); $$;

-- =====================================================================
-- 3. HÀM NGHIỆP VỤ (client chỉ được ghi dữ liệu qua các hàm này)
-- =====================================================================
create or replace function public.create_room(p_quiz_id uuid)
returns public.rooms
language plpgsql security definer set search_path = public
as $$
declare
  v_code text;
  v_room public.rooms;
begin
  if not exists (select 1 from public.quiz_sets where id = p_quiz_id and owner_id = auth.uid()) then
    raise exception 'not_owner';
  end if;
  loop
    v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;
  insert into public.rooms (code, host_id, quiz_id, total_questions)
  values (v_code, auth.uid(), p_quiz_id,
          (select count(*) from public.questions where quiz_id = p_quiz_id))
  returning * into v_room;
  return v_room;
end $$;

create or replace function public.join_room(p_code text, p_name text)
returns public.players
language plpgsql security definer set search_path = public
as $$
declare
  v_room   public.rooms;
  v_player public.players;
begin
  select * into v_room from public.rooms where code = p_code and phase <> 'finished';
  if not found then
    raise exception 'room_not_found';
  end if;
  insert into public.players (room_id, user_id, name)
  values (v_room.id, auth.uid(), left(trim(p_name), 20))
  on conflict (room_id, user_id) do update set name = excluded.name
  returning * into v_player;
  return v_player;
end $$;

-- Giáo viên: sang câu tiếp theo (hoặc kết thúc nếu hết câu)
create or replace function public.host_next_question(p_room_id uuid)
returns public.rooms
language plpgsql security definer set search_path = public
as $$
declare
  v_room public.rooms;
  v_q    public.questions;
begin
  select * into v_room from public.rooms
   where id = p_room_id and host_id = auth.uid() and phase in ('lobby','reveal')
   for update;
  if not found then
    raise exception 'invalid_state';
  end if;

  select * into v_q from public.questions
   where quiz_id = v_room.quiz_id and q_index = v_room.q_index + 1;

  if not found then
    update public.rooms
       set phase = 'finished', question = null, correct_index = null
     where id = v_room.id returning * into v_room;
    return v_room;
  end if;

  update public.rooms set
    phase               = 'question',
    q_index             = v_q.q_index,
    question            = jsonb_build_object('text', v_q.text, 'options', v_q.options,
                                             'image_url', v_q.image_url, 'time_limit', v_q.time_limit),
    correct_index       = null,
    question_started_at = now(),
    question_ends_at    = now() + make_interval(secs => v_q.time_limit)
  where id = v_room.id
  returning * into v_room;
  return v_room;
end $$;

-- Học sinh: gửi đáp án. Server tự chấm điểm; client không biết đáp án đúng.
create or replace function public.submit_answer(p_room_id uuid, p_choice int)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_player  public.players;
  v_room    public.rooms;
  v_key     int;
  v_limit   int;
  v_elapsed numeric;
  v_ok      boolean;
  v_pts     int;
begin
  select * into v_player from public.players where room_id = p_room_id and user_id = auth.uid();
  if not found then raise exception 'not_in_room'; end if;

  select * into v_room from public.rooms where id = p_room_id;
  if v_room.phase <> 'question' or now() > v_room.question_ends_at + interval '1 second' then
    raise exception 'closed';
  end if;

  select correct_index, time_limit into v_key, v_limit
    from public.questions where quiz_id = v_room.quiz_id and q_index = v_room.q_index;

  v_ok      := (p_choice = v_key);
  v_elapsed := extract(epoch from (now() - v_room.question_started_at));
  -- Đúng: 1000 điểm nếu trả lời ngay, giảm dần còn 500 điểm khi hết giờ. Sai: 0 điểm.
  v_pts     := case when v_ok
                    then round(1000 * (1 - least(v_elapsed / v_limit, 1) / 2))::int
                    else 0 end;

  insert into public.answers (player_id, room_id, q_index, choice, is_correct, points)
  values (v_player.id, p_room_id, v_room.q_index, p_choice, v_ok, v_pts)
  on conflict (player_id, q_index) do nothing;

  return jsonb_build_object('accepted', found);   -- false nếu đã trả lời câu này rồi
end $$;

-- Giáo viên: chốt câu hỏi, công bố đáp án đúng và cộng điểm
create or replace function public.host_reveal(p_room_id uuid)
returns public.rooms
language plpgsql security definer set search_path = public
as $$
declare
  v_room public.rooms;
  v_key  int;
begin
  select * into v_room from public.rooms
   where id = p_room_id and host_id = auth.uid() and phase = 'question'
   for update;
  if not found then raise exception 'invalid_state'; end if;

  select correct_index into v_key from public.questions
   where quiz_id = v_room.quiz_id and q_index = v_room.q_index;

  update public.players p set score = p.score + a.points
    from public.answers a
   where a.player_id = p.id and a.room_id = v_room.id
     and a.q_index = v_room.q_index and a.is_correct;

  update public.rooms set phase = 'reveal', correct_index = v_key
   where id = v_room.id returning * into v_room;
  return v_room;
end $$;

-- =====================================================================
-- 4. BẢO MẬT: RLS + QUYỀN
-- =====================================================================
alter table public.quiz_sets enable row level security;
alter table public.questions enable row level security;
alter table public.rooms     enable row level security;
alter table public.players   enable row level security;
alter table public.answers   enable row level security;

-- Giáo viên (tài khoản đăng nhập thật, không phải ẩn danh) quản lý bộ câu hỏi của mình
create policy quiz_sets_owner on public.quiz_sets for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid()
              and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

create policy questions_owner on public.questions for all to authenticated
  using (exists (select 1 from public.quiz_sets q where q.id = quiz_id and q.owner_id = auth.uid()))
  with check (exists (select 1 from public.quiz_sets q where q.id = quiz_id and q.owner_id = auth.uid()));

-- Phòng/người chơi: chỉ thành viên của phòng mới đọc được; KHÔNG có policy ghi
create policy rooms_member_read   on public.rooms   for select to authenticated using (public.is_room_member(id));
create policy players_member_read on public.players for select to authenticated using (public.is_room_member(room_id));

-- Đáp án: học sinh chỉ đọc bài của mình, giáo viên đọc cả phòng
create policy answers_read on public.answers for select to authenticated
  using (
    exists (select 1 from public.players p where p.id = player_id and p.user_id = auth.uid())
    or exists (select 1 from public.rooms r where r.id = room_id and r.host_id = auth.uid())
  );

-- Quyền bảng: client không được ghi trực tiếp vào phòng/người chơi/đáp án
revoke all on public.quiz_sets, public.questions, public.rooms, public.players, public.answers from anon, authenticated;
grant select, insert, update, delete on public.quiz_sets, public.questions to authenticated;
grant select on public.rooms, public.players, public.answers to authenticated;

-- Quyền gọi hàm: chỉ người đã đăng nhập (kể cả ẩn danh)
revoke execute on function
  public.is_room_member(uuid), public.server_now(), public.create_room(uuid),
  public.join_room(text, text), public.host_next_question(uuid),
  public.submit_answer(uuid, int), public.host_reveal(uuid)
from public, anon;
grant execute on function
  public.is_room_member(uuid), public.server_now(), public.create_room(uuid),
  public.join_room(text, text), public.host_next_question(uuid),
  public.submit_answer(uuid, int), public.host_reveal(uuid)
to authenticated;
```

```sql
-- Dọn phòng cũ (chạy tay, hoặc đặt lịch bằng pg_cron nếu muốn)
delete from public.rooms where created_at < now() - interval '1 day';
```

> **Đã kiểm thử:** logic các hàm, RLS và quyền trong khối SQL trên đã được chạy thử trên PostgreSQL mô phỏng (đầy đủ kịch bản: tạo phòng, vào phòng, trả lời đúng/sai, trả lời lặp, trả lời sau giờ, học sinh cố ghi trực tiếp, người lạ đọc phòng). Phần đặc thù của Supabase (Auth thật, claim `is_anonymous`, Realtime) **chưa** được thử, nên cần chạy lại các kiểm tra ở mục 10 trên project Supabase thật.

---

## 7. Code client: lớp giao tiếp (`src/net/api.js`)

```js
import { supabase } from '../lib/supabase.js';

const unwrap = ({ data, error }) => { if (error) throw error; return data; };

// ---- Giáo viên ----
export const createRoom   = async (quizId) => unwrap(await supabase.rpc('create_room', { p_quiz_id: quizId }));
export const nextQuestion = async (roomId) => unwrap(await supabase.rpc('host_next_question', { p_room_id: roomId }));
export const reveal       = async (roomId) => unwrap(await supabase.rpc('host_reveal', { p_room_id: roomId }));

// ---- Học sinh ----
export const joinRoom     = async (code, name) => unwrap(await supabase.rpc('join_room', { p_code: code, p_name: name }));
export const submitAnswer = async (roomId, choice) => unwrap(await supabase.rpc('submit_answer', { p_room_id: roomId, p_choice: choice }));

// ---- Đọc trạng thái hiện tại (dùng khi vào phòng, tải lại trang, hoặc kết nối lại) ----
export async function fetchSnapshot(roomId) {
  const [room, players] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', roomId).single(),
    supabase.from('players').select('id,name,score').eq('room_id', roomId).order('score', { ascending: false }),
  ]);
  if (room.error) throw room.error;
  if (players.error) throw players.error;
  return { room: room.data, players: players.data };
}

// ---- Nghe thay đổi theo thời gian thực ----
export function subscribeRoom(roomId, { onRoom, onPlayers, onStatus }) {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => onRoom(payload.new))
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        (payload) => onPlayers(payload))
    .subscribe((status) => onStatus?.(status));
  return () => supabase.removeChannel(channel);        // gọi khi rời phòng
}
```

**Quy tắc khi nghe realtime**
- Mỗi lần trạng thái kênh trở thành `SUBSCRIBED` (kể cả sau khi mạng chập chờn rồi nối lại), **gọi lại `fetchSnapshot`** để không bỏ sót thay đổi xảy ra lúc mất kết nối.
- Hủy đăng ký (`removeChannel`) khi rời phòng để không rò rỉ kết nối.

**Đồng bộ đồng hồ đếm ngược** (`src/net/clock.js`) — không dùng giờ của máy học sinh, vì đồng hồ mỗi máy lệch nhau:
```js
import { supabase } from '../lib/supabase.js';

let offsetMs = 0;
export async function syncClock() {
  const t0 = Date.now();
  const { data } = await supabase.rpc('server_now');
  const t1 = Date.now();
  offsetMs = new Date(data).getTime() - (t0 + t1) / 2;     // bù độ trễ mạng một chiều
}
export const serverNow = () => Date.now() + offsetMs;
export const msLeft = (room) =>
  Math.max(0, new Date(room.question_ends_at).getTime() - serverNow());
```
Gọi `syncClock()` khi vào phòng và định kỳ (ví dụ mỗi vài phút). Giao diện chỉ **hiển thị** thời gian còn lại; việc chặn trả lời quá giờ do server quyết định (`submit_answer` có dung sai 1 giây).

**Khôi phục sau khi tải lại trang:** phiên ẩn danh của học sinh được lưu trong trình duyệt, nên `user id` giữ nguyên. Lưu `roomId` và mã phòng vào `sessionStorage`; khi mở lại, gọi `fetchSnapshot` rồi đăng ký realtime. `join_room` an toàn khi gọi lại (cập nhật tên thay vì tạo trùng).

---

## 8. Mini-game trong chế độ nhiều người

Giai đoạn 1: game nhận 2 đội. Giai đoạn 2: game **chỉ hiển thị**, nhận toàn bộ danh sách người chơi và trạng thái phòng. Mọi tính toán điểm đã nằm ở server.

```js
// src/games/<ten-game>.js — interface mới
export default {
  id: 'race-car',
  name: 'Đua xe',

  mount(container) {},                       // dựng giao diện một lần

  // Gọi mỗi khi dữ liệu phòng hoặc người chơi thay đổi
  update({ phase, qIndex, totalQuestions, players, me }) {
    // players: [{ id, name, score }]
    // Vị trí về đích gợi ý: progress = score / (totalQuestions * 1000)  → giá trị 0..1
  },

  unmount() {},                              // dọn dẹp khi thoát
};
```

- Với phòng đông người, hiển thị **top 5–8 người** cùng "vị trí của bạn" thay vì vẽ tất cả.
- Hoạt họa chạy ở pha `reveal` (sau khi điểm được cộng), không chạy lúc đang trả lời.
- Game theo đội (kéo co) cần thêm cột `players.team` và cách chia đội; làm ở mốc cuối (mục 9).

**Cấu trúc thư mục bổ sung**
```
supabase/
└── migrations/
    └── 0001_multiplayer.sql
src/
├── config.js
├── lib/supabase.js
├── net/
│   ├── api.js
│   └── clock.js
├── ui/
│   ├── host/        (chọn bộ câu hỏi, phòng chờ, điều khiển ván)
│   └── player/      (nhập mã, phòng chờ, trả lời, kết quả)
└── games/           (các mini-game theo interface mới)
```

---

## 9. Lộ trình

**M0 — Kết nối Supabase (khoảng 0,5 ngày)**
*(Chưa có project thật; mã đã sẵn sàng.)*
- [ ] Tạo project, lấy URL và publishable key, bật Anonymous sign-ins
- [ ] `config.js`, `supabase.js`, chạy được đoạn "Thử kết nối" ở mục 5.7

*Nghiệm thu:* Console in ra `user id` và giờ server.

**M1 — Database và bảo mật (1–2 ngày)**
*(Mã đã xong; chưa chạy migration trên Postgres thật.)*
- [ ] Chạy SQL mục 6 thành migration, bật Realtime cho `rooms`, `players`
- [ ] Thử các kịch bản bảo mật ở mục 10 trực tiếp bằng SQL Editor / 2 trình duyệt

*Nghiệm thu:* toàn bộ danh sách "học sinh KHÔNG được làm" ở mục 10 đều bị chặn.

**M2 — Luồng giáo viên (2 ngày)**
*(Mã đã xong; chờ kiểm chứng đầu-cuối.)*
- [ ] Đăng nhập email, nhập bộ câu hỏi vào bảng `quiz_sets`/`questions` (bắt đầu bằng tải file CSV/Excel đã có)
- [ ] Tạo phòng, hiện mã, danh sách học sinh vào phòng theo thời gian thực

*Nghiệm thu:* mở trang học sinh ở cửa sổ ẩn danh, tên hiện lên máy giáo viên trong vài giây.

**M3 — Luồng học sinh (2 ngày)**
*(Mã đã xong; chờ kiểm chứng đầu-cuối.)*
- [ ] Nhập mã + tên, phòng chờ
- [ ] Màn hình câu hỏi với đồng hồ đếm ngược (đồng bộ giờ server), gửi đáp án, màn "đã gửi"

*Nghiệm thu:* hai học sinh cùng thấy câu hỏi, cùng lúc, đồng hồ lệch nhau không quá khoảng nửa giây.

**M4 — Vòng chơi hoàn chỉnh (2–3 ngày)**
*(Mã đã xong; chờ kiểm chứng đầu-cuối.)*
- [ ] Giáo viên: chốt câu, câu tiếp, kết thúc
- [ ] Học sinh: màn reveal (đúng/sai, điểm), bảng xếp hạng, màn kết thúc
- [ ] Game đua xe theo interface mục 8

*Nghiệm thu:* chơi trọn 5 câu với 3 thiết bị, điểm hiển thị khớp với tính toán thủ công.

**M5 — Độ bền (2 ngày)**
*(Một phần: đã có tải lại, tự lấy lại snapshot, vào muộn, trùng tên, lỗi thân thiện; chưa có dọn phòng cũ/giới hạn thao tác lặp.)*
- [ ] Tải lại trang giữa chừng vẫn quay lại đúng trạng thái
- [ ] Mất mạng rồi có lại: tự lấy lại snapshot
- [ ] Vào muộn (phòng đang chơi) và học sinh trùng tên
- [ ] Dọn phòng cũ, giới hạn thao tác lặp, xử lý lỗi hiển thị thân thiện

**M6 — Thử tải và mở rộng**
*(Chưa làm.)*
- [ ] Giả lập 40 học sinh vào phòng và trả lời cùng lúc (script Node dùng publishable key + đăng nhập ẩn danh)
- [ ] Đối chiếu giới hạn Realtime của gói Supabase đang dùng (xem trang "Realtime rate limits" trong tài liệu Supabase)
- [ ] Thêm các mini-game còn lại, chế độ theo đội (`players.team`), Presence nếu cần hiện trạng thái online

---

## 10. Kiểm thử và bảo mật

**Học sinh KHÔNG được làm (mỗi dòng phải có cách kiểm tra và kết quả "bị chặn"):**
- [ ] Đọc bảng `questions` (không thấy đáp án đúng)
- [ ] Thấy `rooms.correct_index` khi phòng đang ở pha `question` (phải là `null`)
- [ ] Ghi trực tiếp vào `players` (sửa điểm, đổi tên người khác), `rooms`, `answers`
- [ ] Gọi `host_next_question` / `host_reveal` của phòng không phải của mình
- [ ] Gửi đáp án hai lần cho cùng một câu, hoặc gửi sau khi hết giờ
- [ ] Đọc bài làm của học sinh khác trước khi công bố
- [ ] Thấy phòng của lớp khác, hoặc tự tạo bộ câu hỏi bằng tài khoản ẩn danh

**Kịch bản kiểm thử chức năng**
- [ ] 1 giáo viên + 3 học sinh (cửa sổ ẩn danh khác nhau), chơi 5 câu, có người không trả lời, có người trả lời sai
- [ ] Tải lại trang của học sinh giữa lúc đang có câu hỏi
- [ ] Tắt/bật mạng của học sinh trong lúc chơi
- [ ] Hai học sinh nhập cùng mã nhưng sai mã, mã đã kết thúc

**Checklist trước khi cho người dùng thật dùng**
- [ ] Không có secret key trong repo (tìm `sb_secret_` và `service_role`)
- [ ] RLS bật trên cả 5 bảng
- [ ] Bật CAPTCHA hoặc giới hạn tần suất cho đăng nhập ẩn danh (tránh bị tạo hàng loạt tài khoản)
- [ ] Đã ghim phiên bản `@supabase/supabase-js`

---

## 11. Rủi ro và giới hạn đã biết

| Rủi ro | Ảnh hưởng | Cách giảm |
|---|---|---|
| Giới hạn kết nối/tin nhắn Realtime của gói miễn phí | Lớp đông có thể bị nghẽn | Đọc trang rate limits của Supabase trước khi thử tải; chuyển sang Broadcast nếu cần |
| Postgres Changes kiểm tra RLS cho từng người nhận | Chậm hơn khi phòng rất đông | Giữ policy đơn giản; M6 đo thực tế; cân nhắc Broadcast from Database |
| Lạm dụng đăng nhập ẩn danh | Tạo hàng loạt tài khoản rác | CAPTCHA, giới hạn tần suất, dọn dẹp định kỳ |
| Mã phòng 6 số có thể bị đoán | Người lạ vào phòng | Phòng chỉ nhận người ở pha chưa kết thúc; có thể thêm giáo viên "khóa phòng" sau |
| Lệch đồng hồ giữa các máy | Đồng hồ đếm ngược chênh nhau | Dùng `server_now` (mục 7); server là nơi quyết định hết giờ |
| Mạng yếu trong lớp học | Mất sự kiện realtime | Luôn lấy lại snapshot khi kết nối lại |
| Học sinh trùng tên | Khó phân biệt trên bảng xếp hạng | Cho phép trùng, hoặc thêm hậu tố số khi hiển thị |

---

## 12. Quyết định đã chốt

| Ngày | Quyết định | Lý do |
|---|---|---|
| [YYYY-MM-DD] | Dùng Supabase (Postgres + Auth + Realtime) làm backend | Có sẵn đăng nhập, cơ sở dữ liệu và realtime; không phải tự dựng server |
| [YYYY-MM-DD] | Học sinh đăng nhập ẩn danh, giáo viên đăng nhập email | Học sinh vào nhanh bằng mã; giáo viên cần lưu bộ câu hỏi |
| [YYYY-MM-DD] | Server chấm điểm qua hàm RPC; client không ghi trực tiếp | Chống gian lận, đáp án không rời khỏi server trước khi công bố |
| [YYYY-MM-DD] | Bản đầu dùng Postgres Changes, cân nhắc Broadcast khi mở rộng | Dễ làm, tự áp dụng RLS, đủ cho quy mô một lớp |
| | | |
| 2026-11-11 | Ghim `@supabase/supabase-js@2.119.0`, tải động qua jsDelivr ESM | Không cần build; trang vẫn mở được khi ngoại tuyến/chưa cấu hình; tránh SDK tự đổi bản |
| 2026-11-11 | Dùng luồng PKCE (`?code=`) thay vì implicit | Không xung đột với router dùng hash `#/...` |
| 2026-11-11 | Chế độ trực tuyến chỉ nhận câu trắc nghiệm 4 đáp án | Khớp ràng buộc `questions.options` trong DB; đúng/sai và điền từ vẫn dùng ở chế độ một máy |
| 2026-11-11 | Giữ bản LAN cũ nhưng không nối vào giao diện | Không mất mã đã chạy được; có thể quay lại nếu Supabase không phù hợp |
| 2026-11-11 | Giáo viên tự công bố sau khi hết giờ ~1,2 giây | Tránh kẹt phòng khi giáo viên quên bấm; server vẫn chặn đáp án sau hạn |

---

## 13. Trạng thái hiện tại *(cập nhật cuối mỗi phiên)*

**Cập nhật:** 2026-11-11

**Mốc đang làm:** M0 (chờ project Supabase thật) — mã M1–M4 đã viết xong, chưa kiểm chứng đầu-cuối.

**Đã xong:**
- Migration `supabase/migrations/0001_multiplayer.sql`: 5 bảng (`quiz_sets`, `questions`, `rooms`, `players`, `answers`), đủ RPC (`server_now`, `create_room`, `join_room`, `host_next_question`, `submit_answer`, `host_reveal`), bật RLS cho cả 5 bảng, thu hồi quyền ghi trực tiếp, cấp EXECUTE cho `authenticated`, thêm `rooms` + `players` vào publication Realtime (bỏ qua an toàn nếu chưa có publication).
- `src/config.js` (placeholder) + `src/lib/supabase.js`: tải động `@supabase/supabase-js@2.119.0` (ghim phiên bản), PKCE, đăng nhập ẩn danh cho học sinh, magic link cho giáo viên, `ensureTeacher`, `signOut`, `onAuthChange`; chưa cấu hình thì app vẫn chạy.
- `src/net/api.js`: toàn bộ gọi RPC, liệt kê/đăng/xóa bộ câu hỏi, `fetchRoomByCode`, `fetchSnapshot`, `fetchAnswerStats` (dùng cho giáo viên), `subscribeRoom` (Postgres Changes, tự lấy lại snapshot sau khi nối lại), `friendlyError`.
- `src/net/clock.js`: đồng bộ giờ server, tính thời gian còn lại, đồng bộ định kỳ.
- `src/ui/liveHub.js`: đăng nhập giáo viên bằng email, danh sách bộ câu hỏi trên Supabase, đăng bộ đang lưu trên máy, tạo phòng, form học sinh vào bằng mã + tên.
- `src/ui/host/hostViews.js`: lobby realtime, chuyển câu, công bố đáp án (tự công bố sau khi hết giờ ~1,2 giây), thống kê số người trả lời theo từng đáp án, bảng xếp hạng, màn kết thúc.
- `src/ui/player/playerViews.js`: đăng nhập ẩn danh, vào phòng, lobby, câu hỏi + đồng hồ, gửi đáp án, màn chờ/công bố/kết thúc, vào lại sau khi tải lại trang.
- `src/games/raceLive.js`: mini-game đua xe cho chế độ trực tuyến (top 8 + "em").
- `styles.css`: thêm phần giao diện Supabase, dùng lại các lớp `.live`, `.student-live`, `.live-hub`.
- `sw.js`: cache `hocvui-v9`, thêm các module mới; `index.html` + `src/main.js` đã nối giao diện mới.
- Giữ nguyên `server/rooms.js`, `src/live.js`, `src/liveViews.js` (bản LAN cũ) nhưng không còn nối vào router.
- Đã chạy `node --input-type=module --check` cho toàn bộ module mới và kiểm tra DOM bằng Edge headless ở `/`, `/play`, `/room/123456`, `/host/123456` với cấu hình placeholder và cấu hình giả.

**Đang dở:**
- Chưa có project Supabase thật nên chưa kiểm chứng: đăng nhập email, RLS, RPC, Realtime, đồng bộ đồng hồ, tải lại/ngắt mạng, tải 40 học sinh.
- Chưa chạy migration trên Postgres thật; mới kiểm tra cú pháp bằng cách đọc file.

**Việc tiếp theo (tối đa 3 việc):**
1. Tạo project Supabase, bật Anonymous sign-ins, chạy migration, điền `src/config.js`, thêm Redirect URL.
2. Chạy checklist mục 10 với 1 giáo viên + 3 học sinh; ghi lại từng mục bị chặn/không bị chặn.
3. Sửa lỗi phát hiện được, rồi làm M5 (dọn phòng cũ, giới hạn thao tác lặp) và M6 (thử tải 40 học sinh).

**Lỗi/vấn đề đã biết:**
- Chế độ trực tuyến chỉ nhận câu trắc nghiệm đủ 4 đáp án; đúng/sai và điền từ bị bỏ qua khi đăng bộ (có thông báo).
- `submit_answer` cho phép trễ tối đa 1 giây so với `question_ends_at` để bù độ trễ mạng; điểm đã tính theo thời điểm server nhận.
- `fetchAnswerStats` đọc toàn bộ `answers` của phòng ở mỗi nhịp polling; với lớp rất đông nên chuyển sang đếm phía server hoặc Broadcast.
- Chưa có CAPTCHA/giới hạn tần suất cho đăng nhập ẩn danh (rủi ro tạo tài khoản rác).
- Chưa có nút "khóa phòng"/xóa phòng cũ; mã phòng 6 số vẫn có thể bị đoán.

**Ghi chú cho phiên sau:**
- `src/config.js` phải giữ placeholder khi commit; không dán secret key.
- Đọc `README.md` mục "Phòng chơi trực tuyến (Supabase)" để biết các bước cấu hình và bảng kiểm tra bảo mật.
- Không xóa bản LAN cũ; nếu cần dùng lại, nối router vào `src/liveViews.js` và chạy `node server/rooms.js`.


---

## 14. Mẫu prompt nhanh

**Mở phiên**
> Đây là PROJECT.md: [dán]. Hôm nay làm: [việc, ví dụ: M2 — tạo phòng và danh sách người chơi realtime]. Tiêu chí xong: [...]. Đề xuất kế hoạch các bước và file cần sửa, chưa viết code.

**Giao việc có liên quan quyền truy cập**
> Làm bước [n]. Mọi thao tác ghi đi qua RPC ở mục 6, không `insert/update` trực tiếp từ client. Khi xong, liệt kê những gì học sinh KHÔNG được làm và cách tôi kiểm tra từng điều.

**Sửa lỗi Supabase**
> Lỗi: [dán nguyên văn từ Console hoặc tab Network, che mọi khóa]. Tôi đã làm: [thao tác]. Mong đợi: [...]. Giải thích nguyên nhân trước rồi mới sửa. Không tắt RLS.

**Thêm thay đổi DB**
> Cần [thay đổi]. Viết thành migration `supabase/migrations/000N_...sql`, nói rõ ảnh hưởng đến policy/RPC hiện có, và đề xuất cách kiểm thử.

**Đóng phiên**
> Tóm tắt đã làm gì, còn dở gì, rủi ro gì, và viết sẵn nội dung để tôi dán vào mục 13.