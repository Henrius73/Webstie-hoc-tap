// Game đua vịt: cả lớp cùng bơi về đích, mỗi câu đúng vịt bơi 1 bước
import { esc } from '../utils.js';
import { icon } from '../icons.js';

const STEPS = 6; // số bước mặc định khi không biết số học sinh

// Trạng thái ván đang chạy; mỗi lúc chỉ có một ván trên màn hình
let gameState = null;

// Dựng giao diện game vào container, nhận danh sách người chơi (cả lớp)
function init(container, players, ctx = {}) {
  const goal = Math.max(1, Number(ctx.totalTurns) || STEPS);
  gameState = {
    root: container,
    players: players.map(p => ({ ...p, pos: Math.min(goal, Number(p.score) || 0) })),
    goal,
    winner: null,
  };

  container.innerHTML = `
    <div class="race duck">
      <div class="race__head">
        <span>${icon('waves')} Đường đua trên sông</span>
        <span class="race__hint">Mỗi câu đúng ${icon('arrow-right')} cả lớp bơi 1 bước · Tối đa ${goal} bước</span>
      </div>
      <div class="race__lanes">
        ${gameState.players.map(p => `
          <div class="lane" data-player="${p.id}">
            <span class="lane__name" style="--team:${p.color}">${esc(p.name)}</span>
            <div class="lane__track">
              <div class="lane__road">
                <span class="lane__car" style="color:${p.color}">${icon('bird')}</span>
              </div>
              <span class="lane__finish">${icon('flag')}</span>
            </div>
            <span class="lane__score">0/${goal}</span>
          </div>`).join('')}
      </div>
    </div>`;

  render();
}

// Vẽ lại vị trí vịt và điểm số
function render() {
  if (!gameState) return;
  const { root, players, goal } = gameState;

  root.querySelectorAll('.lane').forEach(lane => {
    const player = players.find(p => p.id === lane.dataset.player);
    if (!player) return;

    const duck = lane.querySelector('.lane__car');
    duck.style.left = `${(player.pos / goal) * 100}%`;
    lane.querySelector('.lane__score').textContent = `${player.pos}/${goal}`;
    lane.classList.toggle('is-winner', player.pos >= goal);

    // Hiệu ứng nhún nhẹ khi vịt vừa bơi thêm
    if (duck.dataset.pos !== String(player.pos)) {
      duck.dataset.pos = String(player.pos);
      if (duck.animate) {
        duck.animate(
          [
            { transform: 'translate(-50%, -50%) scale(1)' },
            { transform: 'translate(-50%, -50%) scale(1.2)' },
            { transform: 'translate(-50%, -50%) scale(1)' },
          ],
          { duration: 360, easing: 'ease-out' }
        );
      }
    }
  });
}

// Đồng bộ vị trí vịt theo điểm server gửi (chế độ chơi cùng lớp)
function sync(players = []) {
  if (!gameState) return;
  const byId = new Map(players.map(p => [p.id, p]));
  gameState.players = gameState.players.map(p => {
    const fresh = byId.get(p.id) || p;
    return { ...p, ...fresh, pos: Math.min(gameState.goal, Number(fresh.score) || 0) };
  });
  gameState.winner = gameState.players.find(p => p.pos >= gameState.goal) || null;
  render();
}

// Gọi khi học sinh trả lời; đúng thì vịt của cả lớp bơi 1 bước
function onAnswer(playerId, isCorrect) {
  if (!gameState || gameState.winner) return;
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return;

  if (isCorrect) player.pos = Math.min(gameState.goal, player.pos + 1);
  if (player.pos >= gameState.goal) gameState.winner = player;
  render();
}

// Trả về người chơi khi cả lớp về đích (toàn bộ câu đúng), ngược lại null
function checkWin() {
  return gameState ? gameState.winner : null;
}

// Dọn dẹp khi rời màn chơi
function destroy() {
  if (gameState?.root) gameState.root.innerHTML = '';
  gameState = null;
}

export default {
  id: 'duck',
  name: 'Đua vịt tri thức',
  icon: 'bird',
  description: 'Trả lời đúng, cả lớp cùng bơi 1 bước về đích.',
  init,
  sync,
  onAnswer,
  checkWin,
  destroy,
};
