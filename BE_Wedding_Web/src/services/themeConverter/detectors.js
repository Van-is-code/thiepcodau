// Bộ nhận diện: đoán xem một phần tử HTML trong theme tương ứng với trường nào.
//
// NGUYÊN TẮC: thà bỏ sót còn hơn gắn sai.
// Gắn sai một trường khiến dữ liệu thật của khách hiện nhầm chỗ (vd. tên cô dâu
// nhảy vào ô địa chỉ) — lỗi đó khó phát hiện vì thiệp nhìn vẫn "có chữ". Bỏ sót
// thì chỉ là chữ mẫu của theme còn nguyên, người duyệt nhìn ra ngay.
//
// Mỗi luật trả về điểm tin cậy 0..1. Chỉ luật đạt ngưỡng mới được áp tự động;
// phần còn lại đưa vào báo cáo để người duyệt quyết định.

const MIN_CONFIDENCE = 0.6;

// Bỏ dấu tiếng Việt để so khớp không phụ thuộc dấu.
const deaccent = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D');

const norm = (s) => deaccent(s).toLowerCase().replace(/[\s_-]+/g, '-');

// Gom class + id + các data-* mô tả để dò từ khoá.
const signature = (el, $) => {
  const node = $(el);
  return norm([node.attr('class'), node.attr('id'), node.attr('data-role'), node.attr('name')]
    .filter(Boolean).join(' '));
};

// Chuỗi nhận dạng của cả tổ tiên — dùng để biết phần tử nằm trong mục nào.
const ancestorSignature = (el, $, depth = 6) => {
  const parts = [];
  let cur = $(el).parent();
  for (let i = 0; i < depth && cur.length; i += 1) {
    parts.push(signature(cur[0], $));
    cur = cur.parent();
  }
  return parts.join(' ');
};

const has = (hay, ...needles) => needles.some((n) => hay.includes(n));

// --- Mẫu nội dung ---
const RE_DATE = /\b\d{1,2}\s*[.·/-]\s*\d{1,2}\s*[.·/-]\s*\d{4}\b/;
const RE_TIME = /\b([01]?\d|2[0-3])\s*[:h]\s*[0-5]\d\b/;
const RE_LUNAR = /nh[aă]m ng[aà]y|[aâ]m l[iị]ch|n[aă]m\s+(gi[aá]p|[aấ]t|b[ií]nh|[đd][iị]nh|m[aậ]u|k[yỷ]|canh|t[aâ]n|nh[aâ]m|qu[yý])/i;
const RE_PARENT = /^\s*(ông|bà|ong|ba)\s*[:.]/i;
const RE_URL_MAP = /google\.[a-z.]+\/maps|maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl/i;

module.exports = {
  MIN_CONFIDENCE, deaccent, norm, signature, ancestorSignature, has,
  RE_DATE, RE_TIME, RE_LUNAR, RE_PARENT, RE_URL_MAP,
};

// ---------------------------------------------------------------------------
// Bộ luật cho TRƯỜNG CHỮ.
// Mỗi luật nhận { sig, anc, text, tag } và trả về { field, confidence } hoặc null.
// ---------------------------------------------------------------------------

// Phân biệt chú rể / cô dâu.
//
// Xét theo 3 nguồn, ưu tiên từ gần tới xa:
//   1. class/id của chính phần tử
//   2. class/id của tổ tiên (vd. .polaroid-groom, #gift-panel-bride)
//   3. CHỮ trong khối cha gần nhất (vd. tiêu đề "NHÀ TRAI" / "NHÀ GÁI")
//
// Nguồn 3 là bắt buộc: rất nhiều theme đặt class trung tính (.family-column,
// .bank-slip-value) và chỉ phân biệt hai bên bằng tiêu đề chữ. Thiếu nó thì toàn
// bộ mục gia đình và mục ngân hàng bị bỏ sót.
const GROOM_WORDS = ['groom', 'chu-re', 'churer', 'nha-trai', 'nhatrai', 'đằng trai'];
const BRIDE_WORDS = ['bride', 'co-dau', 'codau', 'nha-gai', 'nhagai', 'đằng gái'];

const sideFromText = (bt) => {
  const groom = has(bt, 'nha-trai', 'chu-re', 'dang-trai');
  const bride = has(bt, 'nha-gai', 'co-dau', 'dang-gai');
  if (groom && !bride) return 'groom';
  if (bride && !groom) return 'bride';
  return null;
};

