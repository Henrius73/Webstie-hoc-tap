// Màn học sinh: vào phòng bằng mã, trả lời trên thiết bị của mình,
// xem đáp án và bảng xếp hạng do server công bố.
import { esc, toast } from '../../utils.js';
import { icon } from '../../icons.js';
import { isConfigured, ensureSession } from '../../lib/supabase.js';
import {
  joinRoom, submitAnswer, fetchRoomByCode, fetchSnapshot, subscribeRoom, friendlyError,
} from '../../net/api.js';
import { syncClock, startClockSync, msLeft } from '../../net/clock.js';
import {
  messageHtml, loadingHtml, setupHtml, rosterChips, rankingRows,
  normalizeCode, initial, colorFor, LETTERS,
} from '../shared.js';
import { playCorrect, playWrong, playWin } from '../../sound.js';

function nameKey(code) {
  return `hocvui.supabase.name.${code}`;
}

function readName(code) {
  try { return localStorage.getItem(nameKey(code)) || ''; } catch { return ''; }
}

function saveName(code, name) {
  try { localStorage.setItem(nameKey(code), name); } catch { /* bỏ qua */ }
}

export function renderPlayerRoom(app, rawCode) {
  const code = normalizeCode(rawCode);
  let destroyed = false;
  const cleanups = [];

  let room = null;
  let players = [];
  let me = null;
  let myAnswer = null;
  let bodyKey = '';
  let answerSending = false;
  let connectionLost = false;
  let unsubscribe = null;
  let clockTimer = null;
  let refreshTimer = null;
  let lastRevealKey = '';
  let winPlayed = false;

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    clearInterval(clockTimer);
    clearTimeout(refreshTimer);
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
      text: 'Hãy nhập mã phòng ở trang Chơi cùng lớp, hoặc mở link giáo viên đã gửi.',
    });
    return cleanup;
  }

  // ====== Màn nhập tên ======
  function renderJoin(note = '') {
    const saved = readName(code);
    app.innerHTML = `
      <div class="student-live student-live--join">
        <section class="card student-live__join">
          <div class="student-live__avatar" style="--team:#7c3aed">${icon('gamepad-2')}</div>
          <span class="live__eyebrow">${icon('gamepad-2')} Vào phòng</span>
          <h1 class="student-live__title">Phòng <strong>${esc(code)}</strong></h1>
          <p class="muted">Nhập tên của em để giáo viên nhận ra trên bảng xếp hạng.</p>
          ${note ? `<div class="feedback feedback--bad">${icon('circle-alert')} ${esc(note)}</div>` : ''}
          <form id="player-join" class="student-live__joinform" autocomplete="off">
            <label class="field">
              <span>Tên của em</span>
              <input id="player-name" type="text" required maxlength="20"
                placeholder="Ví dụ: Minh Anh" value="${esc(saved)}" autocomplete="nickname" />
            </label>
            <button class="btn btn--primary btn--lg" type="submit">${icon('user-plus')} Vào phòng</button>
          </form>
          <a class="btn btn--ghost btn--sm" href="#/play">${icon('arrow-left')} Về trang chơi</a>
        </section>
      </div>`;
  }

  // ====== Khung màn học sinh ======
  function barHtml() {
    return `
      <header class="student-live__bar">
        <div class="student-live__room">
          <span class="live__code live__code--sm">${esc(code)}</span>
          <span class="muted">Đua xe</span>
        </div>
        <div class="student-live__me">
          <span class="student-live__dot" style="--team:${colorFor(me?.id)}"></span>
          <strong>${esc(me?.name || '')}</strong>
          ${room && room.phase !== 'lobby' ? `<span class="student-live__score">${Number(me?.score) || 0} điểm</span>` : ''}
        </div>
      </header>
      <div class="live-conn" id="student-conn" ${connectionLost ? '' : 'hidden'}>
        ${icon('wifi-off')} Mất kết nối. Đang thử kết nối lại...
      </div>`;
  }

  function lobbyBody() {
    return `
      <section class="card student-live__wait">
        <div class="student-live__avatar" style="--team:${colorFor(me?.id)}">${initial(me?.name)}</div>
        <span class="live__eyebrow">Đã vào phòng</span>
        <h1 class="student-live__title">${esc(me?.name || '')}</h1>
        <p class="muted">Chờ giáo viên bắt đầu. Giữ trang này mở nhé!</p>
        <div class="student-live__codebox">Mã phòng <strong>${esc(code)}</strong></div>
        <div class="student-live__waitmeta">
          <span>${icon('users')} ${players.length} bạn đã vào</span>
          <span>${icon('car')} Đua xe</span>
          <span>${icon('book-open')} ${room.total_questions} câu hỏi</span>
        </div>
        <div class="student-live__roster">${rosterChips(players, { meId: me?.id })}</div>
        <a class="btn btn--ghost btn--sm" href="#/play">Rời màn hình</a>
      </section>`;
  }

  function optionsHtml() {
    const question = room.question;
    if (!question) return '';
    const revealed = room.phase === 'reveal';
    const correctIndex = revealed ? Number(room.correct_index) : -1;
    const myChoice = Number.isInteger(myAnswer?.choice) ? myAnswer.choice : null;

    if (!revealed) {
      const answered = myChoice !== null;
      return `
        <div class="options" id="student-options">
          ${(question.options || []).map((option, index) => `
            <button class="option" data-choice="${index}" ${answered ? 'disabled' : ''}>
              <span class="option__key">${LETTERS[index]}</span>
              <span class="option__text">${esc(option)}</span>
            </button>`).join('')}
        </div>`;
    }

    return `
      <div class="options">
        ${(question.options || []).map((option, index) => {
          const isCorrect = correctIndex === index;
          const isWrong = myChoice === index && !isCorrect;
          return `
            <div class="option ${isCorrect ? 'is-correct' : ''} ${isWrong ? 'is-wrong' : ''}">
              <span class="option__key">${LETTERS[index]}</span>
              <span class="option__text">${esc(option)}</span>
              ${isCorrect ? `<span class="option__count">${icon('check')}</span>` : ''}
            </div>`;
        }).join('')}
      </div>`;
  }

  function roundBody() {
    const question = room.question;
    if (!question) return '';

    const revealed = room.phase === 'reveal';
    const correctIndex = revealed ? Number(room.correct_index) : -1;
    const correctText = question.options?.[correctIndex] ?? '';

    let feedback = '';
    if (!revealed) {
      feedback = myAnswer
        ? `<div class="feedback feedback--wait">${icon('check')} Đã gửi câu trả lời. Chờ giáo viên công bố đáp án.</div>`
        : `<p class="muted student-live__hint">${icon('timer')} Chọn một đáp án. Điểm cao hơn khi trả lời nhanh.</p>`;
    } else if (myAnswer?.is_correct) {
      feedback = `<div class="feedback feedback--ok">${icon('circle-check')} Chính xác! Em được cộng <strong>${Number(myAnswer.points) || 0} điểm</strong>.</div>`;
    } else if (myAnswer) {
      feedback = `<div class="feedback feedback--bad">${icon('circle-x')} Chưa đúng. Đáp án đúng là <strong>${esc(correctText)}</strong>.</div>`;
    } else {
      feedback = `<div class="feedback feedback--bad">${icon('timer')} Hết giờ! Đáp án đúng là <strong>${esc(correctText)}</strong>.</div>`;
    }

    return `
      <div class="student-live__round">
        <div class="student-live__roundbar">
          <span class="student-live__progress">Câu ${room.q_index + 1}/${room.total_questions}</span>
          <span class="quiz-timer" id="student-timer" hidden></span>
        </div>
        <section class="card student-live__qcard">
          <span class="live__eyebrow">Trắc nghiệm</span>
          ${question.image_url ? `<div class="question-image"><img src="${esc(question.image_url)}" alt="Ảnh minh họa câu hỏi" /></div>` : ''}
          <h1 class="question student-live__question">${esc(question.text)}</h1>
          ${optionsHtml()}
          ${feedback}
          ${revealed ? `<p class="muted student-live__waitnext">${icon('timer')} Chờ giáo viên chuyển câu tiếp theo...</p>` : ''}
        </section>
      </div>`;
  }

  function finishedBody() {
    const rank = players.findIndex(player => player.id === me?.id) + 1;
    return `
      <section class="card student-live__finish">
        <div class="student-live__trophy">${icon('trophy')}</div>
        <span class="live__eyebrow">Kết thúc trận</span>
        <h1 class="student-live__title">${rank === 1 ? 'Em đứng nhất!' : 'Hoàn thành!'}</h1>
        <p class="muted">${esc(me?.name || '')} · ${Number(me?.score) || 0} điểm · Hạng ${rank}/${players.length}</p>
        <div class="live-rank">${rankingRows(players, { meId: me?.id })}</div>
        <p class="muted student-live__note">Điểm đã được máy chủ chấm và cộng vào bảng xếp hạng chung.</p>
        <div class="student-live__finish-actions">
          <a class="btn btn--primary" href="#/play">${icon('gamepad-2')} Về trang chơi</a>
          <a class="btn btn--ghost" href="#/">${icon('house')} Trang chủ</a>
        </div>
      </section>`;
  }

  // ====== Đồng hồ ======
  function paintTimer() {
    const el = app.querySelector('#student-timer');
    if (!el || !room || room.phase !== 'question') return;

    const left = Math.max(0, Math.ceil(msLeft(room) / 1000));
    el.hidden = false;
    el.classList.toggle('is-low', left <= 5 && left > 0);
    el.innerHTML = left > 0 ? `${icon('timer')} ${left}s` : `${icon('timer')} Hết giờ`;

    if (left <= 0) lockOptions();
  }

  function lockOptions() {
    app.querySelectorAll('[data-choice]').forEach(button => { button.disabled = true; });
  }

  function syncTimer() {
    clearInterval(clockTimer);
    clockTimer = null;
    if (room?.phase === 'question') {
      clockTimer = setInterval(paintTimer, 250);
      paintTimer();
    }
  }

  function updateConnection() {
    const banner = app.querySelector('#student-conn');
    if (banner) banner.hidden = !connectionLost;
  }

  // ====== Vẽ màn hình ======
  function render() {
    if (destroyed || !room || !me) return;

    const key = room.phase === 'lobby'
      ? `lobby:${players.length}:${players.map(player => player.id).join(',')}`
      : `${room.phase}:${room.q_index}:${myAnswer?.choice ?? ''}:${myAnswer?.is_correct ? 1 : 0}:${myAnswer?.points ?? ''}:${me?.score ?? 0}`;

    if (key !== bodyKey) {
      bodyKey = key;
      const body = room.phase === 'lobby'
        ? lobbyBody()
        : room.phase === 'finished'
          ? finishedBody()
          : roundBody();

      app.innerHTML = `<div class="student-live">${barHtml()}<main class="student-live__main">${body}</main></div>`;
    }

    updateConnection();
    syncTimer();

    if (room.phase === 'reveal' && myAnswer) {
      const revealKey = `${room.q_index}:${myAnswer.choice}:${myAnswer.is_correct ? 1 : 0}`;
      if (lastRevealKey !== revealKey) {
        lastRevealKey = revealKey;
        if (myAnswer.is_correct) playCorrect();
        else playWrong();
      }
    }

    if (room.phase === 'finished' && !winPlayed) {
      winPlayed = true;
      playWin();
    }
  }

  // ====== Tải dữ liệu ======
  function applySnapshot(snapshot) {
    room = snapshot.room;
    players = snapshot.players;
    me = snapshot.me;
    myAnswer = snapshot.myAnswer;
    if (me) saveName(code, me.name);
  }

  async function refresh() {
    if (!room) return;
    try {
      applySnapshot(await fetchSnapshot(room.id));
      if (destroyed) return;
      if (!me) {
        app.innerHTML = messageHtml({
          iconName: 'circle-x',
          title: 'Em không còn trong phòng',
          text: 'Phiên vào phòng đã hết hoặc giáo viên đã kết thúc phòng. Hãy vào lại bằng mã phòng.',
          code,
        });
        return;
      }
      render();
    } catch {
      /* mất mạng: giữ trạng thái cũ, kênh realtime sẽ báo khi nối lại */
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refresh(), 120);
  }

  async function startRealtime() {
    try {
      unsubscribe = await subscribeRoom(room.id, {
        onRoom: () => {
          syncClock().catch(() => {});
          scheduleRefresh();
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

  async function enterRoom(snapshot) {
    applySnapshot(snapshot);
    if (!me) throw new Error('not_in_room');

    await syncClock().catch(() => {});
    if (destroyed) return;
    cleanups.push(startClockSync());
    render();
    startRealtime();
  }

  // ====== Vào phòng ======
  async function boot() {
    app.innerHTML = loadingHtml('Đang kiểm tra phòng...');

    try {
      await ensureSession();
    } catch (err) {
      if (destroyed) return;
      app.innerHTML = messageHtml({ iconName: 'circle-alert', title: 'Chưa đăng nhập được', text: friendlyError(err), code });
      return;
    }

    if (destroyed) return;

    // Đã vào phòng trước đó (tải lại trang, quay lại bằng link) thì vào thẳng.
    try {
      const found = await fetchRoomByCode(code);
      if (found) {
        const snapshot = await fetchSnapshot(found.id);
        await enterRoom(snapshot);
        return;
      }
    } catch {
      /* chưa là thành viên hoặc phòng đã bị dọn: hiện form nhập tên */
    }

    if (destroyed) return;
    renderJoin();
  }

  const onSubmit = event => {
    if (event.target.id !== 'player-join') return;
    event.preventDefault();

    const form = event.target;
    const input = form.querySelector('#player-name');
    const button = form.querySelector('button[type="submit"]');
    const name = String(input?.value || '').replace(/\s+/g, ' ').trim().slice(0, 20);
    if (!name) {
      toast('Hãy nhập tên của em');
      input?.focus();
      return;
    }

    if (button) button.disabled = true;
    joinRoom(code, name)
      .then(async player => {
        if (destroyed) return;
        saveName(code, player.name);
        const snapshot = await fetchSnapshot(player.room_id);
        await enterRoom(snapshot);
        toast('Đã vào phòng');
      })
      .catch(err => {
        if (button) button.disabled = false;
        renderJoin(friendlyError(err));
      });
  };

  const onClick = async event => {
    const button = event.target.closest('[data-choice]');
    if (!button || answerSending || !room || room.phase !== 'question') return;
    if (myAnswer) return;
    if (msLeft(room) <= 0) { lockOptions(); return; }

    const choice = Number(button.dataset.choice);
    if (!Number.isInteger(choice)) return;

    answerSending = true;
    myAnswer = { choice };
    lockOptions();
    render();

    try {
      await submitAnswer(room.id, choice);
    } catch (err) {
      myAnswer = null;
      bodyKey = '';
      render();
      toast(friendlyError(err));
    } finally {
      answerSending = false;
    }
  };

  app.addEventListener('submit', onSubmit);
  app.addEventListener('click', onClick);
  cleanups.push(() => app.removeEventListener('submit', onSubmit));
  cleanups.push(() => app.removeEventListener('click', onClick));

  boot().catch(err => {
    if (destroyed) return;
    app.innerHTML = messageHtml({ iconName: 'wifi-off', title: 'Chưa kết nối được', text: friendlyError(err), code });
  });

  return cleanup;
}
