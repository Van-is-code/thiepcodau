// Lớp phòng thủ chung: header bảo mật, CORS theo danh sách trắng, và giới hạn tần suất.
const helmet = require('helmet');
const cors = require('cors');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const env = require('../config/env');

// --- Header bảo mật ---
// contentSecurityPolicy tắt cho swagger-ui (tự chèn inline style/script); các route
// API trả JSON nên CSP không mang lại nhiều giá trị, nhưng /uploads có thể phục vụ
// file người dùng tải lên nên được bọc CSP riêng ở securedStatic() bên dưới.
const securityHeaders = () => helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  // Ảnh/nhạc trong thiệp được nhúng từ origin FE khác -> không được chặn cross-origin.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: env.isProd() ? { maxAge: 15552000, includeSubDomains: true } : false,
});

// --- CORS ---
// Không đặt CORS_ORIGINS -> chỉ mở toàn bộ ở dev. Ở production env.js đã chặn khởi động.
const corsMiddleware = () => {
  const allow = env.corsOrigins;
  if (allow.length === 0) {
    return cors({ origin: true, credentials: true });
  }
  return cors({
    origin: (origin, cb) => {
      // Không có Origin: request server-to-server / curl / webhook -> cho qua.
      if (!origin) return cb(null, true);
      if (allow.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin không được phép: ${origin}`));
    },
    credentials: true,
    maxAge: 86400,
  });
};

// --- Giới hạn tần suất ---
// Dùng IP thật khi chạy sau proxy (đã bật app.set('trust proxy')).
const makeLimiter = ({ windowMs, max, message, skipSuccess = false, keyBy }) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: skipSuccess,
  keyGenerator: keyBy,
  handler: (req, res) => res.status(429).json({ success: false, message }),
});

// Đăng nhập / đổi mật khẩu: chống dò mật khẩu. Đếm theo IP + username để 1 IP
// không khoá được tài khoản của người khác (và ngược lại).
const authLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: env.int(process.env.RATE_LIMIT_AUTH, 10),
  skipSuccess: true,
  message: 'Bạn đã thử quá nhiều lần. Vui lòng đợi 15 phút rồi thử lại.',
  // ipKeyGenerator chuẩn hoá IPv6 về /64 — nếu tự ghép req.ip thì mỗi địa chỉ
  // trong cùng 1 subnet IPv6 sẽ là 1 khoá riêng và giới hạn coi như vô hiệu.
  keyBy: (req, res) => `${ipKeyGenerator(req.ip)}|${String(req.body?.username || '').toLowerCase().slice(0, 64)}`,
});

// Ghi dữ liệu công khai (lời chúc / xác nhận tham dự): chống spam flood.
const publicWriteLimiter = makeLimiter({
  windowMs: 10 * 60 * 1000,
  max: env.int(process.env.RATE_LIMIT_PUBLIC_WRITE, 20),
  message: 'Bạn gửi quá nhiều lần trong thời gian ngắn. Vui lòng thử lại sau ít phút.',
});

// Tạo lại link thanh toán: mỗi lần gọi payOS tốn tài nguyên -> siết chặt.
const paymentRefreshLimiter = makeLimiter({
  windowMs: 10 * 60 * 1000,
  max: env.int(process.env.RATE_LIMIT_PAYMENT_REFRESH, 5),
  message: 'Bạn đã làm mới mã thanh toán quá nhiều lần. Vui lòng đợi vài phút.',
});

// Upload (ảnh/nhạc/QR): chống bơm rác làm đầy ổ đĩa & quota R2.
const uploadLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: env.int(process.env.RATE_LIMIT_UPLOAD, 120),
  message: 'Bạn đã tải lên quá nhiều tệp trong 1 giờ. Vui lòng thử lại sau.',
});

// Trần chung cho toàn bộ /api — rộng rãi, chỉ để chặn quét/DoS thô.
const globalApiLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: env.int(process.env.RATE_LIMIT_GLOBAL, 300),
  message: 'Quá nhiều yêu cầu. Vui lòng chậm lại.',
});

// Header cho thư mục tĩnh chứa file người dùng tải lên: cấm trình duyệt đoán kiểu
// nội dung và cấm mọi script chạy từ origin này (chống XSS lưu trữ qua file .html/.svg).
const userContentHeaders = (res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('Content-Disposition', 'inline');
};

module.exports = {
  securityHeaders,
  corsMiddleware,
  authLimiter,
  publicWriteLimiter,
  paymentRefreshLimiter,
  uploadLimiter,
  globalApiLimiter,
  userContentHeaders,
};
