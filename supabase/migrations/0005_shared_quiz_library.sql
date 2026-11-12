-- =====================================================================
-- 0005: thư viện bộ câu hỏi dùng chung giữa nhiều máy
--
-- Mục tiêu: bộ câu hỏi đã tạo hiện trên mọi máy, không chỉ máy đã tạo.
--
-- Nguyên tắc:
--   - Mọi phiên (kể cả ẩn danh) ĐỌC được danh sách bộ câu hỏi.
--   - Chỉ máy đã tạo (owner_id) mới SỬA/XÓA bộ câu hỏi + câu hỏi bên trong.
--   - Mọi máy đều có thể MỞ PHÒNG cho bất kỳ bộ câu hỏi nào.
--   - Bảng questions (kèm đáp án đúng) vẫn chỉ chủ sở hữu đọc trực tiếp;
--     phòng chơi lấy đáp án qua RPC security definer, không lộ ra client.
-- =====================================================================

-- 1. quiz_sets: đọc chung, ghi theo chủ sở hữu
drop policy if exists quiz_sets_owner on public.quiz_sets;

create policy quiz_sets_read on public.quiz_sets
  for select to authenticated using (true);

create policy quiz_sets_insert on public.quiz_sets
  for insert to authenticated with check (owner_id = auth.uid());

create policy quiz_sets_update on public.quiz_sets
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy quiz_sets_delete on public.quiz_sets
  for delete to authenticated using (owner_id = auth.uid());

-- 2. Danh sách bộ câu hỏi kèm số câu.
-- Hàm security definer đếm được câu hỏi dù RLS chỉ cho chủ sở hữu đọc bảng questions.
create or replace function public.list_quiz_summaries()
returns table (
  id uuid,
  title text,
  created_at timestamptz,
  question_count bigint,
  owner_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select qs.id, qs.title, qs.created_at, count(q.id), qs.owner_id
  from public.quiz_sets qs
  left join public.questions q on q.quiz_id = qs.id
  group by qs.id, qs.title, qs.created_at, qs.owner_id
  order by qs.created_at desc;
$$;

revoke execute on function public.list_quiz_summaries() from public, anon;
grant execute on function public.list_quiz_summaries() to authenticated;

-- 3. Cho phép mở phòng cho bộ câu hỏi của máy khác.
-- Vẫn chỉ chủ phòng (host_id) điều khiển phòng của mình.
create or replace function public.create_room(p_quiz_id uuid)
returns public.rooms
language plpgsql security definer set search_path = public
as $$
declare
  v_code text;
  v_room public.rooms;
begin
  if not exists (select 1 from public.quiz_sets where id = p_quiz_id) then
    raise exception 'quiz_not_found';
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

revoke execute on function public.create_room(uuid) from public, anon;
grant execute on function public.create_room(uuid) to authenticated;

-- 4. Xóa bộ câu hỏi thì xóa luôn phòng (và người chơi/đáp án) của bộ đó.
-- Trước đây khóa ngoại không cascade nên nút "Xóa" báo lỗi nếu bộ đã từng mở phòng.
alter table public.rooms drop constraint if exists rooms_quiz_id_fkey;
alter table public.rooms add constraint rooms_quiz_id_fkey
  foreign key (quiz_id) references public.quiz_sets(id) on delete cascade;
