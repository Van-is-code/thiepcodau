// Gắn data-field / data-image vào HTML của theme.
//
// Không sửa gì ngoài việc THÊM thuộc tính: bố cục, class, CSS, script của theme
// giữ nguyên 100%. Nhờ vậy theme vẫn mở trực tiếp được như cũ, và nếu bộ nhận
// diện đoán sai thì chỉ cần gỡ thuộc tính chứ không phải khôi phục cả tệp.
const cheerio = require('cheerio');
const D = require('./detectors');
const catalog = require('./fieldCatalog');

// Phần tử chứa chữ ngắn, không có con là phần tử -> ứng viên gắn data-field.
// Gắn vào thẻ bọc nhiều tầng sẽ xoá sạch cấu trúc con khi bơm textContent.
const isLeafText = ($, el) => {
  const node = $(el);
  if (node.children().filter((_i, c) => c.type === 'tag').length > 0) return false;
  const text = node.text().trim();
  return text.length > 0 && text.length <= 600;
};

const SKIP_TAGS = new Set(['script', 'style', 'svg', 'path', 'polygon', 'polyline',
  'line', 'circle', 'rect', 'defs', 'use', 'audio', 'video', 'source', 'head', 'meta',
  'title', 'link', 'br', 'hr', 'input', 'textarea', 'select', 'option', 'button', 'form', 'label']);

// Không gắn vào phần tử thuộc BIỂU MẪU (ô nhập liệu, nút bấm) — đó là chỗ khách
// mời gõ vào, không phải nội dung thiệp.
//
// Lưu ý: KHÔNG loại trừ cả cửa sổ bật lên. Popup "Gửi mừng cưới" là nội dung hiển
// thị thật (số tài khoản, mã QR) và bắt buộc phải bơm dữ liệu của khách vào. Loại
// cả popup thì toàn bộ mục ngân hàng và mã QR bị bỏ sót.
const inInteractive = ($, el) => $(el).closest('form, [data-noconvert]').length > 0;

// Khối chỉ dùng để nhập liệu — bỏ qua hẳn.
const isFormChrome = ($, el) => {
  const node = $(el);
  if (node.closest('label, fieldset, .form-group, .inline-form').length) return true;
  const sig = D.signature(el, $);
  return D.has(sig, 'placeholder', 'form-label', 'form-hint', 'btn-', 'button');
};

/**
 * Quét HTML, trả về danh sách đề xuất gắn thuộc tính (chưa áp dụng).
 * @returns {{ fields: [], images: [], hrefs: [], skipped: [] }}
 */
