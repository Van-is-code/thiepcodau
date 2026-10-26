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
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const protoFromProxy = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const isCfHttps = String(req.headers['cf-visitor'] || '').includes('https');
  const isHttps = protoFromProxy === 'https' || isCfHttps || host.endsWith('thiepminh.io.vn');
  const protocol = isHttps ? 'https' : 'http';
  // Không để Host header bất thường chui vào HTML sinh động.
  const safeHost = /^[a-z0-9.:-]+$/i.test(host) ? host : 'thiepminh.io.vn';
  return `${protocol}://${safeHost}`;
};

const linkTuyetDoi = (url, origin) => {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith('/') ? `${origin}${raw}` : `${origin}/${raw}`;
};

const dinhDangNgay = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch (_) {
    return '';
  }
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

  // Tên cặp đôi: ưu tiên tên đã ghép custom hoặc tên chú rể & cô dâu
  const coupleNames = chuoiGon(extra.couple_names)
    || [invitation.groom?.name_groom, invitation.bride?.name_bride].filter(Boolean).join(' & ');

  // Ngày cưới: format YYYY-MM-DD theo chuẩn ảnh mẫu ("Our wedding date: 2026-09-21")
  const weddingDateStr = dinhDangNgay(invitation.ceremony_date || invitation.reception_date);

  // Câu chúc / lời mời / lời cảm ơn
  const weddingWish = chuoiGon(
    invitation.thank_you_message || invitation.extra_notes,
    'Sự hiện diện của quý khách là niềm hạnh phúc và vinh dự to lớn cho gia đình chúng tôi!'
  );

  // Tiêu đề & mô tả công khai mặc định:
  // Đúng chuẩn mẫu ảnh người dùng gửi:
  // Title: "Đăng Chiến & Minh Hằng Wedding site!"
  // Description: "Đăng Chiến & Minh Hằng - Our wedding date: 2026-11-16 | Sự hiện diện của quý khách..."
  const defaultPublicTitle = coupleNames ? `${coupleNames} Wedding site!` : chuoiGon(invitation.title_vi || invitation.title, 'Thiệp Cưới Online');
  const defaultPublicDescription = coupleNames
    ? (weddingDateStr
        ? `${coupleNames} - Our wedding date: ${weddingDateStr} | ${weddingWish}`
        : `${coupleNames} | ${weddingWish}`)
    : weddingWish;

  const publicTitle = chuoiGon(extra.share_title_public, defaultPublicTitle);
  const publicDescription = chuoiGon(extra.share_description_public, defaultPublicDescription);

  // Tiêu đề & mô tả riêng cho khách mời (khi có ?to=... hoặc ?g=...)
  const defaultPrivateTitle = coupleNames
    ? `Mời {guest_name} đến chung vui cùng ${coupleNames}`
    : 'Mời {guest_name} đến chung vui cùng chúng tôi';
  const defaultPrivateDescription = coupleNames
    ? (weddingDateStr
        ? `Trân trọng kính mời {guest_name} đến chung vui cùng ${coupleNames} vào ngày ${weddingDateStr}. Sự hiện diện của {guest_name} là niềm hạnh phúc to lớn của gia đình chúng tôi!`
        : `Trân trọng kính mời {guest_name} đến chung vui cùng ${coupleNames}. Sự hiện diện của {guest_name} là niềm hạnh phúc to lớn của gia đình chúng tôi!`)
    : 'Trân trọng kính mời {guest_name} đến chung vui cùng gia đình chúng tôi.';

  const privateTitleTemplate = chuoiGon(extra.share_title_private, defaultPrivateTitle);
  const privateDescriptionTemplate = chuoiGon(extra.share_description_private, defaultPrivateDescription);

  const title = guestName
    ? privateTitleTemplate.replace(/\{\{?guest_name\}?}|\{\{?name\}?}/g, guestName)
    : publicTitle;
  const description = guestName
    ? privateDescriptionTemplate.replace(/\{\{?guest_name\}?}|\{\{?name\}?}/g, guestName)
    : publicDescription;

  // Tìm ảnh đẹp nhất để hiển thị thẻ xem trước (Open Graph preview image)
  // Ưu tiên:
  // 1. Ảnh đánh dấu cover (is_cover = true)
  // 2. Ảnh loại 'cover'
  // 3. Ảnh album 'gallery', 'story', 'hero' (ảnh đôi)
  // 4. Bất kỳ ảnh nào tải lên (khác bank_qr)
  // 5. Ảnh thumbnail_url của template
  // 6. Ảnh mặc định theo template_code (vd ảnh mẫu cưới Hydrangea / Blue Botanical)
  const allImages = Array.isArray(invitation.images) ? invitation.images : [];
  const validUserImages = allImages.filter((img) => img?.image_url && img?.image_type !== 'bank_qr');

  const chosenImg = validUserImages.find((img) => img.is_cover)
    || validUserImages.find((img) => img.image_type === 'cover')
    || validUserImages.find((img) => ['gallery', 'story', 'hero'].includes(img.image_type))
    || validUserImages[0]
    || null;

  let rawImageUrl = '';
  let imageWidth = 1200;
  let imageHeight = 800;

  if (chosenImg) {
    const jpegVariants = Array.isArray(chosenImg.variants?.jpeg) ? chosenImg.variants.jpeg : [];
    const bestJpeg = jpegVariants.length > 0 ? jpegVariants[jpegVariants.length - 1] : null;
    rawImageUrl = bestJpeg?.url || chosenImg.image_url;
    imageWidth = bestJpeg?.width || chosenImg.width || 1200;
    imageHeight = bestJpeg?.height || chosenImg.height || 800;
  } else if (extra.share_image) {
    rawImageUrl = extra.share_image;
  } else if (invitation.template?.thumbnail_url) {
    rawImageUrl = invitation.template.thumbnail_url;
  } else {
    const code = invitation.template?.template_code;
    if (code === 'theme_blue_botanical_masterpiece') {
      rawImageUrl = '/templates/theme_blue_botanical_masterpiece/assets/images/couple/52ed9a3f-608e-403c-98a9-9cf73747e2a8.jpg';
    } else {
      rawImageUrl = '/templates/theme_hydrangea_editorial/assets/images/52ed9a3f-608e-403c-98a9-9cf73747e2a8.jpg';
    }
  }

  const origin = originCua(req);
  const canonicalUrl = `${origin}${req.url || `/${slug}`}`;
  const siteName = coupleNames || 'Thiệp Cưới Online';

  // Kích thước chuẩn cho Open Graph:
  // Nếu ảnh gốc là ngang (landscape): 1200 x 630
  // Nếu ảnh gốc là dọc (portrait) hoặc vuông: 1000 x 1000 (chuẩn thẻ vuông Messenger di động)
  let targetWidth = 1000;
  let targetHeight = 1000;
  if (chosenImg && chosenImg.width && chosenImg.height) {
    if (Number(chosenImg.width) >= Number(chosenImg.height) * 1.15) {
      targetWidth = 1200;
      targetHeight = 630;
    } else {
      targetWidth = 1000;
      targetHeight = 1000;
    }
  }

  // Dùng endpoint chuyên dụng /api/invitations/slug/:slug/og-image.jpg
  // Tự động smart-crop cô dâu chú rể, JPEG chuẩn, không bao giờ dính CSP sandbox hay SAMEORIGIN
  const imageVersion = chosenImg?.id ? String(chosenImg.id).slice(0, 8) : '1';
  const ogImageUrl = `${origin}/api/invitations/slug/${encodeURIComponent(slug)}/og-image.jpg?v=${imageVersion}`;

  return {
    title: chuoiGon(title, defaultPublicTitle),
    description: chuoiGon(description, defaultPublicDescription),
    image: ogImageUrl,
    imageType: 'image/jpeg',
    imageWidth: targetWidth,
    imageHeight: targetHeight,
    canonicalUrl,
    siteName,
  };
};

