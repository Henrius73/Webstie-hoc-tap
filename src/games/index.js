// Danh sách game dùng chung interface ở mục 6 của project.md.
// Thêm game mới chỉ cần import module và đưa vào mảng GAMES.
import race from './race.js';
import tug from './tug.js';
import duck from './duck.js';
import sack from './sack-race.js';

const GAMES = [race, tug, duck, sack];

// Toàn bộ game đang có, theo thứ tự hiển thị
export function listGames() {
  return GAMES;
}

// Tìm game theo id; không thấy thì trả về game đầu tiên để tránh vỡ trang chơi
export function getGame(id) {
  return GAMES.find(g => g.id === id) || GAMES[0];
}
