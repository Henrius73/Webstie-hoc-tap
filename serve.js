// Server chạy local: phục vụ file tĩnh + API phòng chơi trực tuyến + SSE.
// Cách dùng: node serve.js  ->  mở http://localhost:8000
// Không cần thư viện ngoài; phòng chơi lưu trong bộ nhớ của process này.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const rooms = require('./server/rooms');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8000;
const BODY_LIMIT = 8 * 1024 * 1024; // ảnh trong câu hỏi có thể là data URL

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Mỗi phòng giữ danh sách kết nối SSE đang mở
const sseClients = new Map();

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(res, err) {
  const status = Number(err?.status) || 500;
  if (status >= 500) console.error('[api]', err);
  const message = err instanceof rooms.RoomError
    ? err.message
    : status >= 500 ? 'Lỗi máy chủ. Hãy thử lại.' : err.message;
  if (!res.headersSent) sendJson(res, status, { error: message });
  else res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        const err = new Error('Dữ liệu gửi lên quá lớn (tối đa 8MB).');
        err.status = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(data && typeof data === 'object' ? data : {});
      } catch {
        const err = new Error('Dữ liệu gửi lên không phải JSON hợp lệ.');
        err.status = 400;
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// ===== SSE: đẩy trạng thái phòng cho từng client =====
function writeEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function broadcast(room, event = 'update') {
  const clients = sseClients.get(room.code);
  if (!clients?.size) return;

  for (const client of [...clients]) {
    try {
      if (event === 'closed') {
        writeEvent(client.res, 'closed', { code: room.code, message: 'Phòng đã đóng.' });
      } else {
        writeEvent(client.res, 'update', rooms.snapshot(room, client.viewer));
      }
    } catch {
      // Kết nối đã rơi; dọn ở sự kiện close của request
      clients.delete(client);
    }
  }
}

rooms.setNotifier(broadcast);

function handleEvents(req, res, url, code) {
  let room;
  try {
    room = rooms.getRoom(code);
  } catch (err) {
    sendError(res, err);
    return;
  }

  const playerToken = url.searchParams.get('playerToken') || '';
  const viewer = rooms.resolveViewer(room, {
    hostToken: url.searchParams.get('hostToken') || '',
    playerToken,
  });

  if (!viewer) {
    sendJson(res, 403, { error: 'Phiên vào phòng không hợp lệ. Hãy vào lại phòng.' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');

  const client = { res, viewer };
  let set = sseClients.get(room.code);
  if (!set) {
    set = new Set();
    sseClients.set(room.code, set);
  }
  set.add(client);

  // Gửi ngay trạng thái hiện tại để màn hình không phải chờ sự kiện kế tiếp
  try {
    writeEvent(res, 'update', rooms.snapshot(room, viewer));
  } catch { /* để close dọn */ }

  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* close sẽ dọn */ }
  }, 20000);
  if (heartbeat.unref) heartbeat.unref();

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);

    const list = sseClients.get(room.code);
    if (list) {
      list.delete(client);
      if (!list.size) sseClients.delete(room.code);
    }

    // Chỉ báo mất kết nối khi không còn tab nào của học sinh đó đang mở
    if (viewer.role === 'player') {
      const stillOnline = (sseClients.get(room.code) || new Set());
      const hasOtherTab = [...stillOnline].some(c => c.viewer.playerId === viewer.playerId);
      if (!hasOtherTab) rooms.markDisconnected(room.code, playerToken);
    }
  };

  req.on('close', cleanup);
  res.on('error', cleanup);
}

