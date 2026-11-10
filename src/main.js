// Điểm vào ứng dụng: hash routing + các trang (trang chủ, giáo viên, thiết lập, chơi)
import { getSets, getSet, saveSet, deleteSet, blankSet, blankQuestion, sampleSet } from './store.js';
import { esc, toast } from './utils.js';
import { parseCsvQuestions } from './csv.js';
import { parseXlsxQuestions, buildXlsxWorkbook } from './xlsx.js';
import { createQuiz } from './quizEngine.js';
import { getGame, listGames } from './games/index.js';
import { icon } from './icons.js';
import { getHistory, saveMatch, clearHistory, summarize, formatDate } from './stats.js';
import { playCorrect, playWrong, playWin, isMuted, toggleMuted } from './sound.js';

const app = document.getElementById('app');
const STUDENT_COLORS = ['#7c3aed', '#db2777', '#0284c7', '#d97706', '#059669', '#dc2626', '#0891b2', '#9333ea'];
const MAX_STUDENTS = 40;
// Người chơi đại diện cả lớp trên đường đua
const CLASS_PLAYER = { id: 'class', name: 'Cả lớp', color: '#7c3aed' };
const MATCH_KEY = 'hocvui.match.v1';

let cleanupPage = null;

// ===== Trang chủ =====
function renderHome() {
  const sets = getSets();
  const totalQuestions = sets.reduce((n, s) => n + s.questions.length, 0);
  const history = getHistory();

  app.innerHTML = `
    <section class="hero">
      <div>
        <span class="hero__eyebrow">${icon('sparkles')} Học mà chơi · Chơi mà học</span>
        <h1>Lớp học sôi động cùng <em>mini-game</em> đấu trí</h1>
        <p>Giáo viên tạo bộ câu hỏi trắc nghiệm trong vài phút. Học sinh nhập tên để tham gia,
          cả lớp cùng trả lời và tiến về đích — kiến thức vào đầu, tiếng cười ở lại lớp.</p>
        <div class="hero__actions">
          <a class="btn btn--primary btn--lg" href="#/teacher">${icon('pencil-line')} Tạo bộ câu hỏi</a>
          <a class="btn btn--ghost btn--lg" href="#/play">${icon('gamepad-2')} Vào chơi ngay</a>
        </div>
      </div>
      <div class="hero__art">
        <span class="hero__spark hero__spark--a">${icon('star')}</span>
        <span class="hero__spark hero__spark--b">${icon('target')}</span>
        <div class="mock">
          <span class="mock__team">${icon('car')} Minh Anh · Lượt của bạn</span>
          <div class="mock__q">Hành tinh nào gần Mặt Trời nhất?</div>
          <div class="mock__opts">
            <span>Kim Tinh</span>
            <span class="is-pick">${icon('check')} Thủy Tinh</span>
            <span>Hỏa Tinh</span>
            <span>Mộc Tinh</span>
          </div>
          <div class="mock__track">
            <span class="mock__car" style="left:62%">${icon('car')}</span>
            <span class="mock__flag">${icon('flag')}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="stats">
      <div class="stat"><strong>${sets.length}</strong><span>Bộ câu hỏi đã tạo</span></div>
      <div class="stat"><strong>${totalQuestions}</strong><span>Câu hỏi sẵn sàng</span></div>
      <div class="stat"><strong>2</strong><span>Mini-game đang mở</span></div>
    </section>

    ${sets.length ? `
      <section class="recent">
        <div class="recent__head">
          <h2 class="card__title">Bộ câu hỏi gần đây</h2>
          <a class="btn btn--ghost btn--sm" href="#/teacher">Quản lý ${icon('arrow-right')}</a>
        </div>
        <div class="recent__list">
          ${sets.slice(0, 4).map(s => `
            <a class="recent__item" href="#/play/${s.id}">
              <strong>${esc(s.title || 'Bộ chưa đặt tên')}</strong>
              <span>${s.questions.length} câu hỏi${s.subject ? ` · ${esc(s.subject)}` : ''} · Bấm để chơi</span>
            </a>`).join('')}
        </div>
      </section>` : ''}

    ${history.length ? `
      <section class="recent">
        <div class="recent__head">
          <h2 class="card__title">Tổng hợp điểm gần đây</h2>
          <a class="btn btn--ghost btn--sm" href="#/stats">Xem tất cả ${icon('arrow-right')}</a>
        </div>
        <div class="recent__list">
          ${history.slice(0, 3).map(m => `
            <a class="recent__item" href="#/stats">
              <strong>${m.winner?.name ? `${esc(m.winner.name)} dẫn đầu` : 'Trận đấu'} · ${esc(m.setName || 'Bộ câu hỏi')}</strong>
              <span>${getGame(m.gameId).name} · ${formatDate(m.date)}</span>
            </a>`).join('')}
        </div>
      </section>` : ''}

    <section class="features">
      <article class="feature">
        <div class="feature__icon">${icon('pencil-line')}</div>
        <h3>Soạn đề nhanh</h3>
        <p>Nhập câu hỏi, 4 đáp án và đánh dấu đáp án đúng. Lưu lại để tái sử dụng nhiều lần.</p>
      </article>
      <article class="feature">
        <div class="feature__icon">${icon('users')}</div>
        <h3>Cả lớp cùng chơi</h3>
        <p>Học sinh nhập tên trực tiếp trên lớp. Mỗi bạn một lượt, điểm được tổng hợp riêng.</p>
      </article>
      <article class="feature">
        <div class="feature__icon">${icon('flag')}</div>
        <h3>Học qua trò chơi</h3>
        <p>Đua xe hoặc kéo co: trả lời đúng để cả lớp tiến bước và kéo dây về đích.</p>
      </article>
    </section>`;
}

// ===== Tải tệp xuống =====

// Bỏ dấu tiếng Việt để đặt tên tệp gọn gàng
function slugify(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 50) || 'bo-cau-hoi';
}

