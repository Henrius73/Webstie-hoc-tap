-- =====================================================================
-- Giai đoạn 2: phòng chơi nhiều người chơi cùng lúc (Supabase)
-- Chạy toàn bộ file này trong SQL Editor của project Supabase.
-- Sau khi chạy xong, bật Realtime cho rooms + players (khối cuối file).
--
-- Nguyên tắc bảo mật:
--   1. Đáp án đúng chỉ nằm trong public.questions (chỉ giáo viên chủ bộ đọc).
--   2. rooms.correct_index chỉ được điền khi phase = 'reveal'.
--   3. Client không ghi trực tiếp rooms/players/answers; mọi ghi đi qua RPC.
--   4. Điểm chỉ được cộng trong host_reveal.
-- =====================================================================

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
  q_index       int  not null check (q_index >= 0),
  text          text not null,
  options       jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_index int  not null check (correct_index between 0 and 3),
  image_url     text,
  time_limit    int  not null default 20 check (time_limit between 5 and 300),
  unique (quiz_id, q_index)
);

create table public.rooms (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  host_id             uuid not null references auth.users(id),
  quiz_id             uuid not null references public.quiz_sets(id),
  phase               text not null default 'lobby'
                        check (phase in ('lobby','question','reveal','finished')),
  total_questions     int  not null default 0,
  q_index             int  not null default -1,
  question            jsonb,
  correct_index       int,
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

-- =====================================================================
-- 5. REALTIME: báo thay đổi của rooms + players xuống client
-- =====================================================================
do $$
begin
  alter publication supabase_realtime add table public.rooms, public.players;
exception
  when duplicate_object then null;   -- đã bật trước đó
  when undefined_object then
    raise notice 'Không tìm thấy publication supabase_realtime; hãy bật Realtime trong Dashboard.';
end $$;

-- =====================================================================
-- 6. DỌN PHÒNG CŨ (chạy tay, hoặc đặt lịch bằng pg_cron nếu muốn)
-- =====================================================================
-- delete from public.rooms where created_at < now() - interval '1 day';
