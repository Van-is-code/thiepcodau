// Danh mục trường CHUẨN mà bộ bơm dữ liệu của thiệp hiểu được.
//
// Bộ chuyển đổi chỉ được phép sinh ra các khoá trong danh mục này. Sinh bừa một
// khoá lạ thì nó rơi vào extra_data và không bao giờ có dữ liệu — thiệp hiện chữ
// mẫu của theme, nhìn như đã chạy nhưng thực ra hỏng.
//
// Nguồn đối chiếu: FE_Wedding_Web/src/lib/templateEngine.js (resolveWriteTarget,
// buildMergedData) và các cột trong models/Invitation|Groom|Bride.

// --- Trường suy ra từ hồ sơ cô dâu / chú rể ---
const PERSON_FIELDS = {
  groom_name: { label: 'Họ tên chú rể', group: 'couple' },
  bride_name: { label: 'Họ tên cô dâu', group: 'couple' },
  groom_short_name: { label: 'Tên gọi chú rể', group: 'couple' },
  bride_short_name: { label: 'Tên gọi cô dâu', group: 'couple' },
  groom_initial: { label: 'Chữ cái đầu chú rể', group: 'couple' },
  bride_initial: { label: 'Chữ cái đầu cô dâu', group: 'couple' },
  'groom.father_grom': { label: 'Cha chú rể', group: 'family' },
  'groom.mother_groom': { label: 'Mẹ chú rể', group: 'family' },
  'groom.address': { label: 'Quê quán nhà trai', group: 'family' },
  'bride.father_bride': { label: 'Cha cô dâu', group: 'family' },
  'bride.mother_bride': { label: 'Mẹ cô dâu', group: 'family' },
  'bride.address': { label: 'Quê quán nhà gái', group: 'family' },
  'groom.bank_name': { label: 'Ngân hàng chú rể', group: 'bank', readonly: true },
  'groom.bank_account_name': { label: 'Chủ TK chú rể', group: 'bank', readonly: true },
  'groom.bank_account_number': { label: 'Số TK chú rể', group: 'bank', readonly: true },
  'bride.bank_name': { label: 'Ngân hàng cô dâu', group: 'bank', readonly: true },
  'bride.bank_account_name': { label: 'Chủ TK cô dâu', group: 'bank', readonly: true },
  'bride.bank_account_number': { label: 'Số TK cô dâu', group: 'bank', readonly: true },
};

// --- Ngày giờ: engine tự tính từ ceremony_date / reception_date ---
const DATE_FIELDS = {
  ceremony_short: { label: 'Ngày lễ (26.04.2025)', group: 'ceremony', kind: 'date' },
  ceremony_day: { label: 'Ngày lễ (số)', group: 'ceremony', kind: 'date' },
  ceremony_month: { label: 'Tháng lễ', group: 'ceremony', kind: 'date' },
  ceremony_year: { label: 'Năm lễ', group: 'ceremony', kind: 'date' },
  ceremony_weekday: { label: 'Thứ (lễ)', group: 'ceremony', kind: 'date' },
  ceremony_time_weekday: { label: 'Giờ + thứ (lễ)', group: 'ceremony', kind: 'date' },
  ceremony_month_en: { label: 'Tháng tiếng Anh (lễ)', group: 'ceremony', kind: 'date' },
  reception_short: { label: 'Ngày tiệc', group: 'reception', kind: 'date' },
  reception_day: { label: 'Ngày tiệc (số)', group: 'reception', kind: 'date' },
  reception_month: { label: 'Tháng tiệc', group: 'reception', kind: 'date' },
  reception_year: { label: 'Năm tiệc', group: 'reception', kind: 'date' },
  reception_weekday: { label: 'Thứ (tiệc)', group: 'reception', kind: 'date' },
  reception_time_weekday: { label: 'Giờ + thứ (tiệc)', group: 'reception', kind: 'date' },
  reception_month_en: { label: 'Tháng tiếng Anh (tiệc)', group: 'reception', kind: 'date' },
};

