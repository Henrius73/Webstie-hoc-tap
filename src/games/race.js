// Game đua xe: mỗi câu đúng, xe tiến 1 bước; đội về đích trước sẽ thắng
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
    <div class="race">
      <div class="race__head">
        <span>${icon('flag')} Đường đua</span>
        <span class="race__hint">Đúng 1 câu ${icon('arrow-right')} tiến 1 bước · Về đích sau ${STEPS} bước</span>
      </div>
      <div class="race__lanes">
        ${gameState.teams.map(t => `
          <div class="lane" data-team="${t.id}">
            <span class="lane__name" style="--team:${t.color}">${esc(t.name)}</span>
            <div class="lane__track">
              <div class="lane__road">
                <span class="lane__car" style="color:${t.color}">${icon('car')}</span>
              </div>
              <span class="lane__finish">${icon('flag')}</span>
            </div>
            <span class="lane__score">0/${STEPS}</span>
          </div>`).join('')}
      </div>
    </div>`;

  render();
}

// Vẽ lại vị trí xe và điểm số
function render() {
  if (!gameState) return;
  const { root, teams } = gameState;

  root.querySelectorAll('.lane').forEach(lane => {
    const team = teams.find(t => t.id === lane.dataset.team);
    if (!team) return;

    const car = lane.querySelector('.lane__car');
    car.style.left = `${(team.pos / STEPS) * 100}%`;
    lane.querySelector('.lane__score').textContent = `${team.pos}/${STEPS}`;
    lane.classList.toggle('is-winner', team.pos >= STEPS);

    // Hiệu ứng nhún nhẹ khi xe vừa tiến bước
    if (car.dataset.pos !== String(team.pos)) {
      car.dataset.pos = String(team.pos);
      if (car.animate) {
        car.animate(
          [
            { transform: 'translate(-50%, -50%) scaleX(-1) scale(1)' },
            { transform: 'translate(-50%, -50%) scaleX(-1) scale(1.25)' },
            { transform: 'translate(-50%, -50%) scaleX(-1) scale(1)' },
          ],
          { duration: 380, easing: 'ease-out' }
        );
      }
    }
  });
}

// Gọi khi một đội trả lời; đúng thì xe tiến 1 bước
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
  id: 'race',
  name: 'Đua xe tri thức',
  icon: 'car',
  description: 'Trả lời đúng, xe tiến 1 bước. Về đích trước để thắng.',
  teamLimit: null, // không giới hạn số đội
  init,
  onAnswer,
  checkWin,
  destroy,
};
