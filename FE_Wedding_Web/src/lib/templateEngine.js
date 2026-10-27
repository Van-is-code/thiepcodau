import { API_BASE } from '../api'
import { buildImageLoadingScript, preconnectOrigins, findLcpImage, DEFAULT_SIZES } from './imageLoading'

// ---------------------------------------------------------------------------
// Module dùng chung cho cả 2 nơi render mẫu thiệp:
//   - TemplateLoader.jsx  -> trang công khai khách mời xem (view-only)
//   - EditorPage.jsx      -> trang chủ thiệp sửa trực tiếp trên chính thiệp
//
// Cùng 1 quy ước data-field/data-image, cùng 1 cách bơm dữ liệu — chỉ khác là
// EditorPage bật thêm "chế độ sửa" (editMode) cho script chạy trong iframe.
// ---------------------------------------------------------------------------

// Ghép html_path (đường dẫn tương đối trả về từ invitation_templates, vd:
// "/templates/duccuong-nguyenquyet/www.ziuwedding.site/vobe2.html") thành URL tuyệt
// đối trỏ về backend đang serve gói mẫu đó. Cho phép html_path đã là URL tuyệt đối
// (mẫu host ở nơi khác, CDN...).
export const resolveTemplateUrl = (htmlPath) => {
  if (!htmlPath) return null
  if (/^https?:\/\//i.test(htmlPath)) return htmlPath
  const normalizedPath = htmlPath.startsWith('/') ? htmlPath : `/${htmlPath}`
  const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}${normalizedPath}`
}

const VN_WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const pad2 = (n) => String(n).padStart(2, '0')

// Ảnh/nhạc do người dùng upload được BE lưu & trả về đường dẫn GỐC theo domain
// (vd "/uploads/images/<id>/x.jpg"). Trong iframe mẫu (srcDoc, cùng origin với FE)
// thì đường dẫn bắt đầu bằng "/" sẽ trỏ về origin FE -> 404 vì file nằm ở BE.
// Thẻ <base> không cứu được (chỉ tác động URL tương đối). Nên phải ghép cứng vào
// API_BASE để mọi ảnh/nhạc load đúng ở cả trình sửa lẫn trang khách xem.
export const toAbsoluteMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return url
  let full = url
  if (!/^(https?:|data:|blob:)/i.test(full) && !full.startsWith('//')) {
    const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '')
    full = `${base}${full.startsWith('/') ? '' : '/'}${full}`
  }
  try {
    return encodeURI(decodeURI(full))
  } catch {
    return full
  }
}

// Chuẩn hoá 1 ảnh trước khi bơm vào iframe:
//   - Đường dẫn tuyệt đối cho MỌI phiên bản, không chỉ ảnh chính. Thiếu bước này thì
//     các URL trong srcset ("/uploads/...") sẽ trỏ về origin của FE -> 404, trình
//     duyệt lặng lẽ rơi về ảnh gốc 1920px và toàn bộ việc tối ưu thành vô nghĩa.
//   - Dựng sẵn chuỗi srcset cho AVIF/WebP/JPEG để applyImg() dùng ngay.
const normalizeVariants = (variants) => {
  if (!variants || typeof variants !== 'object') return null
  const out = {}
  for (const [format, list] of Object.entries(variants)) {
    if (!Array.isArray(list)) continue
    out[format] = list.map((v) => ({ ...v, url: toAbsoluteMediaUrl(v.url) }))
  }
  return out
}

const srcsetOf = (list) => (Array.isArray(list) && list.length
  ? list.map((v) => `${v.url} ${v.width}w`).join(', ')
  : null)

const normalizeImage = (img) => {
  if (!img || !img.image_url) return img
  const variants = normalizeVariants(img.variants)
  return {
    ...img,
    image_url: toAbsoluteMediaUrl(img.image_url),
    variants,
    // BE đã tính sẵn (invitationImageService.publicImage) nhưng route công khai theo
    // slug trả về bản ghi thô — nên tự dựng lại ở đây cho chắc.
    srcset_avif: variants ? srcsetOf(variants.avif) : null,
    srcset_webp: variants ? srcsetOf(variants.webp) : null,
    srcset_jpeg: variants ? srcsetOf(variants.jpeg) : null,
  }
}

const normalizeImageList = (list) => (Array.isArray(list) ? list.map(normalizeImage) : list)

const lastWord = (value) => {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  const parts = trimmed.split(/\s+/)
  return parts[parts.length - 1]
}

// Dùng getUTC* thay vì get* (local) để tránh lệch ngày với field DATEONLY
// (vd. reception_date) — quy ước xuyên suốt: các chữ số ngày/giờ lưu trong DB được
// coi LÀ giờ tường thuật, đọc/ghi đều qua UTC getter/setter cho nhất quán.
const addDateParts = (target, isoValue, prefix) => {
  if (!isoValue) return
  const d = new Date(isoValue)
  if (Number.isNaN(d.getTime())) return

  target[`${prefix}_day`] = pad2(d.getUTCDate())
  target[`${prefix}_month`] = `Tháng ${pad2(d.getUTCMonth() + 1)}`
  target[`${prefix}_month_en`] = EN_MONTHS[d.getUTCMonth()]
  target[`${prefix}_year`] = `Năm ${d.getUTCFullYear()}`
  target[`${prefix}_weekday`] = VN_WEEKDAYS[d.getUTCDay()]
  target[`${prefix}_time_weekday`] = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}, ${VN_WEEKDAYS[d.getUTCDay()]}`
  target[`${prefix}_month_num`] = pad2(d.getUTCMonth() + 1)
  target[`${prefix}_year_num`] = String(d.getUTCFullYear())
  target[`${prefix}_time`] = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
  target[`${prefix}_weekday_date`] = `${VN_WEEKDAYS[d.getUTCDay()].toUpperCase()}, ${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`
  target[`${prefix}_full_date`] = `${VN_WEEKDAYS[d.getUTCDay()]} · ${pad2(d.getUTCDate())} tháng ${pad2(d.getUTCMonth() + 1)} năm ${d.getUTCFullYear()}`
  target[`${prefix}_short`] = `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`
}

