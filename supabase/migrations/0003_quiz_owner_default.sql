-- =====================================================================
-- 0003: mặc định chủ sở hữu cho bộ câu hỏi
--
-- Lý do: client chỉ gửi { title } khi tạo bộ câu hỏi, nhưng cột
-- public.quiz_sets.owner_id là "not null" và không có default, nên lệnh
-- insert bị lỗi "null value in column owner_id". Đặt default auth.uid()
-- để bộ câu hỏi tự thuộc về giáo viên đang đăng nhập.
--
-- An toàn: RLS (policy quiz_sets_owner) vẫn bắt buộc owner_id = auth.uid()
-- và chặn tài khoản ẩn danh, nên default này không nới lỏng quyền.
-- =====================================================================

alter table public.quiz_sets
  alter column owner_id set default auth.uid();
