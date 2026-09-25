// Máy chủ phục vụ giao diện đã build, kèm chuyển tiếp API sang backend.
//
// Vì sao không dùng `pm2 serve` có sẵn: nó chỉ phục vụ tệp tĩnh, không chuyển
// tiếp được /api. Mà nếu giao diện gọi API sang CỔNG KHÁC thì thành khác origin:
// dính CORS, và bản build phải biết trước tên miền API. Ở đây mọi thứ đi chung
// một cổng nên giao diện không cần biết tên miền nào — thêm tên miền về sau
// không phải dựng lại.
//
// Không thêm thư viện ngoài: chỉ dùng http/fs/path có sẵn của Node.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const THU_MUC = path.resolve(process.env.FE_DIST || path.join(__dirname, 'dist'));
const CONG = Number(process.env.FE_PORT) || 1001;
const BE = {
  host: process.env.BE_HOST || '127.0.0.1',
  port: Number(process.env.BE_PORT) || 1000,
};

// Những đường dẫn thuộc về backend. Còn lại là của giao diện.
// Khớp cả trường hợp tiền tố /same-origin/ hoặc relative fetch từ route con (/auth/api/...)
const CUA_BACKEND = /(?:^|\/)(?:same-origin\/)?(api|uploads|templates|media|api-docs|api-docs-assets)(\/.*)?$/;

const KIEU = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

// Tệp trong assets/ do Vite đặt tên kèm mã băm nội dung -> đổi nội dung là đổi
// tên, nên cache một năm vô tư. index.html thì KHÔNG cache: nó là chỗ trỏ tới
// các tệp băm đó, cache lại là người dùng kẹt ở bản cũ sau khi cập nhật.
const cacheCho = (duong) => (
  duong.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'
);

// Chuyển tiếp sang backend, giữ cả phần thân (tải ảnh, tải nhạc).
const chuyenTiep = (req, res, targetPath) => {
  let p = targetPath || req.url;
  try {
    p = encodeURI(decodeURI(p));
  } catch (_) {}
  const opts = {
    host: BE.host,
    port: BE.port,
    method: req.method,
    path: p,
    headers: { ...req.headers, host: `${BE.host}:${BE.port}` },
  };
  const ra = http.request(opts, (tl) => {
    res.writeHead(tl.statusCode || 502, tl.headers);
    tl.pipe(res);
  });
  ra.on('error', (e) => {
    // Backend chết hoặc chưa lên. Nói rõ thay vì để trình duyệt treo.
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, message: 'Không kết nối được backend: ' + e.message }));
  });
  req.pipe(ra);
};

// Chặn thoát thư mục: mọi đường dẫn phải nằm trong thư mục dist.
const duongDanThat = (urlPath) => {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0]); } catch (_e) { return null; }
  if (p.includes('\0')) return null;
  const abs = path.resolve(path.join(THU_MUC, p));
  if (abs !== THU_MUC && !abs.startsWith(THU_MUC + path.sep)) return null;
  return abs;
};

const guiTep = (res, abs, urlPath) => {
  const ext = path.extname(abs).toLowerCase();
  const st = fs.statSync(abs);
  res.writeHead(200, {
    'Content-Type': KIEU[ext] || 'application/octet-stream',
    'Content-Length': st.size,
    'Cache-Control': cacheCho(urlPath),
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(abs).pipe(res);
};

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  const backendMatch = req.url.match(CUA_BACKEND);
  if (backendMatch) {
    // Nếu là /templates hoặc /templates/ (không có tệp con mẫu thiệp như /templates/theme/index.html)
    // thì đây là route hiển thị kho mẫu của giao diện React (SPA), không chuyển tiếp sang backend.
    const isTemplateShowcasePage = backendMatch[1] === 'templates' && (!backendMatch[2] || backendMatch[2] === '/');
    if (!isTemplateShowcasePage) {
      const cleanPath = '/' + backendMatch[1] + (backendMatch[2] || '');
      return chuyenTiep(req, res, cleanPath);
    }
  }

  const abs = duongDanThat(urlPath);
  if (!abs) { res.writeHead(400).end('duong dan khong hop le'); return; }

  // Tệp có thật thì trả về.
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return guiTep(res, abs, urlPath);

  // Không có tệp -> trả index.html để React tự định tuyến (ứng dụng một trang).
  // Nhờ vậy mở thẳng /thiep/abc hay bấm F5 giữa chừng đều không ra 404.
  const index = path.join(THU_MUC, 'index.html');
  if (!fs.existsSync(index)) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Chua build giao dien. Chay: npm run build trong FE_Wedding_Web');
    return;
  }
  return guiTep(res, index, '/index.html');
});

server.listen(CONG, () => {
  console.log(`[fe] cong ${CONG} · thu muc ${THU_MUC} · api -> ${BE.host}:${BE.port}`);
});
