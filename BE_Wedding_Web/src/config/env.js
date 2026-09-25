// Kiểm tra & chuẩn hoá biến môi trường ngay khi khởi động.
// Mục tiêu: KHÔNG bao giờ để production chạy với secret mặc định / cấu hình nguy hiểm.
require('dotenv').config();

const WEAK_JWT_SECRETS = new Set([
  '', 'your_jwt_secret_key', 'your_jwt_secret_key_change_this_in_production',
  'secret', 'changeme', 'jwt_secret', 'test'
]);

const isProd = () => String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};
const int = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};
const list = (value) => String(value || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const problems = [];

// --- JWT ---
const jwtSecret = process.env.JWT_SECRET || '';
if (WEAK_JWT_SECRETS.has(jwtSecret.trim())) {
  problems.push('JWT_SECRET đang là giá trị mặc định/placeholder — bất kỳ ai biết giá trị này đều tự ký được token admin.');
} else if (jwtSecret.length < 32) {
  problems.push(`JWT_SECRET quá ngắn (${jwtSecret.length} ký tự, cần >= 32).`);
}

// --- payOS mock ---
if (bool(process.env.PAYOS_MOCK) && isProd()) {
  problems.push('PAYOS_MOCK=true ở production — webhook thanh toán sẽ KHÔNG kiểm chữ ký.');
}

// --- CORS ---
const corsOrigins = list(process.env.CORS_ORIGINS || process.env.FRONTEND_URL);
if (isProd() && corsOrigins.length === 0) {
  problems.push('Chưa đặt CORS_ORIGINS (hoặc FRONTEND_URL) — API sẽ mở cho mọi origin.');
}

if (problems.length) {
  const banner = problems.map((p) => `  ✗ ${p}`).join('\n');
  if (isProd()) {
    console.error(`\n❌ Cấu hình không an toàn cho production:\n${banner}\n`);
    throw new Error('Từ chối khởi động với cấu hình không an toàn. Sửa .env rồi chạy lại.');
  }
  console.warn(`\n⚠️  Cảnh báo cấu hình (chỉ chấp nhận ở môi trường dev):\n${banner}\n`);
}

module.exports = {
  isProd,
  bool,
  int,
  list,
  jwtSecret: jwtSecret || 'dev_only_insecure_secret',
  corsOrigins,
  // Bật/tắt tính năng
  allowPublicRegister: () => bool(process.env.ALLOW_PUBLIC_REGISTER, false),
  enableSlotPurchase: () => bool(process.env.ENABLE_SLOT_PURCHASE, false),
  // Giới hạn kích thước
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '256kb',
  maxImageBytes: int(process.env.MAX_IMAGE_BYTES, 15 * 1024 * 1024),
  maxAudioBytes: int(process.env.MAX_AUDIO_BYTES, 25 * 1024 * 1024),
};
