// Giao diện chơi cùng lớp: trang chọn phòng, màn giáo viên và màn học sinh.
// Mọi điểm số lấy từ server qua SSE; màn học sinh không bao giờ thấy đáp án trước khi chốt.
import { esc, toast } from './utils.js';
import { icon } from './icons.js';
import { getSets, getSet, saveSet, sampleSet } from './store.js';
import { saveMatch } from './stats.js';
import { playCorrect, playWrong, playWin } from './sound.js';
import * as live from './live.js';
import { listGames, getGame } from './games/index.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const GAME_ICONS = { race: 'car', tug: 'move-horizontal', duck: 'bird', sack: 'rabbit' };

function normalizeCode(value) {
  return String(value ?? '').trim().toUpperCase();
}

function gameIcon(id) {
  return GAME_ICONS[id] || 'gamepad-2';
}

function initial(name) {
  return esc(String(name || '?').trim().charAt(0).toUpperCase() || '?');
}

// Màn hình thông báo dùng chung
function messageHtml({ iconName = 'circle-x', title, text, code = '' }) {
  return `
    <section class="empty">
      <div class="empty__icon">${icon(iconName)}</div>
      <h2>${esc(title)}</h2>
      <p>${esc(text)}</p>
      ${code ? `<p class="muted">Mã phòng: <strong>${esc(code)}</strong></p>` : ''}
      <div class="hero__actions" style="justify-content:center">
        <a class="btn btn--primary" href="#/play">${icon('gamepad-2')} Về trang chơi</a>
        <a class="btn btn--ghost" href="#/">${icon('house')} Trang chủ</a>
      </div>
    </section>`;
}

function loadingHtml(text) {
  return `<section class="empty"><div class="empty__icon">${icon('timer')}</div><p>${esc(text)}</p></section>`;
}

function rosterChips(players, { lobby = false } = {}) {
  return players.map(p => `
    <span class="live-player ${p.connected ? '' : 'is-offline'} ${p.answered ? 'is-answered' : ''}"
      style="--team:${p.color}" title="${esc(p.name)}${p.connected ? '' : ' · mất kết nối'}">
      <span class="live-player__dot"></span>
      <span class="live-player__name">${esc(p.name)}</span>
      ${lobby ? '' : `<span class="live-player__score">${Number(p.score) || 0}</span>`}
      ${p.answered ? `<span class="live-player__tick">${icon('check')}</span>` : ''}
      ${lobby ? `<button class="live-player__remove" data-act="remove" data-id="${esc(p.id)}"
        title="Xóa ${esc(p.name)}" aria-label="Xóa ${esc(p.name)}">${icon('x')}</button>` : ''}
    </span>`).join('');
}

function rankingRows(ranking, highlightId = '') {
  return ranking.map((p, i) => `
    <div class="live-rank__row ${p.id === highlightId ? 'is-me' : ''} ${i === 0 ? 'is-first' : ''}">
      <span class="live-rank__place">${i === 0 ? icon('medal') : i + 1}</span>
      <span class="live-rank__who">
        <span class="live-rank__dot" style="--team:${p.color}"></span>
        <span class="live-rank__name">${esc(p.name)}</span>
        ${i === 0 ? icon('crown') : ''}
      </span>
      <span class="live-rank__score">${p.score}/${p.total}</span>
    </div>`).join('');
}

