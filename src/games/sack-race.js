// Game nhảy bao bố: cả lớp cùng nhảy về đích, mỗi câu đúng nhảy 1 bước
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
    <div class="race sack">
      <div class="race__head">
        <span>${icon('rabbit')} Đường đua bao bố</span>
        <span class="race__hint">Mỗi câu đúng ${icon('arrow-right')} cả lớp nhảy 1 bước · Tối đa ${goal} bước</span>
      </div>
      <div class="race__lanes">
        ${gameState.players.map(p => `
          <div class="lane" data-player="${p.id}">
            <span class="lane__name" style="--team:${p.color}">${esc(p.name)}</span>
            <div class="lane__track">
              <div class="lane__road">
                <span class="lane__car" style="color:${p.color}">${icon('shopping-bag')}</span>
              </div>
              <span class="lane__finish">${icon('flag')}</span>
            </div>
            <span class="lane__score">0/${goal}</span>
          </div>`).join('')}
      </div>
    </div>`;

  render();
}

// Vẽ lại vị trí bao bố và điểm số
function render() {
  if (!gameState) return;
  const { root, players, goal } = gameState;

  root.querySelectorAll('.lane').forEach(lane => {
    const player = players.find(p => p.id === lane.dataset.player);
    if (!player) return;

    const jumper = lane.querySelector('.lane__car');
    jumper.style.left = `${(player.pos / goal) * 100}%`;
    lane.querySelector('.lane__score').textContent = `${player.pos}/${goal}`;
    lane.classList.toggle('is-winner', player.pos >= goal);

    // Hiệu ứng nhảy lên mỗi khi tiến thêm một bước (không chạy lúc mới dựng bàn)
    const moved = jumper.dataset.pos !== undefined && jumper.dataset.pos !== String(player.pos);
    jumper.dataset.pos = String(player.pos);
    if (moved && jumper.animate) {
      jumper.animate(
        [
          { transform: 'translate(-50%, -50%) rotate(0deg)' },
          { transform: 'translate(-50%, -88%) rotate(-5deg) scale(1.08)' },
          { transform: 'translate(-50%, -50%) rotate(0deg)' },
        ],
        { duration: 380, easing: 'ease-out' }
      );
    }
  });
}

// Đồng bộ vị trí bao bố theo điểm server gửi (chế độ chơi cùng lớp)
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

// Gọi khi học sinh trả lời; đúng thì bao bố của cả lớp nhảy 1 bước
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
  id: 'sack',
  name: 'Nhảy bao bố',
  icon: 'rabbit',
  description: 'Trả lời đúng, cả lớp cùng nhảy 1 bước về đích.',
  init,
  sync,
  onAnswer,
  checkWin,
  destroy,
};