// Kích hoạt tải một Blob xuống mà không cần backend
function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===== Trang giáo viên: soạn & quản lý bộ câu hỏi =====
function renderTeacher() {
  let draft = null;      // bộ đang soạn
  let editingId = null;  // id bộ đã lưu đang sửa (null nếu là bộ mới)

  app.innerHTML = `
    <div id="teacher-page">
    <div class="teacher__head">
      <div>
        <h1 class="page-title">Tạo bộ câu hỏi</h1>
        <p class="page-sub">Soạn câu hỏi trắc nghiệm, đúng/sai hoặc điền từ rồi lưu lại để chơi.</p>
      </div>
      <div class="hero__actions" style="margin:0">
        <button class="btn btn--ghost" data-act="sample">${icon('dices')} Dùng bộ mẫu</button>
        <button class="btn btn--primary" data-act="new">${icon('plus')} Bộ mới</button>
      </div>
    </div>

    <div class="teacher__layout">
      <section class="card editor">
        <label class="field">
          <span>Tên bộ câu hỏi</span>
          <input id="set-name" type="text" maxlength="80" placeholder="VD: Ôn tập Toán chương 3" />
        </label>
        <label class="field">
          <span>Môn học</span>
          <input id="set-subject" type="text" maxlength="40" placeholder="VD: Toán, Tiếng Việt, Tổng hợp" />
        </label>
        <div class="qlist" id="qlist"></div>
        <button class="btn btn--ghost btn--sm" data-act="add-q">${icon('plus')} Thêm câu hỏi</button>
        <div class="editor__actions">
          <button class="btn btn--primary" data-act="save">${icon('save')} Lưu bộ câu hỏi</button>
          <button class="btn btn--ghost btn--sm" data-act="import-excel"
            title="Thêm câu hỏi từ tệp Excel .xlsx vào bộ đang soạn">${icon('file-spreadsheet')} Nhập Excel</button>
          <button class="btn btn--ghost btn--sm" data-act="import-csv"
            title="Thêm câu hỏi từ tệp CSV vào bộ đang soạn">${icon('upload')} Nhập CSV</button>
          <span class="muted" id="editor-status"></span>
        </div>
        <p class="csv-hint muted">
          <strong>Excel (.xlsx):</strong> cột Loại câu hỏi (Trắc nghiệm, Đúng/Sai, Điền từ), Câu hỏi,
          Đáp án A–D, Đáp án đúng, Các đáp án đúng, Ảnh (URL), Thời gian (giây).
          Vẫn nhận CSV 6 cột (chỉ câu trắc nghiệm) như trước. Câu hợp lệ được thêm vào bộ đang soạn, chưa tự lưu.
        </p>
        <div class="csv-report" id="csv-report" aria-live="polite" hidden></div>
      </section>

      <aside class="card">
        <div class="saved__head">
          <h2 class="card__title">Bộ câu hỏi đã lưu</h2>
          <div class="saved__tools">
            <button class="btn btn--ghost btn--sm" data-act="export-excel-all"
              title="Xuất tất cả bộ câu hỏi ra tệp Excel .xlsx (mỗi bộ một sheet)">${icon('file-spreadsheet')} Excel</button>
          </div>
        </div>
        <div class="saved__list" id="saved-list"></div>
        <p class="saved__hint muted">Excel (.xlsx) mỗi bộ một sheet, mở được bằng Excel hoặc Google Sheets.</p>
      </aside>
      <input id="csv-file" type="file" accept=".csv,text/csv" hidden />
      <input id="excel-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden />
    </div>
    </div>`;

  const page = app.querySelector('#teacher-page');
  const nameInput = app.querySelector('#set-name');
  const subjectInput = app.querySelector('#set-subject');
  const qlist = app.querySelector('#qlist');
  const savedList = app.querySelector('#saved-list');
  const statusEl = app.querySelector('#editor-status');
  const csvInput = app.querySelector('#csv-file');
  const excelInput = app.querySelector('#excel-file');
  const csvReport = app.querySelector('#csv-report');
  const letters = ['A', 'B', 'C', 'D'];
  const typeLabels = { choice: 'Trắc nghiệm', boolean: 'Đúng / Sai', fill: 'Điền từ' };

  // Phần đáp án trong trình soạn, thay đổi theo loại câu hỏi
  function editorOptions(q, qi) {
    const type = q.type || 'choice';

    if (type === 'boolean') {
      return `<div class="q__options q__options--boolean">
        ${['Đúng', 'Sai'].map((label, oi) => `
          <label class="opt-row ${oi === q.correctIndex ? 'is-correct' : ''}">
            <input type="radio" name="correct-${qi}" value="${oi}" data-qi="${qi}"
              ${oi === q.correctIndex ? 'checked' : ''} />
            <span class="opt-key">${oi === 0 ? '✓' : '✕'}</span>
            <span class="opt-static">${label}</span>
          </label>`).join('')}
      </div>`;
    }

    if (type === 'fill') {
      return `<div class="q__options q__options--fill">
        <label class="field">
          <span>Đáp án đúng (các cách viết cách nhau bằng dấu |)</span>
          <input class="q__answers" type="text" data-qi="${qi}" maxlength="300"
            value="${esc((q.answers || []).join(' | '))}"
            placeholder="Ví dụ: Hà Nội | Thủ đô Hà Nội" />
        </label>
        <p class="muted q__inline-hint">Không phân biệt hoa/thường và khoảng trắng thừa; giữ dấu tiếng Việt.</p>
      </div>`;
    }

    return `<div class="q__options">
      ${q.options.map((opt, oi) => `
        <label class="opt-row ${oi === q.correctIndex ? 'is-correct' : ''}">
          <input type="radio" name="correct-${qi}" value="${oi}" data-qi="${qi}"
            ${oi === q.correctIndex ? 'checked' : ''} />
          <span class="opt-key">${letters[oi]}</span>
          <input class="opt-input" type="text" data-qi="${qi}" data-oi="${oi}"
            value="${esc(opt)}" maxlength="120" placeholder="Đáp án ${letters[oi]}" />
        </label>`).join('')}
    </div>`;
  }

  // Vẽ danh sách câu hỏi của bộ đang soạn
  function renderQuestions(focusLast = false) {
    qlist.innerHTML = draft.questions.map((q, qi) => `
      <div class="q" data-qi="${qi}">
        <div class="q__head">
          <span class="q__no">Câu ${qi + 1}</span>
          <div class="q__head-tools">
            <select class="q__type-select" data-qi="${qi}" aria-label="Loại câu hỏi">
              ${Object.entries(typeLabels).map(([value, label]) => `
                <option value="${value}" ${(q.type || 'choice') === value ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
            <button class="icon-btn" data-act="del-q" data-qi="${qi}"
              title="Xóa câu hỏi" ${draft.questions.length === 1 ? 'disabled' : ''}>${icon('trash-2')}</button>
          </div>
        </div>
        <textarea class="q__text" rows="2" data-qi="${qi}"
          placeholder="Nhập nội dung câu hỏi...">${esc(q.text)}</textarea>
        ${editorOptions(q, qi)}
        <div class="q__extra">
          <label class="field">
            <span>Ảnh minh họa (URL)</span>
            <input class="q__image" type="url" data-qi="${qi}"
              value="${esc(q.image || '')}" placeholder="https://..." />
          </label>
          <label class="field">
            <span>Thời gian (giây, 0 = không giới hạn)</span>
            <input class="q__time" type="number" min="0" max="600" step="1" data-qi="${qi}"
              value="${Number(q.timeLimit) || 0}" />
          </label>
        </div>
        <div class="q__preview" data-qi="${qi}" ${q.image ? '' : 'hidden'}>
          ${q.image ? `<img src="${esc(q.image)}" alt="Ảnh minh họa câu ${qi + 1}" loading="lazy" />` : ''}
        </div>
      </div>`).join('');

    if (focusLast) {
      const texts = qlist.querySelectorAll('.q__text');
      texts[texts.length - 1]?.focus();
    }
  }

  // Cập nhật ảnh xem trước khi giáo viên nhập URL
  function updateImagePreview(qi) {
    const box = qlist.querySelector(`.q__preview[data-qi="${qi}"]`);
    if (!box) return;
    const url = draft.questions[qi]?.image;
    box.hidden = !url;
    box.innerHTML = url
      ? `<img src="${esc(url)}" alt="Ảnh minh họa câu ${qi + 1}" loading="lazy" />`
      : '';
  }

  // Giới hạn thời gian từ 0 đến 600 giây
  function clampTime(value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(600, n);
  }

  function updateStatus() {
    statusEl.textContent = editingId ? 'Đang sửa bộ đã lưu' : 'Bộ mới chưa lưu';
  }

  // Xóa báo cáo nhập tệp khi chuyển sang bộ khác
  function clearCsvReport() {
    csvReport.hidden = true;
    csvReport.innerHTML = '';
  }

  // Hiện các dòng CSV/Excel chưa nhập được để giáo viên sửa
  function showCsvReport(added, errors) {
    if (!errors.length) { clearCsvReport(); return; }
    const head = added
      ? `Đã thêm ${added} câu. ${errors.length} dòng cần kiểm tra:`
      : `Chưa thêm câu nào. ${errors.length} dòng cần kiểm tra:`;
    csvReport.innerHTML = `
      <strong class="csv-report__title">${head}</strong>
      <ul class="csv-report__list">
        ${errors.slice(0, 50).map(e =>
          `<li>${e.line ? `Dòng ${e.line}: ` : ''}${esc(e.message)}</li>`).join('')}
      </ul>
      ${errors.length > 50 ? `<p class="muted">Còn ${errors.length - 50} dòng lỗi khác.</p>` : ''}`;
    csvReport.hidden = false;
  }

  // Bộ mới luôn có sẵn 1 câu trống; nhập CSV sẽ thay thế câu trống đó
  function isBlankQuestion(q) {
    if (q.text.trim()) return false;
    const type = q.type || 'choice';
    if (type === 'fill') return (q.answers || []).every(a => !String(a).trim());
    if (type === 'choice') return q.options.every(o => !o.trim());
    return true; // đúng/sai chưa nhập gì thì vẫn coi là câu trống
  }

  function loadDraft(set) {
    draft = JSON.parse(JSON.stringify(set));
    editingId = getSets().some(s => s.id === set.id) ? set.id : null;
    nameInput.value = draft.title;
    subjectInput.value = draft.subject;
    renderQuestions();
    updateStatus();
    clearCsvReport();
  }

  function newDraft() {
    draft = blankSet();
    editingId = null;
    nameInput.value = '';
    subjectInput.value = '';
    renderQuestions();
    updateStatus();
    clearCsvReport();
  }

  // Danh sách bộ đã lưu
  function refreshSaved() {
    const sets = getSets();
    savedList.innerHTML = sets.length ? sets.map(s => `
      <div class="saved-item">
        <div class="saved-item__info">
          <strong>${esc(s.title || 'Bộ chưa đặt tên')}</strong>
          <small>${s.subject ? `${esc(s.subject)} · ` : ''}${s.questions.length} câu hỏi${s.id === editingId ? ' · đang sửa' : ''}</small>
        </div>
        <div class="saved-item__actions">
          <a class="btn btn--ghost btn--sm" href="#/play/${s.id}">${icon('play')} Chơi</a>
          <button class="btn btn--ghost btn--sm" data-act="edit" data-id="${s.id}">${icon('pencil')} Sửa</button>
          <button class="btn btn--ghost btn--sm" data-act="export-excel" data-id="${s.id}"
            title="Xuất bộ này ra tệp Excel .xlsx">${icon('file-spreadsheet')} Excel</button>
          <button class="btn btn--danger btn--sm" data-act="delete" data-id="${s.id}">${icon('trash-2')} Xóa</button>
        </div>
      </div>`).join('') : '<p class="muted">Chưa có bộ nào. Hãy soạn bộ đầu tiên ở khung bên trái.</p>';
  }

  // Xuất một hoặc nhiều bộ câu hỏi ra tệp Excel; mỗi bộ là một sheet
  function exportExcelSets(list, filename) {
    if (!list.length) { toast('Chưa có bộ câu hỏi để xuất'); return; }
    try {
      downloadBlob(filename, buildXlsxWorkbook(list));
      toast(list.length === 1
        ? 'Đã xuất bộ câu hỏi ra Excel'
        : `Đã xuất ${list.length} bộ câu hỏi ra Excel`);
    } catch (err) {
      toast(err.message || 'Không tạo được tệp Excel');
    }
  }

  function exportExcelOne(id) {
    const set = getSet(id);
    if (!set) return;
    exportExcelSets([set], `hocvui-${slugify(set.title)}.xlsx`);
  }

  function saveDraft() {
    const title = draft.title.trim();
    if (!title) { toast('Đặt tên cho bộ câu hỏi đã nhé'); nameInput.focus(); return; }

    for (let i = 0; i < draft.questions.length; i++) {
      const q = draft.questions[i];
      const type = q.type || 'choice';
      if (!q.text.trim()) { toast(`Câu ${i + 1}: chưa có nội dung`); return; }

      if (type === 'fill') {
        if (!(q.answers || []).some(a => String(a).trim())) {
          toast(`Câu ${i + 1}: nhập ít nhất 1 đáp án đúng`);
          return;
        }
        continue;
      }

      if (type === 'boolean') continue; // đáp án cố định Đúng/Sai

      if (q.options.some(o => !o.trim())) { toast(`Câu ${i + 1}: điền đủ 4 đáp án`); return; }
    }

    // Giữ nguyên id, ảnh và giới hạn thời gian của từng câu khi lưu
    draft = {
      ...draft,
      title,
      subject: draft.subject.trim(),
      questions: draft.questions.map(q => {
        const type = q.type || 'choice';
        return {
          id: q.id,
          type,
          text: q.text.trim(),
          options: type === 'choice' ? q.options.map(o => o.trim())
            : type === 'boolean' ? ['Đúng', 'Sai'] : [],
          correctIndex: type === 'fill' ? 0
            : type === 'boolean' ? (Number(q.correctIndex) === 1 ? 1 : 0)
            : Number(q.correctIndex) || 0,
          answers: type === 'fill'
            ? (q.answers || []).map(a => a.trim()).filter(Boolean)
            : [],
          image: q.image || null,
          timeLimit: q.timeLimit || 0,
        };
      }),
    };

    draft = saveSet(draft);
    editingId = draft.id;
    updateStatus();
    refreshSaved();
    toast('Đã lưu bộ câu hỏi');
  }

  // Cập nhật dữ liệu khi gõ
  page.addEventListener('input', e => {
    const el = e.target;
    if (el.id === 'set-name') { draft.title = el.value; return; }
    if (el.id === 'set-subject') { draft.subject = el.value; return; }
    const qi = Number(el.dataset.qi);
    if (Number.isNaN(qi) || !draft.questions[qi]) return;
    if (el.classList.contains('q__text')) draft.questions[qi].text = el.value;
    if (el.classList.contains('opt-input')) draft.questions[qi].options[Number(el.dataset.oi)] = el.value;
    if (el.classList.contains('q__answers')) {
      draft.questions[qi].answers = el.value.split('|').map(a => a.trim()).filter(Boolean);
    }
    if (el.classList.contains('q__image')) {
      draft.questions[qi].image = el.value.trim() || null;
      updateImagePreview(qi);
    }
    if (el.classList.contains('q__time')) draft.questions[qi].timeLimit = clampTime(el.value);
  });

  // Chọn đáp án đúng hoặc đổi loại câu hỏi
  page.addEventListener('change', e => {
    const el = e.target;
    const qi = Number(el.dataset.qi);
    if (el.classList.contains('q__time') && draft.questions[qi]) {
      el.value = String(draft.questions[qi].timeLimit);
      return;
    }
    if (el.classList.contains('q__type-select')) {
      const q = draft.questions[qi];
      if (!q) return;
      const type = el.value;
      q.type = type;
      // Đổi loại thì đặt lại phần đáp án của loại mới, giữ nội dung/ảnh/thời gian
      if (type === 'boolean') {
        q.options = ['Đúng', 'Sai'];
        q.correctIndex = 0;
        q.answers = [];
      } else if (type === 'fill') {
        q.options = [];
        q.correctIndex = 0;
        q.answers = [''];
      } else {
        q.options = ['', '', '', ''];
        q.correctIndex = 0;
        q.answers = [];
      }
      renderQuestions();
      return;
    }
    if (el.type !== 'radio') return;
    if (draft.questions[qi]) draft.questions[qi].correctIndex = Number(el.value);
    el.closest('.q__options').querySelectorAll('.opt-row')
      .forEach((row, i) => row.classList.toggle('is-correct', i === Number(el.value)));
  });

  // Các nút trong trang
  page.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'new') { newDraft(); toast('Đã tạo bộ mới'); }
    if (act === 'sample') { loadDraft(sampleSet()); toast('Đã nạp bộ mẫu, bấm Lưu để dùng'); }
    if (act === 'add-q') { draft.questions.push(blankQuestion()); renderQuestions(true); }
    if (act === 'del-q') {
      const qi = Number(btn.dataset.qi);
      if (draft.questions.length === 1) { toast('Cần ít nhất 1 câu hỏi'); return; }
      draft.questions.splice(qi, 1);
      renderQuestions();
    }
    if (act === 'save') saveDraft();
    if (act === 'edit') {
      const set = getSet(btn.dataset.id);
      if (set) { loadDraft(set); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }
    if (act === 'delete') {
      const set = getSet(btn.dataset.id);
      if (!set) return;
      if (!confirm(`Xóa bộ "${set.title || 'chưa đặt tên'}"?`)) return;
      deleteSet(set.id);
      if (editingId === set.id) newDraft();
      refreshSaved();
      toast('Đã xóa bộ câu hỏi');
    }
    if (act === 'import-excel') excelInput.click();
    if (act === 'import-csv') csvInput.click();
    if (act === 'export-excel') exportExcelOne(btn.dataset.id);
    if (act === 'export-excel-all') exportExcelSets(getSets(), 'hocvui-bo-cau-hoi.xlsx');
  });

  // Nhập câu hỏi từ tệp Excel .xlsx vào bộ đang soạn
  excelInput.addEventListener('change', async () => {
    const file = excelInput.files?.[0];
    if (!file) return;

    try {
      const { questions, errors } = await parseXlsxQuestions(await file.arrayBuffer());

      if (!questions.length) {
        showCsvReport(0, errors);
        toast(errors[0]?.message || 'Không đọc được câu hỏi từ Excel');
        return;
      }

      // Bộ mới chỉ có 1 câu trống thì thay thế, còn lại thì nối thêm
      const replaceBlank = draft.questions.length === 1 && isBlankQuestion(draft.questions[0]);
      draft.questions = replaceBlank ? questions : [...draft.questions, ...questions];
      renderQuestions();
      showCsvReport(questions.length, errors);
      toast(errors.length
        ? `Đã thêm ${questions.length} câu, ${errors.length} dòng lỗi`
        : `Đã thêm ${questions.length} câu hỏi từ Excel`);
    } catch (err) {
      const message = err.message || 'Không đọc được tệp Excel';
      showCsvReport(0, [{ line: 0, message }]);
      toast(message);
    } finally {
      // Xóa lựa chọn để có thể nhập lại đúng tệp đó
      excelInput.value = '';
    }
  });

  // Nhập câu hỏi từ tệp CSV vào bộ đang soạn
  csvInput.addEventListener('change', async () => {
    const file = csvInput.files?.[0];
    if (!file) return;

    try {
      const { questions, errors } = parseCsvQuestions(await file.text());

      if (!questions.length) {
        showCsvReport(0, errors);
        toast(errors[0]?.message || 'Không đọc được câu hỏi từ CSV');
        return;
      }

      // Bộ mới chỉ có 1 câu trống thì thay thế, còn lại thì nối thêm
      const replaceBlank = draft.questions.length === 1 && isBlankQuestion(draft.questions[0]);
      draft.questions = replaceBlank ? questions : [...draft.questions, ...questions];
      renderQuestions();
      showCsvReport(questions.length, errors);
      toast(errors.length
        ? `Đã thêm ${questions.length} câu, ${errors.length} dòng lỗi`
        : `Đã thêm ${questions.length} câu hỏi từ CSV`);
    } catch {
      toast('Không đọc được tệp CSV');
    } finally {
      // Xóa lựa chọn để có thể nhập lại đúng tệp đó
      csvInput.value = '';
    }
  });

  newDraft();
  refreshSaved();
}

// ===== Trang thiết lập trận đấu =====
function renderPlay(param) {
  const sets = getSets();

  if (!sets.length) {
    app.innerHTML = `
      <section class="empty">
        <div class="empty__icon">${icon('book-open')}</div>
        <h2>Chưa có bộ câu hỏi nào</h2>
        <p>Hãy tạo bộ câu hỏi đầu tiên, hoặc dùng bộ mẫu để chơi thử ngay.</p>
        <div class="hero__actions" style="justify-content:center">
          <a class="btn btn--primary" href="#/teacher">${icon('pencil-line')} Tạo bộ câu hỏi</a>
          <button class="btn btn--ghost" data-act="use-sample">${icon('dices')} Dùng bộ mẫu</button>
        </div>
      </section>`;
    app.querySelector('[data-act="use-sample"]').addEventListener('click', () => {
      saveSet(sampleSet());
      toast('Đã thêm bộ câu hỏi mẫu');
      renderRoute();
    });
    return;
  }

  const selectedId = sets.some(s => s.id === param) ? param : sets[0].id;
  let gameId = listGames()[0].id;
  let students = []; // { id, name, color }
  let studentSeq = 0;

  app.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Vào chơi</h1>
        <p class="page-sub">Chọn bộ câu hỏi, thêm tên học sinh và bắt đầu trận đấu.</p>
      </div>
      <a class="btn btn--ghost" href="#/teacher">${icon('pencil-line')} Quản lý câu hỏi</a>
    </div>

    <div class="setup__grid">
      <section class="card">
        <h2 class="card__title">Bộ câu hỏi</h2>
        <label class="field">
          <span>Chọn bộ để chơi</span>
          <select class="select" id="pick-set">
            ${sets.map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${esc(s.title || 'Bộ chưa đặt tên')} (${s.questions.length} câu)</option>`).join('')}
          </select>
        </label>
        <p class="muted" id="set-info" style="margin-top:10px;font-size:.88rem"></p>
      </section>

      <section class="card">
        <h2 class="card__title">Học sinh tham gia</h2>
        <div class="student-add">
          <input id="student-name" type="text" maxlength="20" autocomplete="off"
            placeholder="Nhập tên học sinh..." aria-label="Tên học sinh" />
          <button class="btn btn--primary btn--sm" data-act="add-student">${icon('plus')} Thêm</button>
        </div>
        <p class="muted" id="student-hint" style="margin-top:8px;font-size:.82rem"></p>
        <div class="students" id="students"></div>
      </section>

      <section class="card card--wide">
        <h2 class="card__title">Chọn mini-game</h2>
        <div class="games">
          ${listGames().map((g, i) => `
            <button class="game-pick ${i === 0 ? 'is-active' : ''}" data-game="${g.id}">
              <span class="badge badge--ok">Sẵn sàng</span>
              <span class="game-pick__icon">${icon(g.icon)}</span>
              <strong>${esc(g.name)}</strong>
              <small>${esc(g.description || '')}</small>
            </button>`).join('')}
        </div>

        <div class="setup__actions">
          <a class="btn btn--ghost" href="#/">${icon('arrow-left')} Trang chủ</a>
          <button class="btn btn--primary btn--lg" data-act="start">${icon('rocket')} Bắt đầu chơi</button>
        </div>
      </section>
    </div>`;

  const pickSet = app.querySelector('#pick-set');
  const setInfo = app.querySelector('#set-info');
  const studentList = app.querySelector('#students');
  const studentHint = app.querySelector('#student-hint');
  const studentInput = app.querySelector('#student-name');

  function currentSet() {
    return getSet(pickSet.value);
  }

  function updateSetInfo() {
    const set = currentSet();
    setInfo.textContent = set
      ? `Bộ này có ${set.questions.length} câu hỏi. Mỗi học sinh trả lời 1 câu.`
      : '';
  }

  // Vẽ danh sách học sinh đã thêm
  function renderStudents() {
    studentList.innerHTML = students.length ? students.map((s, i) => `
      <span class="student-chip" style="--team:${s.color}">
        <span class="student-chip__dot"></span>
        <span class="student-chip__name">${esc(s.name)}</span>
        <button class="student-chip__remove" data-remove="${i}"
          title="Xóa ${esc(s.name)}" aria-label="Xóa ${esc(s.name)}">${icon('circle-x')}</button>
      </span>`).join('') : '<p class="muted" style="font-size:.86rem">Chưa có học sinh nào. Nhập tên rồi bấm Thêm.</p>';

    studentHint.textContent = students.length
      ? `${students.length} học sinh · mỗi bạn trả lời 1 câu${students.length < 2 ? ' · cần thêm ít nhất 1 bạn' : ''}.`
      : 'Thêm ít nhất 2 học sinh để bắt đầu.';
  }

  // Thêm một học sinh từ ô nhập; bỏ qua tên trống hoặc trùng
  function addStudent() {
    const name = studentInput.value.trim().replace(/\s+/g, ' ');
    if (!name) { studentInput.focus(); return; }
    if (students.length >= MAX_STUDENTS) { toast(`Mỗi trận tối đa ${MAX_STUDENTS} học sinh`); return; }
    if (students.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      toast(`"${name}" đã có trong danh sách`);
      return;
    }

    students.push({
      id: `student-${++studentSeq}`,
      name,
      color: STUDENT_COLORS[students.length % STUDENT_COLORS.length],
    });
    studentInput.value = '';
    studentInput.focus();
    renderStudents();
  }

  pickSet.addEventListener('change', updateSetInfo);

  // Enter trong ô nhập cũng thêm học sinh
  studentInput.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    addStudent();
  });

  app.querySelector('[data-act="add-student"]').addEventListener('click', addStudent);

  studentList.addEventListener('click', e => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    students.splice(Number(btn.dataset.remove), 1);
    renderStudents();
  });

  app.querySelectorAll('[data-game]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      gameId = btn.dataset.game;
      app.querySelectorAll('[data-game]').forEach(b =>
        b.classList.toggle('is-active', b === btn));
    });
  });

  app.querySelector('[data-act="start"]').addEventListener('click', () => {
    const set = currentSet();
    if (!set) { toast('Không tìm thấy bộ câu hỏi'); return; }
    if (!set.questions.length) { toast('Bộ câu hỏi đang trống'); return; }
    if (students.length < 2) {
      toast('Cần ít nhất 2 học sinh để bắt đầu');
      studentInput.focus();
      return;
    }

    // Lưu trận đấu để tải lại trang vẫn tiếp tục được
    sessionStorage.setItem(MATCH_KEY, JSON.stringify({ setId: set.id, gameId, students }));
    location.hash = `#/game/${set.id}`;
  });

  updateSetInfo();
  renderStudents();
}

