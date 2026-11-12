-- =====================================================================
-- 0004: dùng Supabase không cần tài khoản giáo viên
--
-- Trước đây policy quiz_sets_owner chặn tài khoản ẩn danh
-- (is_anonymous = true), nên muốn lưu bộ câu hỏi phải đăng nhập email.
-- Nay cho phép phiên ẩn danh tự tạo/sửa/xóa bộ câu hỏi của chính mình.
--
-- Vẫn giữ owner_id = auth.uid(): mỗi trình duyệt (mỗi phiên ẩn danh)
-- chỉ đọc được bộ câu hỏi của mình, học sinh không xem được đáp án đúng
-- của bộ câu hỏi khác.
-- =====================================================================

drop policy if exists quiz_sets_owner on public.quiz_sets;

create policy quiz_sets_owner on public.quiz_sets for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- questions dùng policy questions_owner (kiểm tra chủ bộ) nên không cần đổi.