// ===== Trang chơi: tạo phòng hoặc vào phòng =====
export function renderLiveHub(app) {
  const sets = getSets();
  const games = listGames();
  let pickedGame = 'race';
  try {
    const saved = localStorage.getItem('hocvui.live.game');
    if (games.some(g => g.id === saved)) pickedGame = saved;
  } catch { /* bỏ qua */ }

  app.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Chơi cùng lớp</h1>
        <p class="page-sub">Mỗi học sinh dùng một thiết bị, cùng trả lời một bộ câu hỏi. Điểm được máy chủ chấm và tổng hợp sau trận.</p>
      </div>
      <a class="btn btn--ghost" href="#/solo">${icon('pencil-line')} Làm bài một máy</a>
    </div>

    <div class="live-hub">
      <article class="card live-hub__card live-hub__card--host">
        <span class="live__eyebrow">${icon('users')} Dành cho giáo viên</span>
        <h2 class="live-hub__title">Tạo phòng cho cả lớp</h2>
        ${sets.length ? `
          <label class="field">
            <span>Bộ câu hỏi</span>
            <select class="select" id="live-set">
              ${sets.map(s => `<option value="${s.id}">${esc(s.title || 'Bộ chưa đặt tên')} (${s.questions.length} câu)</option>`).join('')}
            </select>
          </label>
          <p class="muted live-hub__info" id="live-set-info"></p>
          <div class="field">
            <span>Chọn mini-game</span>
            <div class="game-picker" id="game-picker">
              ${games.map(g => `
                <label class="game-pick ${g.id === pickedGame ? 'is-picked' : ''}" style="--team:#7c3aed">
                  <input type="radio" name="live-game" value="${g.id}" ${g.id === pickedGame ? 'checked' : ''} />
                  <span class="game-pick__icon">${icon(g.icon)}</span>
                  <span class="game-pick__body">
                    <strong>${esc(g.name)}</strong>
                    <small>${esc(g.description)}</small>
                  </span>
                </label>`).join('')}
            </div>
          </div>
          <button class="btn btn--primary btn--lg live-hub__submit" data-act="create">${icon('play')} Tạo phòng</button>
          <p class="live-hub__note">${icon('users')} Phòng nhận 2–40 học sinh. Cần chạy <code>node serve.js</code> trên máy giáo viên và mở bằng địa chỉ Wi-Fi của lớp.</p>
        ` : `
          <div class="live-hub__empty">
            <p class="muted">Chưa có bộ câu hỏi nào. Tạo bộ đầu tiên hoặc dùng bộ mẫu để chơi thử.</p>
            <div class="hero__actions">
              <a class="btn btn--primary" href="#/teacher">${icon('pencil-line')} Tạo bộ câu hỏi</a>
              <button class="btn btn--ghost" data-act="sample">${icon('dices')} Dùng bộ mẫu</button>
            </div>
          </div>`}
      </article>

      <article class="card live-hub__card">
        <span class="live__eyebrow">${icon('gamepad-2')} Dành cho học sinh</span>
        <h2 class="live-hub__title">Vào phòng bằng mã</h2>
        <label class="field">
          <span>Mã phòng (5 ký tự)</span>
          <input class="live-hub__code" id="join-code" type="text" maxlength="5" autocomplete="off"
            spellcheck="false" placeholder="VD: A7K2M" aria-label="Mã phòng" />
        </label>
        <button class="btn btn--primary btn--lg live-hub__submit" data-act="join">${icon('arrow-right')} Vào phòng</button>
        <p class="live-hub__note">Hoặc mở link giáo viên gửi. Tên của em sẽ được hỏi ở bước tiếp theo.</p>
        <div class="live-hub__solo">
          <strong>Chỉ có một máy?</strong>
          <p class="muted">Chuyển cả lớp lần lượt trả lời trên màn hình chung.</p>
          <a class="btn btn--ghost btn--sm" href="#/solo">${icon('arrow-right')} Làm bài một máy</a>
        </div>
      </article>
    </div>`;

  const codeInput = app.querySelector('#join-code');

  app.addEventListener('click', async event => {
    const btn = event.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'sample') {
      saveSet(sampleSet());
      toast('Đã thêm bộ câu hỏi mẫu');
      renderLiveHub(app);
    }

    if (act === 'join') {
      const code = normalizeCode(codeInput?.value);
      if (code.length !== 5) {
        toast('Mã phòng gồm 5 ký tự');
        codeInput?.focus();
        return;
      }
      location.hash = `#/room/${code}`;
    }
  });

  if (!sets.length) return;

  const pickSet = app.querySelector('#live-set');
  const setInfo = app.querySelector('#live-set-info');

  // Hiện nhanh số câu và thời lượng của bộ đang chọn
  function updateInfo() {
    const set = getSet(pickSet.value);
    if (!set) { setInfo.textContent = ''; return; }
    const seconds = set.questions.reduce((sum, q) => sum + (Number(q.timeLimit) > 0 ? Number(q.timeLimit) : 30), 0);
    setInfo.textContent = `${set.questions.length} câu hỏi · khoảng ${Math.max(1, Math.round(seconds / 60))} phút nếu mỗi câu dùng hết thời gian.`;
  }

  pickSet.addEventListener('change', updateInfo);
  updateInfo();

  app.querySelector('#game-picker').addEventListener('change', event => {
    const picked = event.target.closest('input[name="live-game"]');
    if (!picked) return;
    pickedGame = picked.value;
    app.querySelectorAll('.game-pick').forEach(el => {
      el.classList.toggle('is-picked', el.querySelector('input')?.checked);
    });
    try { localStorage.setItem('hocvui.live.game', pickedGame); } catch { /* bỏ qua */ }
  });

  app.querySelector('[data-act="create"]').addEventListener('click', async event => {
    const btn = event.currentTarget;
    const set = getSet(pickSet.value);
    if (!set) { toast('Không tìm thấy bộ câu hỏi'); return; }
    if (!set.questions.length) { toast('Bộ câu hỏi đang trống'); return; }

    const gameId = app.querySelector('input[name="live-game"]:checked')?.value || pickedGame;
    btn.disabled = true;
    try {
      const created = await live.createRoom({
        setId: set.id,
        setName: set.title || 'Bộ chưa đặt tên',
        gameId,
        questions: set.questions,
      });
      live.saveHostSession(created.code, created.hostToken);
      toast(`Đã tạo phòng ${created.code}`);
      location.hash = `#/host/${created.code}`;
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  });
}

