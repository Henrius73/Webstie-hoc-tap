// Mini-game đua xe cho chế độ nhiều người (interface mục 8 của PROJECT.md).
// Game chỉ hiển thị: mọi điểm số do server tính và truyền vào qua update().
import { esc } from '../utils.js';
import { icon } from '../icons.js';

const TOP = 8;
const COLORS = ['#7c3aed', '#db2777', '#0284c7', '#d97706', '#059669', '#dc2626', '#0891b2', '#9333ea'];

function colorForId(id) {
  const text = String(id || '');
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

let state = null;

function mount(container) {
  state = { root: container, lanes: new Map(), goal: 1 };
  container.innerHTML = `
    <div class="race">
      <div class="race__head">
        <span>${icon('flag')} Đường đua của lớp</span>
        <span class="race__hint">Điểm càng cao, xe càng gần đích · Hiện top ${TOP} và vị trí của bạn</span>
      </div>
      <div class="race__lanes"></div>
    </div>`;
}

function laneHtml(player) {
  const color = colorForId(player.id);
  return `
    <div class="lane" data-player="${esc(player.id)}">
      <span class="lane__name" style="--team:${color}">${esc(player.name)}</span>
      <div class="lane__track">
        <div class="lane__road">
          <span class="lane__car" style="color:${color}">${icon('car')}</span>
        </div>
        <span class="lane__finish">${icon('flag')}</span>
      </div>
      <span class="lane__score">0</span>
    </div>`;
}

// players: [{ id, name, score }]
// me: người chơi hiện tại (có thể null) để luôn hiện vị trí của mình.
function update({ players = [], me = null, totalQuestions = 0 }) {
  if (!state) return;

  const goal = Math.max(1, Number(totalQuestions) || 1) * 1000;
  state.goal = goal;

  const sorted = [...players].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
  let visible = sorted.slice(0, TOP);
  if (me && !visible.some(player => player.id === me.id)) {
    const mine = sorted.find(player => player.id === me.id);
    if (mine) visible = [...visible, mine];
  }

  const lanesRoot = state.root.querySelector('.race__lanes');
  if (!lanesRoot) return;

  const wanted = new Set(visible.map(player => player.id));

  // Xóa làn của người không còn trong danh sách hiển thị
  for (const [id, lane] of state.lanes) {
    if (!wanted.has(id)) {
      lane.remove();
      state.lanes.delete(id);
    }
  }

  for (const player of visible) {
    let lane = state.lanes.get(player.id);
    if (!lane) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = laneHtml(player);
      lane = wrapper.firstElementChild;
      state.lanes.set(player.id, lane);
    }

    lanesRoot.appendChild(lane);   // giữ đúng thứ tự hạng

    const score = Math.max(0, Number(player.score) || 0);
    const progress = Math.min(1, score / goal);
    const car = lane.querySelector('.lane__car');
    const scoreEl = lane.querySelector('.lane__score');

    if (car) car.style.left = `${progress * 100}%`;
    if (scoreEl) scoreEl.textContent = `${score}`;
    lane.classList.toggle('is-winner', player.id === sorted[0]?.id && progress >= 1);
    lane.classList.toggle('is-me', !!me && player.id === me.id);

    const nameEl = lane.querySelector('.lane__name');
    if (nameEl) nameEl.textContent = player.name;
  }
}

function unmount() {
  if (state?.root) state.root.innerHTML = '';
  state = null;
}

export default {
  id: 'race',
  name: 'Đua xe',
  mount,
  update,
  unmount,
};
