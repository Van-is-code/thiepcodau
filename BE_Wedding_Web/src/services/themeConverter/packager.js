// Đóng gói: thư mục theme (hoặc .zip) -> gói mẫu đã gắn thuộc tính + manifest.
//
// Chạy được ở hai nơi với cùng một lõi:
//   - CLI ngoài máy (theme-to-template/) để chuyển hàng loạt
//   - Trang quản trị, khi admin tải thẳng file .zip lên
const path = require('path');
const AdmZip = require('adm-zip');
const { convert } = require('./annotate');
const catalog = require('./fieldCatalog');

// Giới hạn giống templateUploadService để gói độc hại không lọt qua đường này.
const MAX_UNCOMPRESSED = Number.parseInt(process.env.MAX_TEMPLATE_UNCOMPRESSED_BYTES, 10) || 300 * 1024 * 1024;
const MAX_ENTRIES = Number.parseInt(process.env.MAX_TEMPLATE_ENTRIES, 10) || 5000;

const bad = (message, status = 400) => {
  const e = new Error(message); e.status = status; return e;
};

// Tìm tệp HTML "vào cổng" của theme: ưu tiên index.html nông nhất.
const findEntryHtml = (names, preferred) => {
  const htmls = names.filter((n) => /\.html?$/i.test(n) && !n.startsWith('__MACOSX'));
  if (!htmls.length) return null;
  if (preferred && htmls.includes(preferred)) return preferred;
  const depth = (n) => n.split('/').length;
  const indexes = htmls.filter((n) => path.posix.basename(n).toLowerCase() === 'index.html');
  const pool = indexes.length ? indexes : htmls;
  return pool.sort((a, b) => depth(a) - depth(b) || a.length - b.length)[0];
};

// Kiểm gói zip AN TOÀN trước khi đụng tới nội dung.
const assertSafeZip = (zip) => {
  const entries = zip.getEntries();
  if (entries.length > MAX_ENTRIES) {
    throw bad(`Gói theme có quá nhiều tệp (${entries.length}, tối đa ${MAX_ENTRIES}).`);
  }
  let total = 0;
  for (const e of entries) {
    const name = String(e.entryName || '');
    if (!name || name.includes('\u0000') || path.isAbsolute(name) || name.split('/').includes('..')) {
      throw bad('Gói theme chứa đường dẫn không an toàn');
    }
    total += Number(e.header && e.header.size) || 0;
  }
  if (total > MAX_UNCOMPRESSED) {
    throw bad(`Gói theme giải nén ra quá lớn (${Math.round(total / 1048576)}MB, tối đa ${Math.round(MAX_UNCOMPRESSED / 1048576)}MB).`);
  }
  return entries;
};

module.exports = { findEntryHtml, assertSafeZip, bad, MAX_UNCOMPRESSED, MAX_ENTRIES };

/**
 * Chuyển 1 gói theme (.zip buffer) thành gói MẪU THIỆP đã gắn thuộc tính.
 *
 * @param {Buffer} buffer  nội dung .zip của theme
 * @param {object} options
 *   - entryFile: chỉ định tệp HTML vào cổng (không có thì tự dò)
 *   - overrides: { selector: field } người duyệt map tay
 *   - minConfidence: ngưỡng tự động áp
 *   - dryRun: chỉ phân tích, không sinh gói mới
 * @returns {{ zip: Buffer, manifest: object, report: object }}
 */
const convertThemeZip = (buffer, options = {}) => {
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch (_e) {
    throw bad('Tệp tải lên không phải .zip hợp lệ');
  }

  const entries = assertSafeZip(zip);
  const names = entries.filter((e) => !e.isDirectory).map((e) => String(e.entryName).split(String.fromCharCode(92)).join('/'));

  const entryName = findEntryHtml(names, options.entryFile);
  if (!entryName) throw bad('Không tìm thấy tệp .html nào trong gói theme');

  const original = zip.getEntry(entryName).getData().toString('utf8');
  const result = convert(original, {
    overrides: options.overrides || {},
    minConfidence: options.minConfidence,
    dryRun: Boolean(options.dryRun),
  });

  // Ghi HTML đã gắn thuộc tính đè lên chính tệp vào cổng; mọi tệp khác giữ nguyên.
  if (!options.dryRun) {
    zip.updateFile(entryName, Buffer.from(result.html, 'utf8'));
  }

  const manifest = buildManifest({ entryName, result, fileCount: names.length });

  if (!options.dryRun) {
    zip.addFile('template-manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
  }

  return {
    zip: options.dryRun ? null : zip.toBuffer(),
    entryName,
    manifest,
    report: {
      summary: result.summary,
      applied: result.applied,
      needsReview: result.needsReview,
      unmapped: result.unmapped,
      skipped: result.skipped,
    },
  };
};

// Manifest mô tả mẫu: trường nào có, ô ảnh nào có. Trang quản trị và trình soạn
// thiệp đọc file này để biết mẫu hỗ trợ gì mà không phải phân tích lại HTML.
const buildManifest = ({ entryName, result, fileCount }) => {
  // Lấy từ trạng thái CUỐI của tài liệu (present), không phải phần vừa gắn thêm.
  const fieldKeys = [...new Set(result.present.fields)];
  const hrefKeys = [...new Set(result.present.hrefs)];

  const groups = {};
  for (const key of fieldKeys.concat(hrefKeys)) {
    const meta = catalog.fieldMeta(key);
    const g = (meta && meta.group) || 'khac';
    if (!groups[g]) groups[g] = [];
    groups[g].push({ key, label: meta ? meta.label : key, readonly: Boolean(meta && meta.readonly) });
  }

  const imageSlots = {};
  for (const im of result.present.images) {
    if (!imageSlots[im.slot]) {
      imageSlots[im.slot] = { slot: im.slot, label: (catalog.IMAGE_SLOTS[im.slot] || {}).label || im.slot, count: 0 };
    }
    imageSlots[im.slot].count += 1;
  }

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    entry_file: entryName,
    file_count: fileCount,
    fields: fieldKeys.concat(hrefKeys).sort(),
    field_groups: groups,
    image_slots: Object.values(imageSlots),
    // Theme có thẻ <audio> hay không -> quyết định có hiện ô chọn nhạc cho khách.
    has_music_box: Boolean(result.present.has_music_box),
    audio_count: result.present.audio_count || 0,
    stats: result.summary,
    // Ghi lại phần chưa chắc chắn ngay trong gói, để lần sau mở ra còn biết.
    needs_review: result.needsReview,
  };
};

module.exports.convertThemeZip = convertThemeZip;
module.exports.buildManifest = buildManifest;
