// Đổi mã lỗi kỹ thuật thành câu tiếng Việt dễ hiểu.

export function friendlyError(err: unknown): string {
  const raw = String((err as { message?: string })?.message || err || '')
  const map: Record<string, string> = {
    room_not_found: 'Không tìm thấy phòng. Hãy kiểm tra lại mã phòng hoặc phòng đã kết thúc.',
    invalid_state: 'Phòng đang ở trạng thái khác, thao tác này chưa thực hiện được.',
    not_in_room: 'Em chưa ở trong phòng này. Hãy vào phòng lại bằng mã.',
    not_owner: 'Tài khoản này không phải chủ bộ câu hỏi.',
    closed: 'Đã hết giờ trả lời câu này.',
  }
  for (const [code, text] of Object.entries(map)) {
    if (raw.includes(code)) return text
  }
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(raw)) {
    return 'Không kết nối được tới Supabase. Hãy kiểm tra mạng rồi thử lại.'
  }
  if (/JWT|permission denied|row-level security/i.test(raw)) {
    return 'Tài khoản chưa có quyền thực hiện thao tác này. Hãy đăng nhập lại.'
  }
  if (/Anonymous sign|anonymous/i.test(raw)) {
    return 'Project Supabase chưa bật đăng nhập ẩn danh. Vào Authentication → Sign In / Providers → bật Anonymous sign-ins.'
  }
  return raw || 'Có lỗi xảy ra, hãy thử lại.'
}