const analyze = (html) => {
  const $ = cheerio.load(html, { decodeEntities: false });
  const fields = [];
  const images = [];
  const hrefs = [];
  const skipped = [];
  const usedOnce = new Set(); // trường chỉ nên xuất hiện 1 lần thì không nhân bản

  // ---- Timeline: nhận theo cụm trước, vì phải đánh số theo thứ tự mốc ----
  const timelineHits = D.detectTimeline($, catalog);
  const timelineEls = new Set(timelineHits.map((t) => t.el));
  for (const t of timelineHits) {
    if (!catalog.isKnownField(t.field)) continue;
    fields.push({ el: t.el, field: t.field, confidence: t.confidence, sample: $(t.el).text().trim().slice(0, 70), sig: 'timeline' });
  }

  // ---- Trường chữ ----
  $('*').each((_i, el) => {
    if (timelineEls.has(el)) return; // đã xử lý ở cụm timeline
    const tag = String(el.tagName || '').toLowerCase();
    if (SKIP_TAGS.has(tag)) return;
    if ($(el).attr('data-field')) return; // theme đã gắn sẵn -> tôn trọng
    if (!isLeafText($, el)) return;
    if (inInteractive($, el) || isFormChrome($, el)) return;
    // Phần tử chỉ chứa dấu phân cách / ký tự trang trí (· — ✦ |) không phải ô dữ
    // liệu. Gắn vào đó thì dữ liệu thật của khách sẽ đè mất dấu phân cách.
    if (!/[\p{L}\p{N}]/u.test($(el).text())) return;

    const ctx = {
      sig: D.signature(el, $),
      anc: D.ancestorSignature(el, $),
      text: $(el).text().trim(),
      blockText: D.blockTextsOf(el, $),
      // Chữ của phần tử liền trước: cần cho dạng markup tách nhãn khỏi giá trị
      // (<span>Ông</span><span>Nguyễn Văn A</span>).
      prevText: $(el).prev().text().trim().slice(0, 40),
      tag,
    };
    for (const rule of D.TEXT_RULES) {
      const hit = rule(ctx);
      if (!hit) continue;
      if (!catalog.isKnownField(hit.field)) {
        skipped.push({ reason: 'truong-khong-co-trong-danh-muc', field: hit.field, sample: ctx.text.slice(0, 50) });
        break;
      }
      const entry = { el, field: hit.field, confidence: hit.confidence, sample: ctx.text.slice(0, 70), sig: ctx.sig };
      fields.push(entry);
      break;
    }
  });

  // ---- Ô ảnh ----
  // Xét cả <img> lẫn phần tử vẽ ảnh bằng CSS background-image (kiểu LadiPage).
  const galleryCounters = {};
  $('img, [style*="background-image"], [data-bg]').each((_i, el) => {
    const tag = String(el.tagName || '').toLowerCase();
    if (SKIP_TAGS.has(tag) && tag !== 'img') return;
    if ($(el).attr('data-image')) return;
    // Ô QR thường nằm trong popup mừng cưới — vẫn phải gắn. Chỉ bỏ qua phần tử
    // trong biểu mẫu mà KHÔNG liên quan tới QR.
    const qrish = D.has(D.signature(el, $) + ' ' + D.ancestorSignature(el, $) + ' ' + D.norm($(el).attr('src') || ''), 'qr');
    if (inInteractive($, el) && !qrish) return;

    // Ảnh trang trí (hoa, bướm, hoạ tiết) tuyệt đối không gắn.
    if (D.isDecorative(el, $)) {
      skipped.push({ reason: 'anh-trang-tri', sample: String($(el).attr('src') || '').slice(-46) });
      return;
    }

    const ctx = {
      sig: D.signature(el, $),
      anc: D.ancestorSignature(el, $),
      src: D.norm($(el).attr('src') || $(el).attr('data-src') || ''),
      alt: $(el).attr('alt') || '',
      blockText: D.blockTextsOf(el, $),
    };
    for (const rule of D.IMAGE_RULES) {
      const hit = rule(ctx);
      if (!hit) continue;
      if (!catalog.isKnownImageSlot(hit.slot)) break;
      const entry = { el, slot: hit.slot, confidence: hit.confidence, src: ctx.src.slice(-46) };
      const meta = catalog.IMAGE_SLOTS[hit.slot];
      if (meta.multiple) {
        const n = galleryCounters[hit.slot] || 0;
        if (n < (meta.max || 20)) {
          entry.index = n;
          galleryCounters[hit.slot] = n + 1;
        } else {
          skipped.push({ reason: 'vuot-so-o-toi-da', slot: hit.slot });
          break;
        }
      }
      images.push(entry);
      break;
    }
  });

  // ---- Link chỉ đường ----
  $('a[href]').each((_i, el) => {
    if ($(el).attr('data-field-href')) return;
    const ctx = {
      sig: D.signature(el, $),
      anc: D.ancestorSignature(el, $),
      href: $(el).attr('href') || '',
    };
    for (const rule of D.HREF_RULES) {
      const hit = rule(ctx);
      if (!hit) continue;
      if (!catalog.isKnownField(hit.field)) break;
      hrefs.push({ el, field: hit.field, confidence: hit.confidence, href: ctx.href.slice(0, 50) });
      break;
    }
  });

  return { $, fields, images, hrefs, skipped, usedOnce };
};

