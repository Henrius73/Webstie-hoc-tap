// Đổi mã lỗi kỹ thuật thành câu tiếng Việt dễ hiểu.

export function friendlyError(err: unknown): string {
  const raw = String((err as { message?: string })?.message || err || '')
  const map: Record<string, string> = {
    room_not_found: 'Không tìm thấy phòng. Hãy kiểm tra lại mã phòng hoặc phòng đã kết thúc.',
    invalid_state: 'Phòng đang ở trạng thái khác, thao tác này chưa thực hiện được.',
    not_in_room: 'Em chưa ở trong phòng này. Hãy vào phòng lại bằng mã.',
    not_owner: 'Bộ câu hỏi này được tạo trên máy khác — chỉ máy đó mới sửa/xóa được.',
    quiz_not_found: 'Không tìm thấy bộ câu hỏi. Có thể bộ đã bị xóa.',
    closed: 'Đã hết giờ trả lời câu này.',
  }
  for (const [code, text] of Object.entries(map)) {
    if (raw.includes(code)) return text
  }
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(raw)) {
    return 'Không kết nối được tới Supabase. Hãy kiểm tra mạng rồi thử lại.'
  }
  if (/rate limit|too many/i.test(raw)) {
    return 'Bạn thao tác quá nhanh, hãy chờ ít phút rồi thử lại.'
  }
  if (/JWT|permission denied|row-level security/i.test(raw)) {
    return 'Phiên làm việc chưa đủ quyền cho thao tác này. Hãy tải lại trang rồi thử lại.'
  }
  if (/Anonymous sign|anonymous/i.test(raw)) {
    return 'Project Supabase chưa bật đăng nhập ẩn danh. Vào Authentication → Sign In / Providers → bật Anonymous sign-ins.'
  }
  return raw || 'Có lỗi xảy ra, hãy thử lại.'
}
