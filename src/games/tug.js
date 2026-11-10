// Game kéo co: cả lớp kéo dây về đích, mỗi câu sai bị "thử thách" kéo lại
import { esc } from '../utils.js';
import { icon } from '../icons.js';

const STEPS = 4; // số bước mặc định khi không biết số học sinh

// Trạng thái ván đang chạy; mỗi lúc chỉ có một ván trên màn hình
let gameState = null;

// Dựng giao diện game vào container, nhận danh sách người chơi (cả lớp)
function init(container, players, ctx = {}) {
  const goal = Math.max(1, Number(ctx.totalTurns) || STEPS);
  const classSide = players[0] || { id: 'class', name: 'Cả lớp', color: '#7c3aed' };
  gameState = {
    root: container,
    sides: [
      { ...classSide },
      { id: 'challenge', name: 'Thử thách', color: '#64748b' },
    ],
    goal,
    position: 0, // > 0: cả lớp có lợi thế, < 0: thử thách có lợi thế
    winner: null,
  };

  const sideBox = (side, alignment) => side ? `
    <div class="tug__team tug__team--${alignment}" data-side="${side.id}" style="--team:${side.color}">
      <span class="tug__emoji">${icon('dumbbell')}</span>
      <strong class="tug__name">${esc(side.name)}</strong>
      <span class="tug__state"></span>
    </div>` : '';

  container.innerHTML = `
    <div class="tug">
      <div class="tug__head">
        <span>${icon('move-horizontal')} Kéo co tri thức</span>
        <span class="tug__hint">Đúng kéo dây về phía lớp · Sai bị thử thách kéo 1 bước</span>
      </div>
      <div class="tug__arena">
        ${sideBox(gameState.sides[0], 'left')}
        <div class="tug__field">
          <div class="tug__line"></div>
          <span class="tug__target tug__target--left">${icon('flag')}</span>
          <span class="tug__target tug__target--right">${icon('flag')}</span>
          <div class="tug__knot">${icon('grip')}</div>
        </div>
        ${sideBox(gameState.sides[1], 'right')}
      </div>
    </div>`;

  render();
}

// Đặt nút thắt theo thế trận và cập nhật trạng thái hai bên
function render() {
  if (!gameState) return;
  const { root, sides, position, goal, winner } = gameState;

  const knot = root.querySelector('.tug__knot');
  if (!knot) return;
  knot.style.left = `${50 - (position / goal) * 40}%`; // 10% .. 90%

  root.querySelectorAll('.tug__team').forEach(el => {
    const side = sides.find(s => s.id === el.dataset.side);
    if (!side) return;

    const isLeft = side.id === sides[0].id;
    const remaining = isLeft ? goal - position : goal + position;
    el.querySelector('.tug__state').textContent =
      remaining <= 0 ? 'Về đích!' : `Còn ${remaining} bước`;

    // Tô sáng bên đang kéo dây về phía mình / bên thắng
    el.classList.toggle('is-pulling', isLeft ? position > 0 : position < 0);
    el.classList.toggle('is-winning', winner === side);
  });

  // Hiệu ứng nhún khi nút thắt vừa di chuyển
  if (knot.dataset.pos !== String(position)) {
    knot.dataset.pos = String(position);
    if (knot.animate) {
      knot.animate(
        [
          { transform: 'translate(-50%, -50%) scale(1)' },
          { transform: 'translate(-50%, -50%) scale(1.22)' },
          { transform: 'translate(-50%, -50%) scale(1)' },
        ],
        { duration: 340, easing: 'ease-out' }
      );
    }
  }
}

// Gọi khi học sinh trả lời; đúng kéo về phía lớp, sai bị kéo ngược lại
function onAnswer(playerId, isCorrect) {
  if (!gameState || gameState.winner) return;
  if (gameState.sides.findIndex(s => s.id === playerId) < 0) return;

  gameState.position += isCorrect ? 1 : -1;
  gameState.position = Math.max(-gameState.goal, Math.min(gameState.goal, gameState.position));

  if (gameState.position >= gameState.goal) gameState.winner = gameState.sides[0];
  else if (gameState.position <= -gameState.goal) gameState.winner = gameState.sides[1];
  render();
}

// Trả về bên thắng khi dây về đích, ngược lại null
function checkWin() {
  return gameState ? gameState.winner : null;
}

// Dọn dẹp khi rời màn chơi
function destroy() {
  if (gameState?.root) gameState.root.innerHTML = '';
  gameState = null;
}

export default {
  id: 'tug',
  name: 'Kéo co tri thức',
  icon: 'move-horizontal',
  description: 'Cả lớp cùng kéo dây về đích; mỗi câu sai bị thử thách kéo lại.',
  init,
  onAnswer,
  checkWin,
  destroy,
};