module.exports = { analyze, isLeafText, SKIP_TAGS };

/**
 * Áp các đề xuất lên HTML và trả về kết quả kèm báo cáo.
 *
 * @param {string} html
 * @param {object} options
 *   - minConfidence: ngưỡng tự động áp (mặc định 0.6)
 *   - overrides: { 'css-selector': 'ten_truong' } — người duyệt chỉ định tay, luôn thắng
 *   - dryRun: chỉ phân tích, không sửa HTML
 */
// Dựng selector ngắn, ổn định cho 1 phần tử — để người duyệt map tay trong
// theme-map.json hoặc trên trang quản trị.
const buildSelector = ($, el) => {
  const id = $(el).attr('id');
  if (id) return '#' + id;
  const cls = String($(el).attr('class') || '').trim().split(/\s+/).filter(Boolean);
  const tag = String(el.tagName || '').toLowerCase();
  if (cls.length) {
    const sel = tag + '.' + cls.slice(0, 2).join('.');
    // Chỉ dùng được khi selector trỏ đúng 1 phần tử.
    try { if ($(sel).length === 1) return sel; } catch (_e) { /* selector lạ */ }
    const idx = $(sel).index(el);
    if (idx >= 0) return sel + ':eq(' + idx + ')';
    return sel;
  }
  return tag;
};

