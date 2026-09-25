// Cấu hình PM2 cho máy chủ nhà.
//
// Hai tiến trình:
//   thiepminh-api  backend Express, cổng 1000
//   thiepminh-web  giao diện đã build + chuyển tiếp /api sang backend, cổng 1001
//
// Cloudflare Tunnel trỏ vào CỔNG 1001. Giao diện và API đi chung một cổng nên
// trình duyệt thấy cùng một tên miền: không dính CORS, và bản build không chứa
// tên miền nào — thêm tên miền về sau không phải dựng lại.
//
// Cách dùng thường ngày:
//   pm2 start ecosystem.config.cjs     bật cả hai
//   pm2 restart thiepminh-api          khởi động lại riêng backend
//   pm2 logs thiepminh-api             xem log
//   pm2 save                           ghi nhớ để bật lại sau khi khởi động máy
const path = require('path');

const GOC = __dirname;
const CONG_BE = Number(process.env.CONG_BE) || 1000;
const CONG_FE = Number(process.env.CONG_FE) || 1001;

module.exports = {
  apps: [
    {
      name: 'thiepminh-api',
      cwd: path.join(GOC, 'BE_Wedding_Web'),
      script: 'src/server.js',
      // Một tiến trình thôi: xử lý ảnh bằng sharp đã ăn gần hết 4 nhân của M720q,
      // chạy cluster chỉ làm tranh nhau CPU và nhân đôi bộ nhớ.
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: CONG_BE },
      // Rò rỉ bộ nhớ thì tự khởi động lại thay vì để máy hết RAM.
      max_memory_restart: '900M',
      // Chết liên tục thì dừng hẳn, đừng quay vòng vô tận làm đầy log.
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 3000,
      error_file: path.join(GOC, 'logs', 'api-loi.log'),
      out_file: path.join(GOC, 'logs', 'api.log'),
      merge_logs: true,
      time: true,
    },
    {
      name: 'thiepminh-web',
      cwd: path.join(GOC, 'FE_Wedding_Web'),
      script: 'server.cjs',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        FE_PORT: CONG_FE,
        BE_PORT: CONG_BE,
        BE_HOST: '127.0.0.1',
      },
      max_memory_restart: '200M',
      error_file: path.join(GOC, 'logs', 'web-loi.log'),
      out_file: path.join(GOC, 'logs', 'web.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