// ===== Màn giáo viên =====
export function renderHostRoom(app, rawCode) {
  const code = normalizeCode(rawCode);
  const hostToken = live.readHostSession(code);

  if (!code || !hostToken) {
    app.innerHTML = messageHtml({
      iconName: 'circle-x',
      title: 'Máy này không giữ quyền điều khiển phòng',
      text: 'Mã phòng chỉ điều khiển được trên trình duyệt đã tạo phòng. Hãy tạo phòng mới hoặc mở đúng máy giáo viên.',
      code,
    });
    return undefined;
  }

  let snapshot = null;
  let layout = '';
  let gameApi = null;
  let unlisten = null;
  let clock = null;
  let deadline = 0;
  let destroyed = false;
  let leaving = false;
  let connectionLost = false;
  let errorCount = 0;

  app.innerHTML = loadingHtml('Đang kết nối phòng...');

  // ----- Đồng hồ đếm ngược dùng giờ server -----
  function paintClock() {
    const el = app.querySelector('#live-timer');
    if (!el) {
      clearInterval(clock);
      clock = null;
      return;
    }
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    el.innerHTML = `${icon('timer')} ${left}s`;
    el.classList.toggle('is-low', left <= 5);
    if (left <= 0) {
      clearInterval(clock);
      clock = null;
      el.innerHTML = `${icon('timer')} Hết giờ`;
    }
  }

  function syncClock() {
    if (snapshot?.phase !== 'question' || !snapshot.deadlineAt) {
      clearInterval(clock);
      clock = null;
      return;
    }
    const offset = Date.now() - (snapshot.serverNow || Date.now());
    deadline = snapshot.deadlineAt + offset;
    if (!clock) clock = setInterval(paintClock, 250);
    paintClock();
  }

  function stopClock() {
    clearInterval(clock);
    clock = null;
  }

  function destroyGame() {
    try { gameApi?.destroy?.(); } catch { /* bỏ qua */ }
    gameApi = null;
  }

  // ----- Giao diện phòng chờ -----
  function lobbyHtml() {
    const snap = snapshot;
    const players = snap.players;
    const link = live.roomLink(code);
    const ready = players.length >= snap.minPlayers;

    return `
      <div class="live">
        <div class="live__bar">
          <a class="btn btn--ghost btn--sm" href="#/play">${icon('arrow-left')} Chơi cùng lớp</a>
          <div class="live__bar-meta">
            <span class="game__tag">${icon(gameIcon(snap.gameId))} ${esc(snap.gameName)}</span>
            <span class="muted">${esc(snap.setName)} · ${snap.total} câu</span>
          </div>
          <button class="btn btn--ghost btn--sm" data-act="close">${icon('x')} Đóng phòng</button>
        </div>
        ${connectionLost ? `<div class="live-conn">${icon('circle-x')} Mất kết nối tới máy chủ. Đang thử kết nối lại...</div>` : ''}

        <div class="live__lobby">
          <section class="card live__invite">
            <span class="live__eyebrow">Mã phòng</span>
            <div class="live__code">${esc(snap.code)}</div>
            <p class="live__invite-hint">Học sinh mở link này trên điện thoại:</p>
            <div class="live__linkrow">
              <input class="live__link" readonly value="${esc(link)}" aria-label="Link phòng" />
              <button class="btn btn--ghost btn--sm" data-act="copy">${icon('copy')} Sao chép</button>
            </div>
            <p class="muted live__invite-note">Hoặc vào mục <strong>Chơi cùng lớp</strong> và nhập mã phòng.</p>

            <div class="live__invite-stats">
              <div><strong>${players.length}</strong><span>học sinh đã vào</span></div>
              <div><strong>${snap.total}</strong><span>câu hỏi</span></div>
              <div><strong>${snap.gameName}</strong><span>mini-game</span></div>
            </div>

            <button class="btn btn--primary btn--lg live__start" data-act="start" ${ready ? '' : 'disabled'}>
              ${icon('play')} Bắt đầu trận
            </button>
            <p class="muted live__start-hint">
              ${ready ? 'Cả lớp đã sẵn sàng. Bấm để gửi câu hỏi đầu tiên tới tất cả thiết bị.' : `Cần ít nhất ${snap.minPlayers} học sinh để bắt đầu.`}
            </p>
          </section>

          <section class="card live__waiting">
            <div class="live__waiting-head">
              <h2 class="card__title">${icon('users')} Danh sách chờ</h2>
              <span class="live__count">${players.length}/${snap.capacity}</span>
            </div>
            ${players.length ? `
              <div class="live__roster-grid">${rosterChips(players, { lobby: true })}</div>
              <p class="muted live__waiting-hint">Bấm dấu × để xóa một bạn khỏi phòng chờ.</p>
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

  // ----- Giao diện đang chơi -----
  function gameShellHtml() {
    return `
      <div class="live">
        <div class="live__bar" id="live-top"></div>
        ${connectionLost ? `<div class="live-conn" id="live-conn">${icon('circle-x')} Mất kết nối tới máy chủ. Đang thử kết nối lại...</div>` : ''}
        <div class="live__layout">
          <section class="card live__stage">
            <div class="live__game" id="live-game"></div>
          </section>
          <aside class="card live__side" id="live-side"></aside>
        </div>
        <section class="card live__roster-card" id="live-roster"></section>
      </div>`;
  }

  function mountGame() {
    const container = app.querySelector('#live-game');
    if (!container) return;
    gameApi = getGame(snapshot.gameId);
    const goal = snapshot.gameId === 'tug'
      ? Math.max(1, snapshot.total * Math.max(1, snapshot.players.length))
      : Math.max(1, snapshot.total);
    gameApi.init(container, snapshot.players, { totalTurns: snapshot.total, goal });
  }

  function updateTop() {
    const top = app.querySelector('#live-top');
    if (!top) return;
    const snap = snapshot;
    const progress = snap.phase === 'finished' ? 'Đã kết thúc' : `Câu ${Math.max(0, snap.index) + 1}/${snap.total}`;

    let middle = `<div class="live__progress"><strong>${progress}</strong>`;
    if (snap.phase === 'question') {
      middle += `<span class="quiz-timer" id="live-timer" hidden></span>
        <span class="live__answered">${snap.answeredCount}/${snap.players.length} đã trả lời</span>`;
    } else if (snap.phase === 'reveal') {
      middle += `<span class="live__pill live__pill--ok">${icon('check')} Đã chốt đáp án</span>`;
    }
    middle += '</div>';

    let actions = '';
    if (snap.phase === 'question') {
      actions += `<button class="btn btn--primary btn--sm" data-act="reveal">${icon('circle-check')} Chốt đáp án</button>`;
    }
    if (snap.phase === 'reveal') {
      const last = snap.index + 1 >= snap.total;
      actions += `<button class="btn btn--primary btn--sm" data-act="next">${last ? 'Xem tổng kết' : 'Câu tiếp'} ${icon('arrow-right')}</button>`;
    }
    if (snap.phase === 'finished') {
      actions += `<button class="btn btn--primary btn--sm" data-act="restart">${icon('rotate-ccw')} Chơi lại</button>
        <a class="btn btn--ghost btn--sm" href="#/stats">${icon('chart-column')} Tổng hợp điểm</a>`;
    }
    actions += `<button class="btn btn--ghost btn--sm" data-act="close">${icon('x')} Đóng phòng</button>`;

    top.innerHTML = `
      <div class="live__bar-room">
        <span class="live__code live__code--sm">${esc(snap.code)}</span>
        <span class="muted">${esc(snap.gameName)} · ${esc(snap.setName)}</span>
      </div>
      ${middle}
      <div class="live__bar-actions">${actions}</div>`;
  }

  function optionReviewHtml(question, reveal) {
    const counts = reveal?.answerCounts || {};
    if (question.type === 'fill') {
      const answered = Number(counts.fill) || 0;
      if (!reveal) {
        return `<div class="live__fill-wait">${icon('pencil-line')} Học sinh đang nhập câu trả lời trên thiết bị của mình.</div>`;
      }
      return `<div class="live__fill-review">
        <span class="muted">Đáp án đúng</span>
        <strong>${esc(reveal.correctText)}</strong>
        <span class="muted">${answered} bạn đã trả lời bằng chữ</span>
      </div>`;
    }

    return `
      <div class="options options--review ${question.type === 'boolean' ? 'options--boolean' : ''}">
        ${question.options.map((opt, i) => {
          const count = Number(counts[i]) || 0;
          const correct = reveal && reveal.correctIndex === i;
          return `
            <div class="option ${correct ? 'is-correct' : ''}">
              <span class="option__key">${question.type === 'boolean'
                ? icon(i === 0 ? 'circle-check' : 'circle-x')
                : LETTERS[i]}</span>
              <span class="option__text">${esc(opt)}</span>
              ${reveal ? `<span class="option__count">${count} chọn</span>` : ''}
            </div>`;
        }).join('')}
      </div>`;
  }

  function updateSide() {
    const side = app.querySelector('#live-side');
    if (!side) return;
    const snap = snapshot;

    if (snap.phase === 'finished') {
      side.innerHTML = `
        <div class="live__finish">
          <div class="live__trophy">${icon('trophy')}</div>
          <span class="live__eyebrow">Kết thúc trận</span>
          <h2 class="live__finish-title">Tổng hợp điểm</h2>
          <p class="muted">${snap.players.length} học sinh · ${snap.total} câu hỏi · ${esc(snap.gameName)}</p>
          <div class="live-rank">${rankingRows(snap.ranking, snap.winner?.id)}</div>
          <div class="live__finish-actions">
            <button class="btn btn--primary" data-act="restart">${icon('rotate-ccw')} Chơi lại</button>
            <a class="btn btn--ghost" href="#/stats">${icon('chart-column')} Tổng hợp điểm</a>
          </div>
        </div>`;
      return;
    }

    const question = snap.question;
    if (!question) { side.innerHTML = ''; return; }
    const reveal = snap.reveal || null;
    const correctCount = reveal?.results ? reveal.results.filter(r => r.correct).length : 0;

    side.innerHTML = `
      <div class="live__qhead">
        <span class="live__eyebrow">Câu ${snap.index + 1}/${snap.total}</span>
        <span class="live__answered">${snap.answeredCount}/${snap.players.length} đã trả lời</span>
      </div>
      ${question.image ? `<div class="question-image live__qimage"><img src="${esc(question.image)}" alt="Ảnh minh họa câu hỏi" /></div>` : ''}
      <h2 class="question live__question">${esc(question.text)}</h2>
      ${optionReviewHtml(question, reveal)}
      ${reveal ? `
        <div class="feedback feedback--ok live__answer-note">
          ${icon('circle-check')} Đáp án đúng: <strong>${esc(reveal.correctText)}</strong>
          <span class="muted">· ${correctCount}/${snap.players.length} bạn đúng</span>
        </div>` : `
        <p class="muted live__wait-note">${icon('timer')} Hết giờ hoặc đủ đáp án, hệ thống sẽ tự chốt. Giáo viên có thể chốt sớm.</p>`}
    `;
  }

  function updateRoster() {
    const roster = app.querySelector('#live-roster');
    if (!roster) return;
    const snap = snapshot;
    roster.innerHTML = `
      <div class="live__waiting-head">
        <h2 class="card__title">${icon('users')} ${snap.players.length} học sinh</h2>
        <span class="live__count">${snap.phase === 'question' ? `${snap.answeredCount} đã trả lời` : 'Điểm hiện tại'}</span>
      </div>
      <div class="live__roster-grid">${rosterChips(snap.players)}</div>`;
  }

  // Chỉ lưu lịch sử một lần cho mỗi lượt chơi, kể cả khi giáo viên tải lại trang
  function saveFinished() {
    const snap = snapshot;
    if (snap.phase !== 'finished' || !snap.roundId) return;
    const key = `hocvui.live.saved.${snap.roundId}`;
    try { if (sessionStorage.getItem(key)) return; } catch { /* bỏ qua */ }

    const students = snap.ranking.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      correct: p.score,
      total: p.total,
    }));

    saveMatch({
      setId: snap.setId,
      setName: snap.setName,
      gameId: snap.gameId,
      gameName: snap.gameName,
      live: true,
      students,
      winner: snap.winner ? { ...snap.winner } : null,
    });

    try { sessionStorage.setItem(key, '1'); } catch { /* bỏ qua */ }
    playWin();
  }

  function render() {
    if (!snapshot || destroyed) return;

    if (snapshot.phase === 'lobby') {
      if (layout !== 'lobby') {
        layout = 'lobby';
        stopClock();
        destroyGame();
      }
      app.innerHTML = lobbyHtml();
      syncClock();
      return;
    }

    if (layout !== 'game') {
      layout = 'game';
      app.innerHTML = gameShellHtml();
      mountGame();
    }

    updateTop();
    updateSide();
    updateRoster();
    try { gameApi?.sync?.(snapshot.players); } catch { /* game lỗi thì vẫn chạy tiếp */ }
    syncClock();
  }

  async function run(btn, fn) {
    if (btn?.dataset.busy === '1') return;
    if (btn) { btn.dataset.busy = '1'; btn.disabled = true; }
    try {
      await fn();
    } catch (err) {
      toast(err.message);
      if (btn) { btn.disabled = false; delete btn.dataset.busy; }
    }
  }

  async function closeAndLeave() {
    if (!confirm('Đóng phòng và kết thúc trận? Học sinh sẽ được đưa ra khỏi phòng.')) return;
    leaving = true;
    try {
      await live.closeRoom(code, hostToken);
    } catch (err) {
      // Phòng đã bị dọn trước đó thì vẫn cho giáo viên rời màn hình
      if (!/Không tìm thấy phòng/.test(err.message)) {
        leaving = false;
        toast(err.message);
        return;
      }
    }
    destroyed = true;
    live.clearHostSession(code);
    location.hash = '#/play';
  }

  const onClick = event => {
    const btn = event.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'copy') {
      live.copyText(live.roomLink(code)).then(ok => {
        toast(ok ? 'Đã sao chép link phòng' : 'Không sao chép được. Hãy chọn link và sao chép thủ công.');
      });
      return;
    }
    if (act === 'start') {
      run(btn, () => live.startRoom(code, hostToken));
      return;
    }
    if (act === 'reveal') {
      run(btn, () => live.revealRoom(code, hostToken));
      return;
    }
    if (act === 'next') {
      run(btn, () => live.nextRoom(code, hostToken));
      return;
    }
    if (act === 'restart') {
      run(btn, () => live.restartRoom(code, hostToken));
      return;
    }
    if (act === 'close') {
      closeAndLeave();
      return;
    }
    if (act === 'remove') {
      const name = btn.closest('.live-player')?.querySelector('.live-player__name')?.textContent || 'học sinh này';
      if (!confirm(`Xóa ${name} khỏi phòng chờ?`)) return;
      run(btn, () => live.removePlayer(code, hostToken, btn.dataset.id));
      return;
    }
    if (act === 'fullscreen') {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      } catch {
        toast('Trình duyệt không cho phép toàn màn hình');
      }
    }
  };

  app.addEventListener('click', onClick);

  unlisten = live.watchRoom(code, {
    hostToken,
    onUpdate: data => {
      snapshot = data;
      connectionLost = false;
      errorCount = 0;
      saveFinished();
      render();
    },
    onClosed: () => {
      if (destroyed || leaving) return;
      destroyed = true;
      stopClock();
      destroyGame();
      live.clearHostSession(code);
      app.innerHTML = messageHtml({
        iconName: 'circle-x',
        title: 'Phòng đã đóng',
        text: 'Giáo viên đã đóng phòng hoặc phòng hết thời gian chờ. Hãy tạo phòng mới để chơi tiếp.',
        code,
      });
    },
    onOpen: () => {
      connectionLost = false;
      errorCount = 0;
      const banner = app.querySelector('#live-conn');
      if (banner) banner.remove();
    },
    onError: () => {
      connectionLost = true;
      errorCount += 1;
      const banner = app.querySelector('#live-conn');
      if (banner) banner.hidden = false;
      if (errorCount === 5) {
        live.roomInfo(code).catch(() => {
          if (destroyed) return;
          destroyed = true;
          stopClock();
          destroyGame();
          live.clearHostSession(code);
          app.innerHTML = messageHtml({
            iconName: 'circle-x',
            title: 'Không kết nối được phòng',
            text: 'Máy chủ có thể đã khởi động lại. Phòng trong bộ nhớ đã mất; hãy tạo phòng mới.',
            code,
          });
        });
      }
    },
  });

  return () => {
    destroyed = true;
    stopClock();
    if (unlisten) unlisten();
    destroyGame();
    app.removeEventListener('click', onClick);
  };
}