// --- Cột thật của bảng invitations ---
const INVITATION_FIELDS = {
  title_vi: { label: 'Tiêu đề thiệp', group: 'general' },
  title_en: { label: 'Tiêu đề tiếng Anh', group: 'general' },
  venue_address: { label: 'Địa chỉ làm lễ', group: 'ceremony' },
  map_url: { label: 'Link chỉ đường (lễ)', group: 'ceremony', kind: 'href' },
  reception_venue_address: { label: 'Địa chỉ đãi tiệc', group: 'reception' },
  reception_map_url: { label: 'Link chỉ đường (tiệc)', group: 'reception', kind: 'href' },
  ceremony_lunar_text: { label: 'Âm lịch (lễ)', group: 'ceremony' },
  reception_lunar_text: { label: 'Âm lịch (tiệc)', group: 'reception' },
  thank_you_message: { label: 'Lời cảm ơn', group: 'general' },
  extra_notes: { label: 'Ghi chú thêm', group: 'general' },
};

// --- Trường riêng của theme, lưu trong extra_data ---
const EXTRA_FIELDS = {
  monogram: { label: 'Chữ lồng (M & N)', group: 'general' },
  // Nhiều theme gộp cả hai tên vào MỘT phần tử ("DUY NAM & VÂN ANH"). Không tách
  // được thành 2 ô mà không đụng vào cấu trúc DOM của theme, nên cho chủ thiệp
  // nhập nguyên cụm — vẫn sửa được, vẫn hiện đúng.
  couple_names: { label: 'Tên đôi (ghép chung 1 ô)', group: 'couple' },
  wedding_tag: { label: 'Nhãn THE WEDDING OF', group: 'general' },
  venue_name: { label: 'Tên nơi làm lễ', group: 'ceremony' },
  reception_venue_name: { label: 'Tên nhà hàng', group: 'reception' },
  reception_time: { label: 'Giờ đãi tiệc', group: 'reception' },
  welcome_quote: { label: 'Câu dẫn lời ngỏ', group: 'content' },
  welcome_text: { label: 'Đoạn lời ngỏ', group: 'content' },
  story_quote: { label: 'Câu dẫn chuyện tình', group: 'content' },
  story_content: { label: 'Nội dung chuyện tình', group: 'content' },
  footer_thank_you: { label: 'Tiêu đề chân trang', group: 'content' },
  invitation_greeting: { label: 'Lời mời', group: 'content' },
  invitation_greeting_sub: { label: 'Lời mời phụ', group: 'content' },
  family_lead_text: { label: 'Dẫn mục gia đình', group: 'family' },
  ceremony_intro: { label: 'Dẫn mục lễ', group: 'ceremony' },
  ceremony_heartfelt_quote: { label: 'Câu cảm ơn ở mục lễ', group: 'ceremony' },
  envelope_subtext: { label: 'Chữ trên phong bì', group: 'content' },
  groom_transfer_note: { label: 'Nội dung CK (chú rể)', group: 'bank' },
  bride_transfer_note: { label: 'Nội dung CK (cô dâu)', group: 'bank' },
  vinyl_track_text: { label: 'Chữ chạy quanh đĩa than', group: 'content' },
  podcast_title: { label: 'Tên bản ghi âm', group: 'content' },
};

// timeline_time_1..8 / timeline_title_1..8 / timeline_desc_1..8
const TIMELINE_MAX = 8;
const TIMELINE_FIELDS = {};
for (let i = 1; i <= TIMELINE_MAX; i += 1) {
  TIMELINE_FIELDS['timeline_time_' + i] = { label: 'Mốc ' + i + ' — giờ', group: 'timeline' };
  TIMELINE_FIELDS['timeline_title_' + i] = { label: 'Mốc ' + i + ' — tiêu đề', group: 'timeline' };
  TIMELINE_FIELDS['timeline_desc_' + i] = { label: 'Mốc ' + i + ' — mô tả', group: 'timeline' };
}

const ALL_FIELDS = Object.assign({}, PERSON_FIELDS, DATE_FIELDS, INVITATION_FIELDS, EXTRA_FIELDS, TIMELINE_FIELDS);