// blockText nhận cả chuỗi lẫn MẢNG (từ blockTextsOf). Với mảng thì quét từ GẦN ra
// XA và lấy tầng đầu tiên phân biệt được — đi quá xa thì khối cha chứa cả hai bên
// và thành nhập nhằng.
const sideOf = (sig, anc, blockText) => {
  const groom = has(sig, ...GROOM_WORDS) || has(anc, ...GROOM_WORDS);
  const bride = has(sig, ...BRIDE_WORDS) || has(anc, ...BRIDE_WORDS);
  if (groom && !bride) return 'groom';
  if (bride && !groom) return 'bride';

  const texts = Array.isArray(blockText) ? blockText : (blockText ? [blockText] : []);
  for (const t of texts) {
    const side = sideFromText(norm(t));
    if (side) return side;
  }
  return null; // nhập nhằng -> không đoán
};

// Khối này nói về TIỆC hay về LỄ?
//
// Cùng lý do với sideOf: nhiều theme đặt class trung tính (.event-venue-title) và
// chỉ phân biệt hai sự kiện bằng CHỮ trong nhãn ("LỄ THÀNH HÔN" / "TIỆC CƯỚI").
const RECEPTION_WORDS = ['reception', 'tiec', 'banquet', 'party', 'invitation-day', 'ngay-moi'];
const CEREMONY_WORDS = ['ceremony', 'le-thanh-hon', 'le-cuoi', 'hon-le', 'vu-quy', 'thanh-hon'];

const isReception = (sig, anc, blockText) => {
  const recSig = has(sig, ...RECEPTION_WORDS) || has(anc, ...RECEPTION_WORDS);
  const cerSig = has(sig, ...CEREMONY_WORDS) || has(anc, ...CEREMONY_WORDS);
  if (recSig && !cerSig) return true;
  if (cerSig && !recSig) return false;

  const texts = Array.isArray(blockText) ? blockText : (blockText ? [blockText] : []);
  for (const t of texts) {
    const bt = norm(t);
    const rec = has(bt, 'tiec-cuoi', 'tiec-chinh', 'khai-tiec', 'du-tiec', 'tiec-mung');
    const cer = has(bt, 'le-thanh-hon', 'le-vu-quy', 'hon-le', 'nghi-le');
    if (rec && !cer) return true;
    if (cer && !rec) return false;
  }
  return null; // nhập nhằng -> để luật gọi tự quyết
};

// Phần tử có nằm trong khối GIA ĐÌNH (cha mẹ hai bên) không.
//
// Quan trọng: tên cha mẹ và tên cô dâu chú rể đều là "tên người" nên luật tên dễ
// vơ cả hai. Gán nhầm thì thiệp hiện tên chú rể ở cả ô cha lẫn ô mẹ.
const FAMILY_WORDS = ['family', 'gia-dinh', 'parent', 'phu-huynh', 'nha-trai', 'nha-gai', 'member'];
const inFamilyBlock = (sig, anc) => has(sig, ...FAMILY_WORDS) || has(anc, ...FAMILY_WORDS);

// Chữ của các khối cha, xếp từ GẦN ra XA (tối đa 6 tầng).
const blockTextsOf = (el, $, maxLen = 1200) => {
  const out = [];
  let cur = $(el).parent();
  for (let i = 0; i < 6 && cur.length; i += 1) {
    const t = cur.text().replace(/\s+/g, ' ').trim();
    if (t.length >= 4 && t.length <= maxLen) out.push(t);
    cur = cur.parent();
  }
  return out;
};

// Giữ cho tương thích: chuỗi của khối cha gần nhất có nghĩa.
const blockTextOf = (el, $, maxLen = 1200) => (blockTextsOf(el, $, maxLen)[0] || '');