// ===== API phòng chơi =====
async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api','rooms',code,...]
  if (parts[0] !== 'api' || parts[1] !== 'rooms') {
    sendJson(res, 404, { error: 'Không tìm thấy API.' });
    return;
  }

  let code = '';
  try {
    code = decodeURIComponent(parts[2] || '').toUpperCase();
  } catch {
    sendJson(res, 400, { error: 'Mã phòng không hợp lệ.' });
    return;
  }
  const action = parts[3] || '';
  const extra = parts[4] || '';

  try {
    // Tạo phòng mới
    if (!code) {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Hãy dùng POST để tạo phòng.' });
        return;
      }
      const body = await readBody(req);
      const created = rooms.createRoom({
        setId: body.setId,
        setName: body.setName,
        gameId: body.gameId,
        questions: body.questions,
      });
      sendJson(res, 201, created);
      return;
    }

    // Kiểm tra phòng trước khi vào
    if (action === '' && req.method === 'GET') {
      sendJson(res, 200, rooms.publicRoom(code));
      return;
    }

    if (action === 'events' && req.method === 'GET') {
      handleEvents(req, res, url, code);
      return;
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const hostToken = body.hostToken || req.headers['x-host-token'] || url.searchParams.get('hostToken') || '';
      const playerToken = body.playerToken || body.token || req.headers['x-player-token'] || url.searchParams.get('playerToken') || '';

      switch (action) {
        case 'join': {
          const joined = rooms.joinRoom(code, { name: body.name, token: playerToken });
          sendJson(res, 200, joined);
          return;
        }
        case 'start':
          rooms.startRoom(code, hostToken);
          sendJson(res, 200, { ok: true });
          return;
        case 'answer':
          rooms.answerRoom(code, { token: playerToken, index: body.index, answer: body.answer });
          sendJson(res, 200, { ok: true });
          return;
        case 'reveal':
          rooms.revealRoom(code, hostToken);
          sendJson(res, 200, { ok: true });
          return;
        case 'next':
          rooms.nextRoom(code, hostToken);
          sendJson(res, 200, { ok: true });
          return;
        case 'restart':
          rooms.restartRoom(code, hostToken);
          sendJson(res, 200, { ok: true });
          return;
        case 'close':
          rooms.closeRoom(code, hostToken);
          sendJson(res, 200, { ok: true });
          return;
        default:
          sendJson(res, 404, { error: 'Không tìm thấy thao tác phòng.' });
          return;
      }
    }

    if (action === 'players' && extra && req.method === 'DELETE') {
      const hostToken = req.headers['x-host-token'] || url.searchParams.get('hostToken') || '';
      rooms.removePlayer(code, hostToken, decodeURIComponent(extra));
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 405, { error: 'Phương thức không được hỗ trợ.' });
  } catch (err) {
    sendError(res, err);
  }
}

// ===== File tĩnh =====
function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
    res.end('Phương thức không được hỗ trợ');
    return;
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Đường dẫn không hợp lệ');
    return;
  }

  let filePath = path.resolve(ROOT, `.${urlPath === '/' ? '/index.html' : urlPath}`);

  // Không cho truy cập ra ngoài thư mục dự án
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  // Thư mục thì trả về index.html bên trong
  try {
    if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch { /* để bước đọc file báo 404 */ }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Không tìm thấy: ${urlPath}`);
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': data.length,
    });
    if (req.method === 'HEAD') res.end();
    else res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Yêu cầu không hợp lệ');
    return;
  }

  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    handleApi(req, res, url);
    return;
  }

  serveStatic(req, res, url);
});

// Báo lỗi thân thiện thay vì in stack trace khi cổng đã bị chiếm.
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error(`Không khởi động được: cổng ${PORT} đang được chương trình khác sử dụng.`);
    console.error(`- Nếu đang có server cũ, mở http://localhost:${PORT} hoặc dừng nó trước.`);
    console.error(`- Hoặc chạy ở cổng khác (PowerShell): $env:PORT=${PORT + 1}; node serve.js`);
    console.error(`  (macOS/Linux): PORT=${PORT + 1} node serve.js`);
    console.error('');
    process.exit(1);
  }
  console.error('Lỗi server:', err);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Học Vui đang chạy tại http://localhost:${PORT}`);
  console.log('Trong lớp, học sinh có thể vào bằng địa chỉ Wi-Fi:');

  const nets = os.networkInterfaces();
  let found = false;
  for (const list of Object.values(nets)) {
    for (const net of list || []) {
      if (net.family !== 'IPv4' && net.family !== 4) continue;
      if (net.internal) continue;
      found = true;
      console.log(`  http://${net.address}:${PORT}`);
    }
  }
  if (!found) console.log('  (chưa thấy địa chỉ mạng LAN - hãy kiểm tra Wi-Fi)');

  console.log('Nhấn Ctrl + C để dừng.');
});
