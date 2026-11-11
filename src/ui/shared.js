// Các mảnh giao diện dùng chung cho phòng chơi Supabase.
import { esc } from '../utils.js';
import { icon } from '../icons.js';

export const LETTERS = ['A', 'B', 'C', 'D'];

const COLORS = ['#7c3aed', '#db2777', '#0284c7', '#d97706', '#059669', '#dc2626', '#0891b2', '#9333ea'];

// Màu ổn định theo id người chơi (cùng một bạn luôn cùng một màu).
export function colorFor(id) {
  const text = String(id || '');
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export function normalizeCode(value) {
  return String(value ?? '').replace(/\s+/g, '').trim().toUpperCase();
}

export function initial(name) {
  return esc(String(name || '?').trim().charAt(0).toUpperCase() || '?');
}

export function roomLink(code) {
  const url = new URL(location.href);
  url.hash = `#/room/${encodeURIComponent(code)}`;
  return url.href;
}

export function messageHtml({ iconName = 'circle-x', title, text, code = '', actions = true }) {
  return `
    <section class="empty">
      <div class="empty__icon">${icon(iconName)}</div>
      <h2>${esc(title)}</h2>
      <p>${esc(text)}</p>
      ${code ? `<p class="muted">Mã phòng: <strong>${esc(code)}</strong></p>` : ''}
      ${actions ? `
        <div class="hero__actions" style="justify-content:center">
          <a class="btn btn--primary" href="#/play">${icon('gamepad-2')} Về trang chơi</a>
          <a class="btn btn--ghost" href="#/">${icon('house')} Trang chủ</a>
        </div>` : ''}
    </section>`;
}

export function loadingHtml(text) {
  return `<section class="empty"><div class="empty__icon">${icon('timer')}</div><p>${esc(text)}</p></section>`;
}

// Hướng dẫn khi chưa điền src/config.js hoặc chưa chạy migration.
export function setupHtml() {
  return `
    <section class="card setup">
      <span class="live__eyebrow">${icon('settings')} Cần cấu hình Supabase</span>
      <h1 class="page-title">Bật phòng chơi trực tuyến</h1>
      <p class="muted">Trang chơi nhiều người dùng Supabase (Postgres + Auth + Realtime). Làm lần lượt các bước sau:</p>
      <ol class="setup__steps">
        <li>Tạo project tại <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a>, rồi mở <strong>Authentication → Sign In / Providers</strong> và bật <strong>Anonymous sign-ins</strong> cho học sinh.</li>
        <li>Mở <strong>SQL Editor</strong>, dán và chạy toàn bộ file <code>supabase/migrations/0001_multiplayer.sql</code>.</li>
        <li>Vào <strong>Project Settings → API Keys</strong>, lấy <strong>Project URL</strong> và <strong>Publishable key</strong> (không dùng secret key).</li>
        <li>Điền hai giá trị đó vào <code>src/config.js</code> rồi tải lại trang.</li>
      </ol>
      <p class="setup__warn">${icon('circle-check')} Không bao giờ đặt secret key trong mã chạy trên trình duyệt. Mọi thao tác ghi đều đi qua RPC và RLS.</p>
      <div class="hero__actions">
        <a class="btn btn--ghost" href="#/">${icon('house')} Trang chủ</a>
      </div>
    </section>`;
}

// Danh sách người chơi dạng chip.
export function rosterChips(players, { answeredIds = new Set(), meId = '' } = {}) {
  return players.map(player => {
    const answered = answeredIds.has(player.id);
    return `
      <span class="live-player ${answered ? 'is-answered' : ''}" style="--team:${colorFor(player.id)}"
        title="${esc(player.name)}${answered ? ' · đã trả lời' : ''}">
        <span class="live-player__dot"></span>
        <span class="live-player__name">${esc(player.name)}${player.id === meId ? ' (em)' : ''}</span>
        <span class="live-player__score">${Number(player.score) || 0}</span>
        ${answered ? `<span class="live-player__tick">${icon('check')}</span>` : ''}
      </span>`;
  }).join('');
}

export function rankingRows(players, { meId = '', limit = 0 } = {}) {
  const list = limit > 0 ? players.slice(0, limit) : players;
  return list.map((player, index) => `
    <div class="live-rank__row ${player.id === meId ? 'is-me' : ''} ${index === 0 ? 'is-first' : ''}">
      <span class="live-rank__place">${index === 0 ? icon('medal') : index + 1}</span>
      <span class="live-rank__who">
        <span class="live-rank__dot" style="--team:${colorFor(player.id)}"></span>
        <span class="live-rank__name">${esc(player.name)}</span>
        ${index === 0 ? icon('crown') : ''}
      </span>
      <span class="live-rank__score">${Number(player.score) || 0} điểm</span>
    </div>`).join('');
}