const TEXT_RULES = [
  // --- Tên cô dâu chú rể ---
  // Tên GHÉP: "DUY NAM & VÂN ANH", "Minh Anh và Hoàng Nam", "A — B".
  // Xử lý TRƯỚC luật tên đơn, vì luật kia sẽ vơ nhầm cả cụm vào một bên.
  ({ sig, anc, text }) => {
    const t = String(text || '').trim();
    if (t.length < 5 || t.length > 70) return null;
    if (!/[&＆]|và|and/i.test(t)) return null;
    // Hai vế, mỗi vế là tên người (chữ cái, có thể nhiều từ), không có số.
    const parts = t.split(/\s*(?:[&＆]|và|and)\s*/i).map((x) => x.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '').trim());
    if (parts.length !== 2 || parts.some((x) => x.length < 2 || /\d/.test(x))) return null;
    // Phải ở chỗ trông như ô tên (class có 'name', hoặc là tiêu đề trong khối bìa/thư).
    // Chỗ trông như ô tên: class có 'name', hoặc là dòng ký tên / tiêu đề trong
    // khối bìa, thư mở đầu, chân trang.
    const nameish = has(sig, 'name', 'ten', 'couple', 'doi-uyen-uong',
      'author', 'signature', 'sign', 'finale', 'ky-ten')
      || has(anc, 'cover', 'letter', 'envelope', 'hero', 'intro', 'footer', 'finale');
    if (!nameish) return null;
    return { field: 'couple_names', confidence: 0.7 };
  },

  ({ sig, anc, text, blockText }) => {
    if (!has(sig, 'name', 'ten')) return null;
    // Trong khối ngân hàng, "name" là CHỦ TÀI KHOẢN chứ không phải tên cô dâu chú
    // rể — để luật ngân hàng ở cuối xử lý. Hai thứ này thường trùng tên nên gắn
    // nhầm rất khó phát hiện, cho tới khi tài khoản đứng tên bố mẹ.
    if (has(sig, 'bank', 'slip', 'account', 'stk') || has(anc, 'bank', 'gift', 'qr-', 'mung-cuoi')) return null;
    // Trong khối gia đình, "name" là tên CHA MẸ. Để luật cha/mẹ ngay bên dưới lo.
    if (inFamilyBlock(sig, anc)) return null;
    const side = sideOf(sig, anc, blockText);
    if (!side) return null;
    // Tên đầy đủ thường có >= 2 từ; tên gọi (hero) thường 1-2 từ và chữ to.
    const words = String(text).trim().split(/\s+/).length;
    const full = has(sig, 'full', 'fullname', 'serif', 'day-du') || words >= 3;
    return { field: side + (full ? '_name' : '_short_name'), confidence: 0.85 };
  },
  // --- Cha / mẹ hai bên ---
  ({ sig, anc, text, blockText, prevText }) => {
    const named = has(sig, 'parent', 'father', 'mother', 'cha-', 'phu-huynh')
      || (inFamilyBlock(sig, anc) && has(sig, 'name', 'ten'));
    if (!RE_PARENT.test(text) && !named) return null;
    const side = sideOf(sig, anc, blockText);
    if (!side) return null;

    // Hai cách theme hay viết:
    //   ghép : <p>Ông: Nguyễn Văn A</p>
    //   tách : <span class="member-title">Ông</span><span class="member-name">Nguyễn Văn A</span>
    // Dạng tách cần đọc chữ của phần tử LIỀN TRƯỚC mới biết là cha hay mẹ.
    const lead = /^\s*(ông|ong)\s*[:.]?/i;
    const leadMother = /^\s*(bà|ba)\s*[:.]?/i;
    const isFather = lead.test(text) || has(sig, 'father', 'cha') || lead.test(String(prevText || ''));
    const isMother = leadMother.test(text) || has(sig, 'mother') || leadMother.test(String(prevText || ''));
    if (!isFather && !isMother) return null;
    const col = side === 'groom'
      ? (isFather ? 'groom.father_grom' : 'groom.mother_groom')
      : (isFather ? 'bride.father_bride' : 'bride.mother_bride');
    return { field: col, confidence: 0.8 };
  },
  // --- Quê quán hai bên ---
  ({ sig, anc, blockText }) => {
    if (!has(sig, 'location', 'que-quan', 'quequan', 'city', 'hometown')) return null;
    const side = sideOf(sig, anc, blockText);
    if (!side) return null;
    return { field: side + '.address', confidence: 0.7 };
  },
];

// --- Ngày / giờ / âm lịch ---
TEXT_RULES.push(({ sig, anc, text, blockText }) => {
  const lunar = RE_LUNAR.test(text) || has(sig, 'lunar', 'am-lich');
  if (lunar) {
    const rec = isReception(sig, anc, blockText);
    return { field: rec ? 'reception_lunar_text' : 'ceremony_lunar_text', confidence: rec === null ? 0.5 : 0.8 };
  }
  return null;
});

