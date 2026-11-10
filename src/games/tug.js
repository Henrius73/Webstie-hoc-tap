// Game kéo co: 2 đội. Trả lời đúng kéo dây về phía mình, sai bị đội bạn kéo
import { esc } from '../utils.js';
import { icon } from '../icons.js';

const STEPS = 4; // số bước kéo để dây về đích

// Trạng thái ván đang chạy; mỗi lúc chỉ có một ván trên màn hình
let gameState = null;

// Dựng giao diện game vào container, chỉ dùng 2 đội đầu tiên
function init(container, teams) {
  gameState = {
    root: container,
    teams: teams.slice(0, 2).map(t => ({ ...t })),
    position: 0, // > 0: đội trái có lợi thế, < 0: đội phải có lợi thế
    winner: null,
  };

  const teamBox = (team, side) => team ? `
    <div class="tug__team tug__team--${side}" data-team="${team.id}" style="--team:${team.color}">
      <span class="tug__emoji">${icon('dumbbell')}</span>
      <strong class="tug__name">${esc(team.name)}</strong>
      <span class="tug__state"></span>
    </div>` : '';

  container.innerHTML = `
    <div class="tug">
      <div class="tug__head">
        <span>${icon('move-horizontal')} Kéo co tri thức</span>
        <span class="tug__hint">Đúng kéo dây về phía mình · Sai bị đối thủ kéo 1 bước</span>
      </div>
      <div class="tug__arena">
        ${teamBox(gameState.teams[0], 'left')}
        <div class="tug__field">
          <div class="tug__line"></div>
          <span class="tug__target tug__target--left">${icon('flag')}</span>
          <span class="tug__target tug__target--right">${icon('flag')}</span>
          <div class="tug__knot">${icon('grip')}</div>
        </div>
        ${teamBox(gameState.teams[1], 'right')}
      </div>
    </div>`;

  render();
}

// Đặt nút thắt theo thế trận và cập nhật trạng thái hai đội
function render() {
  if (!gameState) return;
  const { root, teams, position, winner } = gameState;

  const knot = root.querySelector('.tug__knot');
  if (!knot) return;
  knot.style.left = `${50 - (position / STEPS) * 40}%`; // 10% .. 90%

  root.querySelectorAll('.tug__team').forEach(el => {
    const team = teams.find(t => t.id === el.dataset.team);
    if (!team) return;

    const isLeft = team.id === teams[0].id;
    const remaining = isLeft ? STEPS - position : STEPS + position;
    el.querySelector('.tug__state').textContent =
      remaining <= 0 ? 'Về đích!' : `Còn ${remaining} bước`;

    // Tô sáng đội đang kéo dây về phía mình / đội thắng
    el.classList.toggle('is-pulling', isLeft ? position > 0 : position < 0);
    el.classList.toggle('is-winning', winner === team);
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

// Gọi khi một đội trả lời; đúng kéo về phía mình, sai bị kéo ngược lại
function onAnswer(teamId, isCorrect) {
  if (!gameState || gameState.winner) return;
  const index = gameState.teams.findIndex(t => t.id === teamId);
  if (index < 0) return;

  const direction = index === 0 ? 1 : -1;
  gameState.position += direction * (isCorrect ? 1 : -1);
  gameState.position = Math.max(-STEPS, Math.min(STEPS, gameState.position));

  if (gameState.position >= STEPS) gameState.winner = gameState.teams[0];
  else if (gameState.position <= -STEPS) gameState.winner = gameState.teams[1];
  render();
}

// Trả về đội thắng khi ván kết thúc, ngược lại null
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
  description: 'Hai đội so tài: trả lời đúng kéo dây về phía mình.',
  teamLimit: 2, // kéo co chỉ chơi được với đúng 2 đội
  init,
  onAnswer,
  checkWin,
  destroy,
};
