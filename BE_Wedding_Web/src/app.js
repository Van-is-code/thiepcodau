const express = require('express');
const morgan = require('morgan');
const path = require('path');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const userService = require('./services/userService');
const notifyService = require('./services/notifyService');
const env = require('./config/env');
const {
  securityHeaders, corsMiddleware, authLimiter, globalApiLimiter, userContentHeaders,
} = require('./middlewares/security');

const app = express();

const DOCS_COOKIE_NAME = 'api_docs_token';
const DOCS_COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60;

const parseCookies = (cookieHeader = '') => {
  return cookieHeader.split(';').reduce((acc, pair) => {
    const [rawKey, ...rawValue] = pair.split('=');
    const key = (rawKey || '').trim();
    if (!key) {
      return acc;
    }
    acc[key] = decodeURIComponent(rawValue.join('=').trim());
    return acc;
  }, {});
};

const setDocsCookie = (res, token) => {
  const isSecure = process.env.NODE_ENV === 'production';
  const cookieParts = [
    `${DOCS_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${DOCS_COOKIE_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax'
  ];

  if (isSecure) {
    cookieParts.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieParts.join('; '));
};

const clearDocsCookie = (res) => {
  const isSecure = process.env.NODE_ENV === 'production';
  const cookieParts = [
    `${DOCS_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax'
  ];

  if (isSecure) {
    cookieParts.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieParts.join('; '));
};

const requireApiDocsAdmin = (req, res, next) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[DOCS_COOKIE_NAME];

  if (!token) {
    return res.redirect('/api-docs');
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    if (!decoded || decoded.role !== 'admin') {
      clearDocsCookie(res);
      return res.redirect('/api-docs');
    }

    req.user = decoded;
    return next();
  } catch (error) {
    clearDocsCookie(res);
    return res.redirect('/api-docs');
  }
};

const swaggerUiOptions = {
  customSiteTitle: 'Wedding API Docs',
  customJs: '/api-docs-assets/swagger-auto-auth.js',
  swaggerOptions: {
    persistAuthorization: true
  }
};

// Chạy sau reverse proxy (nginx / Cloudflare): không bật thì req.ip luôn là IP của
// proxy, khiến rate limit gộp chung tất cả người dùng vào 1 khoá.
app.set('trust proxy', Number.parseInt(process.env.TRUST_PROXY_HOPS, 10) || 1);
// Không quảng cáo "Express" cho công cụ dò tự động.
app.disable('x-powered-by');

// Middleware
app.use(securityHeaders());
app.use(corsMiddleware());
app.use(morgan(env.isProd() ? 'combined' : 'dev'));
// Giới hạn kích thước body: mặc định 100kb của Express là đủ, nhưng nêu rõ ràng
// để không ai vô tình nới lên và mở đường cho tấn công làm cạn bộ nhớ.
app.use(express.json({ limit: env.jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.jsonBodyLimit }));

// Trần chung cho toàn bộ /api — chặn quét và dò tự động.
app.use('/api', globalApiLimiter);
// Ảnh chủ thiệp upload có tên file ngẫu nhiên duy nhất -> cache dài ngày ở trình
// duyệt cho khỏi tải lại mỗi lần khách mở thiệp (trước đây không set nên ảnh load
// lại liên tục, cảm giác chậm).
// setHeaders: mọi tệp do NGƯỜI DÙNG tải lên đều được phục vụ với nosniff + CSP
// sandbox, nên kể cả nếu lọt được 1 tệp HTML/SVG lên thì trình duyệt cũng không chạy
// script từ đó (chống XSS lưu trữ trên chính domain API).
// Tên tệp ảnh do hệ thống sinh ra đều DUY NHẤT và không bao giờ bị ghi đè: bản
// đã qua dây chuyền xử lý đặt theo mã băm nội dung, bản cũ đặt theo thời điểm +
// UUID. Đổi ảnh là đổi luôn đường dẫn. Vậy nên cache được cả năm và đánh dấu
// "immutable" y như khi để trên R2 — thiếu immutable thì trình duyệt vẫn hỏi lại
// máy chủ mỗi lần người dùng tải lại trang, tốn một vòng đi về vô ích.
const IMMUTABLE_YEAR = 'public, max-age=31536000, immutable';
const STATIC_MEDIA_OPTS = {
  etag: true,
  lastModified: true,
  setHeaders: (res) => {
    userContentHeaders(res);
    res.setHeader('Cache-Control', IMMUTABLE_YEAR);
  },
};
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), STATIC_MEDIA_OPTS));
app.use('/media', express.static(path.join(process.cwd(), 'media'), STATIC_MEDIA_OPTS));
// Gói mẫu thiệp (html/css/js/ảnh) được upload qua /api/invitation-templates/upload
// và phục vụ tĩnh tại đây. Thêm mẫu mới = upload + insert DB, không cần rebuild FE.
// KHÔNG cache lâu: file mẫu (html/css) có thể được sửa & phục vụ lại tại chỗ.
app.use('/templates', express.static(path.join(process.cwd(), 'uploads', 'templates'), {
  etag: true,
  setHeaders: function (res, filePath) {
    res.setHeader('Cache-Control', /\.(html|js|css)$/i.test(filePath) ? 'no-cache' : 'public, max-age=86400');
  },
}));
app.use('/api-docs-assets', express.static(path.join(__dirname, 'public')));
app.use('/api-docs/ui', requireApiDocsAdmin, swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
app.get('/api-docs', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'api-docs-login.html');
  return res.sendFile(filePath);
});
app.post('/api-docs/login', authLimiter, async (req, res) => {
  try {
    const data = await userService.login(req.body);
    if (!data.user || data.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới được truy cập API docs'
      });
    }

    setDocsCookie(res, data.token);
    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      redirect: '/api-docs/ui',
      token: data.token
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Đăng nhập thất bại'
    });
  }
});
app.post('/api-docs/logout', (req, res) => {
  clearDocsCookie(res);
  return res.status(200).json({
    success: true,
    message: 'Đăng xuất thành công'
  });
});