TEXT_RULES.push(({ sig, anc, text, tag, blockText }) => {
  const looksDate = RE_DATE.test(text);
  const namedDate = has(sig, 'date', 'ngay', 'datestamp');
  if (!looksDate && !namedDate) return null;
  // Chuỗi dài lẫn tên + ngày (vd. chữ chạy vòng quanh đĩa than) không phải ô ngày.
  if (looksDate && String(text).trim().length > 40) return null;
  // Chữ trong SVG (textPath/tspan) là hoạ tiết, không phải ô dữ liệu.
  if (['textpath', 'tspan', 'text'].includes(String(tag || '').toLowerCase())) return null;
  // "Ngày mời"/"tiệc" -> nhóm reception; còn lại mặc định là lễ.
  const rec = isReception(sig, anc, blockText);
  const prefix = rec ? 'reception' : 'ceremony';

  // Phần tử KHÔNG có class/id riêng thì chỉ đoán được qua tổ tiên — mà lễ và tiệc
  // hay nằm lồng nhau nên rất dễ lẫn. Hạ độ tin cậy để nó rơi vào diện "cần duyệt"
  // thay vì gắn bừa: gắn nhầm ngày lễ thành ngày tiệc là sai lệch khách nhìn thấy.
  const anonymous = !sig;
  const penalty = anonymous ? 0.3 : 0;

  if (RE_TIME.test(text) && looksDate) return { field: prefix + '_time_weekday', confidence: 0.55 - penalty };
  if (looksDate) return { field: prefix + '_short', confidence: 0.8 - penalty };
  return { field: prefix + '_short', confidence: 0.6 - penalty };
});

TEXT_RULES.push(({ sig, anc, text, blockText }) => {
  if (!has(sig, 'weekday', 'thu-', 'day-of-week', 'dayofweek')) return null;
  const rec = isReception(sig, anc, blockText);
  return { field: (rec ? 'reception' : 'ceremony') + '_weekday', confidence: 0.75 };
});

TEXT_RULES.push(({ sig, anc, text, blockText }) => {
  // Chỉ có giờ, không có ngày -> giờ tiệc / giờ lễ.
  if (!RE_TIME.test(text) || RE_DATE.test(text)) return null;
  if (!has(sig, 'time', 'gio', 'hour')) return null;
  if (has(sig, 'countdown', 'dem-nguoc', 'timer')) return null; // đồng hồ đếm ngược, không phải trường
  const rec = isReception(sig, anc, blockText);
  return rec ? { field: 'reception_time', confidence: 0.7 } : null;
});

// --- Địa điểm ---
TEXT_RULES.push(({ sig, anc, text, blockText }) => {
  const addr = has(sig, 'address', 'dia-chi', 'diachi');
  const venue = has(sig, 'venue', 'hall', 'restaurant', 'nha-hang', 'sanh', 'dia-diem');
  if (!addr && !venue) return null;
  const rec = isReception(sig, anc, blockText);
  // Nhập nhằng (không rõ lễ hay tiệc) -> hạ độ tin cậy để người duyệt quyết.
  const conf = rec === null ? 0.5 : 0.8;
  if (addr) {
    return { field: rec ? 'reception_venue_address' : 'venue_address', confidence: conf };
  }
  return { field: rec ? 'reception_venue_name' : 'venue_name', confidence: rec === null ? 0.45 : 0.7 };
});

// --- Nội dung dài ---
TEXT_RULES.push(({ sig, anc, tag }) => {
  if (has(sig, 'thank', 'cam-on', 'camon')) {
    // "Thank You" ở chân trang là TIÊU ĐỀ trang trí; đoạn lời cảm ơn thật thường
    // nằm ở .footer-quote / .thank-you-message kế bên. Phân biệt bằng thẻ heading.
    const isHeading = has(sig, 'title', 'heading') || ['h1', 'h2', 'h3', 'h4'].includes(tag);
    return { field: isHeading ? 'footer_thank_you' : 'thank_you_message', confidence: 0.75 };
  }
  if (has(sig, 'footer-quote') && has(anc, 'footer')) {
    return { field: 'thank_you_message', confidence: 0.7 };
  }
  if (has(sig, 'welcome', 'loi-ngo', 'loingo')) {
    return { field: has(sig, 'quote') ? 'welcome_quote' : 'welcome_text', confidence: 0.75 };
  }
  if (has(sig, 'story', 'chuyen-chung-minh', 'our-beginning', 'love-story')) {
    return { field: has(sig, 'quote') ? 'story_quote' : 'story_content', confidence: 0.75 };
  }
  if (has(sig, 'monogram')) return { field: 'monogram', confidence: 0.85 };
  if (has(sig, 'wedding-tag', 'wedding-of', 'badge', 'tag')) {
    if (has(anc, 'hero', 'envelope', 'cover')) return { field: 'wedding_tag', confidence: 0.65 };
  }
  return null;
});

