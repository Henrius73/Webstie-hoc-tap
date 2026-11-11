// Giao tiếp với API phòng chơi trực tuyến và giữ phiên trên trình duyệt.
// Không dùng thư viện ngoài: fetch cho thao tác, EventSource cho cập nhật realtime.
const API = 'api/rooms';
const STORE = 'hocvui.live.v1';

// Gọi API, đổi lỗi máy chủ thành thông báo tiếng Việt dễ hiểu
async function request(method, path, body, headers = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      cache: 'no-store',
      headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Không kết nối được máy chủ phòng chơi. Hãy kiểm tra Wi-Fi và chạy "node serve.js".');
  }

  const type = res.headers.get('content-type') || '';
  if (!type.includes('application/json')) {
    throw new Error('Máy chủ phòng chơi chưa chạy. Hãy chạy "node serve.js" trên máy giáo viên.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Máy chủ báo lỗi ${res.status}.`);
  return data;
}

// ===== Phiên giáo viên / học sinh theo mã phòng =====
function hostKey(code) {
  return `${STORE}.host.${code}`;
}

function playerKey(code) {
  return `${STORE}.player.${code}`;
}

export function saveHostSession(code, hostToken) {
  try { localStorage.setItem(hostKey(code), hostToken); } catch { /* trình duyệt chặn lưu */ }
}

export function readHostSession(code) {
  try { return localStorage.getItem(hostKey(code)) || ''; } catch { return ''; }
}

export function clearHostSession(code) {
  try { localStorage.removeItem(hostKey(code)); } catch { /* bỏ qua */ }
}

export function savePlayerSession(code, player) {
  try { localStorage.setItem(playerKey(code), JSON.stringify(player)); } catch { /* bỏ qua */ }
}

export function readPlayerSession(code) {
  try {
    const data = JSON.parse(localStorage.getItem(playerKey(code)) || 'null');
    return data && data.token ? data : null;
  } catch {
    return null;
  }
}

export function clearPlayerSession(code) {
  try { localStorage.removeItem(playerKey(code)); } catch { /* bỏ qua */ }
}

// Link mời học sinh vào đúng phòng
export function roomLink(code) {
  const url = new URL(location.href);
  url.hash = `#/room/${code}`;
  return url.href;
}

// ===== Thao tác phòng =====
export function createRoom(payload) {
  return request('POST', '', payload);
}

export function roomInfo(code) {
  return request('GET', `/${encodeURIComponent(code)}`);
}

export function joinRoom(code, name, playerToken = '') {
  return request('POST', `/${encodeURIComponent(code)}/join`, { name, playerToken });
}

export function startRoom(code, hostToken) {
  return request('POST', `/${encodeURIComponent(code)}/start`, { hostToken });
}

export function answerRoom(code, playerToken, index, answer) {
  return request('POST', `/${encodeURIComponent(code)}/answer`, { playerToken, index, answer });
}

export function revealRoom(code, hostToken) {
  return request('POST', `/${encodeURIComponent(code)}/reveal`, { hostToken });
}

export function nextRoom(code, hostToken) {
  return request('POST', `/${encodeURIComponent(code)}/next`, { hostToken });
}

export function restartRoom(code, hostToken) {
  return request('POST', `/${encodeURIComponent(code)}/restart`, { hostToken });
}

export function closeRoom(code, hostToken) {
  return request('POST', `/${encodeURIComponent(code)}/close`, { hostToken });
}

export function removePlayer(code, hostToken, playerId) {
  return request(
    'DELETE',
    `/${encodeURIComponent(code)}/players/${encodeURIComponent(playerId)}`,
    undefined,
    { 'x-host-token': hostToken }
  );
}

// ===== Nhận trạng thái realtime qua SSE =====
// EventSource tự kết nối lại khi mất mạng; token vẫn giữ nguyên phiên.
export function watchRoom(code, { hostToken = '', playerToken = '', onUpdate, onClosed, onOpen, onError } = {}) {
  const params = new URLSearchParams();
  if (hostToken) params.set('hostToken', hostToken);
  if (playerToken) params.set('playerToken', playerToken);

  const source = new EventSource(`${API}/${encodeURIComponent(code)}/events?${params}`);

  source.addEventListener('update', event => {
    try { onUpdate?.(JSON.parse(event.data)); } catch { /* bỏ qua gói hỏng */ }
  });

  source.addEventListener('closed', event => {
    let data = {};
    try { data = JSON.parse(event.data); } catch { /* bỏ qua */ }
    source.close();
    onClosed?.(data);
  });

  source.addEventListener('open', () => onOpen?.());
  source.addEventListener('error', () => onError?.());

  return () => source.close();
}

// Sao chép link phòng, có phương án dự phòng cho trình duyệt cũ
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const input = document.createElement('textarea');
      input.value = text;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand('copy');
      input.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