// Đọc thông tin trận đấu đã thiết lập
function readMatch(setId) {
  try {
    const match = JSON.parse(sessionStorage.getItem(MATCH_KEY) || 'null');
    if (match && match.setId === setId && Array.isArray(match.students) && match.students.length) {
      return match;
    }
  } catch { /* dữ liệu hỏng thì bỏ qua */ }
  return null;
}

// ===== Trang chơi =====
function renderGame(setId) {
  const set = getSet(setId);
  const match = readMatch(setId);

  if (!set || !match || !set.questions.length) {
    toast('Hãy thiết lập trận đấu trước khi chơi');
    location.hash = '#/play';
    return;
  }

  const info = getGame(match.gameId);
  const players = match.students;
  const classPlayer = { ...CLASS_PLAYER };
  const muted = isMuted();
  let quiz = null;
  let current = null;
  let answered = false;
  let timer = null;
  let countdown = null;
  let tally = new Map(); // điểm từng học sinh trong trận: { correct, total }

  app.innerHTML = `
    <div class="game">
      <div class="game__bar">
        <a class="btn btn--ghost btn--sm" href="#/play/${set.id}">${icon('arrow-left')} Đổi thiết lập</a>
        <div class="game__meta">
          <span class="game__tag">${icon(info.icon)} ${info.name}</span>
          <span class="muted">${esc(set.title || 'Bộ chưa đặt tên')}</span>
        </div>
        <div class="game__tools">
          <button class="btn btn--ghost btn--sm" data-act="mute" aria-pressed="${muted}"
            title="${muted ? 'Bật âm thanh' : 'Tắt âm thanh'}">
            ${icon(muted ? 'volume-x' : 'volume-2')}
            <span class="game__tool-label">${muted ? 'Bật tiếng' : 'Tắt tiếng'}</span>
          </button>
          <button class="btn btn--ghost btn--sm" data-act="fullscreen" aria-pressed="false"
            title="Toàn màn hình">
            ${icon('maximize')}
            <span class="game__tool-label">Toàn màn hình</span>
          </button>
        </div>
      </div>

      <div class="board" id="board"></div>

      <section class="card quiz">
        <div id="turn-slot" class="quiz__top"></div>
        <div class="question-image" id="question-image" hidden></div>
        <h2 class="question" id="question"></h2>
        <div class="options" id="options"></div>
        <div id="feedback"></div>
        <p class="quiz__hint">Chọn đáp án đúng. Trả lời xong sẽ tự chuyển sang học sinh kế tiếp.</p>
      </section>

      <div class="overlay" id="overlay" hidden></div>
    </div>`;

  const board = app.querySelector('#board');
  const turnSlot = app.querySelector('#turn-slot');
  const questionImage = app.querySelector('#question-image');
  const questionEl = app.querySelector('#question');
  const optionsEl = app.querySelector('#options');
  const feedbackEl = app.querySelector('#feedback');
  const overlay = app.querySelector('#overlay');
  const gameRoot = app.querySelector('.game');
  const muteBtn = app.querySelector('[data-act="mute"]');
  const fsBtn = app.querySelector('[data-act="fullscreen"]');

  // Cập nhật nút tắt/bật âm thanh theo trạng thái đã lưu
  function refreshMuteButton() {
    const off = isMuted();
    muteBtn.innerHTML = `${icon(off ? 'volume-x' : 'volume-2')}
      <span class="game__tool-label">${off ? 'Bật tiếng' : 'Tắt tiếng'}</span>`;
    muteBtn.setAttribute('aria-pressed', String(off));
    muteBtn.title = off ? 'Bật âm thanh' : 'Tắt âm thanh';
  }

  // Cập nhật nút toàn màn hình khi vào/ra chế độ
  function refreshFullscreenButton() {
    const on = !!document.fullscreenElement;
    fsBtn.innerHTML = `${icon(on ? 'minimize' : 'maximize')}
      <span class="game__tool-label">${on ? 'Thoát toàn màn hình' : 'Toàn màn hình'}</span>`;
    fsBtn.setAttribute('aria-pressed', String(on));
    fsBtn.title = on ? 'Thoát toàn màn hình' : 'Toàn màn hình';
  }

  // Trình duyệt không hỗ trợ toàn màn hình thì ẩn nút
  if (!document.fullscreenEnabled || !gameRoot.requestFullscreen) fsBtn.hidden = true;

  muteBtn.addEventListener('click', () => {
    const off = toggleMuted();
    refreshMuteButton();
    toast(off ? 'Đã tắt âm thanh' : 'Đã bật âm thanh');
  });

  fsBtn.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await gameRoot.requestFullscreen();
    } catch {
      toast('Trình duyệt không cho phép toàn màn hình');
    }
  });

  document.addEventListener('fullscreenchange', refreshFullscreenButton);

  const game = getGame(match.gameId);

  // Dừng đồng hồ đếm ngược của câu hiện tại
  function stopCountdown() {
    if (countdown !== null) {
      clearInterval(countdown);
      countdown = null;
    }
  }

  // Chạy đồng hồ nếu câu hỏi có giới hạn thời gian; 0 = không giới hạn
  function startCountdown(seconds) {
    stopCountdown();
    const clock = turnSlot.querySelector('#quiz-timer');
    if (!clock) return;

    const limit = Math.max(0, Math.floor(Number(seconds) || 0));
    if (!limit) { clock.hidden = true; return; }

    clock.hidden = false;
    const deadline = Date.now() + limit * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      clock.innerHTML = `${icon('timer')} ${left}s`;
      clock.classList.toggle('is-low', left <= 5);
      if (left <= 0) {
        stopCountdown();
        submitAnswer(null);
      }
    };
    tick();
    countdown = setInterval(tick, 200);
  }

  function startMatch() {
    clearTimeout(timer);
    stopCountdown();
    overlay.hidden = true;
    overlay.innerHTML = '';
    game.destroy();
    quiz = createQuiz(players, set.questions);
    tally = new Map(players.map(p => [p.id, { correct: 0, total: 0 }]));
    game.init(board, [classPlayer], { questions: set.questions, totalTurns: players.length });
    nextTurn();
  }

  // Nhãn đáp án đúng để hiện khi trả lời sai hoặc hết giờ
  function correctAnswerText(question) {
    if (question.type === 'fill') return (question.answers || []).join(' hoặc ');
    if (question.type === 'boolean') {
      return question.options[question.correctIndex] || (question.correctIndex === 0 ? 'Đúng' : 'Sai');
    }
    return `${'ABCD'[question.correctIndex]}. ${question.options[question.correctIndex]}`;
  }

  // Hiện câu hỏi cho học sinh đang tới lượt
  function nextTurn() {
    if (quiz.finished) { showResults(); return; }
    current = quiz.next();
    if (!current) { showResults(); return; }
    answered = false;

    const player = current.player;
    const question = current.question;
    turnSlot.innerHTML = `
      <span class="turn" style="--team:${player.color}">
        <span class="turn__dot"></span>Lượt của ${esc(player.name)} · câu ${quiz.index + 1}/${quiz.total}
      </span>
      <span class="quiz-timer" id="quiz-timer" hidden></span>`;
    questionEl.textContent = question.text;

    const image = question.image;
    questionImage.hidden = !image;
    // Ảnh câu hỏi tải ngay (không lazy) để hiện kịp trước khi đồng hồ chạy
    questionImage.innerHTML = image
      ? `<img src="${esc(image)}" alt="Ảnh minh họa câu hỏi" />`
      : '';

    optionsEl.className = 'options';
    if (question.type === 'boolean') {
      optionsEl.classList.add('options--boolean');
      optionsEl.innerHTML = question.options.map((opt, i) => `
        <button class="option option--boolean" data-oi="${i}">
          <span class="option__key">${icon(i === 0 ? 'circle-check' : 'circle-x')}</span>
          <span class="option__text">${esc(opt)}</span>
        </button>`).join('');
    } else if (question.type === 'fill') {
      optionsEl.classList.add('options--fill');
      optionsEl.innerHTML = `
        <form class="fill" id="fill-form" autocomplete="off">
          <input class="fill__input" id="fill-input" type="text" maxlength="120"
            placeholder="Nhập câu trả lời..." aria-label="Câu trả lời" />
          <button class="btn btn--primary fill__submit" type="submit">
            ${icon('arrow-right')} Trả lời
          </button>
        </form>`;
    } else {
      optionsEl.innerHTML = question.options.map((opt, i) => `
        <button class="option" data-oi="${i}">
          <span class="option__key">${'ABCD'[i]}</span>
          <span class="option__text">${esc(opt)}</span>
        </button>`).join('');
    }

    feedbackEl.innerHTML = '';
    startCountdown(question.timeLimit);
  }

  // Bảng điểm từng học sinh trong trận, xếp theo số câu đúng rồi tỉ lệ đúng
  function scoreRows() {
    return players.map((p, order) => {
      const s = tally.get(p.id) || { correct: 0, total: 0 };
      return {
        ...p,
        order,
        correct: s.correct,
        total: s.total,
        accuracy: s.total ? Math.round((s.correct / s.total) * 100) : 0,
      };
    }).sort((a, b) => b.correct - a.correct || b.accuracy - a.accuracy || a.order - b.order);
  }

  function scoreTable(rows, winnerId) {
    return `
      <div class="scoreboard">
        <div class="scoreboard__head">
          <span>Hạng</span><span>Học sinh</span><span>Đúng</span><span>Tỉ lệ</span>
        </div>
        ${rows.map((r, i) => `
          <div class="scoreboard__row ${r.id === winnerId ? 'is-winner' : ''}">
            <span class="scoreboard__rank">${i === 0 ? icon('medal') : i + 1}</span>
            <span class="scoreboard__team">
              <span class="scoreboard__dot" style="--team:${r.color}"></span>
              <span class="scoreboard__name">${esc(r.name)}</span>
              ${r.id === winnerId ? icon('crown') : ''}
            </span>
            <span class="scoreboard__count">${r.correct}/${r.total}</span>
            <span class="scoreboard__rate">${r.accuracy}%</span>
          </div>`).join('')}
      </div>`;
  }

  function showResults() {
    stopCountdown();
    playWin();
    const rows = scoreRows();
    const top = rows[0] || null;

    // Lưu trận vào lịch sử để trang Tổng hợp điểm thống kê
    saveMatch({
      setId: set.id,
      setName: set.title || 'Bộ chưa đặt tên',
      gameId: match.gameId,
      gameName: info.name,
      students: rows.map(r => ({ id: r.id, name: r.name, color: r.color, correct: r.correct, total: r.total })),
      winner: top ? { id: top.id, name: top.name, color: top.color } : null,
    });

    overlay.innerHTML = `
      <div class="overlay__card overlay__card--wide">
        <div class="overlay__trophy">${icon('trophy')}</div>
        <h2 class="overlay__title">Cả lớp đã hoàn thành!</h2>
        <p class="muted">${players.length} học sinh đã trả lời xong. Cùng xem điểm của từng bạn bên dưới.</p>
        <div class="scoreboard__title">${icon('chart-column')} Tổng hợp điểm</div>
        ${scoreTable(rows, top ? top.id : null)}
        <div class="overlay__actions">
          <button class="btn btn--primary" data-act="again">${icon('rotate-ccw')} Chơi lại</button>
          <a class="btn btn--ghost" href="#/stats">${icon('chart-column')} Tổng hợp điểm</a>
          <a class="btn btn--ghost" href="#/play/${set.id}">${icon('settings')} Đổi thiết lập</a>
          <a class="btn btn--ghost" href="#/">${icon('house')} Trang chủ</a>
        </div>
      </div>`;
    overlay.hidden = false;
  }

  // Chấm đáp án (picked = null khi hết giờ) và cập nhật đường đua
  function submitAnswer(picked) {
    if (answered || !current) return;
    answered = true;
    stopCountdown();

    const result = quiz.answer(picked);
    const question = result.question;
    const correctIndex = question.correctIndex;
    const isFill = question.type === 'fill';

    // Phát hiệu ứng âm thanh tương ứng (tự bỏ qua nếu đang tắt tiếng)
    if (result.isCorrect) playCorrect();
    else playWrong();

    // Cộng điểm tổng hợp cho học sinh vừa trả lời; hết giờ tính là sai
    const stat = tally.get(result.player.id);
    if (stat) {
      stat.total += 1;
      if (result.isCorrect) stat.correct += 1;
    }

    if (isFill) {
      const input = optionsEl.querySelector('#fill-input');
      const submit = optionsEl.querySelector('.fill__submit');
      if (input) {
        input.disabled = true;
        if (picked !== null) input.classList.add(result.isCorrect ? 'is-correct' : 'is-wrong');
      }
      if (submit) submit.disabled = true;
    } else {
      optionsEl.querySelectorAll('.option').forEach((el, i) => {
        el.disabled = true;
        if (i === correctIndex) el.classList.add('is-correct');
        if (picked !== null && i === picked && !result.isCorrect) el.classList.add('is-wrong');
      });
    }

    if (picked === null) {
      const clock = turnSlot.querySelector('#quiz-timer');
      if (clock) {
        clock.innerHTML = `${icon('timer')} Hết giờ`;
        clock.classList.add('is-low');
      }
    }

    feedbackEl.innerHTML = result.isCorrect
      ? game.id === 'tug'
        ? `<div class="feedback feedback--ok">${icon('circle-check')} Chính xác! ${esc(result.player.name)} kéo dây về phía lớp.</div>`
        : `<div class="feedback feedback--ok">${icon('circle-check')} Chính xác! ${esc(result.player.name)} trả lời đúng.</div>`
      : picked === null
        ? `<div class="feedback feedback--bad">${icon('timer')} Hết giờ! Đáp án đúng là <strong>${esc(correctAnswerText(question))}</strong>.</div>`
        : `<div class="feedback feedback--bad">${icon('circle-x')} Chưa đúng. Đáp án đúng là <strong>${esc(correctAnswerText(question))}</strong>.</div>`;

    game.onAnswer(classPlayer.id, result.isCorrect);

    // Trận kết thúc khi mọi học sinh đã trả lời xong, không dừng sớm theo đường đua
    timer = setTimeout(nextTurn, picked === null ? 2200 : 1700);
  }

  optionsEl.addEventListener('click', e => {
    const btn = e.target.closest('.option');
    if (!btn || answered || !current) return;
    submitAnswer(Number(btn.dataset.oi));
  });

  // Gửi câu trả lời điền từ bằng nút hoặc phím Enter
  optionsEl.addEventListener('submit', e => {
    if (!e.target.closest('#fill-form') || answered || !current) return;
    e.preventDefault();
    const input = e.target.querySelector('#fill-input');
    submitAnswer(input?.value ?? '');
  });

  overlay.addEventListener('click', e => {
    if (e.target.closest('[data-act="again"]')) startMatch();
  });

  startMatch();

  // Dọn hẹn giờ, đồng hồ, game và chế độ toàn màn hình khi rời trang
  return () => {
    clearTimeout(timer);
    stopCountdown();
    game.destroy();
    document.removeEventListener('fullscreenchange', refreshFullscreenButton);
    if (document.fullscreenElement) {
      try { document.exitFullscreen?.()?.catch?.(() => {}); } catch { /* bỏ qua */ }
    }
  };
}