// --- Link chỉ đường ---
const HREF_RULES = [
  ({ sig, anc, href }) => {
    if (!RE_URL_MAP.test(href || '') && !has(sig, 'map', 'chi-duong', 'direction')) return null;
    const rec = has(sig, 'reception', 'tiec') || has(anc, 'reception', 'tiec', 'invitation-day', 'ngay-moi');
    return { field: rec ? 'reception_map_url' : 'map_url', confidence: 0.85 };
  },
];

module.exports.TEXT_RULES = TEXT_RULES;
module.exports.HREF_RULES = HREF_RULES;
module.exports.sideOf = sideOf;
module.exports.blockTextOf = blockTextOf;
module.exports.blockTextsOf = blockTextsOf;

// ---------------------------------------------------------------------------
// Bộ luật cho Ô ẢNH.
//
// Ảnh trang trí (hoa, bướm, hoạ tiết, đường kẻ) TUYỆT ĐỐI không được gắn — gắn
// nhầm thì ảnh cưới của khách nhảy vào chỗ bông hoa góc trang.
// ---------------------------------------------------------------------------

// Dấu hiệu ảnh trang trí: nằm trong thư mục hoạ tiết, hoặc aria-hidden, hoặc tên
// class nói rõ là đồ trang trí.
const DECOR_HINTS = [
  'botanical', 'flower', 'floral', 'leaf', 'leaves', 'branch', 'petal', 'butterfly',
  'divider', 'ornament', 'corner', 'frame', 'seal', 'stamp', 'sprig', 'swag', 'garden',
  'dove', 'bg-', 'background-deco', 'pattern', 'icon', 'sparkle', 'accent', 'decor',
];

const isDecorative = (el, $) => {
  const node = $(el);
  if (String(node.attr('aria-hidden')) === 'true') return true;
  const alt = String(node.attr('alt') || '');
  // alt rỗng là quy ước chuẩn cho ảnh thuần trang trí.
  if (node.is('img') && node.attr('alt') !== undefined && alt.trim() === '') return true;
  const src = norm(node.attr('src') || node.attr('data-src') || '');
  const sig = signature(el, $);
  return has(src, ...DECOR_HINTS) || has(sig, ...DECOR_HINTS);
};

const IMAGE_RULES = [
  // Mã QR mừng cưới
  ({ sig, anc, src, alt }) => {
    if (has(sig, 'qr') || has(src, 'qr') || has(norm(alt), 'qr')) {
      return { slot: 'bank_qr', confidence: 0.9 };
    }
    return null;
  },
  // Ảnh riêng của chú rể / cô dâu
  ({ sig, anc, alt, blockText }) => {
    const side = sideOf(sig + ' ' + norm(alt), anc, blockText);
    if (!side) return null;
    if (!has(sig, 'photo', 'img', 'image', 'polaroid', 'portrait', 'avatar', 'anh')
      && !has(anc, 'couple', 'polaroid', 'co-dau-chu-re')) return null;
    return { slot: side, confidence: 0.8 };
  },
  // Album ảnh
  ({ sig, anc }) => {
    if (has(sig, 'gallery', 'album', 'slide', 'carousel') || has(anc, 'gallery', 'album', 'polaroid-stack')) {
      return { slot: 'gallery', confidence: 0.85, indexed: true };
    }
    return null;
  },
  // Ảnh mục chuyện tình
  ({ sig, anc }) => {
    if (has(sig, 'story') || has(anc, 'story', 'our-beginning', 'love-story')) {
      return { slot: 'story', confidence: 0.8 };
    }
    return null;
  },
  // Ảnh bìa / hero
  ({ sig, anc }) => {
    if (has(sig, 'hero', 'cover', 'main-photo', 'portrait', 'anh-bia')
      || has(anc, 'hero', 'cover', 'save-the-date', 'std-')) {
      return { slot: 'cover', confidence: 0.75 };
    }
    return null;
  },
];

module.exports.IMAGE_RULES = IMAGE_RULES;
module.exports.isDecorative = isDecorative;
module.exports.DECOR_HINTS = DECOR_HINTS;

