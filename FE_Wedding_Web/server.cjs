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

const boKyTuNguyHiem = (value) => String(value || '')
  .replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const chuoiGon = (value, fallback = '') => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 200) || fallback;

const duLieuApi = (apiPath) => new Promise((resolve) => {
  const request = http.request({
    host: BE.host,
    port: BE.port,
    method: 'GET',
    path: apiPath,
    headers: { Accept: 'application/json' },
  }, (response) => {
    let body = '';
    let tooLarge = false;
    response.setEncoding('utf8');
    response.on('data', (chunk) => {
      if (body.length + chunk.length > 1024 * 1024) {
        tooLarge = true;
        response.destroy();
        return;
      }
      body += chunk;
    });
    response.on('end', () => {
      if (tooLarge || response.statusCode !== 200) return resolve(null);
      try {
        const parsed = JSON.parse(body);
        resolve(parsed?.data || parsed || null);
      } catch (_) {
        resolve(null);
      }
    });
  });
  request.on('error', () => resolve(null));
  request.setTimeout(2500, () => request.destroy());
  request.end();
});

const originCua = (req) => {
  const protoFromProxy = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const protocol = protoFromProxy === 'https' ? 'https' : 'http';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  // Không để Host header bất thường chui vào HTML sinh động.
  const safeHost = /^[a-z0-9.:-]+$/i.test(host) ? host : 'localhost';
  return `${protocol}://${safeHost}`;
};

const linkTuyetDoi = (url, origin) => {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith('/') ? `${origin}${raw}` : `${origin}/${raw}`;
};

const laTrangThiepCongKhai = (urlPath) => {
  const direct = urlPath.match(/^\/([^/]+)\/?$/);
  const nested = urlPath.match(/^\/invitation\/([^/]+)\/?$/);
  const skip = new Set(['', 'auth', 'login', 'dashboard', 'editor', 'pricing', 'profile', 'admin', 'ctv', 'pay', 'payment-success', 'templates', 'mau-thiep', 'preview']);
  const slug = nested?.[1] || direct?.[1] || '';
  if (!slug || skip.has(slug.toLowerCase()) || path.extname(slug)) return null;
  try { return decodeURIComponent(slug).slice(0, 120); } catch (_) { return null; }
};

const metaChiaSe = async (req, slug) => {
  const query = new URLSearchParams((req.url || '').split('?')[1] || '');
  const guestToken = String(query.get('g') || '').trim().slice(0, 180);
  const [invitation, guest] = await Promise.all([
    duLieuApi(`/api/invitations/slug/${encodeURIComponent(slug)}`),
    guestToken ? duLieuApi(`/api/guests/public?token=${encodeURIComponent(guestToken)}`) : Promise.resolve(null),
  ]);
  if (!invitation) return null;

  const queryName = String(query.get('to') || query.get('guest') || '').trim().slice(0, 255);
  const guestName = chuoiGon(guest?.name || queryName);
  const extra = invitation.extra_data && typeof invitation.extra_data === 'object' ? invitation.extra_data : {};
  const publicTitle = chuoiGon(extra.share_title_public || invitation.title_vi || invitation.title, 'Thiệp cưới');
  const privateTemplate = chuoiGon(extra.share_title_private, 'Mời {guest_name} đến chung vui cùng chúng tớ');
  const title = guestName
    ? privateTemplate.replace(/\{\{?guest_name\}?\}|\{\{?name\}?\}/g, guestName)
    : publicTitle;
  const names = [invitation.groom?.name_groom, invitation.bride?.name_bride].filter(Boolean).join(' & ');
  const description = guestName
    ? `Trân trọng kính mời ${guestName} đến chung vui cùng chúng tôi.`
    : (names ? `Trân trọng kính mời bạn đến chung vui cùng ${names}.` : 'Trân trọng kính mời bạn đến chung vui.');
  const cover = Array.isArray(invitation.images)
    ? (invitation.images.find((image) => image?.is_cover && image?.image_url) || invitation.images.find((image) => image?.image_url))
    : null;
  const origin = originCua(req);
  const canonicalUrl = `${origin}${req.url || `/${slug}`}`;

  return {
    title: chuoiGon(title, publicTitle),
    description: chuoiGon(description),
    image: linkTuyetDoi(cover?.image_url, origin),
    canonicalUrl,
  };
};

const chenMetaChiaSe = (html, meta) => {
  const title = boKyTuNguyHiem(meta.title);
  const description = boKyTuNguyHiem(meta.description);
  const canonicalUrl = boKyTuNguyHiem(meta.canonicalUrl);
  const image = boKyTuNguyHiem(meta.image);
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${canonicalUrl}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    ...(image ? [`<meta property="og:image" content="${image}" />`] : []),
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    ...(image ? [`<meta name="twitter:image" content="${image}" />`] : []),
  ].join('\n    ');
  const withoutTitle = html.replace(/<title>[\s\S]*?<\/title>/i, '');
  return withoutTitle.replace(/<\/head>/i, `    ${tags}\n  </head>`);
};

const guiTrangThiep = (req, res, index, slug) => {
  const guiHtml = (html, meta) => {
    const output = meta ? chenMetaChiaSe(html, meta) : html;
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(output),
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(output);
  };

  fs.readFile(index, 'utf8', (error, html) => {
    if (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Khong the doc giao dien');
      return;
    }
    metaChiaSe(req, slug)
      .then((meta) => guiHtml(html, meta))
      .catch(() => guiHtml(html, null));
  });
};

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
  // Bot của Messenger/Zalo/Facebook không chạy React, nên trả sẵn Open Graph
  // theo thiệp và khách mời trước khi React nhận route để hiển thị nội dung.
  const slug = req.method === 'GET' ? laTrangThiepCongKhai(urlPath) : null;
  if (slug) return guiTrangThiep(req, res, index, slug);
  return guiTep(res, index, '/index.html');
});

server.listen(CONG, () => {
  console.log(`[fe] cong ${CONG} · thu muc ${THU_MUC} · api -> ${BE.host}:${BE.port}`);
});