// ===== Trang tổng hợp điểm =====
function renderStats() {
  const history = getHistory();
  const sum = summarize(history);
  const gameInfo = id => getGame(id);

  // Mỗi trận hiển thị bảng điểm các học sinh, xếp theo số câu đúng
  function matchCard(m) {
    const players = m.students || m.teams || [];
    const rows = [...players].sort((a, b) =>
      (b.correct || 0) - (a.correct || 0) ||
      (b.total ? b.correct / b.total : 0) - (a.total ? a.correct / a.total : 0));

    return `
      <article class="match-card">
        <div class="match-card__head">
          <span class="game__tag">${icon(gameInfo(m.gameId).icon)} ${gameInfo(m.gameId).name}</span>
          <strong class="match-card__set">${esc(m.setName || 'Bộ câu hỏi')}</strong>
          <span class="match-card__date">${icon('calendar-days')} ${formatDate(m.date)}</span>
        </div>
        <div class="scoreboard">
          <div class="scoreboard__head">
            <span>Hạng</span><span>${m.students ? 'Học sinh' : 'Đội'}</span><span>Đúng</span><span>Tỉ lệ</span>
          </div>
          ${rows.map((r, i) => {
            const isWinner = m.winner && m.winner.id === r.id;
            const accuracy = r.total ? Math.round((r.correct / r.total) * 100) : 0;
            return `
              <div class="scoreboard__row ${isWinner ? 'is-winner' : ''}">
                <span class="scoreboard__rank">${i === 0 ? icon('medal') : i + 1}</span>
                <span class="scoreboard__team">
                  <span class="scoreboard__dot" style="--team:${r.color}"></span>
                  <span class="scoreboard__name">${esc(r.name)}</span>
                  ${isWinner ? icon('crown') : ''}
                </span>
                <span class="scoreboard__count">${r.correct || 0}/${r.total || 0}</span>
                <span class="scoreboard__rate">${accuracy}%</span>
              </div>`;
          }).join('')}
        </div>
      </article>`;
  }

  app.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Tổng hợp điểm</h1>
        <p class="page-sub">Bảng điểm các trận đã chơi, lưu ngay trên trình duyệt này.</p>
      </div>
      <div class="hero__actions" style="margin:0">
        ${history.length ? `<button class="btn btn--ghost" data-act="clear-history">${icon('trash-2')} Xóa lịch sử</button>` : ''}
        <a class="btn btn--primary" href="#/play">${icon('gamepad-2')} Vào chơi</a>
      </div>
    </div>

    ${history.length ? `
      <section class="stats">
        <div class="stat"><strong>${sum.matches}</strong><span>Trận đã hoàn thành</span></div>
        <div class="stat"><strong>${sum.totalQuestions}</strong><span>Câu đã trả lời</span></div>
        <div class="stat"><strong>${sum.accuracy}%</strong><span>Tỉ lệ trả lời đúng</span></div>
      </section>

      <section class="card card--wide">
        <h2 class="card__title">${icon('medal')} Bảng xếp hạng học sinh</h2>
        <div class="scoreboard scoreboard--teams">
          <div class="scoreboard__head">
            <span>Hạng</span><span>Học sinh</span><span>Trận</span><span>Đúng</span><span>Tỉ lệ</span>
          </div>
          ${sum.ranking.map((t, i) => `
            <div class="scoreboard__row">
              <span class="scoreboard__rank">${i === 0 ? icon('medal') : i + 1}</span>
              <span class="scoreboard__team">
                <span class="scoreboard__dot" style="--team:${t.color}"></span>
                <span class="scoreboard__name">${esc(t.name)}</span>
              </span>
              <span class="scoreboard__count">${t.matches}</span>
              <span class="scoreboard__count">${t.correct}/${t.total}</span>
              <span class="scoreboard__rate">${t.accuracy}%</span>
            </div>`).join('')}
        </div>
      </section>

      <section class="stats-history">
        <h2 class="card__title">${icon('history')} Lịch sử trận đấu</h2>
        ${history.map(matchCard).join('')}
      </section>` : `
      <section class="empty">
        <div class="empty__icon">${icon('chart-column')}</div>
        <h2>Chưa có trận nào</h2>
        <p>Hoàn thành một trận đua xe hoặc kéo co, bảng điểm sẽ xuất hiện ở đây.</p>
        <div class="hero__actions" style="justify-content:center">
          <a class="btn btn--primary" href="#/play">${icon('play')} Vào chơi</a>
        </div>
      </section>`}`;

  app.querySelector('[data-act="clear-history"]')?.addEventListener('click', () => {
    if (!confirm('Xóa toàn bộ lịch sử trận đấu?')) return;
    clearHistory();
    toast('Đã xóa lịch sử trận đấu');
    renderStats();
  });
}

// ===== PWA: đăng ký service worker để chạy ngoại tuyến =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* trình duyệt chặn hoặc môi trường không hỗ trợ thì bỏ qua */
    });
  });
}

// ===== Router =====
function renderRoute() {
  if (cleanupPage) { cleanupPage(); cleanupPage = null; }

  const path = location.hash.replace(/^#/, '') || '/';
  const [route = '', param] = path.split('/').filter(Boolean);
  // path '/' -> parts rỗng nên route = '' (trang chủ)

  // Tô đậm mục điều hướng đang mở
  document.querySelectorAll('#nav a').forEach(a => {
    const r = a.dataset.route;
    const active = route === r || (route === 'game' && r === 'play') || (!route && r === 'home');
    a.classList.toggle('is-active', active);
  });

  if (!route) renderHome();
  else if (route === 'teacher') renderTeacher();
  else if (route === 'play') renderPlay(param);
  else if (route === 'game') cleanupPage = renderGame(param) || null;
  else if (route === 'stats') renderStats();
  else { location.hash = '#/'; return; }

  window.scrollTo({ top: 0 });
}

window.addEventListener('hashchange', renderRoute);
renderRoute();