const chenMetaChiaSe = (html, meta) => {
  const title = boKyTuNguyHiem(meta.title);
  const description = boKyTuNguyHiem(meta.description);
  const canonicalUrl = boKyTuNguyHiem(meta.canonicalUrl);
  const image = boKyTuNguyHiem(meta.image);
  const imageType = boKyTuNguyHiem(meta.imageType || 'image/jpeg');
  const siteName = boKyTuNguyHiem(meta.siteName || 'Thiệp Cưới Online');

  const dimensionTags = (image && meta.imageWidth && meta.imageHeight) ? [
    `<meta property="og:image:width" content="${meta.imageWidth}" />`,
    `<meta property="og:image:height" content="${meta.imageHeight}" />`,
  ] : [];

  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${canonicalUrl}" />`,

    // Open Graph / Facebook / Messenger / Zalo
    `<meta property="og:site_name" content="${siteName}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    `<meta property="og:description" content="${description}" />`,
    ...(image ? [
      `<meta property="og:image" content="${image}" />`,
      `<meta property="og:image:url" content="${image}" />`,
      `<meta property="og:image:secure_url" content="${image}" />`,
      `<meta property="og:image:type" content="${imageType}" />`,
      ...dimensionTags,
      `<meta property="og:image:alt" content="${title}" />`,
    ] : []),

    // Twitter Card (Messenger đọc thẻ này để hiển thị ảnh preview tràn viền)
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    ...(image ? [
      `<meta name="twitter:image" content="${image}" />`,
      `<meta name="twitter:image:src" content="${image}" />`,
    ] : []),

    // Zalo hints
    `<meta property="zalo:title" content="${title}" />`,
    `<meta property="zalo:description" content="${description}" />`,
    ...(image ? [`<meta property="zalo:image" content="${image}" />`] : []),
  ].join('\n    ');

  // ĐẶT TOÀN BỘ THẺ META NGAY ĐẦU <head> (trước mọi thẻ <script> và <link css>)
  // Các bot như Facebook/Messenger chỉ đọc ~60KB đầu tiên của HTML, nếu để script ở trước
  // hoặc đặt thẻ meta ở cuối </head>, bot có thể bỏ qua không đọc thẻ og:image.
  let output = html.replace(/<title>[\s\S]*?<\/title>/i, '');
  output = output.replace(/<meta\s+(?:property|name)=["'](?:og:|twitter:|zalo:|description)[^>]*>/gi, '');
  
  if (/<head[^>]*>/i.test(output)) {
    output = output.replace(/<head([^>]*)>/i, `<head$1 prefix="og: https://ogp.me/ns#">\n    ${tags}`);
  } else {
    output = `<head prefix="og: https://ogp.me/ns#">\n    ${tags}\n  </head>\n` + output;
  }
  return output;
};

const guiTrangThiep = (req, res, index, slug) => {
  const guiHtml = (html, meta) => {
    const output = meta ? chenMetaChiaSe(html, meta) : html;
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(output),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
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
    const headers = { ...tl.headers };
    delete headers['x-frame-options'];
    delete headers['cross-origin-opener-policy'];
    if (!headers['access-control-allow-origin']) headers['access-control-allow-origin'] = '*';
    if (!headers['cross-origin-resource-policy']) headers['cross-origin-resource-policy'] = 'cross-origin';
    res.writeHead(tl.statusCode || 502, headers);
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
  const userAgent = req.headers['user-agent'] || '-';
  if (/facebook|zalo|bot|crawl|preview|curl/i.test(userAgent) || urlPath.includes('minhhang-dangchien')) {
    console.log(`[FE-REQ] ${req.method} ${req.url} | Host: ${req.headers.host} | UA: ${userAgent.slice(0, 80)}`);
  }

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
