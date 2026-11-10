// Service worker: lưu sẵn bộ khung ứng dụng để chạy ngoại tuyến.
// Tăng số phiên bản mỗi khi sửa danh sách file hoặc muốn buộc tải bản mới.
const CACHE = 'hocvui-v5';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './src/main.js',
  './src/store.js',
  './src/utils.js',
  './src/csv.js',
  './src/xlsx.js',
  './src/quizEngine.js',
  './src/icons.js',
  './src/stats.js',
  './src/sound.js',
  './src/games/index.js',
  './src/games/race.js',
  './src/games/tug.js',
  './src/games/duck.js',
  './src/games/sack-race.js',
];

// Cài đặt: tải toàn bộ khung ứng dụng vào cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Kích hoạt: xóa cache của phiên bản cũ rồi tiếp quản các tab đang mở
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Trang điều hướng: ưu tiên mạng để nhận bản mới, mất mạng thì dùng khung đã lưu
function handleNavigation(request) {
  return fetch(request)
    .then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put('./index.html', copy));
      return response;
    })
    .catch(() => caches.match('./index.html'));
}

// Tài nguyên tĩnh cùng origin: dùng cache trước, chưa có thì tải rồi lưu lại
function handleAsset(request) {
  return caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    });
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // ảnh ngoài vẫn cần mạng

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(handleAsset(request));
});