// ---------------------------------------------------------------------------
// TIMELINE — nhận theo CỤM, không theo từng phần tử rời.
//
// Mỗi mốc trong chương trình tiệc gồm bộ ba (giờ / tiêu đề / mô tả) lặp lại N lần.
// Gắn rời từng phần tử sẽ không biết đâu là mốc 1, mốc 2 — nên phải tìm khối cha
// lặp lại rồi đánh số theo thứ tự xuất hiện.
// ---------------------------------------------------------------------------
// Theme đặt tên khối lặp rất khác nhau: timeline-event, milestone, schedule-item...
// Dò theo thứ tự cụ thể -> tổng quát, lấy bộ đầu tiên có từ 2 phần tử trở lên.
const TIMELINE_CONTAINER = [
  '.timeline-event', '.timeline-item', '.timeline-row', '.schedule-item', '.program-item',
  '.stem-milestone-content', '.milestone-content', '.milestone-item', '.stem-milestone',
  '[class*="timeline-event"]', '[class*="schedule-row"]', '[class*="milestone"]',
];

const detectTimeline = ($, catalog) => {
  const out = [];
  let items = $();
  for (const sel of TIMELINE_CONTAINER) {
    const found = $(sel);
    if (found.length >= 2) { items = found; break; }
  }
  if (!items.length) return out;

  items.each((idx, item) => {
    const n = idx + 1;
    if (n > catalog.TIMELINE_MAX) return;
    const $item = $(item);

    const pick = (...keys) => {
      let hit = null;
      $item.find('*').each((_i, el) => {
        if (hit) return;
        if ($(el).children().filter((_j, c) => c.type === 'tag').length) return;
        const sig = signature(el, $);
        if (has(sig, ...keys)) hit = el;
      });
      return hit;
    };

    const timeEl = pick('time', 'gio', 'hour', 'clock');
    const titleEl = pick('title', 'name', 'heading', 'tieu-de');
    const descEl = pick('desc', 'text', 'content', 'mo-ta', 'detail');

    if (timeEl) out.push({ el: timeEl, field: 'timeline_time_' + n, confidence: 0.8 });
    if (titleEl) out.push({ el: titleEl, field: 'timeline_title_' + n, confidence: 0.8 });
    if (descEl) out.push({ el: descEl, field: 'timeline_desc_' + n, confidence: 0.75 });
  });
  return out;
};

module.exports.detectTimeline = detectTimeline;
module.exports.TIMELINE_CONTAINER = TIMELINE_CONTAINER;

// --- Thông tin ngân hàng mừng cưới ---
// Đặt CUỐI danh sách: chỉ chạy khi các luật cụ thể hơn không khớp.
TEXT_RULES.push(({ sig, anc, text, blockText }) => {
  const bankish = has(sig, 'bank', 'account', 'tai-khoan', 'stk', 'slip')
    || has(anc, 'bank', 'gift', 'mung-cuoi', 'qr-');
  if (!bankish) return null;
  const side = sideOf(sig, anc, blockText);
  if (!side) return null;

  if (has(sig, 'account-num', 'accountnumber', 'so-tk', 'stk')) {
    return { field: side + '.bank_account_number', confidence: 0.75 };
  }
  if (has(sig, 'name') && !has(sig, 'bank-name')) {
    return { field: side + '.bank_account_name', confidence: 0.72 };
  }
  if (has(sig, 'bank-name', 'bankname') || /vietcombank|techcombank|mb ?bank|vietinbank|bidv|agribank|acb|vpbank|tpbank|sacombank/i.test(text)) {
    return { field: side + '.bank_name', confidence: 0.72 };
  }
  return null;
});

// --- Câu dẫn / lời mời / tiêu đề mục ---
TEXT_RULES.push(({ sig, anc }) => {
  if (has(sig, 'greeting-lead', 'invitation-greeting', 'kinh-moi', 'greeting')) {
    return { field: has(sig, 'sub', 'phu') ? 'invitation_greeting_sub' : 'invitation_greeting', confidence: 0.7 };
  }
  if (has(sig, 'invitation-intro', 'ceremony-intro')) return { field: 'ceremony_intro', confidence: 0.7 };
  if (has(sig, 'heartfelt', 'ceremony-quote')) return { field: 'ceremony_heartfelt_quote', confidence: 0.7 };
  if (has(sig, 'lead-text', 'section-lead') && has(anc, 'family', 'gia-dinh')) {
    return { field: 'family_lead_text', confidence: 0.7 };
  }
  return null;
});
