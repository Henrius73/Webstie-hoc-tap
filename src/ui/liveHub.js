// Trang "Chơi cùng lớp": giáo viên đăng nhập, chọn bộ câu hỏi và tạo phòng;
// học sinh nhập mã phòng + tên để vào chơi trên thiết bị của mình.
import { esc, toast } from '../utils.js';
import { icon } from '../icons.js';
import { getSets } from '../store.js';
import {
  isConfigured, ensureTeacher, teacherSignIn, signOut, onAuthChange,
} from '../lib/supabase.js';
import {
  listQuizzes, importQuizSet, deleteQuiz, createRoom, friendlyError,
} from '../net/api.js';
import { normalizeCode, setupHtml } from './shared.js';

const NAME_KEY = code => `hocvui.supabase.name.${code}`;

function pageHead() {
  return `
    <div class="page-head">
      <div>
        <h1 class="page-title">Chơi cùng lớp</h1>
        <p class="page-sub">Mỗi học sinh dùng một thiết bị. Giáo viên điều khiển ván chơi,
          máy chủ chấm điểm và cả lớp cùng thấy một câu hỏi tại một thời điểm.</p>
      </div>
      <a class="btn btn--ghost" href="#/solo">${icon('pencil-line')} Làm bài một máy</a>
    </div>`;
}

function studentCardHtml(disabled) {
  return `
    <article class="card live-hub__card">
      <span class="live__eyebrow">${icon('gamepad-2')} Dành cho học sinh</span>
      <h2 class="live-hub__title">Vào phòng bằng mã</h2>
      <form id="student-join" class="student-join" autocomplete="off">
        <label class="field">
          <span>Mã phòng (6 số)</span>
          <input id="student-code" type="text" inputmode="numeric" maxlength="6" required
            placeholder="123456" ${disabled ? 'disabled' : ''} />
        </label>
        <label class="field">
          <span>Tên của em</span>
          <input id="student-name" type="text" maxlength="20" required
            placeholder="Ví dụ: Minh Anh" autocomplete="nickname" ${disabled ? 'disabled' : ''} />
        </label>
        <button class="btn btn--primary btn--lg live-hub__submit" type="submit" ${disabled ? 'disabled' : ''}>
          ${icon('arrow-right')} Vào phòng
        </button>
      </form>
      <p class="live-hub__note">${icon('users')} Không cần tài khoản. Tên trùng nhau vẫn chơi được,
        nhưng nên dùng tên khác để dễ phân biệt trên bảng xếp hạng.</p>
      <div class="live-hub__solo">
        <a class="btn btn--ghost btn--sm" href="#/solo">${icon('play')} Làm bài một mình trên máy này</a>
      </div>
    </article>`;
}