const convert = (html, options = {}) => {
  const minConfidence = options.minConfidence != null ? options.minConfidence : D.MIN_CONFIDENCE;
  const overrides = options.overrides || {};
  const { $, fields, images, hrefs, skipped } = analyze(html);

  const applied = { fields: [], images: [], hrefs: [] };
  const needsReview = [];

  // --- Ghi đè do người duyệt chỉ định: áp TRƯỚC và luôn thắng ---
  for (const [selector, target] of Object.entries(overrides)) {
    let nodes;
    try { nodes = $(selector); } catch (_e) {
      needsReview.push({ kind: 'override-loi', selector, note: 'selector không hợp lệ' });
      continue;
    }
    if (!nodes.length) {
      needsReview.push({ kind: 'override-khong-khop', selector, target });
      continue;
    }
    nodes.each((_i, el) => {
      if (typeof target === 'string' && catalog.isKnownField(target)) {
        $(el).attr('data-field', target);
        applied.fields.push({ field: target, source: 'override', selector });
      } else if (target && target.image && catalog.isKnownImageSlot(target.image)) {
        $(el).attr('data-image', target.image);
        if (target.index != null) $(el).attr('data-image-index', String(target.index));
        applied.images.push({ slot: target.image, index: target.index, source: 'override', selector });
      } else {
        needsReview.push({ kind: 'override-khong-hop-le', selector, target });
      }
    });
  }

  const overridden = new Set(applied.fields.concat(applied.images).map((x) => x.selector));

  // --- Trường chữ ---
  for (const f of fields) {
    if ($(f.el).attr('data-field')) continue; // override đã chiếm chỗ
    if (f.confidence < minConfidence) {
      needsReview.push({ kind: 'do-tin-cay-thap', field: f.field, confidence: f.confidence, sample: f.sample, sig: f.sig });
      continue;
    }
    $(f.el).attr('data-field', f.field);
    const meta = catalog.fieldMeta(f.field);
    // Thông tin ngân hàng có đường sửa riêng (panel quét QR) -> chỉ hiển thị.
    if (meta && meta.readonly) $(f.el).attr('data-readonly', '');
    applied.fields.push({ field: f.field, confidence: f.confidence, sample: f.sample });
  }

  // --- Ô ảnh ---
  for (const im of images) {
    if ($(im.el).attr('data-image')) continue;
    if (im.confidence < minConfidence) {
      needsReview.push({ kind: 'anh-do-tin-cay-thap', slot: im.slot, confidence: im.confidence, src: im.src });
      continue;
    }
    $(im.el).attr('data-image', im.slot);
    if (im.index != null) $(im.el).attr('data-image-index', String(im.index));
    applied.images.push({ slot: im.slot, index: im.index, confidence: im.confidence, src: im.src });
  }

  // --- Link ---
  for (const h of hrefs) {
    if ($(h.el).attr('data-field-href')) continue;
    if (h.confidence < minConfidence) {
      needsReview.push({ kind: 'link-do-tin-cay-thap', field: h.field, confidence: h.confidence });
      continue;
    }
    $(h.el).attr('data-field-href', h.field);
    applied.hrefs.push({ field: h.field, confidence: h.confidence });
  }

  // --- Ứng viên CHƯA nhận ra ---
  //
  // Đây là phần quan trọng nhất của quy trình duyệt: những khối chữ trông giống nội
  // dung thiệp nhưng không luật nào khớp. Không liệt kê ra thì người duyệt không
  // biết còn thiếu gì — mở thiệp lên chỉ thấy chữ mẫu của theme và tưởng đã xong.
  const annotated = new Set();
  $('[data-field]').each((_i, el) => annotated.add(el));
  const unmapped = [];
  $('*').each((_i, el) => {
    const tag = String(el.tagName || '').toLowerCase();
    if (SKIP_TAGS.has(tag) || annotated.has(el)) return;
    if (!isLeafText($, el) || inInteractive($, el) || isFormChrome($, el)) return;
    const text = $(el).text().trim();
    // Bỏ nhãn ngắn và chữ trang trí; giữ lại thứ trông như nội dung thật.
    if (text.length < 4 || text.length > 400) return;
    if (/^[\s✦✧·|—–-]+$/.test(text)) return;
    unmapped.push({
      selector: buildSelector($, el),
      tag,
      sample: text.slice(0, 80),
    });
  });

  // Trạng thái CUỐI của tài liệu: gồm cả thuộc tính theme đã có sẵn lẫn phần tool
  // vừa gắn. Manifest phải mô tả "mẫu này hỗ trợ gì", không phải "lần chạy này thêm
  // gì" — chạy lại lần hai trên theme đã chuyển sẽ báo 0 trường và gây hiểu nhầm.
  const present = { fields: [], images: [], hrefs: [] };

  // Hộp nhạc: theme có thẻ <audio> thì thiệp mới phát được nhạc nền. Mẫu tối giản
  // thường không có — trước đây hệ thống vẫn gán music_url cho mọi thiệp, khách
  // chọn nhạc xong không nghe thấy gì rồi tưởng hỏng.
  //
  // Bỏ qua thẻ đánh dấu data-skip-auto-music (theme tự quản lý nhạc theo cách riêng).
  const soAudio = $('audio:not([data-skip-auto-music])').length;
  present.has_music_box = soAudio > 0;
  present.audio_count = soAudio;
  $('[data-field]').each((_i, el) => present.fields.push($(el).attr('data-field')));
  $('[data-field-href]').each((_i, el) => present.hrefs.push($(el).attr('data-field-href')));
  $('[data-image]').each((_i, el) => present.images.push({
    slot: $(el).attr('data-image'),
    index: $(el).attr('data-image-index') != null ? Number($(el).attr('data-image-index')) : null,
  }));

  return {
    html: options.dryRun ? html : $.html(),
    present,
    applied,
    needsReview,
    skipped,
    unmapped: unmapped.slice(0, 200),
    overriddenCount: overridden.size,
    summary: {
      // "da_co_san" = theme vốn đã gắn; "moi_gan" = lần chạy này tool thêm vào.
      fields: present.fields.length,
      images: present.images.length,
      hrefs: present.hrefs.length,
      moi_gan_fields: applied.fields.length,
      moi_gan_images: applied.images.length,
      da_co_san_fields: present.fields.length - applied.fields.length,
      needsReview: needsReview.length,
      unmapped: unmapped.length,
    },
  };
};

module.exports.convert = convert;