// ===== Màn học sinh =====
export function renderPlayerRoom(app, rawCode) {
  const code = normalizeCode(rawCode);
  let session = live.readPlayerSession(code);
  let snapshot = null;
  let unlisten = null;
  let clock = null;
  let deadline = 0;
  let destroyed = false;
  let joined = false;
  let answering = false;
  let fillDraft = '';
  let lastBodyKey = '';
  let lastResultKey = '';
  let lastWinKey = '';
  let connectionLost = false;
  let errorCount = 0;

  if (!code) {
    app.innerHTML = messageHtml({
      iconName: 'gamepad-2',
      title: 'Thiếu mã phòng',
      text: 'Hãy nhập mã phòng ở trang Chơi cùng lớp, hoặc mở link giáo viên đã gửi.',
    });
    return undefined;
  }

  app.innerHTML = loadingHtml('Đang kiểm tra phòng...');

  function stopClock() {
    clearInterval(clock);
    clock = null;
  }

  function paintClock() {
    const el = app.querySelector('#student-timer');
    if (!el) {
      stopClock();
      return;
    }
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    el.hidden = false;
    el.innerHTML = `${icon('timer')} ${left}s`;
    el.classList.toggle('is-low', left <= 5);
    if (left <= 0) {
      stopClock();
      el.innerHTML = `${icon('timer')} Hết giờ`;
      lockAnswerControls();
    }
  }

  // Khóa đáp án ngay trên màn hình khi hết giờ, không chờ server chốt
  function lockAnswerControls() {
    app.querySelectorAll('[data-oi]').forEach(el => { el.disabled = true; });
    const input = app.querySelector('#student-fill');
    const submit = app.querySelector('#student-fill-form .fill__submit');
    if (input) input.disabled = true;
    if (submit) submit.disabled = true;
  }

  function syncClock() {
    if (snapshot?.phase !== 'question' || !snapshot.deadlineAt) {
      stopClock();
      return;
    }
    const offset = Date.now() - (snapshot.serverNow || Date.now());
    deadline = snapshot.deadlineAt + offset;
    if (!clock) clock = setInterval(paintClock, 250);
    paintClock();
  }

  function updateConnection() {
    const el = app.querySelector('#student-conn');
    if (el) el.hidden = !connectionLost;
  }

  function setMessage({ iconName = 'circle-x', title, text }) {
    stopClock();
    app.innerHTML = messageHtml({ iconName, title, text, code });
  }

  // ----- Các màn hình -----
  function barHtml(snap, me) {
    return `
      <header class="student-live__bar">
        <div class="student-live__room">
          <span class="live__code live__code--sm">${esc(snap.code)}</span>
          <span class="muted">${esc(snap.gameName)}</span>
        </div>
        <div class="student-live__me">
          <span class="student-live__dot" style="--team:${me.color}"></span>
          <strong>${esc(me.name)}</strong>
          ${snap.phase !== 'lobby' ? `<span class="student-live__score">${me.score}/${snap.total}</span>` : ''}
        </div>
      </header>
      <div class="live-conn" id="student-conn" ${connectionLost ? '' : 'hidden'}>
        ${icon('circle-x')} Mất kết nối. Đang thử kết nối lại...
      </div>`;
  }

  function lobbyBody(snap, me) {
    return `
      <section class="card student-live__wait">
        <div class="student-live__avatar" style="--team:${me.color}">${initial(me.name)}</div>
        <span class="live__eyebrow">Đã vào phòng</span>
        <h1 class="student-live__title">${esc(me.name)}</h1>
        <p class="muted">Chờ giáo viên bắt đầu. Giữ trang này mở và kết nối Wi-Fi nhé!</p>
        <div class="student-live__codebox">Mã phòng <strong>${esc(snap.code)}</strong></div>
        <div class="student-live__waitmeta">
          <span>${icon('users')} ${snap.players.length}/${snap.capacity} bạn đã vào</span>
          <span>${icon(gameIcon(snap.gameId))} ${esc(snap.gameName)}</span>
          <span>${icon('book-open')} ${snap.total} câu hỏi</span>
        </div>
        <div class="student-live__roster">${rosterChips(snap.players)}</div>
        <a class="btn btn--ghost btn--sm" href="#/play">Rời màn hình</a>
      </section>`;
  }

  function questionOptionsHtml(snap, me) {
    const q = snap.question;
    const answered = !!me.answered;
    const reveal = snap.reveal;

    if (q.type === 'fill') {
      if (snap.phase === 'question') {
        return `
          <form class="fill student-live__fill" id="student-fill-form" autocomplete="off">
            <input class="fill__input" id="student-fill" type="text" maxlength="120"
              placeholder="${answered ? 'Đã gửi câu trả lời' : 'Nhập câu trả lời...'}"
              value="${answered ? '' : esc(fillDraft)}" ${answered ? 'disabled' : ''} aria-label="Câu trả lời" />
            <button class="btn btn--primary fill__submit" type="submit" ${answered ? 'disabled' : ''}>
              ${icon('arrow-right')} Gửi
            </button>
          </form>
          <p class="muted student-live__hint">${answered
            ? `${icon('check')} Đã gửi. Chờ công bố đáp án.`
            : 'Không phân biệt hoa/thường và khoảng trắng thừa.'}</p>`;
      }

      const own = me.result?.answer;
      return `
        <div class="student-live__fill-review">
          <div class="${me.result?.correct ? 'is-correct' : 'is-wrong'}">
            <span class="muted">Em trả lời</span>
            <strong>${own ? esc(own) : 'Không trả lời'}</strong>
          </div>
          <div class="is-correct">
            <span class="muted">Đáp án đúng</span>
            <strong>${esc(reveal?.correctText || '')}</strong>
          </div>
        </div>`;
    }

    const ownChoice = me.result?.answer;
    return `
      <div class="options ${q.type === 'boolean' ? 'options--boolean' : ''}"
        ${snap.phase === 'question' ? 'id="student-options"' : ''}>
        ${q.options.map((opt, i) => {
          if (snap.phase === 'question') {
            return `
              <button class="option ${q.type === 'boolean' ? 'option--boolean' : ''}" data-oi="${i}" ${me.answered ? 'disabled' : ''}>
                <span class="option__key">${q.type === 'boolean'
                  ? icon(i === 0 ? 'circle-check' : 'circle-x')
                  : LETTERS[i]}</span>
                <span class="option__text">${esc(opt)}</span>
              </button>`;
          }
          const isCorrect = reveal?.correctIndex === i;
          const isWrong = ownChoice === i && !isCorrect;
          return `
            <div class="option ${isCorrect ? 'is-correct' : ''} ${isWrong ? 'is-wrong' : ''}">
              <span class="option__key">${q.type === 'boolean'
                ? icon(i === 0 ? 'circle-check' : 'circle-x')
                : LETTERS[i]}</span>
              <span class="option__text">${esc(opt)}</span>
              ${isCorrect ? `<span class="option__count">${icon('check')}</span>` : ''}
            </div>`;
        }).join('')}
      </div>`;
  }

  function roundBody(snap, me) {
    const q = snap.question;
    if (!q) return '';
    const reveal = snap.reveal;
    const isReveal = snap.phase === 'reveal';
    const correct = me.result?.correct;

    let feedback = '';
    if (!isReveal) {
      feedback = me.answered
        ? `<div class="feedback feedback--wait">${icon('check')} Đã gửi câu trả lời. Chờ giáo viên công bố đáp án.</div>`
        : `<p class="muted student-live__hint">${icon('timer')} Chọn đáp án rồi bấm gửi. Hết giờ hệ thống tự chốt.</p>`;
    } else if (correct) {
      feedback = `<div class="feedback feedback--ok">${icon('circle-check')} Chính xác! Em được cộng 1 điểm.</div>`;
    } else if (me.result?.answer === null || me.result?.answer === undefined) {
      feedback = `<div class="feedback feedback--bad">${icon('timer')} Hết giờ! Đáp án đúng là <strong>${esc(reveal?.correctText || '')}</strong>.</div>`;
    } else {
      feedback = `<div class="feedback feedback--bad">${icon('circle-x')} Chưa đúng. Đáp án đúng là <strong>${esc(reveal?.correctText || '')}</strong>.</div>`;
    }

    return `
      <div class="student-live__round">
        <div class="student-live__roundbar">
          <span class="student-live__progress">Câu ${snap.index + 1}/${snap.total}</span>
          <span class="quiz-timer" id="student-timer" hidden></span>
        </div>
        <section class="card student-live__qcard">
          <p class="live__eyebrow">${esc(snap.setName)}</p>
          ${q.image ? `<div class="question-image"><img src="${esc(q.image)}" alt="Ảnh minh họa câu hỏi" /></div>` : ''}
          <h1 class="question student-live__question">${esc(q.text)}</h1>
          ${questionOptionsHtml(snap, me)}
          ${feedback}
          ${isReveal ? `<p class="muted student-live__waitnext">${icon('timer')} Chờ giáo viên chuyển câu tiếp theo...</p>` : ''}
        </section>
      </div>`;
  }

  function finishedBody(snap, me) {
    return `
      <section class="card student-live__finish">
        <div class="student-live__trophy">${icon('trophy')}</div>
        <span class="live__eyebrow">Kết thúc trận</span>
        <h1 class="student-live__title">${me.rank === 1 ? 'Em đứng nhất!' : 'Hoàn thành!'}</h1>
        <p class="muted">${esc(me.name)} · ${me.score}/${snap.total} câu đúng · Hạng ${me.rank}/${snap.ranking.length}</p>
        <div class="live-rank">${rankingRows(snap.ranking, me.id)}</div>
        <p class="muted student-live__note">Điểm đã được gửi tới giáo viên và tổng hợp cùng cả lớp.</p>
        <div class="student-live__finish-actions">
          <a class="btn btn--primary" href="#/play">${icon('gamepad-2')} Về trang chơi</a>
          <a class="btn btn--ghost" href="#/">${icon('house')} Trang chủ</a>
        </div>
      </section>`;
  }

  function paintPlayer() {
    if (!snapshot || destroyed) return;
    const snap = snapshot;
    const me = snap.me;

    if (!me) {
      live.clearPlayerSession(code);
      joined = false;
      setMessage({
        iconName: 'circle-x',
        title: 'Em không còn trong phòng',
        text: 'Giáo viên đã xóa tên em hoặc phiên vào phòng đã hết. Hãy vào lại bằng mã phòng.',
      });
      return;
    }

    // Âm thanh phản hồi mỗi khi server công bố kết quả
    if (snap.phase === 'reveal' && snap.me.result) {
      const key = `${snap.roundId || ''}:${snap.index}`;
      if (lastResultKey !== key) {
        lastResultKey = key;
        if (snap.me.result.correct) playCorrect();
        else playWrong();
      }
    }
    if (snap.phase === 'finished') {
      const key = `win:${snap.roundId || ''}`;
      if (lastWinKey !== key) {
        lastWinKey = key;
        playWin();
      }
    }

    const bodyKey = snap.phase === 'lobby'
      ? `lobby:${snap.players.map(p => p.id).join(',')}`
      : `${snap.phase}:${snap.index}:${snap.roundId || ''}:${snap.me.answered ? 1 : 0}:${snap.me.result?.correct ? 1 : 0}`;

    if (bodyKey !== lastBodyKey) {
      lastBodyKey = bodyKey;
      const body = snap.phase === 'lobby'
        ? lobbyBody(snap, me)
        : snap.phase === 'finished'
          ? finishedBody(snap, me)
          : roundBody(snap, me);
      app.innerHTML = `
        <div class="student-live">
          ${barHtml(snap, me)}
          <main class="student-live__main">${body}</main>
        </div>`;
    }

    updateConnection();
    syncClock();
  }

  // ----- Gửi câu trả lời -----
  async function submitAnswer(value) {
    if (answering || !snapshot || snapshot.phase !== 'question') return;
    if (snapshot.me?.answered) return;

    answering = true;
    lockAnswerControls();
    const hint = app.querySelector('.student-live__hint');
    if (hint) hint.textContent = 'Đang gửi câu trả lời...';

    try {
      await live.answerRoom(code, session.token, snapshot.index, value);
      fillDraft = '';
    } catch (err) {
      toast(err.message);
      answering = false;
      // Tải lại trạng thái mới nhất nếu server đã chốt hoặc đã nhận đáp án
      paintPlayer();
    }
  }

  const onClick = event => {
    const btn = event.target.closest('[data-oi]');
    if (!btn || snapshot?.phase !== 'question' || snapshot?.me?.answered) return;
    submitAnswer(Number(btn.dataset.oi));
  };

  const onSubmit = event => {
    if (event.target.id !== 'student-fill-form') return;
    event.preventDefault();
    if (snapshot?.phase !== 'question' || snapshot?.me?.answered) return;
    const input = event.target.querySelector('#student-fill');
    const value = input?.value.trim() || '';
    if (!value) {
      toast('Hãy nhập câu trả lời');
      input?.focus();
      return;
    }
    fillDraft = input.value;
    submitAnswer(value);
  };

  const onInput = event => {
    if (event.target.id === 'student-fill') fillDraft = event.target.value;
  };

  app.addEventListener('click', onClick);
  app.addEventListener('submit', onSubmit);
  app.addEventListener('input', onInput);

  // ----- Vào phòng / kết nối -----
  function connect() {
    if (unlisten) unlisten();
    unlisten = live.watchRoom(code, {
      playerToken: session.token,
      onUpdate: data => {
        joined = true;
        answering = false;
        snapshot = data;
        connectionLost = false;
        errorCount = 0;
        paintPlayer();
      },
      onClosed: () => {
        if (destroyed) return;
        live.clearPlayerSession(code);
        setMessage({
          iconName: 'circle-x',
          title: 'Phòng đã đóng',
          text: 'Giáo viên đã kết thúc phòng. Hãy vào phòng mới khi giáo viên tạo lại.',
        });
      },
      onOpen: () => {
        connectionLost = false;
        errorCount = 0;
        updateConnection();
      },
      onError: () => {
        connectionLost = true;
        errorCount += 1;
        updateConnection();
        if (errorCount === 5) {
          live.roomInfo(code).catch(() => {
            if (destroyed) return;
            live.clearPlayerSession(code);
            setMessage({
              iconName: 'circle-x',
              title: 'Không kết nối được phòng',
              text: 'Máy chủ có thể đã khởi động lại. Hãy nhờ giáo viên tạo phòng mới.',
            });
          });
        }
      },
    });
  }

  function joinFormHtml(info) {
    return `
      <div class="student-live student-live--join">
        <section class="card student-live__join">
          <span class="live__eyebrow">${icon('gamepad-2')} Phòng ${esc(code)}</span>
          <h1 class="student-live__title">${esc(info.gameName)}</h1>
          <p class="muted">${esc(info.setName)} · ${info.players}/${info.capacity} bạn đã vào</p>
          <form id="join-form" class="student-live__joinform" autocomplete="off">
            <label class="field">
              <span>Tên của em</span>
              <input id="join-name" type="text" maxlength="20" placeholder="VD: Minh Anh" aria-label="Tên của em" />
            </label>
            <button class="btn btn--primary btn--lg" type="submit">${icon('arrow-right')} Vào phòng</button>
          </form>
          <p class="muted student-live__note">Tên không được trùng với bạn khác trong phòng.</p>
          <a class="btn btn--ghost btn--sm" href="#/play">${icon('arrow-left')} Về trang chơi</a>
        </section>
      </div>`;
  }

  const onJoinSubmit = async event => {
    if (event.target.id !== 'join-form') return;
    event.preventDefault();
    const input = event.target.querySelector('#join-name');
    const name = input?.value.trim().replace(/\s+/g, ' ') || '';
    if (!name) {
      toast('Hãy nhập tên của em');
      input?.focus();
      return;
    }
    const btn = event.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
      const result = await live.joinRoom(code, name);
      session = { id: result.playerId, token: result.playerToken, name };
      live.savePlayerSession(code, session);
      joinFormCleanup();
      app.innerHTML = loadingHtml('Đã vào phòng. Đang chờ giáo viên...');
      connect();
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  };

  function joinFormCleanup() {
    app.removeEventListener('submit', onJoinSubmit);
  }

  async function start() {
    try {
      const info = await live.roomInfo(code);
      if (destroyed) return;

      // Có phiên cũ thì thử vào lại đúng chỗ, kể cả khi trận đã bắt đầu
      if (session?.token) {
        try {
          const result = await live.joinRoom(code, session.name, session.token);
          session = { id: result.playerId, token: result.playerToken, name: session.name };
          live.savePlayerSession(code, session);
          app.innerHTML = loadingHtml('Đang vào lại phòng...');
          connect();
          return;
        } catch {
          live.clearPlayerSession(code);
          session = null;
        }
      }

      if (info.phase !== 'lobby') {
        setMessage({
          iconName: 'timer',
          title: 'Phòng đã bắt đầu',
          text: 'Trận đang diễn ra hoặc đã kết thúc. Hãy nhờ giáo viên mở phòng mới nếu em vào muộn.',
        });
        return;
      }

      app.innerHTML = joinFormHtml(info);
      app.addEventListener('submit', onJoinSubmit);
      app.querySelector('#join-name')?.focus();
    } catch (err) {
      live.clearPlayerSession(code);
      setMessage({
        iconName: 'gamepad-2',
        title: 'Không tìm thấy phòng',
        text: err.message,
      });
    }
  }

  start();

  return () => {
    destroyed = true;
    stopClock();
    if (unlisten) unlisten();
    joinFormCleanup();
    app.removeEventListener('click', onClick);
    app.removeEventListener('submit', onSubmit);
    app.removeEventListener('input', onInput);
  };
}
