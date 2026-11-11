// Màn điều khiển của giáo viên: phòng chờ, câu hỏi, chốt đáp án, tổng kết.
// Toàn bộ trạng thái đọc từ Postgres; realtime chỉ báo "dữ liệu vừa đổi".
import { esc, toast } from '../../utils.js';
import { icon } from '../../icons.js';
import { isConfigured, ensureTeacher, teacherSignIn } from '../../lib/supabase.js';
import {
  nextQuestion, reveal, fetchRoomByCode, fetchSnapshot, fetchAnswerStats,
  subscribeRoom, friendlyError,
} from '../../net/api.js';
import { syncClock, startClockSync, msLeft } from '../../net/clock.js';
import {
  messageHtml, loadingHtml, setupHtml, rosterChips, rankingRows,
  normalizeCode, roomLink, LETTERS,
} from '../shared.js';
import { playWin } from '../../sound.js';
import raceLive from '../../games/raceLive.js';

const POLL_MS = 2000;

export function renderHostRoom(app, rawCode) {
  const code = normalizeCode(rawCode);
  let destroyed = false;
  const cleanups = [];

  let room = null;
  let players = [];
  let answerStats = { counts: [0, 0, 0, 0], answeredIds: new Set(), total: 0, correctCount: 0 };
  let layout = '';
  let busy = false;
  let connectionLost = false;
  let unsubscribe = null;
  let clockTimer = null;
  let pollTimer = null;
  let autoRevealTimer = null;
  let autoRevealKey = '';
  let refreshTimer = null;
  let winPlayed = false;

  const stopTimers = () => {
    clearInterval(clockTimer);
    clearInterval(pollTimer);
    clearTimeout(autoRevealTimer);
    clearTimeout(refreshTimer);
    clockTimer = null;
    pollTimer = null;
    autoRevealTimer = null;
    refreshTimer = null;
  };

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    stopTimers();
    try { raceLive.unmount(); } catch { /* bỏ qua */ }
    try { unsubscribe?.(); } catch { /* bỏ qua */ }
    cleanups.splice(0).forEach(fn => { try { fn(); } catch { /* bỏ qua */ } });
  };

  if (!isConfigured) {
    app.innerHTML = setupHtml();
    return cleanup;
  }

  if (!code) {
    app.innerHTML = messageHtml({
      iconName: 'gamepad-2',
      title: 'Thiếu mã phòng',
      text: 'Hãy tạo phòng ở trang Chơi cùng lớp rồi mở lại màn điều khiển.',
    });
    return cleanup;
  }

  // ====== Đăng nhập giáo viên ======
  function renderAuth() {
    stopTimers();
    app.innerHTML = `
      <section class="card host-auth">
        <span class="live__eyebrow">${icon('graduation-cap')} Dành cho giáo viên</span>
        <h1 class="page-title">Đăng nhập để điều khiển phòng</h1>
        <p class="muted">Chỉ tài khoản đã tạo phòng mới điều khiển được phòng <strong>${esc(code)}</strong>.
          Chúng tôi gửi một link đăng nhập tới email của bạn, không cần mật khẩu.</p>
        <form id="host-login" class="host-auth__form" autocomplete="on">
          <label class="field">
            <span>Email giáo viên</span>
            <input id="host-email" type="email" name="email" required maxlength="160"
              placeholder="giao.vien@truong.edu.vn" autocomplete="email" />
          </label>
          <button class="btn btn--primary" type="submit">${icon('mail')} Gửi link đăng nhập</button>
        </form>
        <p class="muted host-auth__note" id="host-auth-note" role="status"></p>
        <a class="btn btn--ghost btn--sm" href="#/play">${icon('arrow-left')} Về trang chơi</a>
      </section>`;
  }

  // ====== Tải phòng ======
  async function boot() {
    app.innerHTML = loadingHtml('Đang kiểm tra đăng nhập...');
    try {
      const user = await ensureTeacher();
      if (destroyed) return;
      if (!user) { renderAuth(); return; }

      app.innerHTML = loadingHtml('Đang tải phòng...');
      const loaded = await fetchRoomByCode(code);
      if (destroyed) return;
      if (!loaded) {
        app.innerHTML = messageHtml({
          iconName: 'circle-x',
          title: 'Không tìm thấy phòng',
          text: 'Phòng không tồn tại, đã bị dọn, hoặc tài khoản này không phải người tạo phòng.',
          code,
        });
        return;
      }

      room = loaded;
      await Promise.allSettled([syncClock(), refreshSnapshot(false)]);
      if (destroyed) return;

      cleanups.push(startClockSync());
      render();
      subscribe();
    } catch (err) {
      if (destroyed) return;
      app.innerHTML = messageHtml({ iconName: 'wifi-off', title: 'Chưa kết nối được', text: friendlyError(err), code });
    }
  }

  async function refreshSnapshot(renderAfter = true) {
    if (!room) return;
    const snap = await fetchSnapshot(room.id);
    if (destroyed) return;
    room = snap.room;
    players = snap.players;
    if (room.phase === 'question') await refreshAnswers();
    if (renderAfter) render();
  }

  async function refreshAnswers() {
    if (!room || room.q_index < 0) return;
    try {
      answerStats = await fetchAnswerStats(room.id, room.q_index);
    } catch {
      /* giữ số liệu cũ nếu lỗi mạng */
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshSnapshot(true).catch(() => {});
    }, 150);
  }

  async function subscribe() {
    try {
      unsubscribe = await subscribeRoom(room.id, {
        onRoom: newRoom => {
          if (!newRoom || destroyed) return;
          const phaseChanged = room?.phase !== newRoom.phase || room?.q_index !== newRoom.q_index;
          room = newRoom;
          if (phaseChanged) {
            syncClock().catch(() => {});
            refreshAnswers().then(() => render()).catch(() => {});
          } else {
            scheduleRefresh();
          }
        },
        onPlayers: () => scheduleRefresh(),
        onSubscribed: () => {
          connectionLost = false;
          updateConnection();
          scheduleRefresh();
        },
        onStatus: status => {
          if (status === 'SUBSCRIBED') connectionLost = false;
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') connectionLost = true;
          updateConnection();
        },
        onError: () => { connectionLost = true; updateConnection(); },
      });
      if (destroyed) { unsubscribe?.(); return; }
      cleanups.push(() => unsubscribe?.());
    } catch {
      connectionLost = true;
      updateConnection();
    }
  }

  function updateConnection() {
    const banner = app.querySelector('#host-conn');
    if (banner) banner.hidden = !connectionLost;
  }

  // ====== Hành động ======
  async function runAction(button, action) {
    if (busy) return;
    busy = true;
    if (button) { button.disabled = true; button.dataset.busy = '1'; }
    try {
      await action();
    } catch (err) {
      toast(friendlyError(err));
      if (button) { button.disabled = false; delete button.dataset.busy; }
    } finally {
      busy = false;
    }
  }

  async function applyRoom(updated) {
    if (updated) room = updated;
    await Promise.allSettled([syncClock(), refreshSnapshot(false)]);
    render();
  }

  async function goNext(button) {
    await runAction(button, async () => {
      const updated = await nextQuestion(room.id);
      await applyRoom(updated);
    });
  }

  async function doReveal(button, silent = false) {
    await runAction(button, async () => {
      try {
        const updated = await reveal(room.id);
        await applyRoom(updated);
      } catch (err) {
        if (!silent) throw err;
      }
    });
  }

  // Tự chốt khi hết giờ (server vẫn là nơi quyết định thời gian).
  function scheduleAutoReveal() {
    clearTimeout(autoRevealTimer);
    if (!room || room.phase !== 'question') return;

    const key = String(room.q_index);
    if (autoRevealKey === key) return;

    const wait = Math.max(0, msLeft(room)) + 1200;
    autoRevealTimer = setTimeout(() => {
      if (destroyed || !room || room.phase !== 'question') return;
      autoRevealKey = key;
      doReveal(null, true).catch(() => {});
    }, wait);
  }

  // ====== Giao diện ======
  function lobbyHtml() {
    const link = roomLink(room.code);
    const ready = players.length > 0;

    return `
      <div class="live">
        <div class="live__bar">
          <a class="btn btn--ghost btn--sm" href="#/play">${icon('arrow-left')} Chơi cùng lớp</a>
          <div class="live__bar-meta">
            <span class="game__tag">${icon('car')} Đua xe</span>
            <span class="muted">${room.total_questions} câu hỏi</span>
          </div>
          <a class="btn btn--ghost btn--sm" href="#/play">${icon('x')} Thoát màn hình</a>
        </div>
        <div class="live-conn" id="host-conn" ${connectionLost ? '' : 'hidden'}>
          ${icon('wifi-off')} Mất kết nối. Đang thử kết nối lại...
        </div>

        <div class="live__lobby">
          <section class="card live__invite">
            <span class="live__eyebrow">Mã phòng</span>
            <div class="live__code">${esc(room.code)}</div>
            <p class="live__invite-hint">Học sinh mở link này trên điện thoại:</p>
            <div class="live__linkrow">
              <input class="live__link" readonly value="${esc(link)}" aria-label="Link phòng" />
              <button class="btn btn--ghost btn--sm" data-act="copy">${icon('copy')} Sao chép</button>
            </div>
            <p class="muted live__invite-note">Hoặc vào mục <strong>Chơi cùng lớp</strong> và nhập mã phòng.</p>

            <div class="live__invite-stats">
              <div><strong>${players.length}</strong><span>học sinh đã vào</span></div>
              <div><strong>${room.total_questions}</strong><span>câu hỏi</span></div>
              <div><strong>Đua xe</strong><span>mini-game</span></div>
            </div>

            <button class="btn btn--primary btn--lg live__start" data-act="next" ${ready ? '' : 'disabled'}>
              ${icon('play')} Bắt đầu trận
            </button>
            <p class="muted live__start-hint">
              ${ready
                ? 'Bấm để gửi câu hỏi đầu tiên tới tất cả thiết bị. Học sinh vào muộn vẫn có thể tham gia.'
                : 'Chờ ít nhất một học sinh vào phòng để bắt đầu.'}
            </p>
          </section>

          <section class="card live__waiting">
            <div class="live__waiting-head">
              <h2 class="card__title">${icon('users')} Danh sách chờ</h2>
              <span class="live__count">${players.length}/40</span>
            </div>
            ${players.length ? `
              <div class="live__roster-grid">${rosterChips(players)}</div>
              <p class="muted live__waiting-hint">Học sinh tải lại trang vẫn giữ nguyên phiên và tên.</p>
            ` : `
              <div class="live__waiting-empty">
                <span class="live__waiting-emoji">${icon('gamepad-2')}</span>
                <p>Chưa có học sinh nào. Hãy chiếu mã phòng hoặc gửi link cho cả lớp.</p>
              </div>
            `}
          </section>
        </div>
      </div>`;
  }

  function gameShellHtml() {
    return `
      <div class="live">
        <div class="live__bar" id="host-top"></div>
        <div class="live-conn" id="host-conn" ${connectionLost ? '' : 'hidden'}>
          ${icon('wifi-off')} Mất kết nối. Đang thử kết nối lại...
        </div>
        <div class="live__layout">
          <section class="card live__stage">
            <div class="live__game" id="host-game"></div>
          </section>
          <aside class="card live__side" id="host-side"></aside>
        </div>
        <section class="card live__roster-card" id="host-roster"></section>
      </div>`;
  }

  function updateTop() {
    const top = app.querySelector('#host-top');
    if (!top || !room) return;

    const progress = room.phase === 'finished'
      ? 'Đã kết thúc'
      : `Câu ${Math.max(0, room.q_index) + 1}/${room.total_questions}`;

    let middle = `<div class="live__progress"><strong>${progress}</strong>`;
    if (room.phase === 'question') {
      middle += `<span class="quiz-timer" id="host-timer"></span>
        <span class="live__answered">${answerStats.total}/${players.length} đã trả lời</span>`;
    } else if (room.phase === 'reveal') {
      middle += `<span class="live__pill live__pill--ok">${icon('check')} Đã chốt đáp án</span>`;
    }
    middle += '</div>';

    let actions = '';
    if (room.phase === 'question') {
      actions += `<button class="btn btn--primary btn--sm" data-act="reveal">${icon('circle-check')} Chốt đáp án</button>`;
    }
    if (room.phase === 'reveal') {
      const last = room.q_index + 1 >= room.total_questions;
      actions += `<button class="btn btn--primary btn--sm" data-act="next">${last ? 'Xem tổng kết' : 'Câu tiếp'} ${icon('arrow-right')}</button>`;
    }
    actions += `<a class="btn btn--ghost btn--sm" href="#/play">${icon('x')} Thoát</a>`;

    top.innerHTML = `
      <div class="live__bar-room">
        <span class="live__code live__code--sm">${esc(room.code)}</span>
        <span class="muted">Đua xe · ${room.total_questions} câu</span>
      </div>
      ${middle}
      <div class="live__bar-actions">${actions}</div>`;
    paintTimer();
  }

  function paintTimer() {
    const el = app.querySelector('#host-timer');
    if (!el || !room) return;
    if (room.phase !== 'question') return;

    const left = Math.max(0, Math.ceil(msLeft(room) / 1000));
    el.hidden = false;
    el.classList.toggle('is-low', left <= 5 && left > 0);
    el.innerHTML = left > 0 ? `${icon('timer')} ${left}s` : `${icon('timer')} Hết giờ`;
  }

  function requestLabel(roomData) {
    if (roomData.phase === 'reveal') return 'Đáp án đúng';
    return 'Đáp án';
  }

  function updateSide() {
    const side = app.querySelector('#host-side');
    if (!side || !room) return;

    if (room.phase === 'finished') {
      side.innerHTML = `
        <div class="live__finish">
          <div class="live__trophy">${icon('trophy')}</div>
          <span class="live__eyebrow">Kết thúc trận</span>
          <h2 class="live__finish-title">Tổng hợp điểm</h2>
          <p class="muted">${players.length} học sinh · ${room.total_questions} câu hỏi</p>
          <div class="live-rank">${rankingRows(players)}</div>
          <div class="live__finish-actions">
            <a class="btn btn--primary" href="#/play">${icon('gamepad-2')} Về trang chơi</a>
          </div>
        </div>`;
      return;
    }

    const question = room.question;
    if (!question) { side.innerHTML = ''; return; }

    const revealed = room.phase === 'reveal';
    const correctIndex = revealed ? Number(room.correct_index) : -1;

    side.innerHTML = `
      <div class="live__qhead">
        <span class="live__eyebrow">Câu ${room.q_index + 1}/${room.total_questions}</span>
        <span class="live__answered">${answerStats.total}/${players.length} đã trả lời</span>
      </div>
      ${question.image_url ? `<div class="question-image live__qimage"><img src="${esc(question.image_url)}" alt="Ảnh minh họa câu hỏi" /></div>` : ''}
      <h2 class="question live__question">${esc(question.text)}</h2>
      <div class="options options--review">
        ${(question.options || []).map((option, index) => {
          const isCorrect = revealed && correctIndex === index;
          const count = Number(answerStats.counts[index]) || 0;
          return `
            <div class="option ${isCorrect ? 'is-correct' : ''}">
              <span class="option__key">${LETTERS[index]}</span>
              <span class="option__text">${esc(option)}</span>
              ${revealed ? `<span class="option__count">${count} chọn</span>` : ''}
            </div>`;
        }).join('')}
      </div>
      ${revealed ? `
        <div class="feedback feedback--ok live__answer-note">
          ${icon('circle-check')} Đáp án đúng: <strong>${esc(question.options?.[correctIndex] ?? '')}</strong>
          <span class="muted">· ${answerStats.correctCount}/${players.length} bạn đúng</span>
        </div>` : `
        <p class="muted live__wait-note">${icon('timer')} Hết giờ hệ thống tự chốt. Giáo viên có thể chốt sớm để xem đáp án.</p>`}
    `;
  }

  function updateRoster() {
    const roster = app.querySelector('#host-roster');
    if (!roster || !room) return;
    roster.innerHTML = `
      <div class="live__waiting-head">
        <h2 class="card__title">${icon('users')} ${players.length} học sinh</h2>
        <span class="live__count">${room.phase === 'question' ? `${answerStats.total} đã trả lời` : 'Điểm hiện tại'}</span>
      </div>
      <div class="live__roster-grid">${rosterChips(players, { answeredIds: answerStats.answeredIds })}</div>`;
  }

  function syncTimer() {
    clearInterval(clockTimer);
    clockTimer = null;
    if (room?.phase === 'question') {
      clockTimer = setInterval(paintTimer, 250);
      paintTimer();
    }
  }

  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
    if (room?.phase !== 'question') return;

    pollTimer = setInterval(async () => {
      if (destroyed || !room || room.phase !== 'question') return;
      await refreshAnswers();
      if (destroyed) return;
      updateTop();
      updateSide();
      updateRoster();
    }, POLL_MS);
  }

  function render() {
    if (destroyed || !room) return;

    if (room.phase === 'lobby') {
      if (layout !== 'lobby') {
        layout = 'lobby';
        try { raceLive.unmount(); } catch { /* bỏ qua */ }
        clearInterval(clockTimer);
        clearInterval(pollTimer);
      }
      app.innerHTML = lobbyHtml();
      return;
    }

    if (layout !== 'game') {
      layout = 'game';
      app.innerHTML = gameShellHtml();
      try {
        raceLive.mount(app.querySelector('#host-game'));
      } catch (err) {
        console.error('Không dựng được mini-game:', err);
      }
    }

    updateTop();
    updateSide();
    updateRoster();
    try {
      raceLive.update({
        phase: room.phase,
        qIndex: room.q_index,
        totalQuestions: room.total_questions,
        players,
        me: null,
      });
    } catch { /* game lỗi thì vẫn chạy tiếp */ }

    syncTimer();
    startPolling();
    updateConnection();
    scheduleAutoReveal();

    if (room.phase === 'finished' && !winPlayed) {
      winPlayed = true;
      playWin();
    }
  }

  // ====== Sự kiện ======
  const onClick = event => {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    const action = button.dataset.act;

    if (action === 'copy') {
      const link = roomLink(room.code);
      const done = () => toast('Đã sao chép link phòng');
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(link).then(done).catch(() => toast('Không sao chép được. Hãy chọn link và sao chép thủ công.'));
      } else {
        toast('Hãy chọn link và sao chép thủ công.');
      }
      return;
    }

    if (action === 'next') { goNext(button).catch(() => {}); return; }
    if (action === 'reveal') { doReveal(button).catch(() => {}); }
  };

  const onSubmit = event => {
    if (event.target.id !== 'host-login') return;
    event.preventDefault();
    const form = event.target;
    const input = form.querySelector('#host-email');
    const note = app.querySelector('#host-auth-note');
    const button = form.querySelector('button[type="submit"]');
    const email = String(input?.value || '').trim();
    if (!email) return;

    if (button) button.disabled = true;
    if (note) note.textContent = 'Đang gửi link đăng nhập...';

    teacherSignIn(email, location.href)
      .then(() => {
        if (note) note.innerHTML = `${icon('mail')} Đã gửi link tới <strong>${esc(email)}</strong>. Mở email trên chính máy này và bấm link để đăng nhập.`;
        toast('Đã gửi link đăng nhập qua email');
      })
      .catch(err => {
        if (note) note.textContent = '';
        if (button) button.disabled = false;
        toast(friendlyError(err));
      });
  };

  app.addEventListener('click', onClick);
  app.addEventListener('submit', onSubmit);
  cleanups.push(() => app.removeEventListener('click', onClick));
  cleanups.push(() => app.removeEventListener('submit', onSubmit));

  boot().catch(err => {
    if (destroyed) return;
    app.innerHTML = messageHtml({ iconName: 'wifi-off', title: 'Chưa kết nối được', text: friendlyError(err), code });
  });

  return cleanup;
}
