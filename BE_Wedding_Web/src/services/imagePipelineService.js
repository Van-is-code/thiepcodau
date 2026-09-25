// Xử lý ảnh cưới trước khi đưa lên kho: kiểm tra thật sự là ảnh, xoay đúng chiều,
// xoá metadata riêng tư, và sinh nhiều phiên bản kích thước + định dạng hiện đại.
//
// Vì sao cần: ảnh máy ảnh/điện thoại thường 4–12 MB, 6000px. Nhét nguyên bản vào
// thiệp khiến khách mời phải tải cả trăm MB -> thiệp mở rất chậm trên 4G. Ở đây mỗi
// ảnh được xuất ra nhiều cỡ (cho srcset) ở AVIF + WebP + JPEG dự phòng, cộng thêm 1
// ảnh nhoè siêu nhỏ nhúng thẳng vào HTML để hiện ngay trong lúc ảnh thật đang tải.
const sharp = require('sharp');
const storageService = require('./storageService');

// Không dùng đuôi tệp do người dùng đặt để đoán kiểu — luôn đọc "magic bytes".
const MAGIC = [
  { ext: 'jpg', mime: 'image/jpeg', test: (b) => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
  { ext: 'png', mime: 'image/png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 },
  { ext: 'gif', mime: 'image/gif', test: (b) => b.slice(0, 3).toString('latin1') === 'GIF' },
  { ext: 'webp', mime: 'image/webp', test: (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP' },
  { ext: 'avif', mime: 'image/avif', test: (b) => b.slice(4, 8).toString('latin1') === 'ftyp' && /avif|avis/.test(b.slice(8, 12).toString('latin1')) },
  { ext: 'heic', mime: 'image/heic', test: (b) => b.slice(4, 8).toString('latin1') === 'ftyp' && /heic|heix|hevc|mif1/.test(b.slice(8, 12).toString('latin1')) },
];

const detectImageType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return null;
  return MAGIC.find((m) => {
    try { return m.test(buffer); } catch (_e) { return false; }
  }) || null;
};

// SVG cố tình KHÔNG được chấp nhận: SVG là XML có thể chứa <script>, mở thẳng từ
// domain CDN sẽ thành XSS lưu trữ.
const assertRealImage = (buffer) => {
  const type = detectImageType(buffer);
  if (!type) {
    const e = new Error('Tệp không phải ảnh hợp lệ (chỉ nhận JPEG, PNG, WebP, AVIF, HEIC, GIF)');
    e.status = 400;
    throw e;
  }
  return type;
};

// Các cỡ xuất ra, chọn theo điểm gãy thường gặp của điện thoại/màn hình.
const WIDTHS = [400, 800, 1280, 1920];

// Chất lượng nén TĂNG DẦN THEO CỠ ẢNH.
//
// Đo trên ảnh cưới thật (4541x6812, 19,6MB): ở cỡ 1920px mức AVIF q50 làm MƯỢT
// mất lưới voan và hạt ren trên váy — đúng hai chỗ cô dâu hay phóng to soi nhất.
// Ở cỡ 400–800px thì không cần: màn hình điện thoại không đủ điểm ảnh để thể hiện
// lưới voan, có nén kỹ hơn cũng không ai thấy, chỉ tốn dung lượng và tốn 4G.
//
// Nên đổi từ "một mức cho tất cả" sang thang theo cỡ: cỡ nhỏ giữ nguyên cho nhẹ,
// cỡ lớn nâng lên cho nét. Riêng cỡ 1920 AVIF nặng thêm ~128KB, vẫn nhẹ hơn ảnh
// gốc khoảng 50 lần.
const QUALITY_THEO_CO = [
  { toiDa: 800, avif: 50, webp: 72, jpeg: 78 },
  { toiDa: 1280, avif: 56, webp: 76, jpeg: 80 },
  { toiDa: Infinity, avif: 62, webp: 80, jpeg: 84 },
];
const qualityOf = (width, format) =>
  (QUALITY_THEO_CO.find((m) => width <= m.toiDa) || QUALITY_THEO_CO[QUALITY_THEO_CO.length - 1])[format];
const MAX_PIXELS = 60000000; // ~60MP: chặn "ảnh bom nén" làm cạn RAM

const probe = async (buffer) => {
  const meta = await sharp(buffer, { limitInputPixels: MAX_PIXELS }).metadata();
  if (!meta.width || !meta.height) {
    const e = new Error('Không đọc được kích thước ảnh'); e.status = 400; throw e;
  }
  return meta;
};

// Ảnh nhoè siêu nhỏ nhúng thẳng vào HTML (data URI, ~300–900 byte).
// Người xem thấy ngay khối màu đúng bố cục thay vì ô trắng -> cảm giác mở thiệp
// nhanh hơn hẳn, và không bị "giật" bố cục khi ảnh thật tải xong.
const makeBlurPlaceholder = async (buffer) => {
  const out = await sharp(buffer, { limitInputPixels: MAX_PIXELS })
    .rotate()
    .resize(16, 16, { fit: 'inside' })
    .webp({ quality: 20, alphaQuality: 50 })
    .toBuffer();
  return 'data:image/webp;base64,' + out.toString('base64');
};

// Màu trung bình — dùng làm nền ô ảnh trước cả khi ảnh nhoè kịp hiện.
const dominantColor = async (buffer) => {
  try {
    const { dominant } = await sharp(buffer, { limitInputPixels: MAX_PIXELS }).stats();
    const hex = (n) => n.toString(16).padStart(2, '0');
    return '#' + hex(dominant.r) + hex(dominant.g) + hex(dominant.b);
  } catch (_e) {
    return '#efe7dd';
  }
};

const encode = async (buffer, width, format) => sharp(buffer, { limitInputPixels: MAX_PIXELS })
  // .rotate() không tham số = áp dụng EXIF Orientation rồi xoá cờ đó đi.
  // Thiếu bước này thì ảnh chụp dọc từ iPhone hiện bị nằm ngang.
  .rotate()
  // withoutEnlargement: ảnh gốc nhỏ hơn thì giữ nguyên, không phóng to thành mờ.
  .resize({ width, withoutEnlargement: true })
  // sharp mặc định bỏ toàn bộ metadata -> xoá luôn GPS trong EXIF
  // (ảnh cưới thường kèm toạ độ nhà riêng — không nên công khai).
  .toFormat(format, { quality: qualityOf(width, format), effort: format === 'avif' ? 4 : undefined })
  .toBuffer({ resolveWithObject: true });

/**
 * Xử lý 1 ảnh -> đẩy toàn bộ phiên bản lên kho -> trả về mô tả để lưu DB.
 *
 * @param {Buffer} buffer    nội dung tệp gốc
 * @param {string} keyPrefix tiền tố khoá, vd "invitations/<invitation_id>"
 */
const processAndStore = async (buffer, keyPrefix) => {
  assertRealImage(buffer);
  const meta = await probe(buffer);

  const [blurDataUrl, color] = await Promise.all([
    makeBlurPlaceholder(buffer),
    dominantColor(buffer),
  ]);

  // EXIF Orientation 5–8 = ảnh bị xoay 90°, chiều rộng hiển thị chính là meta.height.
  const displayWidth = meta.orientation && meta.orientation >= 5 ? meta.height : meta.width;
  const displayHeight = meta.orientation && meta.orientation >= 5 ? meta.width : meta.height;

  // Chỉ xuất các cỡ NHỎ HƠN ảnh gốc; ảnh gốc bé hơn mọi điểm gãy thì giữ 1 cỡ gốc.
  const targetWidths = WIDTHS.filter((w) => w <= displayWidth);
  if (targetWidths.length === 0) targetWidths.push(displayWidth);

  const formats = ['avif', 'webp', 'jpeg'];
  const variants = { avif: [], webp: [], jpeg: [] };

  await Promise.all(formats.flatMap((format) => targetWidths.map(async (width) => {
    const { data, info } = await encode(buffer, width, format);
    const ext = format === 'jpeg' ? '.jpg' : '.' + format;
    const key = storageService.contentHashedKey({ prefix: keyPrefix + '/' + width, buffer: data, ext });
    const stored = await storageService.put(key, data, {
      contentType: format === 'jpeg' ? 'image/jpeg' : 'image/' + format,
    });
    variants[format].push({ width: info.width, height: info.height, bytes: info.size, key, url: stored.url });
  })));

  for (const f of formats) variants[f].sort((a, b) => a.width - b.width);

  // Ảnh "chính" (src dự phòng cho trình duyệt cũ): JPEG bản lớn nhất.
  const primary = variants.jpeg[variants.jpeg.length - 1];

  return {
    url: primary.url,
    key: primary.key,
    width: primary.width,
    height: primary.height,
    bytes: primary.bytes,
    original_width: displayWidth,
    original_height: displayHeight,
    blur_data_url: blurDataUrl,
    dominant_color: color,
    variants,
    storage_driver: storageService.driver(),
  };
};

// Gom mọi khoá của 1 ảnh (mọi cỡ, mọi định dạng) để xoá sạch, không để rác trong kho.
const allKeysOf = (variants) => {
  if (!variants || typeof variants !== 'object') return [];
  return Object.values(variants).flat().map((v) => v && v.key).filter(Boolean);
};

module.exports = {
  qualityOf, WIDTHS,
  detectImageType,
  assertRealImage,
  processAndStore,
  makeBlurPlaceholder,
  allKeysOf,
  WIDTHS,
};
