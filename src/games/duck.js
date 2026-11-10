// Game đua vịt: giống đua xe nhưng đổi giao diện mặt nước.
// Trả lời đúng, vịt bơi 1 bước; về đích trước sẽ thắng.
import { esc } from '../utils.js';
import { icon } from '../icons.js';

const STEPS = 6; // số bước để về đích

// Trạng thái ván đang chạy; mỗi lúc chỉ có một ván trên màn hình
let gameState = null;

// Dựng giao diện game vào container, nhận danh sách đội
function init(container, teams) {
  gameState = {
    root: container,
    teams: teams.map(t => ({ ...t, pos: 0 })),
    winner: null,
  };

  container.innerHTML = `
    <div class="race duck">
      <div class="race__head">
        <span>${icon('waves')} Đường đua trên sông</span>
        <span class="race__hint">Đúng 1 câu ${icon('arrow-right')} vịt bơi 1 bước · Về đích sau ${STEPS} bước</span>
      </div>
      <div class="race__lanes">
        ${gameState.teams.map(t => `
          <div class="lane" data-team="${t.id}">
            <span class="lane__name" style="--team:${t.color}">${esc(t.name)}</span>
            <div class="lane__track">
              <div class="lane__road">
                <span class="lane__car" style="color:${t.color}">${icon('bird')}</span>
              </div>
              <span class="lane__finish">${icon('flag')}</span>
            </div>
            <span class="lane__score">0/${STEPS}</span>
          </div>`).join('')}
      </div>
    </div>`;

  render();
}

// Vẽ lại vị trí vịt và điểm số
function render() {
  if (!gameState) return;
  const { root, teams } = gameState;

  root.querySelectorAll('.lane').forEach(lane => {
    const team = teams.find(t => t.id === lane.dataset.team);
    if (!team) return;

    const duck = lane.querySelector('.lane__car');
    duck.style.left = `${(team.pos / STEPS) * 100}%`;
    lane.querySelector('.lane__score').textContent = `${team.pos}/${STEPS}`;
    lane.classList.toggle('is-winner', team.pos >= STEPS);

    // Hiệu ứng nhún nhẹ khi vịt vừa bơi thêm
    if (duck.dataset.pos !== String(team.pos)) {
      duck.dataset.pos = String(team.pos);
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

// Gọi khi một đội trả lời; đúng thì vịt bơi 1 bước
function onAnswer(teamId, isCorrect) {
  if (!gameState || gameState.winner) return;
  const team = gameState.teams.find(t => t.id === teamId);
  if (!team) return;

  if (isCorrect) team.pos = Math.min(STEPS, team.pos + 1);
  if (team.pos >= STEPS) gameState.winner = team;
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
  id: 'duck',
  name: 'Đua vịt tri thức',
  icon: 'bird',
  description: 'Trả lời đúng, chú vịt bơi 1 bước. Về đích trước để thắng.',
  teamLimit: null, // không giới hạn số đội
  init,
  onAnswer,
  checkWin,
  destroy,
};