// Gộp dữ liệu invitation + extra_data (field riêng theo mẫu) + vài field tiện lợi
// được tính sẵn (tên ngắn, chữ cái đầu, các phần tách của ngày giờ) để HTML mẫu
// bind trực tiếp mà không cần tự tính toán trong JS của mẫu.
export const buildMergedData = (invitation) => {
  const data = {
    ...(invitation?.extra_data || {}),
    ...invitation,
  }

  // Ghép URL tuyệt đối cho mọi ảnh + nhạc trước khi bơm vào iframe.
  if (data.images) data.images = normalizeImageList(data.images)
  if (data.invitation_images) data.invitation_images = normalizeImageList(data.invitation_images)
  if (data.music_url) data.music_url = toAbsoluteMediaUrl(data.music_url)
  if (data.extra_data?.music_settings?.voice_url) {
    data.extra_data.music_settings.voice_url = toAbsoluteMediaUrl(data.extra_data.music_settings.voice_url)
  }
  if (data.music_settings?.voice_url) {
    data.music_settings.voice_url = toAbsoluteMediaUrl(data.music_settings.voice_url)
  }

  data.groom_name = invitation?.groom?.name_groom || ''
  data.bride_name = invitation?.bride?.name_bride || ''

  // Cho phép người dùng tùy chỉnh tên ngắn / tên gọi và tên đôi hiển thị theo ý muốn,
  // không bị ép buộc chỉ lấy chữ cuối (lastWord).
  const customGroomShort = invitation?.extra_data?.groom_short_name ?? invitation?.groom_short_name
  const customBrideShort = invitation?.extra_data?.bride_short_name ?? invitation?.bride_short_name
  data.groom_short_name = (customGroomShort !== undefined && customGroomShort !== null && String(customGroomShort).trim() !== '')
    ? String(customGroomShort).trim()
    : (data.groom_name ? lastWord(data.groom_name) : '')
  data.bride_short_name = (customBrideShort !== undefined && customBrideShort !== null && String(customBrideShort).trim() !== '')
    ? String(customBrideShort).trim()
    : (data.bride_name ? lastWord(data.bride_name) : '')

  data.groom_initial = data.groom_short_name ? data.groom_short_name.charAt(0) : ''
  data.bride_initial = data.bride_short_name ? data.bride_short_name.charAt(0) : ''

  const customCoupleNames = invitation?.extra_data?.couple_names ?? invitation?.couple_names
  if (customCoupleNames !== undefined && customCoupleNames !== null && String(customCoupleNames).trim() !== '') {
    data.couple_names = String(customCoupleNames).trim()
  } else if (!data.couple_names) {
    data.couple_names = [data.groom_short_name, data.bride_short_name].filter(Boolean).join(' & ')
  }
  if (!data.couple_full_names) {
    data.couple_full_names = [data.groom_name, data.bride_name].filter(Boolean).join(' & ')
  }

  addDateParts(data, invitation?.ceremony_date, 'ceremony')
  addDateParts(data, invitation?.reception_date, 'reception')

  // Giờ lễ cưới (Lễ Thành Hôn): luôn giữ nguyên theo thiết lập của thiệp, không bị thay đổi theo khách mời
  const explicitCeremonyTime = invitation?.ceremony_time || invitation?.extra_data?.ceremony_time
  if (explicitCeremonyTime && String(explicitCeremonyTime).trim()) {
    data.ceremony_time = String(explicitCeremonyTime).trim()
  }
  if (data.ceremony_weekday && data.ceremony_time) {
    data.ceremony_time_weekday = `${data.ceremony_time}, ${data.ceremony_weekday}`
  }

  // Giờ tiệc cưới: ưu tiên reception_time từ invitation/link riêng (?time=...) hoặc extra_data.
  // Tránh việc reception_date kiểu DATEONLY (UTC 00:00) ghi đè làm reception_time bị biến thành 00:00.
  const explicitRecTime = invitation?.reception_time || invitation?.extra_data?.reception_time
  if (explicitRecTime && String(explicitRecTime).trim()) {
    data.reception_time = String(explicitRecTime).trim()
  } else if (!data.reception_time || data.reception_time === '00:00') {
    data.reception_time = '11:00'
  }
  if (data.reception_weekday) {
    data.reception_time_weekday = `${data.reception_time}, ${data.reception_weekday}`
  }

  if (data.wedding_location && !data.wedding_city) {
    data.wedding_city = String(data.wedding_location).replace(/^[\s—–-]+|[\s—–-]+$/g, '').trim()
  } else if (data.wedding_city && !data.wedding_location) {
    data.wedding_location = `— ${data.wedding_city} —`
  }

    // Tuỳ biến hiển thị: RSVP, Lời chúc, Danh sách lời chúc, Hộp quà, Ảnh nền
  const customShowRsvp = invitation?.extra_data?.show_rsvp ?? invitation?.show_rsvp
  data.show_rsvp = customShowRsvp !== undefined ? Boolean(customShowRsvp) : true

  const customAllowWishes = invitation?.extra_data?.allow_wishes ?? invitation?.allow_wishes
  data.allow_wishes = customAllowWishes !== undefined ? Boolean(customAllowWishes) : true

  const customShowWishesList = invitation?.extra_data?.show_wishes_list ?? invitation?.show_wishes_list
  data.show_wishes_list = customShowWishesList !== undefined ? Boolean(customShowWishesList) : true

  const customShowGiftBox = invitation?.extra_data?.show_gift_box ?? invitation?.show_gift_box
  data.show_gift_box = customShowGiftBox !== undefined ? Boolean(customShowGiftBox) : true

  const customBgImage = invitation?.extra_data?.background_image ?? invitation?.background_image
  data.background_image = customBgImage ? toAbsoluteMediaUrl(String(customBgImage).trim()) : ''

  const customBgColor = invitation?.extra_data?.background_color ?? invitation?.background_color
  data.background_color = (customBgColor && typeof customBgColor === 'string' && customBgColor.trim()) ? customBgColor.trim() : ''

  const customAccentColor = invitation?.extra_data?.accent_color ?? invitation?.accent_color
  data.accent_color = (customAccentColor && /^#[0-9a-fA-F]{6}$/.test(String(customAccentColor).trim())) ? String(customAccentColor).trim() : ''

  const customDecorColor = invitation?.extra_data?.decor_color ?? invitation?.decor_color
  data.decor_color = (customDecorColor && /^#[0-9a-fA-F]{6}$/.test(String(customDecorColor).trim())) ? String(customDecorColor).trim() : ''

  const customTextColor = invitation?.extra_data?.text_color ?? invitation?.text_color
  data.text_color = (customTextColor && /^#[0-9a-fA-F]{6}$/.test(String(customTextColor).trim())) ? String(customTextColor).trim() : ''

  const customCoverOverlayColor = invitation?.extra_data?.cover_overlay_color ?? invitation?.cover_overlay_color
  data.cover_overlay_color = (customCoverOverlayColor && /^#[0-9a-fA-F]{6}$/.test(String(customCoverOverlayColor).trim())) ? String(customCoverOverlayColor).trim() : ''

  data.invitation_id = invitation?.id || ''
  data.api_base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '')
  data.guest_name = invitation?.guest_name || ''
  data.guest_id = invitation?.guest_id || ''
  data.guest_note = invitation?.guest_note || ''
  if (Array.isArray(invitation?.wishes)) {
    data.wishes = invitation.wishes
  }

  const extraBank = invitation?.extra_data?.bank || invitation?.bank || {}
  data.bank = {
    ...extraBank,
    display_mode: extraBank.display_mode || 'both',
    groom: {
      bank_name: extraBank.groom?.bank_name || invitation?.groom?.bank_name || '',
      bank_short_name: extraBank.groom?.bank_short_name || '',
      bank_account_number: extraBank.groom?.bank_account_number || invitation?.groom?.bank_account_number || '',
      bank_account_name: extraBank.groom?.bank_account_name || invitation?.groom?.bank_account_name || '',
      qr_content: extraBank.groom?.qr_content || '',
      qr_image: extraBank.groom?.qr_image || '',
    },
    bride: {
      bank_name: extraBank.bride?.bank_name || invitation?.bride?.bank_name || '',
      bank_short_name: extraBank.bride?.bank_short_name || '',
      bank_account_number: extraBank.bride?.bank_account_number || invitation?.bride?.bank_account_number || '',
      bank_account_name: extraBank.bride?.bank_account_name || invitation?.bride?.bank_account_name || '',
      qr_content: extraBank.bride?.qr_content || '',
      qr_image: extraBank.bride?.qr_image || '',
    },
  }

  return data
}

// ---------------------------------------------------------------------------
// Write-map: 1 data-field key khi khách sửa trực tiếp thì LƯU vào đâu.
// Field không khớp quy tắc nào bên dưới thì mặc định rơi vào extra_data (field
// riêng theo mẫu) — khớp đúng cách buildMergedData() đã gộp extra_data vào top-level.
// ---------------------------------------------------------------------------
const GROOM_NAME_ALIASES = new Set(['groom_name', 'groom_initial'])
const BRIDE_NAME_ALIASES = new Set(['bride_name', 'bride_initial'])
const CEREMONY_DATE_ALIASES = new Set([
  'ceremony_day', 'ceremony_month', 'ceremony_month_en', 'ceremony_year',
  'ceremony_weekday', 'ceremony_time_weekday', 'ceremony_short', 'ceremony_month_num', 'ceremony_year_num', 'ceremony_time', 'ceremony_weekday_date', 'ceremony_full_date',
])
const RECEPTION_DATE_ALIASES = new Set([
  'reception_day', 'reception_month', 'reception_month_en', 'reception_year',
  'reception_weekday', 'reception_time_weekday', 'reception_short', 'reception_month_num', 'reception_year_num', 'reception_weekday_date', 'reception_full_date',
])
const INVITATION_TEXT_FIELDS = new Set([
  'title_vi', 'title_en', 'venue_address', 'map_url',
  'reception_venue_address', 'reception_map_url',
  'ceremony_lunar_text', 'reception_lunar_text',
  'thank_you_message', 'extra_notes',
])

// scope: 'invitation' | 'groom' | 'bride' | 'extra_data'
// widget: 'text' | 'date' | 'datetime'
export const resolveWriteTarget = (fieldKey) => {
  if (fieldKey.startsWith('groom.')) return { scope: 'groom', column: fieldKey.slice(6), widget: 'text' }
  if (fieldKey.startsWith('bride.')) return { scope: 'bride', column: fieldKey.slice(6), widget: 'text' }
  if (fieldKey === 'groom_short_name') return { scope: 'extra_data', column: 'groom_short_name', widget: 'text' }
  if (fieldKey === 'bride_short_name') return { scope: 'extra_data', column: 'bride_short_name', widget: 'text' }
  if (fieldKey === 'couple_names') return { scope: 'extra_data', column: 'couple_names', widget: 'text' }
  if (['show_rsvp', 'allow_wishes', 'show_wishes_list', 'show_gift_box', 'background_image', 'background_color', 'accent_color', 'decor_color', 'text_color', 'cover_overlay_color'].includes(fieldKey)) return { scope: 'extra_data', column: fieldKey, widget: 'text' }
  if (GROOM_NAME_ALIASES.has(fieldKey)) return { scope: 'groom', column: 'name_groom', widget: 'text' }
  if (BRIDE_NAME_ALIASES.has(fieldKey)) return { scope: 'bride', column: 'name_bride', widget: 'text' }
  // Field GỐC (không phải alias hiển thị) mà chính openDateInput() và nút "Chọn ngày cưới"
  // trong mẫu thiệp gửi lên khi lưu — thiếu 2 dòng này thì ngày cưới bị rơi xuống nhánh
  // extra_data ở cuối, lưu vào extra_data.ceremony_date thay vì cột invitations.ceremony_date
  // thật, nên bấm lưu xong ngày cưới KHÔNG đổi (buildMergedData ưu tiên cột thật, luôn đè
  // lên extra_data khi gộp dữ liệu).
  if (fieldKey === 'ceremony_date') return { scope: 'invitation', column: 'ceremony_date', widget: 'datetime' }
  if (fieldKey === 'reception_date') return { scope: 'invitation', column: 'reception_date', widget: 'date' }
  if (fieldKey === 'reception_time') return { scope: 'extra_data', column: 'reception_time', widget: 'text' }
  if (CEREMONY_DATE_ALIASES.has(fieldKey)) return { scope: 'invitation', column: 'ceremony_date', widget: 'datetime' }
  if (RECEPTION_DATE_ALIASES.has(fieldKey)) return { scope: 'invitation', column: 'reception_date', widget: 'date' }
  if (INVITATION_TEXT_FIELDS.has(fieldKey)) return { scope: 'invitation', column: fieldKey, widget: 'text' }
  return { scope: 'extra_data', column: fieldKey, widget: 'text' }
}

// Danh sách field ngày dùng để báo cho script trong iframe biết field nào cần mở
// input ngày/giờ thay vì sửa chữ trực tiếp.
const buildEditConfig = () => ({
  ceremonyDateFields: Array.from(CEREMONY_DATE_ALIASES),
  receptionDateFields: Array.from(RECEPTION_DATE_ALIASES),
})

// ---------------------------------------------------------------------------
// Script chạy BÊN TRONG iframe của mẫu — luôn bơm dữ liệu (view lẫn edit), và khi
// editMode bật thì thêm phần click-để-sửa. Chèn ngay trước </body> nên không cần
// đợi DOMContentLoaded — mọi phần tử phía trên nó trong tài liệu đã tồn tại.
// window.__weddingWebReinject(newData) cho phép áp lại dữ liệu MỚI vào DOM hiện có
// mà không cần tải lại iframe (dùng sau khi lưu 1 field thành công).
// ---------------------------------------------------------------------------
// Ảnh trống hiển thị khi 1 vùng data-image CHƯA có ảnh thật — chỉ áp dụng ở chế độ
// sửa thiệp, để chủ thiệp biết ngay đây là chỗ bấm vào để tải ảnh lên, thay vì vẫn
// thấy ảnh mẫu có sẵn trong file template (dễ tưởng nhầm là ảnh thật đã được gán).
const EMPTY_IMAGE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <rect x="6" y="6" width="388" height="388" rx="16" fill="#f5ede0" stroke="#c8856a" stroke-width="4" stroke-dasharray="14 10"/>
  <g transform="translate(200,172)">
    <rect x="-70" y="-46" width="140" height="100" rx="10" fill="none" stroke="#b8896f" stroke-width="6"/>
    <circle cx="-30" cy="-16" r="12" fill="none" stroke="#b8896f" stroke-width="6"/>
    <path d="M-58 34 L-14 -6 L18 24 L46 -2 L58 10" fill="none" stroke="#b8896f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="58" cy="-46" r="22" fill="#c8856a"/>
    <path d="M58 -56 V-36 M48 -46 H68" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
  </g>
  <text x="200" y="270" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#8a7a6f">Bấm để thêm ảnh</text>
</svg>
`.trim()

export const EMPTY_IMAGE_DATA_URI = `data:image/svg+xml,${encodeURIComponent(EMPTY_IMAGE_SVG)}`

const buildDomInjectScript = (editMode) => `
(function () {
  var EDIT_MODE = ${editMode ? 'true' : 'false'};
  var EMPTY_IMAGE_SRC = ${JSON.stringify(EMPTY_IMAGE_DATA_URI)};

  function getPath(obj, path) {
    return path.split('.').reduce(function (acc, key) {
      return acc == null ? acc : acc[key];
    }, obj);
  }

  var WEEKDAYS_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  var MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function cpad(n) { return String(n).length < 2 ? '0' + n : String(n); }

  // ---- LỊCH THÁNG CƯỚI (dùng chung view + edit) ------------------------------
  // Mẫu gốc vẽ lịch bằng 40 ô <div> đặt tuyệt đối, số ngày + vị trí trái tim CỐ
  // ĐỊNH -> đổi ngày cưới xong lịch không cập nhật. Ở đây phủ 1 lịch tự sinh từ
  // ceremony_date lên trên khối lịch cũ (ẩn khối cũ đi) nên luôn đúng tháng, đúng
  // thứ, và trái tim rơi đúng ngày cưới.
  function renderCeremonyCalendar(data) {
    var raw = data && (data.ceremony_date || data.reception_date);
    var d = raw ? new Date(raw) : null;
    if (!d || isNaN(d.getTime())) return;
    var year = d.getUTCFullYear();
    var month = d.getUTCMonth();
    var weddingDay = d.getUTCDate();

    // 1. Mẫu LadiPage (#SECTION8)
    var host = document.getElementById('SECTION8');
    if (host) {
      var container = host.querySelector('.ladi-container') || host;
      var statics = host.querySelectorAll('[id^="HEADLINE"], #IMAGE29, #SHAPE5');
      for (var s = 0; s < statics.length; s++) statics[s].style.setProperty('visibility', 'hidden', 'important');

      var wrap = document.getElementById('ww-cal');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'ww-cal';
        container.appendChild(wrap);
      }
      var firstDow = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // 0 = Monday
      var daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      var cells = '';
      for (var i = 0; i < firstDow; i++) cells += '<span class="ww-cal-cell ww-cal-empty"></span>';
      for (var day = 1; day <= daysInMonth; day++) {
        var isWed = day === weddingDay;
        cells += '<span class="ww-cal-cell' + (isWed ? ' ww-cal-wed' : '') + '">' +
          (isWed ? '<svg viewBox="0 0 32 29" class="ww-cal-heart"><path d="M16 29S2 19.7 2 9.9C2 4.6 6.3.5 11.4.5 14 .5 16 2 16 2s2-1.5 4.6-1.5C25.7.5 30 4.6 30 9.9 30 19.7 16 29 16 29z"/></svg>' : '') +
          '<i>' + cpad(day) + '</i></span>';
      }
      var heads = '';
      for (var h = 0; h < 7; h++) heads += '<span class="ww-cal-head">' + WEEKDAYS_SHORT[h] + '</span>';
      wrap.innerHTML =
        '<div class="ww-cal-month">' + (MONTHS_EN[month] || '') + '</div>' +
        '<div class="ww-cal-grid">' + heads + cells + '</div>' +
        (EDIT_MODE ? '<div class="ww-cal-hint">✏️ Bấm để chọn lại ngày cưới</div>' : '');
    }

    // 2. Mẫu Editorial (#calendar / .scene-calendar / .editorial-calendar-table)
    var edCalSection = document.getElementById('calendar') || document.querySelector('.scene-calendar');
    var edTable = document.querySelector('.editorial-calendar-table');
    if (edTable) {
      if (edCalSection) {
        var titleEl = edCalSection.querySelector('.calendar-header .section-title, .section-title');
        if (titleEl) {
          titleEl.textContent = 'THÁNG ' + cpad(month + 1) + ' / ' + year;
        }
      }
      var tbody = edTable.querySelector('tbody') || edTable;
      var firstDowEd = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // 0 = Hai, ..., 6 = CN
      var daysInMonthEd = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      var tRows = '';
      var curCol = 0;
      var curRow = '<tr>';
      for (var f = 0; f < firstDowEd; f++) {
        curRow += '<td></td>';
        curCol++;
      }
      for (var dNum = 1; dNum <= daysInMonthEd; dNum++) {
        if (curCol === 7) {
          curRow += '</tr>';
          tRows += curRow;
          curRow = '<tr>';
          curCol = 0;
        }
        if (dNum === weddingDay) {
          curRow += '<td class="calendar-wedding-day">' +
            '<div class="calendar-jewel-marker">' +
            '<span class="marker-day">' + cpad(dNum) + '</span>' +
            '<span class="marker-flower-badge" aria-hidden="true">✦</span>' +
            '</div></td>';
        } else {
          curRow += '<td>' + cpad(dNum) + '</td>';
        }
        curCol++;
      }
      if (curCol > 0) {
        while (curCol < 7) {
          curRow += '<td></td>';
          curCol++;
        }
        curRow += '</tr>';
        tRows += curRow;
      }
      tbody.innerHTML = tRows;

      // Cập nhật link Google Calendar
      var gcalPill = document.querySelector('.google-calendar-pill');
      if (gcalPill) {
        var gTitle = encodeURIComponent((data.title_vi || ('Đám cưới ' + (data.groom_name || 'Chú rể') + ' & ' + (data.bride_name || 'Cô dâu'))).trim());
        var yStr = String(year);
        var mStr = cpad(month + 1);
        var dStr = cpad(weddingDay);
        var gDate = yStr + mStr + dStr + 'T040000Z/' + yStr + mStr + dStr + 'T070000Z';
        var gVenue = encodeURIComponent((data.venue_name || data.reception_venue_name || 'Hôn lễ').trim() + ' - ' + (data.venue_address || data.reception_venue_address || '').trim());
        gcalPill.setAttribute('href', 'https://www.google.com/calendar/render?action=TEMPLATE&text=' + gTitle + '&dates=' + gDate + '&location=' + gVenue);
      }
    }
  }

  // ---- THƯ VIỆN ICON TIMELINE (nét vẽ tay, cùng phong cách 3 icon gốc) -------
  var _IA = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var _ID = 'fill="currentColor" stroke="none"';
  var WW_ICONS = {
    'don-khach':{n:'Đón khách',p:'<path d="M12 39.5 V13 H28 V39.5" '+_IA+'/><path d="M7 39.5 H41" '+_IA+'/><path d="M28 13 L37.5 16.5 V36 L28 39.5" '+_IA+'/><path d="M33 26 L33 28.5" '+_IA+'/><path d="M20 10 C18.7 8.3 15.8 9 16.6 11.2 C17.1 12.4 18.6 13.1 20 13.9 C21.4 13.1 22.9 12.4 23.4 11.2 C24.2 9 21.3 8.3 20 10 Z" '+_IA+'/>'},
    'don-dau':{n:'Đón dâu',p:'<path d="M6.5 30 L9.5 21.5 C10 20.2 11 19.5 12.4 19.5 L27 19.5 C28 19.5 28.8 19.9 29.5 20.7 L35.5 27.5 L39 28.5 C40.3 28.9 41 29.9 41 31.2 L41 33.5 C41 34.6 40.1 35.5 39 35.5 L37 35.5" '+_IA+'/><path d="M6.5 30 L6.5 33.5 C6.5 34.6 7.4 35.5 8.5 35.5 L11 35.5 M18 35.5 L30 35.5" '+_IA+'/><circle cx="14.5" cy="35.5" r="3.4" '+_IA+'/><circle cx="33.5" cy="35.5" r="3.4" '+_IA+'/><path d="M18.5 19.5 L18.5 27 L10 27" '+_IA+'/><path d="M24 14.5 C22.6 12.7 19.5 13.4 20.4 15.8 C20.9 17 22.5 17.7 24 18.5 C25.5 17.7 27.1 17 27.6 15.8 C28.5 13.4 25.4 12.7 24 14.5 Z" '+_IA+'/>'},
    'gia-tien':{n:'Lễ gia tiên',p:'<path d="M13 30.5 C13 34.5 17.9 37.5 24 37.5 C30.1 37.5 35 34.5 35 30.5 L35 26.5 L13 26.5 Z" '+_IA+'/><path d="M11 26.5 H37" '+_IA+'/><path d="M18 26.5 L18 23 M30 26.5 L30 23" '+_IA+'/><path d="M24 21 C24 18 21.5 17.5 22.5 14.5 M28 21 C28 19 26.5 18.6 27 16.5 M20 21 C20 19.5 18.8 19 19.2 17" '+_IA+'/>'},
    'trao-nhan':{n:'Trao nhẫn',p:'<path d="M19.5 33 C24.7 33 29 28.9 29 23.9 C29 18.9 24.7 14.8 19.5 14.8 C14.3 14.8 10 18.9 10 23.9 C10 28.9 14.3 33 19.5 33 Z" '+_IA+'/><path d="M28.5 33 C33.7 33 38 28.9 38 23.9 C38 18.9 33.7 14.8 28.5 14.8 C27 14.8 25.6 15.1 24.4 15.7" '+_IA+'/><path d="M19.5 14.8 L17.6 11.4 L21.6 11.4 Z" '+_IA+'/>'},
    'nang-ly':{n:'Nâng ly',p:'<path d="M13 10.5 L9.5 20.5 C8.4 25 11 28.5 15 28.5 C19 28.5 21.6 25 20.5 20.5 L17 10.5 Z" '+_IA+'/><path d="M35 10.5 L38.5 20.5 C39.6 25 37 28.5 33 28.5 C29 28.5 26.4 25 27.5 20.5 L31 10.5 Z" '+_IA+'/><path d="M15 28.5 L15 37.5 M11 38 L19 38" '+_IA+'/><path d="M33 28.5 L33 37.5 M29 38 L37 38" '+_IA+'/><path d="M22 12 L21 8 M26.5 12 L27.5 8 M24 8.5 L24 5" '+_IA+'/>'},
    'khai-tiec':{n:'Khai tiệc · Dùng bữa',p:'<circle cx="24" cy="24" r="12.5" '+_IA+'/><circle cx="24" cy="24" r="7.5" '+_IA+'/><path d="M9 12 L9 21 C9 22.7 10.3 24 12 24 M12 12 L12 24 M15 12 L15 21 C15 22.7 13.7 24 12 24 M12 24 L12 37" '+_IA+'/><path d="M36 12 C33.5 12 32 15 32 19 C32 22 33.5 23.5 36 23.5 L36 37" '+_IA+'/>'},
    'cat-banh':{n:'Cắt bánh',p:'<path d="M14 37 L14 30 C14 28 15.5 27 18 27 L30 27 C32.5 27 34 28 34 30 L34 37 Z" '+_IA+'/><path d="M17 27 L17 21 C17 19 18.3 18 20.5 18 L27.5 18 C29.7 18 31 19 31 21 L31 27" '+_IA+'/><path d="M24 18 L24 13 M24 13 C22.7 13 22 12.2 22 11 C22 9.6 24 8 24 8 C24 8 26 9.6 26 11 C26 12.2 25.3 13 24 13 Z" '+_IA+'/><path d="M30 33 L41 22 M38.5 19.5 L41.5 22.5 L39 25" '+_IA+'/>'},
    'van-nghe':{n:'Văn nghệ · Ca hát',p:'<rect x="18" y="6.5" width="12" height="21" rx="6" '+_IA+'/><path d="M13 22 C13 29 18 33.5 24 33.5 C30 33.5 35 29 35 22" '+_IA+'/><path d="M24 33.5 L24 40 M18.5 40.5 L29.5 40.5" '+_IA+'/><path d="M21 13 L27 13 M21 17.5 L27 17.5" '+_IA+'/>'},
    'mini-game':{n:'Mini game',p:'<path d="M10 17 L21.5 11 L33 17 L33 30 L21.5 36 L10 30 Z" '+_IA+'/><path d="M10 17 L21.5 23 L33 17 M21.5 23 L21.5 36" '+_IA+'/><circle cx="16" cy="20" r="1.2" '+_ID+'/><circle cx="21.5" cy="30.5" r="1.2" '+_ID+'/><circle cx="27" cy="20" r="1.2" '+_ID+'/><path d="M37 11 L37 17 M34 14 L40 14 M39 24 L39 28 M37 26 L41 26" '+_IA+'/>'},
    'tung-hoa':{n:'Tung hoa cưới',p:'<circle cx="18" cy="15" r="5" '+_IA+'/><circle cx="29" cy="13.5" r="4.3" '+_IA+'/><circle cx="24.5" cy="22" r="4.6" '+_IA+'/><path d="M18 20 L22 33 M29 17.8 L26 33 M24.5 26.6 L24 33" '+_IA+'/><path d="M18.5 33 L30 33 L27 40 L21.5 40 Z" '+_IA+'/><path d="M37 20 C40 21 40 25 37 26 M39 14 C41 15 41 18 39 19" '+_IA+'/>'},
    'khieu-vu':{n:'Khiêu vũ',p:'<circle cx="16" cy="11.5" r="3.2" '+_IA+'/><circle cx="32" cy="11.5" r="3.2" '+_IA+'/><path d="M16 15 L16 25 L11 34 M16 20 L23 24 M16 25 L21 33" '+_IA+'/><path d="M32 15 L32 25 L37 34 M32 20 L25 24 M32 25 L27 33" '+_IA+'/><path d="M23 24 L25 24" '+_IA+'/>'},
    'chup-anh':{n:'Chụp ảnh · Photobooth',p:'<path d="M9 18.5 C9 17 10 16 11.5 16 L16 16 L18.5 12.5 L29.5 12.5 L32 16 L36.5 16 C38 16 39 17 39 18.6 L39 33 C39 34.6 38 35.6 36.4 35.6 L11.6 35.6 C10 35.6 9 34.6 9 33 Z" '+_IA+'/><path d="M24 32.4 C28.4 32.4 31.7 28.9 31.6 24.6 C31.5 20.4 28.2 17.2 24 17.2 C19.8 17.2 16.4 20.6 16.4 24.8 C16.4 29 19.8 32.4 24 32.4 Z" '+_IA+'/><circle cx="35.2" cy="19.7" r="1.1" '+_ID+'/>'},
    'thap-nen':{n:'Thắp nến',p:'<path d="M17 20 L31 20 L31 39 C31 39.6 30.6 40 30 40 L18 40 C17.4 40 17 39.6 17 39 Z" '+_IA+'/><path d="M14.5 40 L33.5 40 M20 24.5 L28 24.5" '+_IA+'/><path d="M24 20 L24 16" '+_IA+'/><path d="M24 13.5 C24 10 21 9 22 5.5 C25.5 7 28 10 28 13 C28 15.8 26.2 17.5 24 17.5 C22.2 17.5 21 16 21.4 14" '+_IA+'/>'},
    'dong-ho':{n:'Giờ lành · Đếm ngược',p:'<circle cx="24" cy="25" r="14" '+_IA+'/><path d="M24 25 L24 17 M24 25 L30 28" '+_IA+'/><path d="M24 11 L24 8 M20 8.5 L28 8.5" '+_IA+'/><path d="M37 14 L40 11 M11 14 L8 11" '+_IA+'/>'},
    'tha-bong':{n:'Thả bóng · Pháo giấy',p:'<path d="M18 22 C18 27 15 30 15 30 M18 22 C22.4 22 26 18 26 13 C26 8.5 22.4 6 18 6 C13.6 6 10 9.5 10 14 C10 18.5 13.6 22 18 22 Z" '+_IA+'/><path d="M31 27 C31 31 29 33.5 29 33.5 M31 27 C34.9 27 38 23.8 38 19.5 C38 15.6 34.9 13 31 13 C27.1 13 24 16.2 24 20.5" '+_IA+'/><path d="M15 30 C15 33 19 33 19 36 M29 33.5 C29 36 25 36.5 25.5 39" '+_IA+'/>'},
    'tien-khach':{n:'Tiễn khách · Cảm ơn',p:'<path d="M14 39 L14 24 C14 22.5 15 21.5 16.5 21.5 C18 21.5 19 22.5 19 24 L19 20 C19 18.5 20 17.5 21.5 17.5 C23 17.5 24 18.5 24 20 L24 22 C24 20.5 25 19.5 26.5 19.5 C28 19.5 29 20.5 29 22 L29 24 C29 22.7 29.9 21.8 31.2 21.8 C32.5 21.8 33.4 22.7 33.4 24 L33.4 33 C33.4 37 30.5 39.5 26 39.5 L20 39.5 C17 39.5 14 39 14 39 Z" '+_IA+'/><path d="M13 21 C11 19 11 15 15 15 M20 12 C20 8 15 8 15 12 C15 14 17.5 16 20 18.5 C22.5 16 25 14 25 12 C25 8 20 8 20 12 Z" '+_IA+'/>'}
  };
  var WW_ICON_ORDER = ['don-khach','don-dau','gia-tien','trao-nhan','nang-ly','khai-tiec','cat-banh','van-nghe','mini-game','tung-hoa','khieu-vu','chup-anh','thap-nen','dong-ho','tha-bong','tien-khach'];
  function wwIconSvg(id) {
    var ic = WW_ICONS[id];
    if (!ic) return '';
    return '<svg viewBox="0 0 48 48" class="ww-ic" aria-hidden="true">' + ic.p + '</svg>';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  var WW_TL_DEFAULT = [
    { t: '10:30', label: 'Đón khách & Check-in', desc: 'Chụp ảnh kỷ niệm cùng Cô dâu & Chú rể', icon: 'don-khach' },
    { t: '11:00', label: 'Nghi lễ thành hôn', desc: 'Lễ thành hôn trang trọng và bắt đầu khai tiệc mừng', icon: 'trao-nhan' },
    { t: '11:45', label: 'Cắt bánh & Nâng ly', desc: 'Cô dâu chú rể rót tháp rượu hạnh phúc và gửi lời tri ân', icon: 'nang-ly' },
    { t: '12:30', label: 'Tiệc mừng & Minigame', desc: 'Giao lưu cùng bạn bè thân hữu và bốc thăm may mắn', icon: 'khai-tiec' },
    { t: '13:30', label: 'Tiễn khách & Cảm ơn', desc: 'Lưu lại những kỷ niệm đẹp và gửi lời chúc tốt lành', icon: 'tien-khach' }
  ];

  // ---- TIMELINE + DRESS CODE (tự sinh từ extra_data.timeline / .dresscode) ---
  var TL_FONT_HEAD = 'MUZUViWSVAtUEVSRkVDVEtQFMTElHUkFQSFkuVFRG, "Prata", "Tinos", serif';
  var TL_FONT_ITEM = 'MUZUVlZJUEFsYnJhRGlzcGxheSMaWdodCdGY, "Roboto", sans-serif';
  function wwTimelineItems(data) {
    var arr = data && (data.timeline || (data.extra_data && data.extra_data.timeline));
    if (Array.isArray(arr) && arr.length) return arr;
    var extra = (data && data.extra_data) || data || {};
    var fromIndexed = [];
    for (var idx = 1; idx <= 8; idx++) {
      var t = extra['timeline_time_' + idx];
      var title = extra['timeline_title_' + idx];
      var desc = extra['timeline_desc_' + idx];
      if (t || title || desc) {
        fromIndexed.push({ t: t || '', label: title || '', title: title || '', desc: desc || '', icon: 'don-khach' });
      }
    }
    if (fromIndexed.length) return fromIndexed;
    return WW_TL_DEFAULT;
  }
  function wwDressCode(data) {
    var d = (data && data.dresscode) || (data && data.extra_data && data.extra_data.dresscode) || {};
    var rawColors = Array.isArray(d.colors) ? d.colors : (d.colors ? [d.colors] : []);
    return {
      text: d.text || '',
      colors: rawColors.length ? rawColors : [
        { hex: '#7e6c94', name: 'Lavender', sub: 'Lụa Tím Nhạt' },
        { hex: '#f5e6d3', name: 'Cream', sub: 'Kem Sữa' },
        { hex: '#a3b899', name: 'Sage', sub: 'Xanh Bạc Hà' },
        { hex: '#5c3d4e', name: 'Plum', sub: 'Mận Trầm' }
      ]
    };
  }
  function renderTimeline(data) {
    var showTl = data.show_timeline !== false && (!data.extra_data || data.extra_data.show_timeline !== false);
    var showDc = data.show_dresscode !== false && (!data.extra_data || data.extra_data.show_dresscode !== false);

    var items = wwTimelineItems(data);
    var dress = wwDressCode(data);

    // 1. Mẫu Editorial: #timeline / .scene-timeline
    var edTimeline = document.getElementById('timeline') || document.querySelector('.scene-timeline');
    if (edTimeline) {
      if (!EDIT_MODE && !showTl && !showDc) {
        edTimeline.style.display = 'none';
        return;
      }
      edTimeline.style.removeProperty('display');

      var tlHeader = edTimeline.querySelector('.timeline-header');
      var stem = edTimeline.querySelector('.living-botanical-stem');
      var dcArea = edTimeline.querySelector('.dresscode-open-area');

      // Timeline visibility
      if (!showTl) {
        if (!EDIT_MODE) {
          if (tlHeader) tlHeader.style.display = 'none';
          if (stem) stem.style.display = 'none';
        } else {
          if (tlHeader) tlHeader.style.removeProperty('display');
          if (stem) {
            stem.style.removeProperty('display');
            stem.style.opacity = '0.4';
          }
          var oldBanner = edTimeline.querySelector('.ww-off-banner-tl');
          if (!oldBanner && tlHeader) {
            tlHeader.insertAdjacentHTML('afterend', '<div class="ww-off-banner ww-off-banner-tl" data-edit-tl>⚠️ Timeline đang TẮT (người xem sẽ không thấy). Bấm để chỉnh sửa hoặc bật lại.</div>');
          }
        }
      } else {
        if (tlHeader) tlHeader.style.removeProperty('display');
        if (stem) {
          stem.style.removeProperty('display');
          stem.style.removeProperty('opacity');
        }
        var bannerTl = edTimeline.querySelector('.ww-off-banner-tl');
        if (bannerTl) bannerTl.remove();

        // Render stem milestones
        if (stem) {
          var stemHtml = '<div class="stem-central-vine" aria-hidden="true"></div>';
          for (var i = 0; i < items.length; i++) {
            var it = items[i] || {};
            var ic = it.icon && WW_ICONS[it.icon] ? wwIconSvg(it.icon) : '<svg class="fine-stem-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="12" cy="12" r="6"></circle></svg>';
            stemHtml += '<div class="stem-milestone stem-milestone--node" data-edit-tl style="' + (EDIT_MODE ? 'cursor:pointer' : '') + '">' +
              '<div class="stem-node-badge" aria-hidden="true">' + ic + '</div>' +
              '<div class="stem-milestone-content">' +
                '<span class="milestone-time">' + esc(it.t || '') + '</span>' +
                '<h4 class="milestone-title">' + esc(it.label || it.title || '') + '</h4>' +
                (it.desc ? '<p class="milestone-desc">' + esc(it.desc) + '</p>' : '') +
              '</div>' +
            '</div>';
          }
          stem.innerHTML = stemHtml;
        }
      }

      // Dress code visibility
      if (dcArea) {
        if (!showDc) {
          if (!EDIT_MODE) {
            dcArea.style.display = 'none';
          } else {
            dcArea.style.removeProperty('display');
            var palette = dcArea.querySelector('.dresscode-palette-row');
            if (palette) palette.style.opacity = '0.4';
            var oldDcBanner = dcArea.querySelector('.ww-off-banner-dc');
            if (!oldDcBanner) {
              dcArea.insertAdjacentHTML('afterbegin', '<div class="ww-off-banner ww-off-banner-dc" data-edit-dc>⚠️ Dress code đang TẮT (người xem sẽ không thấy). Bấm để chỉnh sửa hoặc bật lại.</div>');
            }
          }
        } else {
          dcArea.style.removeProperty('display');
          var bannerDc = dcArea.querySelector('.ww-off-banner-dc');
          if (bannerDc) bannerDc.remove();
          var paletteEl = dcArea.querySelector('.dresscode-palette-row');
          if (paletteEl) paletteEl.style.removeProperty('opacity');

          var descEl = dcArea.querySelector('.dresscode-desc');
          if (descEl && dress.text) descEl.textContent = dress.text;

          if (paletteEl && dress.colors && dress.colors.length) {
            var swHtml = '';
            for (var c = 0; c < dress.colors.length; c++) {
              var cItem = dress.colors[c];
              var hex = typeof cItem === 'string' ? cItem : (cItem && cItem.hex ? cItem.hex : '#c8a06a');
              var name = typeof cItem === 'object' && cItem ? (cItem.name || '') : '';
              var sub = typeof cItem === 'object' && cItem ? (cItem.sub || '') : '';
              swHtml += '<div class="dresscode-swatch" data-edit-dc style="' + (EDIT_MODE ? 'cursor:pointer' : '') + '">' +
                '<span class="swatch-circle" style="background:' + esc(hex) + '"></span>' +
                (name ? '<span class="swatch-name">' + esc(name) + '</span>' : '') +
                (sub ? '<span class="swatch-sub">' + esc(sub) + '</span>' : '') +
              '</div>';
            }
            paletteEl.innerHTML = swHtml;
          }
        }
      }
    }

    // 2. Mẫu LadiPage: #SECTION5
    var host = document.getElementById('SECTION5');
    if (host) {
      if (!EDIT_MODE && !showTl && !showDc) {
        host.style.setProperty('display', 'none', 'important');
        return;
      }
      host.style.removeProperty('display');
      var container = host.querySelector('.ladi-container') || host;
      var statics = host.querySelectorAll('[id^="HEADLINE"], [id^="LINE"], [id^="GROUP"], [id^="IMAGE"]:not(#IMAGE18), [id^="BOX"]:not(#BOX4), [id^="SHAPE"]');
      for (var s = 0; s < statics.length; s++) statics[s].style.setProperty('visibility', 'hidden', 'important');

      var wrap = document.getElementById('ww-timeline');
      if (!wrap) { wrap = document.createElement('div'); wrap.id = 'ww-timeline'; container.appendChild(wrap); }

      var rows = '';
      if (showTl || EDIT_MODE) {
        for (var j = 0; j < items.length; j++) {
          var it2 = items[j] || {};
          rows += '<div class="ww-tl-row">' +
            '<span class="ww-tl-ic">' + (it2.icon && WW_ICONS[it2.icon] ? wwIconSvg(it2.icon) : '') + '</span>' +
            '<span class="ww-tl-txt"><span class="ww-tl-time">' + esc(it2.t || '') + '</span>' +
            '<span class="ww-tl-label">' + esc(it2.label || it2.title || '') + '</span></span>' +
          '</div>';
        }
      }

      var swatches = '';
      for (var k = 0; k < dress.colors.length; k++) {
        var col = dress.colors[k];
        var colHex = typeof col === 'string' ? col : (col && col.hex ? col.hex : '#c8a06a');
        swatches += '<span class="ww-dc-sw" style="background:' + esc(colHex) + '"></span>';
      }

      var dressBlock = '';
      if (showDc || EDIT_MODE) {
        dressBlock = '<div class="ww-tl-dress" style="' + (!showDc && EDIT_MODE ? 'opacity:0.4' : '') + '">' +
          (!showDc && EDIT_MODE ? '<div class="ww-off-banner" data-edit-dc>⚠️ Dress code đang TẮT</div>' : '') +
          '<span class="ww-dc-head">Dress code</span>' +
          (dress.text ? '<span class="ww-dc-text">' + esc(dress.text) + '</span>' : '') +
          (swatches ? '<span class="ww-dc-row">' + swatches + '</span>' : '') +
          (EDIT_MODE ? '<button type="button" class="ww-tl-btn" data-edit-dc>🎨 Sửa dress code</button>' : '') +
        '</div>';
      }

      wrap.innerHTML =
        (!showTl && EDIT_MODE ? '<div class="ww-off-banner" data-edit-tl>⚠️ Timeline đang TẮT</div>' : '') +
        (showTl || EDIT_MODE ? ('<div class="ww-tl-title" style="' + (!showTl && EDIT_MODE ? 'opacity:0.4' : '') + '">Timeline</div>' +
          (EDIT_MODE ? '<button type="button" class="ww-tl-btn ww-tl-btn-top" data-edit-tl>✏️ Sửa lịch trình</button>' : '') +
          '<div class="ww-tl-items" style="' + (!showTl && EDIT_MODE ? 'opacity:0.4' : '') + '">' + rows + '</div>') : '') +
        dressBlock;
    }
  }

  // ---- POPUP MÃ QR MỪNG CƯỚI (đổ dữ liệu ngân hàng do AI đọc từ ảnh QR) ------
  function renderQrPopup(data) {
    var card = document.getElementById('ww-qr-card');
    if (!card) return;
    var bank = (data && data.bank) || (data && data.extra_data && data.extra_data.bank) || {};
    var num = bank.bank_account_number || bank.account_number || '';
    var name = bank.bank_account_name || bank.account_name || '';
    var bn = bank.bank_short_name || bank.bank_name || bank.bank || '';
    var list = (data && (data.images || data.invitation_images)) || [];
    var qr = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].image_type === 'bank_qr' && list[i].image_url) { qr = list[i].image_url; break; }
    }
    var setTxt = function (id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
    setTxt('ww-qr-num', num);
    setTxt('ww-qr-bank', bn);
    setTxt('ww-qr-name', name);
    var lines = document.getElementById('ww-qr-lines');
    var empty = document.getElementById('ww-qr-empty');
    var dl = document.getElementById('ww-qr-dl');
    var has = !!qr;
    if (lines) lines.style.display = (num || bn || name) ? '' : 'none';
    if (empty) empty.style.display = has ? 'none' : '';
    if (dl) {
      dl.setAttribute('href', qr || '#');
      dl.style.display = has ? '' : 'none';
      if (has && !dl.__wwWired) {
        dl.__wwWired = true;
        dl.addEventListener('click', function (ev) {
          var url = dl.getAttribute('href');
          if (!url || url === '#') { ev.preventDefault(); return; }
          ev.preventDefault();
          fetch(url).then(function (r) { return r.blob(); }).then(function (b) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(b);
            a.download = 'ma-qr-mung-cuoi.png';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
          }).catch(function () { window.open(url, '_blank'); });
        });
      }
    }
  }

  // ---- ALBUM ẢNH: hiện đúng số ảnh đã tải, tối đa 20 -------------------------
  // Mẫu gốc chốt cứng 9 ô carousel; nếu ảnh ít hơn thì thừa ô trống, nhiều hơn
  // thì không đủ ô. Ở đây tự nhân bản / ẩn bớt ô cho khớp số ảnh gallery thật.
  function syncGallery(imageList) {
    var gallery = document.getElementById('GALLERY1');
    if (!gallery) return;
    var view = gallery.querySelector('.ladi-gallery-view');
    var ctrlBox = gallery.querySelector('.ladi-gallery-control-box');
    if (!view) return;
    var count = imageList.filter(function (img) { return img.image_type === 'gallery' && img.image_url; }).length;
    count = Math.max(1, Math.min(20, count));

    function fit(parent, selector, cls) {
      if (!parent) return;
      var items = parent.querySelectorAll(selector);
      var last = items[items.length - 1];
      // Bổ sung ô cho đủ count (mẫu gốc chỉ có 9 -> nhân bản thêm tối đa tới 20).
      for (var n = items.length; n < count && last; n++) {
        var clone = last.cloneNode(false);
        clone.className = cls;
        clone.classList.remove('selected', 'next', 'prev', 'left', 'right');
        clone.setAttribute('data-index', n);
        clone.setAttribute('data-image', 'gallery');
        clone.setAttribute('data-image-index', n);
        clone.style.removeProperty('background-image');
        parent.appendChild(clone);
        last = clone;
      }
      // Giấu các ô dư (giữ DOM để LadiPage không lệch index).
      var all = parent.querySelectorAll(selector);
      for (var m = 0; m < all.length; m++) {
        if (m < count) all[m].style.removeProperty('display');
        else all[m].style.setProperty('display', 'none', 'important');
      }
    }
    fit(view, '.ladi-gallery-view-item', 'ladi-gallery-view-item');
    fit(ctrlBox, '.ladi-gallery-control-item', 'ladi-gallery-control-item');

    // LadiPage lưu số ô carousel + con trỏ hiện tại trong data-attr trên #GALLERY1;
    // ép về đúng count để autoplay không "nhảy" vào ô trống -> gallery bị trắng.
    gallery.setAttribute('data-max-item', String(count));
    if (Number(gallery.getAttribute('data-current') || 0) >= count) {
      gallery.setAttribute('data-current', '0');
      var first = view.querySelector('.ladi-gallery-view-item');
      var firstC = ctrlBox && ctrlBox.querySelector('.ladi-gallery-control-item');
      view.querySelectorAll('.selected').forEach(function (e) { e.classList.remove('selected'); });
      if (ctrlBox) ctrlBox.querySelectorAll('.selected').forEach(function (e) { e.classList.remove('selected'); });
      if (first) first.classList.add('selected');
      if (firstC) firstC.classList.add('selected');
    }
  }

  function updateCountdownTimer(data) {
    if (window.__wwHasCustomCountdown === true || typeof window.__wwUpdateCountdown === 'function') {
      if (typeof window.__wwUpdateCountdown === 'function') {
        try { window.__wwUpdateCountdown(data); } catch (e) {}
      }
      return; // Không can thiệp nếu template đã tự xử lý countdown để tránh giật lag, nháy số!
    }
    var dEl = document.getElementById('countdown-days') || document.querySelector('.countdown-days, [data-countdown-days], [data-unit="days"]');
    var hEl = document.getElementById('countdown-hours') || document.querySelector('.countdown-hours, [data-countdown-hours], [data-unit="hours"]');
    var mEl = document.getElementById('countdown-minutes') || document.querySelector('.countdown-minutes, [data-countdown-minutes], [data-unit="minutes"]');
    var sEl = document.getElementById('countdown-seconds') || document.querySelector('.countdown-seconds, [data-countdown-seconds], [data-unit="seconds"]');
    if (!dEl || !hEl || !mEl || !sEl) return;

    var curData = data || window.invitationData || {};
    var cdEl = document.querySelector('[data-countdown]');
    var raw = curData.ceremony_date || curData.reception_date
      || (cdEl && cdEl.getAttribute('data-countdown'))
      || (window.weddingData && window.weddingData.eventTime && window.weddingData.eventTime.isoDateTime);
    var targetTime = 0;
    if (raw) {
      var d = new Date(raw);
      if (!isNaN(d.getTime())) targetTime = d.getTime();
    }
    var now = Date.now();
    if (!targetTime || targetTime <= now) {
      if (!window.__wwFallbackTarget) {
        window.__wwFallbackTarget = now + (23 * 24 * 3600 * 1000) + (7 * 3600 * 1000) + (12 * 60 * 1000) + (35 * 1000);
      }
      targetTime = window.__wwFallbackTarget;
    }
    var distance = targetTime - now;
    if (distance < 0) distance = 0;

    function formatTwoDigits(num) {
      return num < 10 ? "0" + Math.max(0, num) : String(Math.max(0, num));
    }

    var days = Math.floor(distance / (1000 * 60 * 60 * 24));
    var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var minutes = Math.floor((distance % (1000 * 60)) / (1000 * 60));
    var seconds = Math.floor((distance % (1000 * 60)) / 1000);

    dEl.textContent = formatTwoDigits(days);
    hEl.textContent = formatTwoDigits(hours);
    mEl.textContent = formatTwoDigits(minutes);
    sEl.textContent = formatTwoDigits(seconds);
  }

  function applyAll(newData) {
    var data = newData || window.invitationData || {};
    window.invitationData = data;

    var fieldEls = document.querySelectorAll('[data-field]');
    for (var i = 0; i < fieldEls.length; i++) {
      var el = fieldEls[i];
      if (el === document.activeElement) continue; // đang gõ dở thì không ghi đè
      var value = getPath(data, el.getAttribute('data-field'));
      if (value !== undefined && value !== null && value !== '') {
        el.textContent = value;
      }
    }

    // --- Cá nhân hoá tên khách mời (nếu có guest_name trong dữ liệu hoặc query string) ---
    var effectiveGuestName = (data && data.guest_name ? String(data.guest_name).trim() : '');
    if (!effectiveGuestName) {
      try {
        var qParams = new URLSearchParams(window.location.search || (window.parent && window.parent.location.search) || '');
        var qTo = qParams.get('to') || qParams.get('guest') || qParams.get('guest_name') || qParams.get('gname');
        if (qTo) {
          effectiveGuestName = decodeURIComponent(qTo.split('+').join(' ')).trim();
        }
      } catch (_e) {}
    }

    // Đọc query param ?time=... hoặc ?reception_time=... nếu có trên URL hiện tại
    try {
      var qParamsTime = new URLSearchParams(window.location.search || (window.parent && window.parent.location.search) || '');
      var qTimeVal = qParamsTime.get('time') || qParamsTime.get('t') || qParamsTime.get('reception_time');
      if (qTimeVal) {
        var cleanQTime = decodeURIComponent(qTimeVal.split('+').join(' ')).trim();
        if (cleanQTime) {
          data.reception_time = cleanQTime;
          if (data.reception_weekday) {
            data.reception_time_weekday = cleanQTime + ', ' + data.reception_weekday;
          }
        }
      }
    } catch (_e) {}

    // Đồng bộ giờ tiệc vào các element hiển thị giờ tiệc cưới (CHỈ áp dụng cho TIỆC CƯỚI, tuyệt đối KHÔNG đè lên LỄ THÀNH HÔN)
    if (data.reception_time) {
      var exactTimeEls = document.querySelectorAll('[data-field="reception_time"], #reception-time');
      for (var etIdx = 0; etIdx < exactTimeEls.length; etIdx++) {
        var etEl = exactTimeEls[etIdx];
        if (etEl === document.activeElement) continue;
        if (etEl.getAttribute('data-field') === 'ceremony_time') continue;
        if (etEl.closest && (etEl.closest('[data-field="ceremony_time"]') || etEl.closest('.scene-ceremony'))) continue;
        etEl.textContent = data.reception_time;
      }
    }

    // Đồng bộ giờ lễ vào các element hiển thị giờ Lễ Thành Hôn (giữ nguyên giờ lễ chính thức của thiệp, không bị thay đổi theo khách mời)
    if (data.ceremony_time) {
      var ceremonyTimeEls = document.querySelectorAll('[data-field="ceremony_time"], #ceremony-time');
      for (var ctIdx = 0; ctIdx < ceremonyTimeEls.length; ctIdx++) {
        var ctEl = ceremonyTimeEls[ctIdx];
        if (ctEl === document.activeElement) continue;
        if (ctEl.getAttribute('data-field') === 'reception_time') continue;
        ctEl.textContent = data.ceremony_time;
      }
    }

    // Xử lý các element có class .event-exact-time nhưng không có data-field
    var exactFallbackEls = document.querySelectorAll('.event-exact-time:not([data-field])');
    for (var efIdx = 0; efIdx < exactFallbackEls.length; efIdx++) {
      var efEl = exactFallbackEls[efIdx];
      if (efEl === document.activeElement) continue;
      var parentNode = efEl.closest ? (efEl.closest('.event-moment-node') || efEl.closest('article') || efEl.closest('section')) : null;
      var parentText = parentNode ? parentNode.textContent : '';
      if (parentText.indexOf('TIỆC CƯỚI') !== -1 && data.reception_time) {
        efEl.textContent = data.reception_time;
      } else if (parentText.indexOf('LỄ THÀNH HÔN') !== -1 && data.ceremony_time) {
        efEl.textContent = data.ceremony_time;
      }
    }

    if (effectiveGuestName && effectiveGuestName !== 'Quý khách' && effectiveGuestName !== 'QUÝ KHÁCH') {
      var guestName = effectiveGuestName;
      var guestNameUpper = guestName.toUpperCase();
      var guestNameDisplay = guestName;
      if (guestNameUpper === 'QUÝ KHÁCH') {
        guestNameDisplay = 'Quý Khách';
      } else if (guestName === guestNameUpper || guestName === guestName.toLowerCase()) {
        guestNameDisplay = guestName.split(' ').map(function(w) {
          return w ? (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : '';
        }).join(' ');
      }

      // Gán vào các element đại diện cho tên khách
      var recipientEls = document.querySelectorAll('[data-field="guest_name"], #envelope-recipient-name, .recipient-name, .guest-name, #guest-name');
      for (var rIdx = 0; rIdx < recipientEls.length; rIdx++) {
        var rEl = recipientEls[rIdx];
        if (rEl === document.activeElement) continue;
        // Bìa phong bì và font chữ uốn lượn giữ hoa thường tự nhiên thay vì ép ALL-CAPS
        if (rEl.classList.contains('recipient-name') || rEl.id === 'envelope-recipient-name' || rEl.closest('.recipient-box')) {
          rEl.textContent = guestNameDisplay;
          if (guestNameDisplay.length > 20) {
            rEl.classList.add('is-long');
          } else {
            rEl.classList.remove('is-long');
          }
        } else {
          rEl.textContent = guestNameUpper;
        }
      }

      // Khớp tên khách ở bìa ngoài phong bì (CHỈ áp dụng cho bìa ngoài vobe2.html, tuyệt đối KHÔNG ghi đè lên phongbibe2.html hay các thẻ chứa data-field tên cô dâu / chú rể)
      var isEnvelopeCover = Boolean(
        document.querySelector('#GROUP1 [data-action], #GROUP1 a[href*="phongbibe2"]') ||
        (document.getElementById('HEADLINE4') && document.getElementById('HEADLINE4').textContent.indexOf('Trân trọng kính mời') !== -1 && !document.getElementById('SECTION2'))
      );
      var headline3El = document.querySelector('#HEADLINE3');
      var headline3HasFields = headline3El ? Boolean(headline3El.querySelector('[data-field]') || headline3El.hasAttribute('data-field')) : false;

      if (isEnvelopeCover && !headline3HasFields) {
        var updateHeadline3 = function() {
          var h3 = document.querySelector('#HEADLINE3 .ladi-headline') || document.querySelector('#HEADLINE3');
          if (h3 && !h3.querySelector('[data-field]') && !h3.hasAttribute('data-field')) {
            if (h3.textContent.trim() !== guestName) {
              h3.textContent = guestName;
            }
          }
        };
        updateHeadline3();
        setTimeout(updateHeadline3, 80);
        setTimeout(updateHeadline3, 300);
        setTimeout(updateHeadline3, 800);
        setTimeout(updateHeadline3, 1600);

        try {
          var targetH3 = document.querySelector('#HEADLINE3 .ladi-headline') || document.querySelector('#HEADLINE3');
          if (targetH3 && window.MutationObserver && !targetH3.__wwObserved) {
            targetH3.__wwObserved = true;
            var obs = new MutationObserver(function() {
              if (!targetH3.querySelector('[data-field]') && !targetH3.hasAttribute('data-field') && targetH3.textContent.trim() !== guestName) {
                targetH3.textContent = guestName;
              }
            });
            obs.observe(targetH3, { childList: true, characterData: true, subtree: true });
          }
        } catch (_e) {}
      }

      // Khớp lời mời cụ thể ở phong bì / thiệp LadiPage (#HEADLINE43)
      var h43 = document.querySelector('#HEADLINE43 .ladi-headline');
      if (h43 && !h43.__wwCustomized) {
        h43.innerHTML = 'Trân trọng kính mời <strong>' + guestName + '</strong><br>tham dự bữa tiệc chung vui cùng gia đình chúng tôi<br>';
        h43.__wwCustomized = true;
      }

      // Quét tất cả text node trong tài liệu để thay thế "Quý khách" / "QUÝ KHÁCH" / "quý khách" bằng tên khách
      try {
        var walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: function(node) {
              if (!node || !node.parentElement) return NodeFilter.FILTER_REJECT;
              var parent = node.parentElement;
              var tag = parent.tagName ? parent.tagName.toLowerCase() : '';
              if (tag === 'script' || tag === 'style' || tag === 'textarea' || tag === 'input' || tag === 'option' || tag === 'select') {
                return NodeFilter.FILTER_REJECT;
              }
              if (parent.closest && parent.closest('form, script, style, .ww-sheet-mask, .ww-dp-mask')) {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );
        var textNode;
        while ((textNode = walker.nextNode())) {
          var val = textNode.nodeValue;
          if (val && (val.indexOf('Quý khách') !== -1 || val.indexOf('QUÝ KHÁCH') !== -1 || val.indexOf('Quý Khách') !== -1 || val.indexOf('quý khách') !== -1)) {
            textNode.nodeValue = val
              .replace(/QUÝ KHÁCH/g, guestNameUpper)
              .replace(/Quý [Kk]hách/g, guestName)
              .replace(/quý khách/g, guestName);
          }
        }
      } catch (_e) {}

      // Điền sẵn tên vào ô nhập lời chúc / xác nhận
      var nameInps = document.querySelectorAll('input[name="name"], input[name="name_guest"]');
      for (var niIdx = 0; niIdx < nameInps.length; niIdx++) {
        var nInp = nameInps[niIdx];
        if (!nInp.value || nInp.value === 'Quý khách' || nInp.value === 'QUÝ KHÁCH') {
          nInp.value = guestName;
        }
      }
    }

    var hrefEls = document.querySelectorAll('[data-field-href]');
    for (var j = 0; j < hrefEls.length; j++) {
      var hrefEl = hrefEls[j];
      var hrefValue = getPath(data, hrefEl.getAttribute('data-field-href'));
      if (hrefValue) hrefEl.setAttribute('href', hrefValue);
    }

    // Xử lý link chỉ đường Google Maps cho In-App Browser (Zalo, Messenger, Facebook)
    function wireMapLinks() {
      var mapLinks = document.querySelectorAll(
        '[data-field-href="map_url"], [data-field-href="reception_map_url"], a.event-action-pill, a[href*="maps.app.goo.gl"], a[href*="google.com/maps"], a[href*="maps.google.com"]'
      );
      for (var mi = 0; mi < mapLinks.length; mi++) {
        var mapA = mapLinks[mi];
        if (mapA.__wwMapWired) continue;
        mapA.__wwMapWired = true;

        mapA.addEventListener('click', function (e) {
          if (window.__weddingWebEditMode) return;

          var rawHref = this.getAttribute('href');
          var targetUrl = rawHref;

          if (!targetUrl || targetUrl === '#' || targetUrl.indexOf('javascript:') === 0) {
            var block = this.closest('.event-moment-node') || this.closest('.timeline-node') || this.closest('article') || this.closest('section') || this.parentElement;
            var addrEl = block ? block.querySelector('[data-field*="address"], address') : null;
            if (addrEl && addrEl.textContent.trim()) {
              targetUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addrEl.textContent.trim());
            }
          }
          if (!targetUrl || targetUrl === '#') return;

          var ua = (navigator.userAgent || '').toLowerCase();
          var isMobile = /android|iphone|ipad|ipod/i.test(ua);
          var isInApp = ua.indexOf('zalo') !== -1 || ua.indexOf('fbav') !== -1 || ua.indexOf('fban') !== -1 || ua.indexOf('messenger') !== -1;

          if (isMobile || isInApp || window !== window.top) {
            e.preventDefault();
            e.stopPropagation();

            try {
              window.parent.postMessage({ type: 'wedding-web:open-map', url: targetUrl }, '*');
            } catch (_err) {}

            try {
              if (window.top && window.top !== window) {
                window.top.location.href = targetUrl;
                return;
              }
            } catch (_err) {}

            window.location.href = targetUrl;
          }
        });
      }
    }
    wireMapLinks();

    var imageList = data.images || data.invitation_images || [];
    try { syncGallery(imageList); } catch (e) {}
    var imageEls = document.querySelectorAll('[data-image]');
    for (var k = 0; k < imageEls.length; k++) {
      var imgEl = imageEls[k];
      var key = imgEl.getAttribute('data-image');
      var idxAttr = imgEl.getAttribute('data-image-index');
      var filtered = imageList
        .filter(function (img) { return img.image_type === key; })
        .sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
      var item = null;
      if (idxAttr !== null) {
        if (imgEl.closest && imgEl.closest('#GALLERY1')) {
          item = filtered[Number(idxAttr)] || null;
        } else {
          var targetIndex = Number(idxAttr);
          for (var ei = 0; ei < filtered.length; ei++) {
            if ((filtered[ei].sort_order || 0) === targetIndex) { item = filtered[ei]; break; }
          }
        }
      } else {
        item = filtered[0] || null;
      }
      var bgTarget = imgEl.classList.contains('ladi-image-background') || imgEl.classList.contains('ladi-box')
        ? imgEl
        : (imgEl.querySelector('.ladi-image-background') || imgEl.querySelector('.ladi-box') || imgEl);

      // Ô QR chưa có mã thật.
      //
      // AN TOÀN TIỀN BẠC: tuyệt đối KHÔNG để lại ảnh QR mẫu có sẵn trong gói mẫu.
      // Khác với ảnh cưới (giữ ảnh mẫu cho đẹp), một mã QR mẫu là số tài khoản CÓ
      // THẬT của người khác — khách mời quét vào sẽ chuyển tiền mừng nhầm người.
      // Nên xoá hẳn ảnh và ẩn ô đi ở chế độ xem; chế độ sửa thì hiện khung trống
      // để chủ thiệp biết chỗ cần tải mã QR lên.
      if (key === 'bank_qr' && (!item || !item.image_url)) {
        if (imgEl.hasAttribute('data-preserve-default') || (imgEl.closest && imgEl.closest('[data-preserve-default]'))) {
          continue;
        }
        bgTarget.style.removeProperty('background-image');
        if (imgEl.tagName === 'IMG') {
          imgEl.removeAttribute('srcset');
          imgEl.removeAttribute('src');
        }
        if (EDIT_MODE) {
          imgEl.classList.add('ww-img-empty');
          if (imgEl.tagName === 'IMG') {
            imgEl.src = EMPTY_IMAGE_SRC;
            imgEl.style.setProperty('object-fit', 'contain');
          } else {
            bgTarget.style.setProperty('background-image', 'url("' + EMPTY_IMAGE_SRC + '")', 'important');
            bgTarget.style.setProperty('background-size', 'contain', 'important');
          }
        } else {
          imgEl.style.setProperty('display', 'none', 'important');
        }
        continue;
      }
      // Có mã QR thật -> bỏ trạng thái ẩn nếu trước đó từng rỗng.
      if (key === 'bank_qr') imgEl.style.removeProperty('display');

      if (!item || !item.image_url) {
        // Chưa có ảnh thật:
        // Nếu phần tử có data-preserve-default (ví dụ: ảnh mini polaroid đính kèm thiệp thư),
        // giữ ảnh mẫu mặc định để không bị đè icon trống làm méo layout, nhưng vẫn cho phép bấm để đổi ảnh.
        if (imgEl.hasAttribute('data-preserve-default') || (imgEl.closest && imgEl.closest('[data-preserve-default]'))) {
          continue;
        }

        // Ở chế độ sửa thì thay ảnh mẫu có sẵn trong file template bằng
        // khung ảnh trống để chủ thiệp biết bấm vào đây tải ảnh lên; ở chế độ xem (khách
        // mời) thì GIỮ NGUYÊN ảnh mẫu, không lộ khung "chưa có ảnh" ra trước mặt khách.
        if (EDIT_MODE) {
          imgEl.classList.add('ww-img-empty');
          if (imgEl.tagName === 'IMG') {
            imgEl.style.setProperty('object-fit', 'contain');
            imgEl.style.setProperty('background-color', '#f5ede0');
            imgEl.src = EMPTY_IMAGE_SRC;
          } else {
            bgTarget.style.setProperty('background-image', 'url("' + EMPTY_IMAGE_SRC + '")', 'important');
            bgTarget.style.setProperty('background-size', 'contain', 'important');
            bgTarget.style.setProperty('background-color', '#f5ede0', 'important');
          }
        }
        continue;
      }

      imgEl.classList.remove('ww-img-empty');
      // Ảnh đầu tiên (ảnh bìa / sort_order nhỏ nhất) là ảnh quyết định điểm LCP —
      // tải ngay với độ ưu tiên cao. Các ảnh còn lại lazy-load. Xem lib/imageLoading.js.
      var isPriority = (k === 0) || item.is_cover === true || EDIT_MODE;
      var IMG = window.__weddingWebImage;
      if (imgEl.tagName === 'IMG') {
        imgEl.style.removeProperty('object-fit');
        imgEl.style.removeProperty('background-color');
        if (IMG) { IMG.applyImg(imgEl, item, isPriority); }
        else { imgEl.src = item.image_url; }
      } else {
        // Gán thẳng URL ảnh thật vào background-image, không dùng ảnh mờ hay placeholder
        bgTarget.style.removeProperty('background-size');
        bgTarget.style.removeProperty('background-color');
        bgTarget.style.setProperty('filter', 'none', 'important');
        bgTarget.style.setProperty('background-size', 'cover', 'important');
        bgTarget.style.setProperty('background-position', 'center', 'important');
        bgTarget.style.setProperty('background-image', 'url("' + item.image_url + '")', 'important');
      }
      imgEl.classList.add('ww-img-loaded');
      bgTarget.classList.add('ww-img-loaded');
      if (imgEl.parentElement) imgEl.parentElement.classList.add('ww-img-loaded');
    }

    try { renderCeremonyCalendar(data); } catch (e) {}
    try { renderTimeline(data); } catch (e) {}
    try { renderQrPopup(data); } catch (e) {}
    try {
      if (typeof window.__wwUpdateGiftModal === 'function') {
        window.__wwUpdateGiftModal(data);
      }
    } catch (e) {}
    try { updateCountdownTimer(data); } catch (e) {}
    try {
      if (typeof window.__wwApplyDisplayToggles === 'function') {
        window.__wwApplyDisplayToggles(data);
      }
    } catch (e) {}

    if (EDIT_MODE) {
      try {
        var blSec = document.getElementById('blessing') || document.querySelector('.scene-blessing');
        if (blSec) {
          var bHdr = blSec.querySelector('.blessing-header');
          if (bHdr && !bHdr.querySelector('.ww-blessing-edit-badge')) {
            bHdr.insertAdjacentHTML('beforeend', '<div style="margin-top:12px;margin-bottom:8px;"><button type="button" class="ww-blessing-edit-badge" data-edit-blessing style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:6px 16px;background:rgba(255,255,255,0.9);border:1px solid #d9cebe;border-radius:20px;font-size:12px;color:#6e5845;font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,0.05);transition:all .2s ease;">💌 Bật/Tắt Lời chúc &amp; Tham dự</button></div>');
          }
        }
      } catch (_e) {}
    }

    // Áp dụng màu nền background (RGB / HEX)
    var bgColor = data.background_color || (data.extra_data && data.extra_data.background_color) || '';
    var existingBgColorStyle = document.getElementById('ww-custom-bg-color-style');
    if (bgColor) {
      if (!existingBgColorStyle) {
        existingBgColorStyle = document.createElement('style');
        existingBgColorStyle.id = 'ww-custom-bg-color-style';
        document.head.appendChild(existingBgColorStyle);
      }
      existingBgColorStyle.textContent =
        ':root { ' +
        '  --paper-ivory: ' + bgColor + ' !important; ' +
        '  --paper-cream: ' + bgColor + ' !important; ' +
        '} ' +
        'body, .editorial-canvas, .editorial-scene, .scene-hero, .scene-couple, .scene-events, .scene-calendar, .scene-gallery, .scene-blessing, .editorial-finale, .stationery-form { ' +
        '  background-color: ' + bgColor + ' !important; ' +
        '  background-image: none !important; ' +
        '}';
    } else if (existingBgColorStyle) {
      existingBgColorStyle.remove();
    }

    var bgImg = data.background_image || (data.extra_data && data.extra_data.background_image) || '';
    var existingBgStyle = document.getElementById('ww-custom-bg-style');
    if (bgImg) {
      if (!existingBgStyle) {
        existingBgStyle = document.createElement('style');
        existingBgStyle.id = 'ww-custom-bg-style';
        document.head.appendChild(existingBgStyle);
      }
      existingBgStyle.textContent =
        'body, .editorial-canvas, .ladi-wraper, .ladi-section-background { ' +
        '  background-image: url("' + bgImg + '") !important;' +
        '  background-size: cover !important;' +
        '  background-position: center !important;' +
        '  background-attachment: fixed !important;' +
        '  background-repeat: no-repeat !important;' +
        '} ' +
        '.editorial-canvas::before { ' +
        '  content: ""; position: fixed; inset: 0; background: rgba(250, 247, 242, 0.78); pointer-events: none; z-index: 0; ' +
        '} ' +
        '.editorial-scene, .editorial-finale, .scene-hero { position: relative; z-index: 1; background-color: transparent !important; }';
    } else if (existingBgStyle) {
      existingBgStyle.remove();
    }

    var mSettings = data.music_settings || (data.extra_data && data.extra_data.music_settings) || {};
    var mVol = typeof mSettings.music_volume === 'number' ? mSettings.music_volume / 100 : 0.8;
    
    // Tìm audio element: ưu tiên #background-music có sẵn trong template, hoặc audio bất kỳ
    var audioEl = document.getElementById('background-music') || document.querySelector('audio');

    if (data.music_url) {
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.id = 'ww-injected-music';
        audioEl.loop = true;
        audioEl.preload = 'auto';
        document.body.appendChild(audioEl);
      }
      
      // Cập nhật cả <source> con (nếu mẫu dùng cấu trúc <audio><source ...></audio>)
      var childSource = audioEl.querySelector('source');
      if (childSource && childSource.src !== data.music_url) {
        childSource.src = data.music_url;
      }
      if (audioEl.src !== data.music_url) {
        var wasPlaying = !audioEl.paused;
        audioEl.src = data.music_url;
        try { audioEl.load(); } catch (e) {}
        if (wasPlaying) {
          audioEl.play().catch(function() {});
        }
      }
      audioEl.volume = mVol;
      window.MUSIC_PLAYLIST = [data.music_url];
    } else if (audioEl) {
      try { audioEl.pause(); } catch (e) {}
      audioEl.src = '';
      window.MUSIC_PLAYLIST = [];
    }

    // Đấu nối nút bấm điều khiển nhạc (#BUTTON4, #toggle-music)
    if (audioEl && !audioEl.__wwWiredButtons) {
      audioEl.__wwWiredButtons = true;

      var updateMusicUi = function() {
        var isPlaying = !audioEl.paused;
        var tBtn = document.getElementById('toggle-music');
        if (tBtn) {
          tBtn.textContent = isPlaying ? '🔊' : '🔇';
          tBtn.style.animation = isPlaying ? 'rotate 2s linear infinite' : 'none';
        }
        // CHỈ quay đĩa nhạc tròn (#IMAGE39 .ladi-image), TUYỆT ĐỐI KHÔNG quay thanh nút #BUTTON4 hay #GROUP43
        var mIcons = document.querySelectorAll('#IMAGE39 .ladi-image, #IMAGE39 .ladi-image-background, .music-disc-icon');
        for (var mi = 0; mi < mIcons.length; mi++) {
          if (isPlaying) {
            mIcons[mi].classList.add('ww-rotating');
          } else {
            mIcons[mi].classList.remove('ww-rotating');
          }
        }
        var discBtns = document.querySelectorAll('.music-disc-btn, #music-toggle');
        for (var di = 0; di < discBtns.length; di++) {
          if (isPlaying) {
            discBtns[di].classList.add('is-playing');
            discBtns[di].setAttribute('aria-pressed', 'true');
          } else {
            discBtns[di].classList.remove('is-playing');
            discBtns[di].setAttribute('aria-pressed', 'false');
          }
        }
        // Đảm bảo thanh chữ không bao giờ bị quay
        var staticBars = document.querySelectorAll('#BUTTON4, #GROUP43, #BUTTON_TEXT4');
        for (var si = 0; si < staticBars.length; si++) {
          staticBars[si].classList.remove('ww-rotating');
          staticBars[si].style.removeProperty('animation');
          staticBars[si].style.removeProperty('transform');
        }
      };

      var toggleAudio = function(e) {
        if (e) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
        }
        if (audioEl.paused) {
          window.__wwUserPaused = false;
          audioEl.play().catch(function() {});
        } else {
          window.__wwUserPaused = true;
          audioEl.pause();
        }
      };

      // Đấu nối nút #toggle-music nếu chưa được gắn (tránh gắn trùng lặp làm lật trạng thái 2 lần)
      var tBtn = document.getElementById('toggle-music');
      if (tBtn && !tBtn.__wwControlled) {
        tBtn.__wwControlled = true;
        tBtn.addEventListener('click', toggleAudio);
      }

      // Đấu nối nút #BUTTON4 (chỉ #BUTTON4, KHÔNG gắn vào #GROUP43 để tránh bubble gọi 2 lần)
      var btn4 = document.getElementById('BUTTON4');
      if (btn4 && !btn4.__wwControlled) {
        btn4.__wwControlled = true;
        btn4.style.cursor = 'pointer';
        btn4.addEventListener('click', toggleAudio);
      }

      var discBtnsW = document.querySelectorAll('#music-toggle, .music-disc-btn');
      for (var dbi = 0; dbi < discBtnsW.length; dbi++) {
        var db = discBtnsW[dbi];
        if (db && !db.__wwControlled) {
          db.__wwControlled = true;
          db.addEventListener('click', toggleAudio);
        }
      }

      audioEl.addEventListener('play', updateMusicUi);
      audioEl.addEventListener('pause', updateMusicUi);

      // Thử phát tự động sau tương tác đầu tiên của khách (chỉ khi khách chưa bấm tắt)
      var tryAutoPlay = function(e) {
        if (window.__wwUserPaused) return;
        if (e && e.target && e.target.closest && (e.target.closest('#toggle-music') || e.target.closest('#BUTTON4') || e.target.closest('#GROUP43'))) {
          return;
        }
        if (audioEl && audioEl.paused) {
          audioEl.play().catch(function() {});
        }
      };
      window.addEventListener('scroll', tryAutoPlay, { once: true });
      document.addEventListener('click', tryAutoPlay, { once: true });
      document.addEventListener('touchstart', tryAutoPlay, { once: true });
    }

    var vUrl = mSettings.voice_url;
    var vVol = typeof mSettings.voice_volume === 'number' ? mSettings.voice_volume / 100 : 1.0;
    var shouldDuck = mSettings.duck_music !== false;

    if (vUrl) {
      var voiceEl = document.querySelector('#ww-injected-voice');
      if (!voiceEl) {
        voiceEl = document.createElement('audio');
        voiceEl.id = 'ww-injected-voice';
        voiceEl.preload = 'auto';
        document.body.appendChild(voiceEl);
      }
      if (voiceEl.src !== vUrl) voiceEl.src = vUrl;
      voiceEl.volume = vVol;

      voiceEl.onplay = function() {
        if (audioEl && shouldDuck) {
          audioEl.volume = Math.max(0.05, mVol * 0.25);
        }
      };
      var restoreMusic = function() {
        if (audioEl) audioEl.volume = mVol;
      };
      voiceEl.onended = restoreMusic;
      voiceEl.onpause = restoreMusic;

      if (audioEl) {
        audioEl.addEventListener('play', function() {
          if (voiceEl && voiceEl.paused && voiceEl.currentTime === 0) {
            voiceEl.play().catch(function() {});
          }
        }, { once: true });
      }
    }

    // --- Xử lý gửi lời chúc & xác nhận tham dự (Universal Wishes / RSVP) ---
    var wishForms = document.querySelectorAll('form, #FORM2');
    for (var wfIdx = 0; wfIdx < wishForms.length; wfIdx++) {
      (function(fEl) {
        if (fEl.__wwWishWired) return;
        // Bỏ qua nếu form đã có logic gửi riêng của template (ví dụ data-unified-form, .unified-blessing-form...)
        if (
          fEl.hasAttribute('data-unified-form') ||
          (fEl.matches && fEl.matches('[data-unified-form]')) ||
          (fEl.classList && fEl.classList.contains('unified-blessing-form'))
        ) {
          fEl.__wwWishWired = true;
          return;
        }

        var msgBox = fEl.querySelector ? (fEl.querySelector('textarea[name="message"]') || fEl.querySelector('textarea[name="messages"]') || fEl.querySelector('textarea') || fEl.querySelector('input[name="message"]')) : null;
        if (!msgBox) return;
        fEl.__wwWishWired = true;

        var triggerBtn = fEl.querySelector('#BUTTON2') || document.getElementById('BUTTON2') || fEl.querySelector('button[type="submit"]') || fEl.querySelector('.ladi-button');

        var isSubmittingWish = false;
        var submitWishHandler = function(ev) {
          if (ev && ev.preventDefault) ev.preventDefault();
          if (isSubmittingWish) return;
          var now = Date.now();
          if (window.__wwLastWishSubmit && (now - window.__wwLastWishSubmit < 3000)) return;

          var nInp = fEl.querySelector('input[name="name"]') || fEl.querySelector('input[name="name_guest"]') || document.querySelector('input[name="name"]');
          var guestName = (nInp && nInp.value ? nInp.value.trim() : '') || data.guest_name || '';
          var msgVal = msgBox ? msgBox.value.trim() : '';

          if (!guestName) {
            alert('Vui lòng nhập tên của bạn.');
            if (nInp) nInp.focus();
            return;
          }

          var attInp = fEl.querySelector('input[type="radio"]:checked') || document.querySelector('input[name="form_item6"]:checked');
          var attendance = attInp ? attInp.value : 'yes';

          var invId = data.invitation_id || data.id || '';
          var apiBase = data.api_base || '';

          var payload = {
            invitation_id: invId || null,
            invitation_slug: data.invitation_slug || data.slug || null,
            guest_id: data.guest_id || null,
            name_guest: guestName,
            messages: msgVal || null,
            confirm_attendance: attendance,
            guests_type: data.guest_id ? 'private' : 'ca_hai'
          };

          isSubmittingWish = true;
          window.__wwLastWishSubmit = now;
          var targetUrl = (apiBase ? apiBase : '') + '/api/messages-checkins';
          fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).then(function(res) {
            if (!res.ok) {
              return res.json().then(function(e) { throw new Error(e.message || 'Lỗi gửi lời chúc'); });
            }
            return res.json();
          }).then(function() {
            if (typeof window.loadWishes === 'function') {
              try { window.loadWishes(true); } catch(e) {}
            }
            if (typeof window.showTY === 'function') {
              window.showTY();
            } else {
              showUniversalToast('🎉 Cảm ơn bạn đã gửi lời chúc tới cô dâu chú rể!');
            }
            if (msgBox) msgBox.value = '';
            if (fEl.reset) fEl.reset();
          }).catch(function(err) {
            alert(err.message || 'Không thể gửi lời chúc lúc này. Vui lòng thử lại sau.');
          }).finally(function() {
            setTimeout(function() { isSubmittingWish = false; }, 1500);
          });
        };

        if (fEl.tagName === 'FORM') {
          fEl.addEventListener('submit', submitWishHandler);
        } else if (triggerBtn) {
          triggerBtn.style.cursor = 'pointer';
          triggerBtn.addEventListener('click', submitWishHandler);
        }
      })(wishForms[wfIdx]);
    }
  }

  var WW_CAL_STYLE = document.createElement('style');
  WW_CAL_STYLE.textContent =
    // Giữ đúng "chất" lịch của mẫu: font tên tháng riêng của mẫu, số ngày Roboto
    // màu nâu ấm rgb(144,112,83), trái tim đỏ rgb(143,13,13) như SHAPE5 gốc.
    '#ww-cal{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px 10px;box-sizing:border-box;z-index:5}' +
    '#ww-cal .ww-cal-month{font-family:REZWTiBFRCBEcmFdGuLmZg,"Prata","Tinos",serif;font-size:46px;line-height:1.1;color:rgb(144,112,83);margin-bottom:14px;text-align:center}' +
    '#ww-cal .ww-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px 0;width:100%;max-width:336px}' +
    '#ww-cal .ww-cal-head{font-family:Roboto,sans-serif;font-size:12px;letter-spacing:.04em;color:rgb(144,112,83);text-transform:uppercase;text-align:center;padding-bottom:6px}' +
    '#ww-cal .ww-cal-cell{position:relative;display:flex;align-items:center;justify-content:center;height:34px;font-family:Roboto,sans-serif;font-size:14px;color:rgb(144,112,83)}' +
    '#ww-cal .ww-cal-cell i{position:relative;z-index:2;font-style:normal}' +
    '#ww-cal .ww-cal-wed i{color:#fff;font-weight:700}' +
    '#ww-cal .ww-cal-heart{position:absolute;top:50%;left:50%;width:32px;height:29px;transform:translate(-50%,-50%);fill:rgb(143,13,13);z-index:1}' +
    '#ww-cal .ww-cal-hint{margin-top:16px;font-size:11px;font-weight:600;color:#fff;background:rgba(0,0,0,.38);border:1px solid rgba(144,112,83,.6);padding:4px 12px;border-radius:999px}' +
    '.ww-cal-editable{cursor:pointer}' +

    // ---- Timeline overlay ----
    '#ww-timeline{position:absolute;inset:0;z-index:6;color:#fff;pointer-events:none}' +
    '#ww-timeline .ww-tl-title,#ww-timeline .ww-tl-items,#ww-timeline .ww-tl-dress,#ww-timeline .ww-tl-btn{pointer-events:auto}' +
    '#ww-timeline .ww-tl-title{position:absolute;top:8px;right:26px;font-family:' + TL_FONT_HEAD + ';font-size:49px;line-height:1.4;color:#fff;text-align:right}' +
    '#ww-timeline .ww-tl-items{position:absolute;left:0;right:0;top:86px;bottom:172px;display:flex;flex-direction:column;justify-content:space-around}' +
    '#ww-timeline .ww-tl-items::before{content:"";position:absolute;left:200px;top:6px;bottom:6px;border-left:1px solid rgba(255,255,255,.85)}' +
    '#ww-timeline .ww-tl-row{position:relative;display:grid;grid-template-columns:200px 1fr;align-items:center}' +
    '#ww-timeline .ww-tl-ic{width:44px;height:44px;justify-self:start;margin-left:120px;color:#fff}' +
    '#ww-timeline .ww-tl-ic .ww-ic{width:44px;height:44px;color:#fff}' +
    '#ww-timeline .ww-tl-row::after{content:"";position:absolute;left:196px;top:50%;width:9px;height:9px;border-radius:50%;background:#fff;transform:translateY(-50%)}' +
    '#ww-timeline .ww-tl-txt{padding-left:32px}' +
    '#ww-timeline .ww-tl-time,#ww-timeline .ww-tl-label{display:block;font-family:' + TL_FONT_ITEM + ';font-size:16px;line-height:1.7;color:#fff;text-transform:uppercase;text-align:left}' +
    '#ww-timeline .ww-tl-dress{position:absolute;left:34px;right:24px;bottom:18px}' +
    '#ww-timeline .ww-dc-head{display:block;font-family:' + TL_FONT_HEAD + ';font-size:40px;line-height:1.2;color:#fff}' +
    '#ww-timeline .ww-dc-text{display:block;font-family:' + TL_FONT_ITEM + ';font-size:13px;line-height:1.6;color:#fff;text-transform:uppercase;margin-top:2px;max-width:34ch}' +
    '#ww-timeline .ww-dc-row{display:flex;gap:8px;margin-top:8px}' +
    '#ww-timeline .ww-dc-sw{width:18px;height:18px;border-radius:50%;box-shadow:0 0 0 1px rgba(255,255,255,.9)}' +
    '#ww-timeline .ww-tl-btn{font:inherit;font-size:11px;font-weight:600;color:#fff;background:rgba(0,0,0,.38);border:1px solid rgba(255,255,255,.55);padding:4px 11px;border-radius:999px;cursor:pointer;backdrop-filter:blur(2px)}' +
    '#ww-timeline .ww-tl-btn:hover{background:rgba(0,0,0,.6)}' +
    '#ww-timeline .ww-tl-btn-top{position:absolute;top:66px;right:26px}' +
    '#ww-timeline .ww-tl-dress .ww-tl-btn{margin-top:8px}' +

    // ---- QR popup card ----
    '#ww-qr-card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:16px;padding:34px 26px 26px;box-sizing:border-box;font-family:inherit}' +
    '#ww-qr-card #ww-qr-frame{position:relative;width:210px;height:210px;border:1px solid rgb(200,170,130);border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff}' +
    '#ww-qr-card #IMAGE36{position:static !important;width:200px !important;height:200px !important;top:auto !important;left:auto !important}' +
    '#ww-qr-card #IMAGE36>.ladi-image,#ww-qr-card #IMAGE36>.ladi-image>.ladi-image-background{width:200px !important;height:200px !important;position:static !important}' +
    '#ww-qr-card #IMAGE36>.ladi-image>.ladi-image-background{background-size:contain !important;background-repeat:no-repeat !important;background-position:center !important}' +
    '#ww-qr-card #ww-qr-empty{position:absolute;font-size:13px;color:#9a8a76;font-family:inherit}' +
    '#ww-qr-card #ww-qr-lines{display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;font-family:"Prata","Tinos",serif;color:rgb(90,70,50)}' +
    '#ww-qr-card #ww-qr-num{font-size:20px;font-weight:700;letter-spacing:.03em}' +
    '#ww-qr-card #ww-qr-bank,#ww-qr-card #ww-qr-name{font-size:15px}' +
    '#ww-qr-card #ww-qr-dl{margin-top:4px;font-family:inherit;font-size:13px;font-weight:600;color:rgb(90,70,50);border:1px solid rgb(180,140,100);border-radius:999px;padding:7px 20px;text-decoration:none;cursor:pointer;background:rgba(255,255,255,.6)}' +
    '#ww-qr-card #ww-qr-dl:hover{background:rgb(144,112,83);color:#fff}' +

    // ---- edit sheets (timeline / dress / icon-picker) ----
    '.ww-sheet-mask{position:fixed;inset:0;z-index:2147483300;background:rgba(31,25,23,.55);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.ww-sheet{width:min(440px,94vw);max-height:88vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.35);font-family:-apple-system,system-ui,sans-serif;color:#1f1917}' +
    '.ww-sheet-hd{padding:15px 18px;border-bottom:1px solid #eee;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:space-between}' +
    '.ww-sheet-hd button{border:none;background:#f2ede7;width:26px;height:26px;border-radius:8px;cursor:pointer;font-size:15px;line-height:1}' +
    '.ww-sheet-bd{padding:14px 18px;display:flex;flex-direction:column;gap:12px}' +
    '.ww-toggle-label{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f8f6f2;border-radius:10px;cursor:pointer;font-weight:600;font-size:13px;color:#332924;margin-bottom:4px}' +
    '.ww-toggle-label input[type=checkbox]{width:18px;height:18px;cursor:pointer;accent-color:#c96547}' +
    '.ww-off-banner{display:block;margin:12px auto;padding:10px 16px;background:#fff4eb;border:1px dashed #e58d6f;border-radius:10px;color:#a84323;font-size:13px;text-align:center;cursor:pointer;font-weight:600;max-width:420px;line-height:1.4}' +
    '.ww-tl-erow{display:grid;grid-template-columns:46px 86px 1fr 30px;gap:6px;align-items:center;margin-bottom:8px}' +
    '.ww-tl-erow .ww-ipick{width:46px;height:46px;border:1px solid #ddd;border-radius:10px;background:#faf7f2;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;font-size:12px;font-weight:700;color:#8a6b45}' +
    '.ww-tl-erow .ww-ipick .ww-ic{width:24px;height:24px;color:#5a463c}' +
    '.ww-sheet input[type=text],.ww-sheet input[type=time],.ww-sheet textarea{width:100%;border:1px solid #ddd;border-radius:8px;padding:8px;font:inherit;font-size:13px;box-sizing:border-box}' +
    '.ww-tl-erow .ww-del{border:none;background:#f6eceb;color:#c0392b;border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center}' +
    '.ww-sheet .ww-add{border:1px dashed #c9b592;background:#faf7f2;color:#8a6b45;border-radius:10px;padding:9px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;width:100%;text-align:center}' +
    '.ww-sheet-ft{display:flex;gap:8px;padding:12px 18px 16px}' +
    '.ww-sheet-ft button{flex:1;border:none;border-radius:10px;padding:10px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}' +
    '.ww-sheet-ok{background:linear-gradient(135deg,#e58d6f,#c96547);color:#fff}' +
    '.ww-sheet-cancel{background:#f2ede7;color:#555}' +
    '.ww-ipgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}' +
    '.ww-ipgrid button{border:1px solid #e6ded2;border-radius:10px;background:#fff;padding:10px 4px 6px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px}' +
    '.ww-ipgrid button.on{border-color:#c96547;background:#fbefe9}' +
    '.ww-ipgrid button .ww-ic{width:28px;height:28px;color:#3a2f27}' +
    '.ww-ipgrid button span{font-size:9px;line-height:1.2;text-align:center;color:#8a7d6e}' +
    '.ww-dc-erow{display:flex;align-items:center;gap:6px;margin-bottom:8px}' +
    '.ww-dc-erow input[type=color]{width:44px;height:34px;border:1px solid #ddd;border-radius:8px;padding:2px;cursor:pointer;background:#fff;flex-shrink:0}' +
    '.ww-dc-erow .ww-del{border:none;background:#f6eceb;color:#c0392b;border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:16px;flex-shrink:0;display:flex;align-items:center;justify-content:center}' +
    '@keyframes wwRotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}' +
    '.ww-rotating{animation:wwRotate 3s linear infinite !important;transform-origin:center center}' +
    '.ww-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(31,25,23,.92);color:#fff;padding:12px 24px;border-radius:999px;font-family:-apple-system,sans-serif;font-size:14px;font-weight:600;z-index:2147483647;box-shadow:0 8px 24px rgba(0,0,0,.3);text-align:center;pointer-events:none;transition:opacity .35s ease}';
  (document.head || document.documentElement).appendChild(WW_CAL_STYLE);

  function showUniversalToast(msg) {
    var toast = document.createElement('div');
    toast.className = 'ww-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0';
      setTimeout(function() { toast.remove(); }, 400);
    }, 3500);
  }

  applyAll(window.invitationData);
  window.__weddingWebReinject = applyAll;
  setInterval(function () { try { updateCountdownTimer(window.invitationData); } catch (e) {} }, 1000);

  // Retry passes để chống việc LadiPage render bất đồng bộ hoặc lazyload ghi đè mất thông tin
  setTimeout(function () { applyAll(window.invitationData); }, 100);
  setTimeout(function () { applyAll(window.invitationData); }, 300);
  setTimeout(function () { applyAll(window.invitationData); }, 700);
  setTimeout(function () { applyAll(window.invitationData); }, 1500);
  window.addEventListener('load', function () {
    applyAll(window.invitationData);
  });

  window.addEventListener('message', function (event) {
    if (!event.data) return;
    if (event.data.type === 'wedding-web:data-updated') {
      applyAll(event.data.data);
    }
    if (event.data.type === 'wedding-web:optimistic-image') {
      var field = event.data.field;
      var index = event.data.index;
      var url = event.data.url;
      if (!field || !url) return;
      var imageEls = document.querySelectorAll('[data-image="' + field + '"]');
      for (var oi = 0; oi < imageEls.length; oi++) {
        var oEl = imageEls[oi];
        var idxAttr = oEl.getAttribute('data-image-index');
        if (index !== null && index !== undefined) {
          if (Number(idxAttr) !== Number(index)) continue;
        }
        oEl.classList.remove('ww-img-empty');
        oEl.classList.add('ww-img-loaded');
        var bgTarget = oEl.classList.contains('ladi-image-background') || oEl.classList.contains('ladi-box')
          ? oEl
          : (oEl.querySelector('.ladi-image-background') || oEl.querySelector('.ladi-box') || oEl);
        if (oEl.tagName === 'IMG') {
          oEl.src = url;
          oEl.removeAttribute('srcset');
          oEl.style.removeProperty('object-fit');
          oEl.style.removeProperty('background-color');
        } else {
          bgTarget.style.removeProperty('background-size');
          bgTarget.style.removeProperty('background-color');
          bgTarget.style.setProperty('filter', 'none', 'important');
          bgTarget.style.setProperty('background-size', 'cover', 'important');
          bgTarget.style.setProperty('background-position', 'center', 'important');
          bgTarget.style.setProperty('background-image', 'url("' + url + '")', 'important');
        }
      }
    }
  });

  ${editMode ? EDIT_MODE_SCRIPT : ''}
})();
`

// Phần chỉ thêm khi ở chế độ sửa trực tiếp.
const EDIT_MODE_SCRIPT = `
  var editConfig = window.__weddingWebEditConfig || { ceremonyDateFields: [], receptionDateFields: [] };

  var style = document.createElement('style');
  style.textContent =
    // Nâng z-index vùng sửa được lên trên lớp trang trí (box mờ, overlay) của mẫu
    // -> click luôn trúng đúng vùng; KHÔNG đổi màu/nền chữ để giữ nguyên diện mạo
    // thiệp, chỉ viền mảnh mờ gợi ý + đậm lên khi rê chuột.
    '[data-field] { position: relative !important; z-index: 90001 !important; outline: 1px dashed rgba(124,58,237,.4) !important; outline-offset: 1px; pointer-events: auto !important; user-select: text !important; }' +
    '[data-field-href] { outline: 1px dashed rgba(124,58,237,.35) !important; outline-offset: 1px; pointer-events: auto !important; }' +
    '[data-image] { outline: 1px dashed rgba(124,58,237,.35) !important; outline-offset: 1px; pointer-events: auto !important; cursor: pointer !important; }' +
    '[data-readonly], [data-readonly] [data-field], [data-readonly] [data-image] { outline: none !important; cursor: default !important; }' +
    '[data-field]:hover, [data-image]:hover, [data-field-href]:hover, .ww-cal-editable:hover { outline: 2px dashed #7c3aed !important; outline-offset: 2px; cursor: pointer; }' +
    '.ww-hot { outline: 2px solid #7c3aed !important; outline-offset: 2px; }' +
    '[data-field][contenteditable="true"] { outline: 2px solid #7c3aed !important; background: rgba(124,58,237,.1) !important; color: inherit !important; cursor: text; }' +
    '.ww-date-input { position: fixed; z-index: 2147483000; border: 2px solid #7c3aed; border-radius: 6px; padding: 4px 6px; font-size: 14px; background: #fff; color: #111; }' +
    // Nhãn nổi bám theo con trỏ, nói rõ bấm vào sẽ sửa GÌ (ảnh / chữ / ngày).
    '.ww-badge { position: fixed; z-index: 2147483200; background: #7c3aed; color: #fff; font: 600 12px/1 -apple-system,system-ui,sans-serif; padding: 5px 9px; border-radius: 999px; pointer-events: none; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,.28); transform: translateY(-125%); }' +
    // Popup chọn ngày cưới.
    '.ww-dp-mask { position: fixed; inset: 0; z-index: 2147483300; background: rgba(31,25,23,.55); display: flex; align-items: center; justify-content: center; padding: 16px; }' +
    '.ww-dp { width: min(340px,100%); background: #fff; border-radius: 18px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.35); font-family: -apple-system,system-ui,sans-serif; color: #1f1917; }' +
    '.ww-dp-hd { padding: 14px 16px; border-bottom: 1px solid #eee; font-weight: 700; font-size: 14px; display:flex; align-items:center; justify-content:space-between; }' +
    '.ww-dp-hd button { border:none; background:#f2ede7; width:26px; height:26px; border-radius:8px; cursor:pointer; font-size:15px; line-height:1; }' +
    '.ww-dp-bd { padding: 14px 16px; }' +
    '.ww-dp-nav { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; font-weight:700; font-size:13px; }' +
    '.ww-dp-nav button { border:none; background:#f2ede7; width:30px; height:30px; border-radius:8px; cursor:pointer; font-size:16px; }' +
    '.ww-dp-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }' +
    '.ww-dp-grid span { text-align:center; font-size:11px; color:#999; padding:4px 0; }' +
    '.ww-dp-grid button { border:none; background:transparent; padding:7px 0; border-radius:8px; cursor:pointer; font-size:13px; color:#333; }' +
    '.ww-dp-grid button:hover { background:#f2ede7; }' +
    '.ww-dp-grid button.on { background:#8f0d0d; color:#fff; font-weight:700; }' +
    '.ww-dp-time { margin-top:12px; display:flex; align-items:center; gap:8px; font-size:13px; }' +
    '.ww-dp-time input { flex:1; border:1px solid #ddd; border-radius:8px; padding:7px 8px; font-size:13px; }' +
    '.ww-dp-ft { display:flex; gap:8px; padding: 12px 16px 16px; }' +
    '.ww-dp-ft button { flex:1; border:none; border-radius:10px; padding:10px; font-size:13px; font-weight:700; cursor:pointer; }' +
    '.ww-dp-ok { background:linear-gradient(135deg,#e58d6f,#c96547); color:#fff; }' +
    '.ww-dp-cancel { background:#f2ede7; color:#555; }';
  document.head.appendChild(style);

  // ---------------------------------------------------------------------------
  // Nhãn nổi "Sửa chữ / Đổi ảnh / Đổi ngày" bám theo con trỏ.
  // ---------------------------------------------------------------------------
  var badge = document.createElement('div');
  badge.className = 'ww-badge';
  badge.style.display = 'none';
  document.body.appendChild(badge);
  var lastHot = null;
  function setHot(el, label) {
    if (lastHot && lastHot !== el) lastHot.classList.remove('ww-hot');
    lastHot = el;
    if (!el) { badge.style.display = 'none'; return; }
    el.classList.add('ww-hot');
    badge.textContent = label;
    badge.style.display = 'block';
  }
  document.addEventListener('mousemove', function (e) {
    if (badge.style.display !== 'none') {
      badge.style.left = e.clientX + 'px';
      badge.style.top = e.clientY + 'px';
    }
  }, true);
  document.addEventListener('mouseover', function (e) {
    var hit = editableFromEvent(e);
    if (!hit) { setHot(null); return; }
    setHot(hit.el, hit.label);
  }, true);

  // Tìm vùng-sửa-được TRÊN CÙNG tại vị trí con trỏ, không quan tâm lớp trang trí
  // nào của mẫu đang nằm đè lên (elementsFromPoint quét cả chồng phần tử).
  function editableFromEvent(e) {
    var stack = document.elementsFromPoint(e.clientX, e.clientY) || [];
    for (var i = 0; i < stack.length; i++) {
      var node = stack[i];
      if (node.closest && node.closest('.ww-badge, .ww-dp-mask, .ww-sheet-mask, .ww-date-input')) return null;
      if (node.closest && node.closest('[data-edit-dc]')) return { kind: 'dress', el: node, label: '🎨 Sửa dress code' };
      if (node.closest && node.closest('[data-edit-blessing]')) return { kind: 'blessing', el: node, label: '💌 Cài đặt Lời chúc & Tham dự' };
      var blArea = node.closest && node.closest('#blessing, .scene-blessing, .unified-blessing-form, .blessing-attendance-block, .blessing-journal-block, #gallery-gift-block, .gallery-gift-action');
      if (blArea) return { kind: 'blessing', el: blArea, label: '💌 Cài đặt Lời chúc & Tham dự' };
      if (node.closest && node.closest('[data-edit-tl]')) return { kind: 'timeline', el: node, label: '✏️ Sửa lịch trình' };
      var dress = node.closest && node.closest('.ww-tl-dress, .dresscode-open-area, .dresscode-palette-row, .dresscode-swatch');
      if (dress) return { kind: 'dress', el: dress, label: '🎨 Sửa dress code' };
      var tlrow = node.closest && node.closest('.ww-tl-row, .ww-tl-items, .living-botanical-stem, .stem-milestone, .scene-timeline .timeline-header, #timeline .timeline-header');
      if (tlrow) return { kind: 'timeline', el: tlrow, label: '✏️ Sửa lịch trình' };
      // data-readonly: vẫn BƠM dữ liệu để hiển thị, nhưng không cho sửa tại chỗ.
      // Dùng cho khối đã có đường sửa riêng — vd. thông tin ngân hàng mừng cưới đi
      // qua panel quét QR (setBank), sửa tay ở đây sẽ ghi sai vào extra_data.
      if (node.closest && node.closest('[data-readonly]')) return null;
      var f = node.closest && node.closest('[data-field]');
      if (f) {
        // Admin chọn ô nào cho khách sửa thì chỉ ô đó mới bấm được. Ô còn lại vẫn
        // hiện dữ liệu thật, chỉ không sửa tại chỗ — giữ đúng bố cục designer đã
        // canh (chữ lồng, nhãn trang trí, câu dẫn... gõ dài ra là vỡ layout).
        if (!wwCanEdit(f.getAttribute('data-field'))) continue;
        return { kind: 'field', el: f, label: isDateField(f.getAttribute('data-field')) ? '📅 Đổi ngày' : '✏️ Sửa chữ' };
      }
      var h = node.closest && node.closest('[data-field-href]');
      if (h) return { kind: 'href', el: h, label: '🔗 Sửa link' };
      var im = node.closest && node.closest('[data-image]');
      if (im) {
        if (!wwCanChangeImage(im.getAttribute('data-image'))) continue;
        return { kind: 'image', el: im, label: isBankQrField(im.getAttribute('data-image')) ? '📷 Đổi mã QR' : '🖼️ Đổi ảnh' };
      }
      var cal = node.closest && node.closest('#ww-cal, .editorial-calendar-table, .scene-calendar, #calendar');
      if (cal) return { kind: 'calendar', el: cal, label: '📅 Đổi ngày cưới' };
    }
    return null;
  }


  // ---- Quyền sửa: ô nào khách được bấm vào ----------------------------------
  // Bộ mặc định phải khớp DEFAULT_EDITABLE trong BE fieldCatalog.js. Nếu lệch thì
  // giao diện cho bấm mà backend từ chối lưu (hoặc ngược lại) — người dùng sửa
  // xong bấm lưu lại thấy không đổi gì.
  var WW_DEFAULT_EDITABLE = ['groom_name','bride_name','groom_short_name','bride_short_name','couple_names',
    'groom.father_grom','groom.mother_groom','groom.address',
    'bride.father_bride','bride.mother_bride','bride.address','bride.commune','bride.district','bride.province','groom.commune','groom.district','groom.province','love_quote_1','love_quote_2',
    'ceremony_short','ceremony_weekday','ceremony_time_weekday','ceremony_day','ceremony_month','ceremony_year',
    'ceremony_lunar_text','venue_address','venue_name','map_url',
    'reception_short','reception_weekday','reception_time_weekday','reception_time',
    'reception_day','reception_month','reception_year','reception_lunar_text',
    'reception_venue_address','reception_venue_name','reception_map_url',
    'thank_you_message','title_vi','extra_notes','invitation_lead','guest_name','wedding_location','wedding_city','show_timeline','show_dresscode',
    'ceremony_month_num','ceremony_year_num','ceremony_time','ceremony_weekday_date','ceremony_full_date','reception_month_num','reception_year_num','reception_time','reception_weekday_date','reception_full_date','welcome_quote','welcome_text','family_lead_text','ceremony_heartfelt_quote','story_quote','timeline_time_1','timeline_title_1','timeline_desc_1','timeline_time_2','timeline_title_2','timeline_desc_2','timeline_time_3','timeline_title_3','timeline_desc_3','timeline_time_4','timeline_title_4','timeline_desc_4','timeline_time_5','timeline_title_5','timeline_desc_5'];

  // Thông tin ngân hàng KHÔNG BAO GIỜ sửa tại chỗ — đi qua panel quét mã QR, vì
  // số tài khoản gõ tay sẽ lệch với mã QR đang hiện.
  var WW_NEVER_EDITABLE = ['groom.bank_name','groom.bank_account_name','groom.bank_account_number',
    'bride.bank_name','bride.bank_account_name','bride.bank_account_number'];

  function wwCanEdit(field) {
    if (!field) return false;
    if (WW_NEVER_EDITABLE.indexOf(field) !== -1) return false;
    var allow = window.__weddingWebEditable;
    // null/undefined = admin chưa cấu hình -> dùng bộ mặc định.
    if (allow == null) return true;
    if (!Array.isArray(allow)) return true;
    return allow.indexOf(field) !== -1;
  }

  function wwCanChangeImage(slot) {
    if (!slot) return false;
    var rules = window.__weddingWebImageRules;
    if (!rules || !rules[slot]) return true; // chưa cấu hình -> cho đổi
    return rules[slot].allow_change !== false;
  }

  function post(msg) {
    window.parent.postMessage(Object.assign({ type: 'wedding-web:edit' }, msg), '*');
  }

  function isDateField(field) {
    if (editConfig.ceremonyDateFields.indexOf(field) !== -1) return 'ceremony';
    if (editConfig.receptionDateFields.indexOf(field) !== -1) return 'reception';
    return null;
  }

  function pad(n) { return String(n).length < 2 ? '0' + n : String(n); }

  // Popup chọn ngày đẹp: lịch tháng bấm chọn + prev/next tháng + giờ (chỉ lễ cưới).
  function openDatePicker(group) {
    var data = window.invitationData || {};
    var raw = group === 'ceremony' ? data.ceremony_date : data.reception_date;
    var base = raw ? new Date(raw) : new Date();
    if (isNaN(base.getTime())) base = new Date();
    var sel = { y: base.getUTCFullYear(), m: base.getUTCMonth(), d: base.getUTCDate() };
    var hh = raw && group === 'ceremony' ? pad(base.getUTCHours()) : '16';
    var mi = raw && group === 'ceremony' ? pad(base.getUTCMinutes()) : '00';
    var viewY = sel.y, viewM = sel.m;

    var mask = document.createElement('div');
    mask.className = 'ww-dp-mask';
    var titleTxt = group === 'ceremony' ? 'Chọn ngày & giờ Lễ cưới' : 'Chọn ngày & giờ Đãi tiệc';
    var curTimeVal = '11:00';
    if (group === 'ceremony') {
      curTimeVal = (raw ? (pad(base.getUTCHours()) + ':' + pad(base.getUTCMinutes())) : '10:15');
    } else {
      curTimeVal = data.reception_time || (raw ? (pad(base.getUTCHours()) + ':' + pad(base.getUTCMinutes())) : '11:00');
    }
    mask.innerHTML =
      '<div class="ww-dp">' +
        '<div class="ww-dp-hd"><span>' + titleTxt + '</span><button data-x>&times;</button></div>' +
        '<div class="ww-dp-bd">' +
          '<div class="ww-dp-nav"><button data-prev>&lsaquo;</button><span data-mlabel></span><button data-next>&rsaquo;</button></div>' +
          '<div class="ww-dp-grid" data-grid></div>' +
          '<div class="ww-dp-time">🕒 <input type="time" data-time value="' + curTimeVal + '"></div>' +
        '</div>' +
        '<div class="ww-dp-ft"><button class="ww-dp-cancel" data-x>Huỷ</button><button class="ww-dp-ok" data-ok>Xong</button></div>' +
      '</div>';
    document.body.appendChild(mask);

    var grid = mask.querySelector('[data-grid]');
    var mlabel = mask.querySelector('[data-mlabel]');
    function draw() {
      mlabel.textContent = MONTHS_EN[viewM] + ' ' + viewY;
      var firstDow = (new Date(Date.UTC(viewY, viewM, 1)).getUTCDay() + 6) % 7;
      var dim = new Date(Date.UTC(viewY, viewM + 1, 0)).getUTCDate();
      var html = '';
      for (var w = 0; w < 7; w++) html += '<span>' + WEEKDAYS_SHORT[w] + '</span>';
      for (var e = 0; e < firstDow; e++) html += '<i></i>';
      for (var day = 1; day <= dim; day++) {
        var on = day === sel.d && viewY === sel.y && viewM === sel.m;
        html += '<button data-d="' + day + '" class="' + (on ? 'on' : '') + '">' + day + '</button>';
      }
      grid.innerHTML = html;
    }
    draw();

    mask.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t.closest('[data-x]') || t === mask) { mask.remove(); return; }
      if (t.closest('[data-prev]')) { viewM--; if (viewM < 0) { viewM = 11; viewY--; } draw(); return; }
      if (t.closest('[data-next]')) { viewM++; if (viewM > 11) { viewM = 0; viewY++; } draw(); return; }
      var db = t.closest('[data-d]');
      if (db) { sel = { y: viewY, m: viewM, d: Number(db.getAttribute('data-d')) }; draw(); return; }
      if (t.closest('[data-ok]')) {
        var t2 = mask.querySelector('[data-time]');
        var defaultTimeFallback = group === 'ceremony' ? '10:15' : '11:00';
        var parts = t2 ? String(t2.value || defaultTimeFallback).split(':') : defaultTimeFallback.split(':');
        var iso = sel.y + '-' + pad(sel.m + 1) + '-' + pad(sel.d);
        if (group === 'ceremony') {
          post({ field: 'ceremony_date', kind: 'field', value: iso + 'T' + pad(parts[0]) + ':' + pad(parts[1]) + ':00Z' });
        } else {
          post({ field: 'reception_date', kind: 'field', value: iso });
          post({ field: 'reception_time', kind: 'field', value: pad(parts[0]) + ':' + pad(parts[1]) });
        }
        mask.remove();
      }
    });
  }

  function activateText(el) {
    var field = el.getAttribute('data-field');
    if (isDateField(field)) { openDatePicker(isDateField(field)); return; }
    if (el.getAttribute('contenteditable') === 'true') return;
    if (!el.__wwWired) {
      el.__wwWired = true;
      el.addEventListener('blur', function () {
        if (el.getAttribute('contenteditable') !== 'true') return;
        el.removeAttribute('contenteditable');
        var value = el.textContent;
        if (value !== el.__wwOriginal) post({ field: field, kind: 'field', value: value });
      });
      el.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && el.getAttribute('contenteditable') === 'true') {
          event.preventDefault();
          el.blur();
        }
      });
    }
    el.setAttribute('contenteditable', 'true');
    el.__wwOriginal = el.textContent;
    el.focus();
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function isBankQrField(field) {
    var f = String(field || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return f === 'qr' || f.indexOf('bank_qr') !== -1 || f.indexOf('qr_code') !== -1 ||
      f.indexOf('qr_bank') !== -1 || f.indexOf('bank_qr_code') !== -1 || /(^|_)qr(_|$)/.test(f);
  }

  function elRatio(el) {
    // Tỉ lệ khung ưu tiên data-image-ratio ("3/4","0.75"), sau đó là kích thước hiển thị.
    var attr = el.getAttribute('data-image-ratio');
    if (attr) {
      if (attr.indexOf('/') !== -1) {
        var p = attr.split('/');
        var a = parseFloat(p[0]), b = parseFloat(p[1]);
        if (a > 0 && b > 0) return a / b;
      }
      var n = parseFloat(attr);
      if (n > 0) return n;
    }
    var rect = el.getBoundingClientRect();
    if (rect.width > 4 && rect.height > 4) return rect.width / rect.height;
    return null;
  }

  function openImagePicker(el) {
    var field = el.getAttribute('data-image');
    var idxAttr = el.getAttribute('data-image-index');

    // Ô QR ngân hàng: mở luồng quét/tải QR, KHÔNG phải upload ảnh thường.
    if (isBankQrField(field)) {
      window.parent.postMessage({ type: 'wedding-web:open-bank-qr' }, '*');
      return;
    }

    var ratio = elRatio(el);
    var index = idxAttr !== null ? Number(idxAttr) : null;

    // Gửi message lên EditorPage để mở popup thư viện chọn ảnh độc lập
    window.parent.postMessage({
      type: 'wedding-web:choose-image',
      field: field,
      index: index,
      ratio: ratio,
    }, '*');
  }

  // ---------------------------------------------------------------------------
  // MỘT trình điều phối click duy nhất ở pha capture. Thay vì gắn listener lên
  // từng phần tử (dễ bị lớp trang trí đè lên chặn mất click), ta quét chồng phần
  // tử tại điểm bấm và chọn đúng vùng-sửa-được trên cùng.
  // ---------------------------------------------------------------------------
  document.addEventListener('click', function (event) {
    if (event.target.closest && event.target.closest('.ww-dp-mask, .ww-sheet-mask, .ww-badge')) return;
    var hit = editableFromEvent(event);
    if (!hit) return;
    event.preventDefault();
    event.stopPropagation();
    if (hit.kind === 'field') activateText(hit.el);
    else if (hit.kind === 'href') openHrefField(hit.el);
    else if (hit.kind === 'image') openImagePicker(hit.el);
    else if (hit.kind === 'calendar') openDatePicker('ceremony');
    else if (hit.kind === 'blessing') openBlessingEditor();
    else if (hit.kind === 'timeline') openTimelineEditor();
    else if (hit.kind === 'dress') openDressEditor();
  }, true);

  function openHrefField(el) {
    var field = el.getAttribute('data-field-href');
    var current = el.getAttribute('href') || '';
    var next = window.prompt('Nhập link Google Maps:', current);
    if (next !== null && next.trim() && next !== current) {
      post({ field: field, kind: 'field', value: next.trim() });
    }
  }

  // ---------------------------------------------------------------------------
  // Popup sửa LỊCH TRÌNH TIMELINE — thêm/xoá mốc, sửa giờ + nội dung, chọn icon.
  // ---------------------------------------------------------------------------
  function sheet(title, bodyHtml, onOk) {
    var mask = document.createElement('div');
    mask.className = 'ww-sheet-mask';
    mask.innerHTML =
      '<div class="ww-sheet">' +
        '<div class="ww-sheet-hd"><span>' + title + '</span><button type="button" data-x>&times;</button></div>' +
        '<div class="ww-sheet-bd">' + bodyHtml + '</div>' +
        '<div class="ww-sheet-ft"><button type="button" class="ww-sheet-cancel" data-x>Huỷ</button><button type="button" class="ww-sheet-ok" data-ok>Xong</button></div>' +
      '</div>';
    document.body.appendChild(mask);
    mask.addEventListener('click', function (ev) {
      if (ev.target === mask || (ev.target.closest && ev.target.closest('[data-x]'))) { mask.remove(); return; }
      if (ev.target.closest && ev.target.closest('[data-ok]')) { if (onOk(mask) !== false) mask.remove(); }
    });
    return mask;
  }

  function openIconPicker(currentId, cb) {
    var grid = '';
    grid += '<button type="button" data-ic="" class="' + (currentId ? '' : 'on') + '"><span class="ww-tl-dot" style="width:12px;height:12px;background:#8a7d6e;border-radius:50%"></span><span>Không icon</span></button>';
    for (var i = 0; i < WW_ICON_ORDER.length; i++) {
      var id = WW_ICON_ORDER[i];
      grid += '<button type="button" data-ic="' + id + '" class="' + (currentId === id ? 'on' : '') + '">' + wwIconSvg(id) + '<span>' + WW_ICONS[id].n + '</span></button>';
    }
    var m = document.createElement('div');
    m.className = 'ww-sheet-mask';
    m.innerHTML = '<div class="ww-sheet"><div class="ww-sheet-hd"><span>Chọn icon cho mốc</span><button type="button" data-x>&times;</button></div><div class="ww-sheet-bd"><div class="ww-ipgrid">' + grid + '</div></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (ev) {
      if (ev.target === m || (ev.target.closest && ev.target.closest('[data-x]'))) { m.remove(); return; }
      var b = ev.target.closest && ev.target.closest('[data-ic]');
      if (b) { cb(b.getAttribute('data-ic')); m.remove(); }
    });
  }

  function tlRowHtml(it) {
    it = it || {};
    var label = esc(it.label || it.title || '').replace(/"/g, '&quot;');
    var desc = esc(it.desc || '').replace(/"/g, '&quot;');
    return '<div class="ww-tl-erow" data-icon="' + (it.icon || '') + '">' +
      '<button type="button" class="ww-ipick" title="Chọn icon">' + (it.icon && WW_ICONS[it.icon] ? wwIconSvg(it.icon) : '<span style="font-size:12px;font-weight:700;color:#8a6b45">+icon</span>') + '</button>' +
      '<input type="time" class="ww-t" value="' + (it.t || '') + '">' +
      '<div style="display:flex;flex-direction:column;gap:4px">' +
        '<input type="text" class="ww-l" placeholder="Tiêu đề mốc (VD: Khai tiệc)" value="' + label + '">' +
        '<input type="text" class="ww-d" placeholder="Mô tả phụ (tuỳ chọn)" value="' + desc + '" style="font-size:11px;padding:4px 6px">' +
      '</div>' +
      '<button type="button" class="ww-del" title="Xoá mốc">&times;</button>' +
    '</div>';
  }

  function openBlessingEditor() {
    var data = window.invitationData || {};
    var extra = data.extra_data || {};

    var showRsvp = (extra.show_rsvp !== undefined) ? Boolean(extra.show_rsvp) : (data.show_rsvp !== undefined ? Boolean(data.show_rsvp) : true);
    var allowWishes = (extra.allow_wishes !== undefined) ? Boolean(extra.allow_wishes) : (data.allow_wishes !== undefined ? Boolean(data.allow_wishes) : true);
    var showWishesList = (extra.show_wishes_list !== undefined) ? Boolean(extra.show_wishes_list) : (data.show_wishes_list !== undefined ? Boolean(data.show_wishes_list) : true);
    var showGiftBox = (extra.show_gift_box !== undefined) ? Boolean(extra.show_gift_box) : (data.show_gift_box !== undefined ? Boolean(data.show_gift_box) : true);

    var body =
      '<div style="display:flex;flex-direction:column;gap:12px">' +
        '<label class="ww-toggle-label"><input type="checkbox" id="ww-rsvp-toggle"' + (showRsvp ? ' checked' : '') + '> <span><strong>1. Xác nhận tham gia (RSVP)</strong></span></label>' +
        '<div style="font-size:11.5px;color:#7a6f68;margin:-8px 0 6px 30px">Hỏi khách có thể tham dự hay không và số lượng người đi cùng</div>' +

        '<label class="ww-toggle-label"><input type="checkbox" id="ww-wishes-toggle"' + (allowWishes ? ' checked' : '') + '> <span><strong>2. Cho phép khách gửi lời chúc mới</strong></span></label>' +
        '<div style="font-size:11.5px;color:#7a6f68;margin:-8px 0 6px 30px">Hiển thị ô nhập lời chúc và nút gợi ý câu chúc</div>' +

        '<label class="ww-toggle-label"><input type="checkbox" id="ww-wishes-list-toggle"' + (showWishesList ? ' checked' : '') + '> <span><strong>3. Hiển thị sổ lưu bút lời chúc trên thiệp</strong></span></label>' +
        '<div style="font-size:11.5px;color:#7a6f68;margin:-8px 0 6px 30px">Hiển thị danh sách các câu chúc khách gửi lên thiệp</div>' +

        '<label class="ww-toggle-label"><input type="checkbox" id="ww-gift-toggle"' + (showGiftBox ? ' checked' : '') + '> <span><strong>4. Hiển thị nút Gửi quà mừng</strong></span></label>' +
        '<div style="font-size:11.5px;color:#7a6f68;margin:-8px 0 6px 30px">Nút mở bảng thông tin STK và mã QR mừng cưới từ xa</div>' +

        '<div style="margin-top:6px;padding:10px 14px;background:#fbf6f0;border:1px dashed #d9cebe;border-radius:10px;font-size:12px;color:#6e5845;line-height:1.45">' +
          '💡 <strong>Lưu ý:</strong> Khi bạn tắt cả mục 1 (Xác nhận tham gia) và mục 2-3 (Lời chúc), nút <strong>GỬI QUÀ MỪNG</strong> sẽ tự động được di chuyển lên hiển thị trang trọng ngay dưới album ảnh cưới (Gallery).' +
        '</div>' +
      '</div>';

    sheet('Cài đặt Lời chúc & Xác nhận tham dự', body, function (m) {
      var isRsvp = !!m.querySelector('#ww-rsvp-toggle').checked;
      var isWishes = !!m.querySelector('#ww-wishes-toggle').checked;
      var isWishesList = !!m.querySelector('#ww-wishes-list-toggle').checked;
      var isGift = !!m.querySelector('#ww-gift-toggle').checked;

      post({ field: 'show_rsvp', kind: 'field', value: isRsvp });
      post({ field: 'allow_wishes', kind: 'field', value: isWishes });
      post({ field: 'show_wishes_list', kind: 'field', value: isWishesList });
      post({ field: 'show_gift_box', kind: 'field', value: isGift });

      var nextData = Object.assign({}, window.invitationData || {});
      nextData.extra_data = Object.assign({}, nextData.extra_data || {}, {
        show_rsvp: isRsvp,
        allow_wishes: isWishes,
        show_wishes_list: isWishesList,
        show_gift_box: isGift
      });
      nextData.show_rsvp = isRsvp;
      nextData.allow_wishes = isWishes;
      nextData.show_wishes_list = isWishesList;
      nextData.show_gift_box = isGift;
      window.invitationData = nextData;
      applyAll(nextData);
    });
  }

  window.__wwOpenBlessingEditor = openBlessingEditor;

  function openTimelineEditor() {
    var data = window.invitationData || {};
    var items = wwTimelineItems(data);
    var showTl = data.show_timeline !== false && (!data.extra_data || data.extra_data.show_timeline !== false);
    var rows = items.map(tlRowHtml).join('');
    var body =
      '<label class="ww-toggle-label"><input type="checkbox" id="ww-tl-toggle"' + (showTl ? ' checked' : '') + '> <span>Hiển thị phần Timeline trên thiệp</span></label>' +
      '<div class="ww-tl-rows">' + rows + '</div>' +
      '<button type="button" class="ww-add" data-add>+ Thêm mốc lịch trình</button>';
    var mask = sheet('Lịch trình timeline', body, function (m) {
      var isVisible = !!m.querySelector('#ww-tl-toggle').checked;
      var out = [];
      m.querySelectorAll('.ww-tl-erow').forEach(function (r) {
        var t = r.querySelector('.ww-t').value.trim();
        var l = r.querySelector('.ww-l').value.trim();
        var d = (r.querySelector('.ww-d') ? r.querySelector('.ww-d').value.trim() : '');
        var ic = r.getAttribute('data-icon') || '';
        if (t || l || d) out.push({ t: t, label: l, title: l, desc: d, icon: ic });
      });
      post({ field: 'show_timeline', kind: 'field', value: isVisible });
      post({ field: 'timeline', kind: 'field', value: out });
    });
    var rowsBox = mask.querySelector('.ww-tl-rows');
    mask.addEventListener('click', function (ev) {
      if (ev.target.closest && ev.target.closest('[data-add]')) {
        rowsBox.insertAdjacentHTML('beforeend', tlRowHtml({ t: '12:00', label: '', desc: '', icon: 'nang-ly' }));
        return;
      }
      var del = ev.target.closest && ev.target.closest('.ww-del');
      if (del) { del.closest('.ww-tl-erow').remove(); return; }
      var pick = ev.target.closest && ev.target.closest('.ww-ipick');
      if (pick) {
        var row = pick.closest('.ww-tl-erow');
        openIconPicker(row.getAttribute('data-icon') || '', function (id) {
          row.setAttribute('data-icon', id || '');
          pick.innerHTML = id && WW_ICONS[id] ? wwIconSvg(id) : '<span style="font-size:12px;font-weight:700;color:#8a6b45">+icon</span>';
        });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Popup sửa DRESS CODE — nội dung + bảng màu (chọn màu RGB tự do, không giới hạn).
  // ---------------------------------------------------------------------------
  function dcRowHtml(item) {
    var hex = typeof item === 'string' ? item : (item && item.hex ? item.hex : '#c8a06a');
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) hex = '#c8a06a';
    var name = typeof item === 'object' && item ? (item.name || '') : '';
    var sub = typeof item === 'object' && item ? (item.sub || '') : '';
    return '<div class="ww-dc-erow">' +
      '<input type="color" class="ww-c" value="' + hex + '">' +
      '<input type="text" class="ww-dc-n" placeholder="Tên màu (VD: Tím, Be...)" value="' + esc(name).replace(/"/g, '&quot;') + '" style="flex:1">' +
      '<input type="text" class="ww-dc-s" placeholder="Ghi chú (VD: Lụa nhạt...)" value="' + esc(sub).replace(/"/g, '&quot;') + '" style="flex:1">' +
      '<button type="button" class="ww-del" title="Xoá màu">&times;</button>' +
    '</div>';
  }
  function openDressEditor() {
    var data = window.invitationData || {};
    var dc = wwDressCode(data);
    var showDc = data.show_dresscode !== false && (!data.extra_data || data.extra_data.show_dresscode !== false);
    var colorsList = dc.colors && dc.colors.length ? dc.colors : ['#7e6c94', '#f5e6d3', '#a3b899', '#5c3d4e'];
    var body =
      '<label class="ww-toggle-label"><input type="checkbox" id="ww-dc-toggle"' + (showDc ? ' checked' : '') + '> <span>Hiển thị phần Dress code trên thiệp</span></label>' +
      '<label style="font-size:12px;color:#6e625c;font-weight:600">Lời nhắn / Quy định trang phục</label>' +
      '<textarea class="ww-dc-t" rows="3" placeholder="VD: Để có những bức hình đồng điệu và trang nhã nhất, Quý khách có thể ưu tiên các gam màu:">' + esc(dc.text) + '</textarea>' +
      '<label style="font-size:12px;color:#6e625c;font-weight:600">Bảng màu gợi ý (thêm/xoá tuỳ ý)</label>' +
      '<div class="ww-dc-colors">' + colorsList.map(dcRowHtml).join('') + '</div>' +
      '<button type="button" class="ww-add" data-addc>+ Thêm màu mới</button>';
    var mask = sheet('Dress code', body, function (m) {
      var isVisible = !!m.querySelector('#ww-dc-toggle').checked;
      var text = m.querySelector('.ww-dc-t').value.trim();
      var colors = [];
      m.querySelectorAll('.ww-dc-erow').forEach(function (r) {
        var c = r.querySelector('.ww-c').value;
        var n = (r.querySelector('.ww-dc-n') ? r.querySelector('.ww-dc-n').value.trim() : '');
        var s = (r.querySelector('.ww-dc-s') ? r.querySelector('.ww-dc-s').value.trim() : '');
        colors.push({ hex: c, name: n, sub: s });
      });
      post({ field: 'show_dresscode', kind: 'field', value: isVisible });
      post({ field: 'dresscode', kind: 'field', value: { text: text, colors: colors } });
    });
    var box = mask.querySelector('.ww-dc-colors');
    mask.addEventListener('click', function (ev) {
      if (ev.target.closest && ev.target.closest('[data-addc]')) {
        box.insertAdjacentHTML('beforeend', dcRowHtml({ hex: '#8a1420', name: '', sub: '' }));
        return;
      }
      var del = ev.target.closest && ev.target.closest('.ww-del');
      if (del && del.closest('.ww-dc-erow')) del.closest('.ww-dc-erow').remove();
    });
  }
`

// Nhúng dữ liệu vào trong thẻ <script> một cách an toàn.
//
// LỖ HỔNG ĐÃ VÁ (XSS lưu trữ): JSON.stringify KHÔNG escape dấu "<", nên một trường
// bất kỳ do người dùng nhập — tiêu đề thiệp, lời cảm ơn, tên cô dâu chú rể... — chứa
// chuỗi "</script><script>..." sẽ ĐÓNG SỚM thẻ script rồi chạy mã của kẻ tấn công
// ngay trong iframe. Vì iframe dùng srcDoc + allow-same-origin nên mã đó chạy đúng
// origin của web, đọc được localStorage.token của bất kỳ ai mở thiệp — kể cả admin.
//
// Cách vá chuẩn: escape "<", ">", "&" thành chuỗi unicode escape. JSON vẫn hợp lệ và
// giải mã ra đúng ký tự ban đầu, nhưng trình phân tích HTML không còn thấy thẻ nào.
// U+2028/U+2029 cũng phải escape vì JS coi chúng là dấu xuống dòng.
const safeJsonForScript = (value) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029')

// Ghép html gốc + <base> + window.invitationData + script bơm/sửa dữ liệu.
export const buildIframeDocument = (htmlContent, invitation, options = {}) => {
  const { editMode = false } = options

  const templateHtmlPath = invitation?.template?.html_path || ''
  const templateBaseUrl = resolveTemplateUrl(templateHtmlPath)
  // Base href để các đường dẫn tương đối (css/js/ảnh) trong mẫu tự resolve đúng về
  // thư mục chứa mẫu đó, bất kể mẫu đang được host ở đâu (BE static, CDN...).
  let baseHref = ''
  if (templateBaseUrl) {
    try {
      const fullUrl = /^https?:\/\//i.test(templateBaseUrl)
        ? templateBaseUrl
        : (typeof window !== 'undefined' ? new URL(templateBaseUrl, window.location.origin).href : templateBaseUrl)
      baseHref = new URL('.', fullUrl).href
    } catch (_e) {
      baseHref = ''
    }
  }

  const mergedData = buildMergedData(invitation)

  const baseTag = baseHref ? `<base href="${baseHref}">` : ''

  // --- Gợi ý mạng: bắt tay sớm với host chứa ảnh (CDN R2 / backend) ---
  // Không có preconnect thì riêng việc mở kết nối (DNS + TCP + TLS) đã tốn 200-300ms
  // trên 4G, cộng thẳng vào thời điểm ảnh đầu tiên hiện ra.
  const images = Array.isArray(mergedData.images) ? mergedData.images : []
  const preconnectTags = preconnectOrigins(images)
    .map((origin) => `<link rel="preconnect" href="${origin}" crossorigin><link rel="dns-prefetch" href="${origin}">`)
    .join('')

  // --- Preload đúng MỘT ảnh LCP ---
  // Ảnh bìa được tải song song với HTML/CSS thay vì chờ JS chạy xong mới biết cần tải.
  // Cố ý chỉ preload 1 ảnh: preload nhiều sẽ giành băng thông và làm LCP CHẬM đi.
  const lcp = findLcpImage(images)
  const lcpPreload = lcp
    ? `<link rel="preload" as="image" href="${lcp.image_url}"` +
      (lcp.srcset_avif || lcp.srcset_webp
        ? ` imagesrcset="${(lcp.srcset_avif || lcp.srcset_webp).replace(/"/g, '&quot;')}" imagesizes="${DEFAULT_SIZES}"`
        : '') +
      ` fetchpriority="high">`
    : ''

  // Chuyển mượt từ ảnh nhoè sang ảnh thật, và chừa sẵn chỗ theo tỉ lệ ảnh.
  const imageStyleTag = `<style>
    [data-image] { background-repeat: no-repeat; background-position: center; }
    img[data-image] { transition: filter .35s ease, opacity .35s ease; }
    [data-image] { filter: none !important; }
    img[data-image] { filter: none !important; opacity: 1; }
  </style>`

  const imageScriptTag = `<script>${buildImageLoadingScript()}</script>`
  // Đặt window.invitationData ngay trong <head>, TRƯỚC mọi script khác của mẫu —
  // để các script riêng của mẫu (nếu có sửa lại để đọc window.invitationData, vd.
  // danh sách nhạc nền) cũng thấy được dữ liệu này, không chỉ script bơm DOM ở cuối.
  const dataTag = `<script>
    window.invitationData = ${safeJsonForScript(mergedData)};
    window.__weddingWebEditConfig = ${safeJsonForScript(buildEditConfig())};
    window.__weddingWebEditMode = ${editMode ? 'true' : 'false'};
    // Danh sách ô admin cho phép khách sửa. null = chưa cấu hình -> mở theo bộ mặc
    // định của hệ thống. Mảng rỗng = khoá hết, khách chỉ xem.
    window.__weddingWebEditable = ${safeJsonForScript(options.editableFields ?? null)};
    // Giới hạn từng ô ảnh: { gallery: { max: 12, allow_add: true }, ... }
    window.__weddingWebImageRules = ${safeJsonForScript(options.imageSlotRules ?? null)};
  </script>`

  let output = htmlContent || ''

  // Cache-busting: Đảm bảo các file CSS và JS trong mẫu luôn mang query param mới
  // để trình duyệt và proxy không bao giờ dùng lại cache cũ khi có cập nhật.
  const cacheBustTime = Date.now()
  output = output.replace(/(href=["']assets\/css\/[^"']+\.css)(?:\?[^"']*)?(["'])/g, `$1?v=${cacheBustTime}$2`)
  output = output.replace(/(src=["']assets\/js\/[^"']+\.js)(?:\?[^"']*)?(["'])/g, `$1?v=${cacheBustTime}$2`)

  // Thứ tự trong <head> có chủ đích: preconnect/preload đứng TRƯỚC để trình duyệt
  // khởi động kết nối và tải ảnh bìa ngay từ lúc quét HTML, không phải chờ script.
  const headInsert = `${preconnectTags}${lcpPreload}${baseTag}${dataTag}${imageStyleTag}${imageScriptTag}`
  output = /<head[^>]*>/i.test(output)
    ? output.replace(/<head([^>]*)>/i, `<head$1>${headInsert}`)
    : `${headInsert}${output}`

  const domScript = `<script>${buildDomInjectScript(editMode)}</script>`
  output = output.includes('</body>') ? output.replace('</body>', `${domScript}</body>`) : `${output}${domScript}`

  return output
}
