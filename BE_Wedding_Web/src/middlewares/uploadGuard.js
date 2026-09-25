// Kiểm tra tệp tải lên bằng NỘI DUNG THẬT, không tin đuôi tệp hay Content-Type
// do trình duyệt khai báo (cả hai đều do client đặt, sửa được tuỳ ý).
//
// Lỗ hổng cũ: tên tệp người dùng đặt được dùng thẳng để suy ra đuôi khi lưu
// (`path.extname(file.originalname)` với đuôi tối đa 10 ký tự). Tải lên "x.html"
// là có ngay 1 trang HTML chạy được trên chính domain API -> XSS lưu trữ, đọc được
// token của người khác. Ở đây tệp chỉ được nhận khi magic bytes khớp danh sách trắng.
const multer = require('multer');
const env = require('../config/env');

// --- Chữ ký nhị phân của các định dạng được phép ---
const IMAGE_SIGNATURES = [
  { ext: '.jpg', mime: 'image/jpeg', test: (b) => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
  { ext: '.png', mime: 'image/png', test: (b) => b[0] === 0x89 && b.slice(1, 4).toString('latin1') === 'PNG' },
  { ext: '.gif', mime: 'image/gif', test: (b) => b.slice(0, 3).toString('latin1') === 'GIF' },
  { ext: '.webp', mime: 'image/webp', test: (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP' },
  { ext: '.avif', mime: 'image/avif', test: (b) => b.slice(4, 8).toString('latin1') === 'ftyp' && /avif|avis/.test(b.slice(8, 12).toString('latin1')) },
  { ext: '.heic', mime: 'image/heic', test: (b) => b.slice(4, 8).toString('latin1') === 'ftyp' && /heic|heix|hevc|mif1/.test(b.slice(8, 12).toString('latin1')) },
];

const AUDIO_SIGNATURES = [
  { ext: '.mp3', mime: 'audio/mpeg', test: (b) => b.slice(0, 3).toString('latin1') === 'ID3' || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0) },
  { ext: '.wav', mime: 'audio/wav', test: (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WAVE' },
  { ext: '.ogg', mime: 'audio/ogg', test: (b) => b.slice(0, 4).toString('latin1') === 'OggS' },
  { ext: '.flac', mime: 'audio/flac', test: (b) => b.slice(0, 4).toString('latin1') === 'fLaC' },
  { ext: '.m4a', mime: 'audio/mp4', test: (b) => b.slice(4, 8).toString('latin1') === 'ftyp' && /M4A|mp4|isom/.test(b.slice(8, 12).toString('latin1')) },
  // Trình duyệt ghi âm (MediaRecorder) trên Chrome/Android xuất ra WebM/Opus.
  // Thiếu dòng này thì khách bấm ghi âm lời chúc xong bị từ chối, mà thông báo
  // lại nói "sai định dạng" — không ai hiểu vì sao.
  // 1A 45 DF A3 là phần đầu EBML, dùng chung cho WebM và Matroska.
  { ext: '.webm', mime: 'audio/webm', test: (b) => b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3 },
];

const ZIP_SIGNATURES = [
  { ext: '.zip', mime: 'application/zip', test: (b) => b[0] === 0x50 && b[1] === 0x4B && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07) },
];

const SETS = { image: IMAGE_SIGNATURES, audio: AUDIO_SIGNATURES, zip: ZIP_SIGNATURES };

const detect = (buffer, kind) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  return (SETS[kind] || []).find((s) => {
    try { return s.test(buffer); } catch (_e) { return false; }
  }) || null;
};

const LABEL = {
  image: 'ảnh (JPEG, PNG, WebP, AVIF, HEIC, GIF)',
  audio: 'nhạc / ghi âm (MP3, WAV, OGG, FLAC, M4A, WebM)',
  zip: 'gói nén .zip',
};

/**
 * Middleware đặt SAU multer: xác thực nội dung tệp đã nằm trong bộ nhớ.
 *
 * @param {'image'|'audio'|'zip'} kind
 * @param {{ required?: boolean, field?: string }} options
 */
const verifyUpload = (kind, { required = true, field = 'file' } = {}) => (req, res, next) => {
  const file = req.file;

  if (!file) {
    if (required) {
      return res.status(400).json({ success: false, message: `Vui lòng chọn tệp ${LABEL[kind]} để tải lên` });
    }
    return next();
  }

  const sig = detect(file.buffer, kind);
  if (!sig) {
    return res.status(400).json({
      success: false,
      message: `Tệp tải lên không phải ${LABEL[kind]} hợp lệ. Nội dung tệp không khớp định dạng khai báo.`,
    });
  }

  // Đuôi tệp an toàn do SERVER quyết định từ magic bytes, không lấy từ originalname.
  file.safeExt = sig.ext;
  file.safeMime = sig.mime;
  // Giữ lại tên gốc đã làm sạch chỉ để hiển thị, KHÔNG dùng để tạo đường dẫn lưu.
  file.displayName = String(file.originalname || '')
    .replace(/[^\p{L}\p{N}._ -]/gu, '')
    .slice(0, 120) || ('upload' + sig.ext);
  return next();
};

// multer dùng bộ nhớ: tệp không bao giờ chạm đĩa với tên do người dùng đặt.
const memoryUpload = (maxBytes) => multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes, files: 1, fields: 24, parts: 30 },
});

const imageUpload = () => memoryUpload(env.maxImageBytes);
const audioUpload = () => memoryUpload(env.maxAudioBytes);
const zipUpload = () => memoryUpload(Number.parseInt(process.env.MAX_TEMPLATE_ZIP_BYTES, 10) || 50 * 1024 * 1024);

module.exports = {
  verifyUpload,
  imageUpload,
  audioUpload,
  zipUpload,
  detect,
};