export function renderLiveHub(app) {
  let destroyed = false;
  let authCleanup = null;

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    try { authCleanup?.(); } catch { /* bỏ qua */ }
    app.removeEventListener('submit', onSubmit);
    app.removeEventListener('click', onClick);
  };

  if (!isConfigured) {
    app.innerHTML = `${pageHead()}${setupHtml()}`;
    return cleanup;
  }

  app.innerHTML = `
    ${pageHead()}
    <div class="live-hub">
      <article class="card live-hub__card live-hub__card--host" id="hub-teacher">
        <span class="live__eyebrow">${icon('graduation-cap')} Dành cho giáo viên</span>
        <h2 class="live-hub__title">Tạo phòng cho cả lớp</h2>
        <p class="muted">Đang kiểm tra đăng nhập...</p>
      </article>
      ${studentCardHtml(false)}
    </div>`;

  // ====== Thẻ giáo viên ======
  function renderTeacherLoading() {
    const card = app.querySelector('#hub-teacher');
    if (card) card.innerHTML = `
      <span class="live__eyebrow">${icon('graduation-cap')} Dành cho giáo viên</span>
      <h2 class="live-hub__title">Tạo phòng cho cả lớp</h2>
      <p class="muted">Đang kiểm tra đăng nhập...</p>`;
  }

  function renderTeacherLogin(message = '') {
    const card = app.querySelector('#hub-teacher');
    if (!card) return;
    card.innerHTML = `
      <span class="live__eyebrow">${icon('graduation-cap')} Dành cho giáo viên</span>
      <h2 class="live-hub__title">Đăng nhập bằng email</h2>
      <p class="muted">Giáo viên cần tài khoản thật để lưu bộ câu hỏi và điều khiển phòng.
        Chúng tôi gửi một link đăng nhập tới email, không cần mật khẩu.</p>
      ${message ? `<div class="feedback feedback--ok">${icon('mail')} ${esc(message)}</div>` : ''}
      <form id="teacher-login" class="teacher-login" autocomplete="on">
        <label class="field">
          <span>Email giáo viên</span>
          <input id="teacher-email" type="email" name="email" required maxlength="160"
            placeholder="giao.vien@truong.edu.vn" autocomplete="email" />
        </label>
        <button class="btn btn--primary btn--lg" type="submit">${icon('mail')} Gửi link đăng nhập</button>
      </form>
      <p class="live-hub__note">${icon('circle-check')} Sau khi bấm link trong email, trang này tự mở lại
        và hiện danh sách bộ câu hỏi của bạn.</p>`;
  }

  function quizRowHtml(quiz) {
    return `
      <li class="quiz-row" data-quiz="${esc(quiz.id)}">
        <div class="quiz-row__body">
          <strong>${esc(quiz.title)}</strong>
          <small>${quiz.count} câu · ${new Date(quiz.createdAt).toLocaleDateString('vi-VN')}</small>
        </div>
        <div class="quiz-row__actions">
          <button class="btn btn--primary btn--sm" data-act="create-room" data-id="${esc(quiz.id)}">
            ${icon('play')} Tạo phòng
          </button>
          <button class="btn btn--ghost btn--sm quiz-row__delete" data-act="delete-quiz" data-id="${esc(quiz.id)}"
            title="Xóa bộ câu hỏi" aria-label="Xóa bộ câu hỏi">${icon('trash-2')}</button>
        </div>
      </li>`;
  }

  function quizPanelHtml(user, quizzes, localSets) {
    return `
      <div class="teacher-who">
        <span>${icon('circle-check')} Đã đăng nhập: <strong>${esc(user.email || 'giáo viên')}</strong></span>
        <button class="btn btn--ghost btn--sm" data-act="sign-out">${icon('log-out')} Đăng xuất</button>
      </div>

      <div class="quiz-panel">
        <div class="live__waiting-head">
          <h3 class="card__title">${icon('list-checks')} Bộ câu hỏi trực tuyến</h3>
          <button class="btn btn--ghost btn--sm" data-act="refresh-quizzes">${icon('refresh-cw')} Làm mới</button>
        </div>
        ${quizzes.length ? `
          <ul class="quiz-list">${quizzes.map(quizRowHtml).join('')}</ul>
        ` : `
          <div class="live-hub__empty">
            <p class="muted">Chưa có bộ câu hỏi nào trên Supabase. Đăng bộ đang lưu trên máy này lên để bắt đầu.</p>
          </div>
        `}
      </div>

      <div class="quiz-import">
        <div class="live__waiting-head">
          <h3 class="card__title">${icon('cloud-upload')} Đăng bộ câu hỏi từ máy này</h3>
        </div>
        ${localSets.length ? `
          <label class="field">
            <span>Bộ câu hỏi đang lưu trên trình duyệt</span>
            <select class="select" id="hub-local-set">
              ${localSets.map(set => `<option value="${esc(set.id)}">${esc(set.title || 'Bộ chưa đặt tên')} (${set.questions.length} câu)</option>`).join('')}
            </select>
          </label>
          <button class="btn btn--ghost" data-act="import-set">${icon('cloud-upload')} Đăng lên Supabase</button>
          <p class="live-hub__note">Chỉ câu trắc nghiệm 4 đáp án được đưa lên phòng trực tuyến.
            Câu đúng/sai và điền từ vẫn dùng được ở chế độ Làm bài một máy.</p>
        ` : `
          <p class="muted">Trên máy này chưa có bộ câu hỏi nào.
            Vào <a href="#/teacher">Tạo câu hỏi</a> để soạn hoặc nhập Excel trước.</p>
        `}
      </div>`;
  }

  async function loadTeacherCard() {
    if (destroyed) return;
    renderTeacherLoading();

    let user;
    try {
      user = await ensureTeacher();
    } catch (err) {
      renderTeacherLogin();
      toast(friendlyError(err));
      return;
    }
    if (destroyed) return;

    if (!user) { renderTeacherLogin(); return; }

    const card = app.querySelector('#hub-teacher');
    if (card) {
      card.innerHTML = `
        <span class="live__eyebrow">${icon('graduation-cap')} Dành cho giáo viên</span>
        <h2 class="live-hub__title">Tạo phòng cho cả lớp</h2>
        <p class="muted">Đang tải bộ câu hỏi...</p>`;
    }

    let quizzes = [];
    try {
      quizzes = await listQuizzes();
    } catch (err) {
      if (destroyed) return;
      toast(friendlyError(err));
    }

    if (destroyed) return;
    const target = app.querySelector('#hub-teacher');
    if (!target) return;
    target.innerHTML = `
      <span class="live__eyebrow">${icon('graduation-cap')} Dành cho giáo viên</span>
      <h2 class="live-hub__title">Tạo phòng cho cả lớp</h2>
      ${quizPanelHtml(user, quizzes, getSets())}`;
  }

  // ====== Hành động ======
  async function handleTeacherLogin(form) {
    const input = form.querySelector('#teacher-email');
    const button = form.querySelector('button[type="submit"]');
    const email = String(input?.value || '').trim();
    if (!email) return;

    if (button) button.disabled = true;
    try {
      await teacherSignIn(email, `${location.origin}${location.pathname}#/play`);
      if (destroyed) return;
      renderTeacherLogin(`Đã gửi link đăng nhập tới ${email}. Hãy mở email trên chính máy này và bấm link.`);
    } catch (err) {
      if (button) button.disabled = false;
      toast(friendlyError(err));
    }
  }

  async function createRoomFrom(button, quizId) {
    if (button?.dataset.busy === '1') return;
    if (button) { button.dataset.busy = '1'; button.disabled = true; }
    try {
      const room = await createRoom(quizId);
      if (destroyed) return;
      location.hash = `#/host/${room.code}`;
    } catch (err) {
      if (button) { button.disabled = false; delete button.dataset.busy; }
      toast(friendlyError(err));
    }
  }

  async function importSetFrom(button) {
    const select = app.querySelector('#hub-local-set');
    const setId = select?.value;
    const set = getSets().find(item => item.id === setId);
    if (!set) { toast('Hãy chọn một bộ câu hỏi'); return; }

    if (button?.dataset.busy === '1') return;
    if (button) { button.dataset.busy = '1'; button.disabled = true; }
    try {
      const result = await importQuizSet(set);
      if (destroyed) return;
      const skipped = result.skipped ? ` Bỏ qua ${result.skipped} câu không phải trắc nghiệm 4 đáp án.` : '';
      toast(`Đã đăng ${result.imported} câu hỏi.${skipped}`);
      await loadTeacherCard();
    } catch (err) {
      if (button) { button.disabled = false; delete button.dataset.busy; }
      toast(friendlyError(err));
    }
  }

  const onSubmit = event => {
    if (event.target.id === 'teacher-login') {
      event.preventDefault();
      handleTeacherLogin(event.target);
      return;
    }

    if (event.target.id === 'student-join') {
      event.preventDefault();
      const form = event.target;
      const code = normalizeCode(form.querySelector('#student-code')?.value);
      const name = String(form.querySelector('#student-name')?.value || '').replace(/\s+/g, ' ').trim().slice(0, 20);

      if (!/^\d{6}$/.test(code)) { toast('Mã phòng gồm đúng 6 chữ số'); return; }
      if (!name) { toast('Hãy nhập tên của em'); return; }

      try { localStorage.setItem(NAME_KEY(code), name); } catch { /* bỏ qua */ }
      location.hash = `#/room/${code}`;
    }
  };

  const onClick = async event => {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    const action = button.dataset.act;

    if (action === 'sign-out') {
      button.disabled = true;
      try {
        await signOut();
        if (!destroyed) { renderTeacherLogin(); toast('Đã đăng xuất'); }
      } catch (err) {
        button.disabled = false;
        toast(friendlyError(err));
      }
      return;
    }

    if (action === 'refresh-quizzes') { loadTeacherCard(); return; }
    if (action === 'create-room') { createRoomFrom(button, button.dataset.id); return; }
    if (action === 'import-set') { importSetFrom(button); return; }

    if (action === 'delete-quiz') {
      if (!confirm('Xóa bộ câu hỏi này khỏi Supabase? Không xóa được nếu đã có phòng sử dụng bộ này.')) return;
      button.disabled = true;
      try {
        await deleteQuiz(button.dataset.id);
        if (destroyed) return;
        toast('Đã xóa bộ câu hỏi');
        await loadTeacherCard();
      } catch (err) {
        button.disabled = false;
        toast(friendlyError(err));
      }
    }
  };

  app.addEventListener('submit', onSubmit);
  app.addEventListener('click', onClick);

  // Magic link quay về trang này: khi phiên đổi, tải lại thẻ giáo viên.
  authCleanup = onAuthChange((event) => {
    if (destroyed) return;
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      loadTeacherCard();
    }
  });

  loadTeacherCard();

  return cleanup;
}
