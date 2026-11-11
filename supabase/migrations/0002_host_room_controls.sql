-- =====================================================================
-- Bổ sung: giáo viên quản lý phòng đang mở.
--   - host_end_room: kết thúc ván chơi ngay từ bất kỳ pha nào chưa kết thúc.
--   - Index riêng cho truy vấn "các phòng đang mở của tôi".
-- Chạy file này SAU 0001_init.sql trong SQL Editor.
-- =====================================================================

-- Tra cứu nhanh danh sách phòng chưa kết thúc theo giáo viên.
create index if not exists rooms_host_open_idx
  on public.rooms (host_id)
  where phase <> 'finished';

-- Giáo viên: kết thúc ván chơi ngay lập tức.
-- Điểm hiển thị là điểm đã công bố đến thời điểm này (câu đang hỏi chưa cộng).
create or replace function public.host_end_room(p_room_id uuid)
returns public.rooms
language plpgsql security definer set search_path = public
as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms
   where id = p_room_id and host_id = auth.uid() and phase <> 'finished'
   for update;
  if not found then
    raise exception 'invalid_state';
  end if;

  update public.rooms
     set phase = 'finished',
         question = null,
         correct_index = null,
         question_started_at = null,
         question_ends_at = null
   where id = v_room.id
   returning * into v_room;
  return v_room;
end $$;

-- Quyền gọi hàm: chỉ người đã đăng nhập.
revoke execute on function public.host_end_room(uuid) from public, anon;
grant execute on function public.host_end_room(uuid) to authenticated;
