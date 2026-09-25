// Dựng bản XEM TRƯỚC của theme vừa tải lên, trước khi quyết định nhập thật.
//
// Vì sao cần: báo cáo dạng số ("46 trường, 8 ô ảnh") không cho biết mẫu trông thế
// nào và ô nào nằm ở đâu. Admin phải nhìn thấy thiệp thật, với dữ liệu mẫu, rồi mới
// tích chọn cho khách sửa được những gì.
//
// Bản xem trước là THƯ MỤC TẠM, tự dọn sau TTL — không lẫn vào kho mẫu thật.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { convertThemeZip } = require('./themeConverter/packager');

const PREVIEW_ROOT = path.join(process.cwd(), 'uploads', 'templates', '_preview');
const TTL_MS = Number.parseInt(process.env.TEMPLATE_PREVIEW_TTL_MS, 10) || 2 * 60 * 60 * 1000; // 2 giờ

const bad = (message, status = 400) => { const e = new Error(message); e.status = status; return e; };

// Token chỉ gồm hex -> không thể chứa ".." hay "/" để thoát thư mục.
const newToken = () => crypto.randomBytes(16).toString('hex');
const isToken = (t) => typeof t === 'string' && /^[0-9a-f]{32}$/.test(t);

const dirOf = (token) => {
  if (!isToken(token)) throw bad('Mã xem trước không hợp lệ', 404);
  return path.join(PREVIEW_ROOT, token);
};

// Dọn bản xem trước quá hạn. Gọi mỗi lần tạo bản mới — không cần cron riêng.
const sweep = () => {
  try {
    if (!fs.existsSync(PREVIEW_ROOT)) return;
    const now = Date.now();
    for (const name of fs.readdirSync(PREVIEW_ROOT)) {
      const dir = path.join(PREVIEW_ROOT, name);
      try {
        const st = fs.statSync(dir);
        if (now - st.mtimeMs > TTL_MS) fs.rmSync(dir, { recursive: true, force: true });
      } catch (_e) { /* bỏ qua tệp lỗi */ }
    }
  } catch (error) {
    console.warn('[preview] không dọn được bản tạm:', error.message);
  }
};

module.exports = { PREVIEW_ROOT, TTL_MS, newToken, isToken, dirOf, sweep, bad };

/**
 * Chuyển theme rồi giải nén ra thư mục tạm để xem trước.
 *
 * @returns { token, previewPath, entryName, manifest, report }
 */
const stage = (buffer, options = {}) => {
  sweep(); // dọn bản cũ trước khi tạo bản mới

  const converted = convertThemeZip(buffer, {
    entryFile: options.entryFile,
    overrides: options.overrides || {},
    minConfidence: options.minConfidence,
  });

  const token = newToken();
  const dir = dirOf(token);
  fs.mkdirSync(dir, { recursive: true });

  // convertThemeZip đã kiểm zip-slip / zip-bomb; giải nén gói ĐÃ chuyển đổi.
  new AdmZip(converted.zip).extractAllTo(dir, true);

  return {
    token,
    // Đường dẫn tĩnh để FE nhúng vào iframe.
    previewPath: `/templates/_preview/${token}/${converted.entryName}`,
    entryName: converted.entryName,
    manifest: converted.manifest,
    report: converted.report,
    expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
  };
};

// Xoá 1 bản xem trước (khi admin đóng hộp thoại hoặc đã nhập xong).
const discard = (token) => {
  const dir = dirOf(token);
  fs.rmSync(dir, { recursive: true, force: true });
  return { discarded: true };
};

// Đọc lại gói đã dựng để NHẬP THẬT mà không phải tải file lên lần nữa.
// Admin đã xem trước, tích chọn xong thì bấm nhập — không bắt họ chờ upload lại
// 15MB một lần nữa.
const repack = (token) => {
  const dir = dirOf(token);
  if (!fs.existsSync(dir)) throw bad('Bản xem trước đã hết hạn, vui lòng tải lại theme', 410);
  const zip = new AdmZip();
  zip.addLocalFolder(dir);
  return zip.toBuffer();
};

module.exports.stage = stage;
module.exports.discard = discard;
module.exports.repack = repack;