// --- Ô ảnh: phải khớp IMAGE_TYPES trong invitationImageService ---
const IMAGE_SLOTS = {
  cover: { label: 'Ảnh bìa', multiple: false },
  groom: { label: 'Ảnh chú rể', multiple: false },
  bride: { label: 'Ảnh cô dâu', multiple: false },
  story: { label: 'Ảnh chuyện tình', multiple: false },
  gallery: { label: 'Album ảnh', multiple: true, max: 20 },
  bank_qr: { label: 'Mã QR mừng cưới', multiple: true, max: 2 },
  banner: { label: 'Ảnh banner', multiple: false },
  thumbnail: { label: 'Ảnh đại diện mẫu', multiple: false },
};

const isKnownField = (key) => Object.prototype.hasOwnProperty.call(ALL_FIELDS, key);
const isKnownImageSlot = (key) => Object.prototype.hasOwnProperty.call(IMAGE_SLOTS, key);
const fieldMeta = (key) => ALL_FIELDS[key] || null;

module.exports = {
  PERSON_FIELDS, DATE_FIELDS, INVITATION_FIELDS, EXTRA_FIELDS, TIMELINE_FIELDS,
  ALL_FIELDS, IMAGE_SLOTS, TIMELINE_MAX,
  isKnownField, isKnownImageSlot, fieldMeta,
};

// ---------------------------------------------------------------------------
// Bộ trường MẶC ĐỊNH cho khách sửa.
//
// Khi admin không tích chọn gì, chỉ những trường này mở cho khách. Đây là các ô
// mà mọi đám cưới đều phải điền và sửa sai cũng không vỡ bố cục: tên, ngày giờ,
// địa chỉ, lời cảm ơn.
//
// Các ô KHÔNG nằm trong bộ này (chữ lồng, nhãn trang trí, câu dẫn của designer,
// chữ chạy quanh đĩa than...) mặc định chỉ hiển thị — vì chúng được thiết kế theo
// đúng bố cục, khách gõ dài ra là vỡ layout. Admin muốn mở thì tự tích.
const DEFAULT_EDITABLE = [
  // Tên
  'groom_name', 'bride_name', 'groom_short_name', 'bride_short_name', 'couple_names',
  // Gia đình
  'groom.father_grom', 'groom.mother_groom', 'groom.address',
  'bride.father_bride', 'bride.mother_bride', 'bride.address',
  // Lễ
  'ceremony_short', 'ceremony_weekday', 'ceremony_time_weekday', 'ceremony_day',
  'ceremony_month', 'ceremony_year', 'ceremony_lunar_text',
  'venue_address', 'venue_name', 'map_url',
  // Tiệc
  'reception_short', 'reception_weekday', 'reception_time_weekday', 'reception_time',
  'reception_day', 'reception_month', 'reception_year', 'reception_lunar_text',
  'reception_venue_address', 'reception_venue_name', 'reception_map_url',
  // Nội dung
  'thank_you_message', 'title_vi', 'extra_notes',
];

// Trường KHÔNG BAO GIỜ cho sửa tại chỗ, dù admin có tích.
// Thông tin ngân hàng đi qua panel quét mã QR — sửa tay ở đây sẽ ghi sai vào
// extra_data và số tài khoản hiển thị sẽ lệch với mã QR.
const NEVER_EDITABLE = Object.keys(PERSON_FIELDS).filter((k) => PERSON_FIELDS[k].readonly);

// Chuẩn hoá danh sách admin gửi lên: bỏ khoá lạ, bỏ khoá cấm.
const sanitizeEditable = (list) => {
  if (list == null) return null; // null = dùng bộ mặc định
  if (!Array.isArray(list)) return null;
  const never = new Set(NEVER_EDITABLE);
  return [...new Set(list.filter((k) => isKnownField(k) && !never.has(k)))];
};

// Danh sách cuối cùng áp cho 1 mẫu.
const resolveEditable = (editableFields) => {
  const list = editableFields == null ? DEFAULT_EDITABLE : editableFields;
  const never = new Set(NEVER_EDITABLE);
  return list.filter((k) => !never.has(k));
};

module.exports.DEFAULT_EDITABLE = DEFAULT_EDITABLE;
module.exports.NEVER_EDITABLE = NEVER_EDITABLE;
module.exports.sanitizeEditable = sanitizeEditable;
module.exports.resolveEditable = resolveEditable;