// Routes
const userRoutes = require('./routes/userRoutes');
const invitationRoutes = require('./routes/invitationRoutes');
const invitationTemplateRoutes = require('./routes/invitationTemplateRoutes');
const privateInvitationRoutes = require('./routes/privateInvitationRoutes');
const invitationImageRoutes = require('./routes/invitationImageRoutes');
const guestRoutes = require('./routes/guestRoutes');
const messageCheckinRoutes = require('./routes/messageCheckinRoutes');
const groomRoutes = require('./routes/groomRoutes');
const brideRoutes = require('./routes/brideRoutes');
const mediaUploadRoutes = require('./routes/mediaUploadRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const mailRoutes = require('./routes/mailRoutes');
const bankQrRoutes = require('./routes/bankQrRoutes');
const adminRoutes = require('./routes/adminRoutes');
const musicLibraryRoutes = require('./routes/musicLibraryRoutes');
const ctvRoutes = require('./routes/ctvRoutes');

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/user', userRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/invitation', invitationRoutes);
app.use('/api/invitation-templates', invitationTemplateRoutes);
app.use('/api/invitation_templates', invitationTemplateRoutes);
app.use('/api/private-invitations', privateInvitationRoutes);
app.use('/api/private_invitation', privateInvitationRoutes);
app.use('/api/invitation-images', invitationImageRoutes);
app.use('/api/invitation_images', invitationImageRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/guest', guestRoutes);
app.use('/api/messages-checkins', messageCheckinRoutes);
app.use('/api/messages_checkins', messageCheckinRoutes);
app.use('/api/grooms', groomRoutes);
app.use('/api/groom', groomRoutes);
app.use('/api/brides', brideRoutes);
app.use('/api/bride', brideRoutes);
app.use('/api/media-upload', mediaUploadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/bank-qr', bankQrRoutes);
app.use('/api/bank_qr', bankQrRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/music-library', musicLibraryRoutes);
app.use('/api/ctv', ctvRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Wedding Web API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/users',
      usersAlias: '/api/user',
      invitations: '/api/invitations',
      invitationsAlias: '/api/invitation',
      invitationTemplates: '/api/invitation-templates',
      invitationTemplatesAlias: '/api/invitation_templates',
      privateInvitations: '/api/private-invitations',
      privateInvitationsAlias: '/api/private_invitation',
      invitationImages: '/api/invitation-images',
      invitationImagesAlias: '/api/invitation_images',
      guests: '/api/guests',
      guestsAlias: '/api/guest',
      messagesCheckins: '/api/messages-checkins',
      messagesCheckinsAlias: '/api/messages_checkins',
      grooms: '/api/grooms',
      groomsAlias: '/api/groom',
      brides: '/api/brides',
      bridesAlias: '/api/bride',
      mediaUpload: '/api/media-upload',
      mediaUploadCrud: '/api/media-upload?resourceType=image|video',
      mailInvitation: '/api/mail/invitation',
      mailInvitationPreview: '/api/mail/invitation/preview',
      bankQrScan: '/api/bank-qr/scan',
      apiDocsLogin: '/api-docs',
      apiDocsUi: '/api-docs/ui'
    }
  });
});

// Healthcheck cho reverse proxy / trình giám sát.
app.get('/health', (req, res) => res.status(200).json({ ok: true, ts: Date.now() }));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route không tồn tại'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Chỉ báo Telegram khi là lỗi bất thường (>=500 hoặc không rõ status), bỏ qua 4xx nghiệp vụ.
  if (!err.status || err.status >= 500) {
    notifyService.alert(
      `Lỗi ${err.status || 500} · ${req.method} ${req.originalUrl}`,
      String(err.message || err).slice(0, 600),
      `err:${req.method}:${req.path}:${String(err.message || '').slice(0, 80)}`
    );
  }

  // Multer error handling
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File quá lớn. Kích thước tối đa là 10MB'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Số lượng file vượt quá giới hạn'
      });
    }
  }

  // CORS từ chối origin -> 403 rõ ràng, không phải 500.
  if (err && /Origin không được phép/.test(err.message || '')) {
    return res.status(403).json({ success: false, message: 'Origin không được phép gọi API này' });
  }

  const status = err.status || 500;
  // Lỗi 5xx KHÔNG được lộ thông điệp nội bộ ra ngoài: chuỗi lỗi của Sequelize/driver
  // thường kèm tên bảng, tên cột, thậm chí câu SQL — đúng thứ kẻ tấn công cần để dò
  // cấu trúc DB. Lỗi 4xx là lỗi nghiệp vụ, hiển thị được cho người dùng.
  const safeMessage = status >= 500
    ? 'Đã có lỗi xảy ra ở máy chủ. Vui lòng thử lại sau.'
    : (err.message || 'Yêu cầu không hợp lệ');

  const body = { success: false, message: safeMessage };
  // Chi tiết đầy đủ chỉ hiện ở môi trường dev, để lập trình viên còn debug.
  if (!env.isProd() && status >= 500) {
    body.debug = { message: err.message, stack: String(err.stack || '').split(String.fromCharCode(10)).slice(0, 5) };
  }
  return res.status(status).json(body);
});

module.exports = app;
