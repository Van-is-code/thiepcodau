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
  return `${API_BASE}${normalizedPath}`
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
  if (/^(https?:|data:|blob:)/i.test(url) || url.startsWith('//')) return url
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
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

  data.groom_name = invitation?.groom?.name_groom || ''
  data.bride_name = invitation?.bride?.name_bride || ''
  data.groom_short_name = lastWord(data.groom_name)
  data.bride_short_name = lastWord(data.bride_name)
  data.groom_initial = data.groom_short_name.charAt(0)
  data.bride_initial = data.bride_short_name.charAt(0)

  addDateParts(data, invitation?.ceremony_date, 'ceremony')
  addDateParts(data, invitation?.reception_date, 'reception')

  return data
}

// ---------------------------------------------------------------------------
// Write-map: 1 data-field key khi khách sửa trực tiếp thì LƯU vào đâu.
// Field không khớp quy tắc nào bên dưới thì mặc định rơi vào extra_data (field
// riêng theo mẫu) — khớp đúng cách buildMergedData() đã gộp extra_data vào top-level.
// ---------------------------------------------------------------------------
const GROOM_NAME_ALIASES = new Set(['groom_name', 'groom_short_name', 'groom_initial'])
const BRIDE_NAME_ALIASES = new Set(['bride_name', 'bride_short_name', 'bride_initial'])
const CEREMONY_DATE_ALIASES = new Set([
  'ceremony_day', 'ceremony_month', 'ceremony_month_en', 'ceremony_year',
  'ceremony_weekday', 'ceremony_time_weekday', 'ceremony_short',
])
const RECEPTION_DATE_ALIASES = new Set([
  'reception_day', 'reception_month', 'reception_month_en', 'reception_year',
  'reception_weekday', 'reception_time_weekday', 'reception_short',
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
  if (GROOM_NAME_ALIASES.has(fieldKey)) return { scope: 'groom', column: 'name_groom', widget: 'text' }
  if (BRIDE_NAME_ALIASES.has(fieldKey)) return { scope: 'bride', column: 'name_bride', widget: 'text' }
  // Field GỐC (không phải alias hiển thị) mà chính openDateInput() và nút "Chọn ngày cưới"
  // trong mẫu thiệp gửi lên khi lưu — thiếu 2 dòng này thì ngày cưới bị rơi xuống nhánh
  // extra_data ở cuối, lưu vào extra_data.ceremony_date thay vì cột invitations.ceremony_date
  // thật, nên bấm lưu xong ngày cưới KHÔNG đổi (buildMergedData ưu tiên cột thật, luôn đè
  // lên extra_data khi gộp dữ liệu).
  if (fieldKey === 'ceremony_date') return { scope: 'invitation', column: 'ceremony_date', widget: 'datetime' }
  if (fieldKey === 'reception_date') return { scope: 'invitation', column: 'reception_date', widget: 'date' }
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
    var host = document.getElementById('SECTION8');
    if (!host) return;
    var container = host.querySelector('.ladi-container') || host;
    var raw = data && data.ceremony_date;
    var d = raw ? new Date(raw) : null;
    if (!d || isNaN(d.getTime())) return;
    var year = d.getUTCFullYear();
    var month = d.getUTCMonth();
    var weddingDay = d.getUTCDate();

    // Ẩn toàn bộ ô lịch tĩnh của mẫu (mọi headline trong SECTION8 + vệt trang trí).
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
    { t: '16:00', label: 'Đón khách', icon: 'don-khach' },
    { t: '16:30', label: 'Khai tiệc', icon: 'khai-tiec' }
  ];

  // ---- TIMELINE + DRESS CODE (tự sinh từ extra_data.timeline / .dresscode) ---
  // Mẫu gốc chốt cứng 2–4 mốc + "Dress code" đặt tuyệt đối. Ở đây phủ 1 khối tự
  // sinh lên SECTION5 (ẩn phần cũ) NHƯNG giữ NGUYÊN font + bố cục của mẫu:
  //   - "Timeline"/"Dress code": font calligraphy của mẫu, cỡ 49px, trắng
  //   - dòng giờ/nội dung: font hẹp in hoa của mẫu, 16px, trắng
  //   - đường kẻ dọc + chấm tròn + icon bên trái, chữ bên phải như mẫu
  var TL_FONT_HEAD = 'MUZUViWSVAtUEVSRkVDVEtQFMTElHUkFQSFkuVFRG, "Prata", "Tinos", serif';
  var TL_FONT_ITEM = 'MUZUVlZJUEFsYnJhRGlzcGxheSMaWdodCdGY, "Roboto", sans-serif';
  function wwTimelineItems(data) {
    var arr = data && data.timeline;
    if (Array.isArray(arr) && arr.length) return arr;
    return WW_TL_DEFAULT;
  }
  function wwDressCode(data) {
    var d = (data && data.dresscode) || {};
    return { text: d.text || '', colors: Array.isArray(d.colors) ? d.colors : [] };
  }
  function renderTimeline(data) {
    var host = document.getElementById('SECTION5');
    if (!host) return;
    var container = host.querySelector('.ladi-container') || host;
    // Ẩn nội dung tĩnh (giữ ảnh nền IMAGE18 + lớp phủ BOX4).
    var statics = host.querySelectorAll('[id^="HEADLINE"], [id^="LINE"], [id^="GROUP"], [id^="IMAGE"]:not(#IMAGE18), [id^="BOX"]:not(#BOX4), [id^="SHAPE"]');
    for (var s = 0; s < statics.length; s++) statics[s].style.setProperty('visibility', 'hidden', 'important');

    var items = wwTimelineItems(data);
    var dress = wwDressCode(data);
    var wrap = document.getElementById('ww-timeline');
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'ww-timeline'; container.appendChild(wrap); }

    var rows = '';
    for (var i = 0; i < items.length; i++) {
      var it = items[i] || {};
      rows += '<div class="ww-tl-row">' +
        '<span class="ww-tl-ic">' + (it.icon && WW_ICONS[it.icon] ? wwIconSvg(it.icon) : '') + '</span>' +
        '<span class="ww-tl-txt"><span class="ww-tl-time">' + esc(it.t || '') + '</span>' +
        '<span class="ww-tl-label">' + esc(it.label || '') + '</span></span>' +
      '</div>';
    }
    var swatches = '';
    for (var c = 0; c < dress.colors.length; c++) {
      swatches += '<span class="ww-dc-sw" style="background:' + esc(dress.colors[c]) + '"></span>';
    }
    var dressBlock = (dress.text || dress.colors.length || EDIT_MODE)
      ? '<div class="ww-tl-dress">' +
          '<span class="ww-dc-head">Dress code</span>' +
          (dress.text ? '<span class="ww-dc-text">' + esc(dress.text) + '</span>' : '') +
          (swatches ? '<span class="ww-dc-row">' + swatches + '</span>' : '') +
          (EDIT_MODE ? '<button type="button" class="ww-tl-btn" data-edit-dc>🎨 Sửa dress code</button>' : '') +
        '</div>'
      : '';

    wrap.innerHTML =
      '<div class="ww-tl-title">Timeline</div>' +
      (EDIT_MODE ? '<button type="button" class="ww-tl-btn ww-tl-btn-top" data-edit-tl>✏️ Sửa lịch trình</button>' : '') +
      '<div class="ww-tl-items">' + rows + '</div>' +
      dressBlock;
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

    var hrefEls = document.querySelectorAll('[data-field-href]');
    for (var j = 0; j < hrefEls.length; j++) {
      var hrefEl = hrefEls[j];
      var hrefValue = getPath(data, hrefEl.getAttribute('data-field-href'));
      if (hrefValue) hrefEl.setAttribute('href', hrefValue);
    }

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
      var item = idxAttr !== null ? filtered[Number(idxAttr)] : filtered[0];
      // Ô ảnh "điểm nhấn" rời (IMAGE1/IMAGE8/IMAGE12/BOX26 — dùng chung image_type
      // "gallery" với data-image-index) — chủ thiệp bấm trực tiếp để tải: khớp theo
      // ĐÚNG sort_order = index (ảnh lưu với sort_order đó) trước, không có mới rơi
      // về vị trí thứ N trong album. Trước đây chỉ khớp theo vị trí nên tải thẳng
      // vào ô này thì ảnh không hiện (album ít ảnh -> filtered[N] rỗng).
      if (idxAttr !== null && !(imgEl.closest && imgEl.closest('#GALLERY1'))) {
        var exact = null;
        for (var ei = 0; ei < filtered.length; ei++) {
          if ((filtered[ei].sort_order || 0) === Number(idxAttr)) { exact = filtered[ei]; break; }
        }
        if (exact) item = exact;
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
        // Chưa có ảnh thật: ở chế độ sửa thì thay ảnh mẫu có sẵn trong file template bằng
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
      var isPriority = (k === 0) || item.is_cover === true;
      var IMG = window.__weddingWebImage;
      if (imgEl.tagName === 'IMG') {
        imgEl.style.removeProperty('object-fit');
        imgEl.style.removeProperty('background-color');
        if (IMG) { IMG.applyImg(imgEl, item, isPriority); }
        else { imgEl.src = item.image_url; }
      } else if (IMG) {
        IMG.applyBackground(bgTarget, item, isPriority);
      } else {
        // Mẫu kiểu Ladipage vẽ ảnh bằng CSS background-image trên .ladi-image-background
        // hoặc .ladi-box (không phải <img>) — dò theo thứ tự, phần tử gốc là fallback cuối.
        bgTarget.style.removeProperty('background-size');
        bgTarget.style.removeProperty('background-color');
        bgTarget.style.setProperty('background-image', 'url("' + item.image_url + '")', 'important');
      }
    }

    try { renderCeremonyCalendar(data); } catch (e) {}
    try { renderTimeline(data); } catch (e) {}
    try { renderQrPopup(data); } catch (e) {}

    if (data.music_url) {
      var audioEl = document.querySelector('audio:not([data-skip-auto-music])');
      if (audioEl) audioEl.src = data.music_url;
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
    '.ww-sheet{width:min(400px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.35);font-family:-apple-system,system-ui,sans-serif;color:#1f1917}' +
    '.ww-sheet-hd{padding:15px 18px;border-bottom:1px solid #eee;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:space-between}' +
    '.ww-sheet-hd button{border:none;background:#f2ede7;width:26px;height:26px;border-radius:8px;cursor:pointer;font-size:15px;line-height:1}' +
    '.ww-sheet-bd{padding:14px 18px;display:flex;flex-direction:column;gap:12px}' +
    '.ww-tl-erow{display:grid;grid-template-columns:48px 96px 1fr 30px;gap:8px;align-items:center}' +
    '.ww-tl-erow .ww-ipick{width:48px;height:48px;border:1px solid #ddd;border-radius:10px;background:#faf7f2;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}' +
    '.ww-tl-erow .ww-ipick .ww-ic{width:26px;height:26px;color:#5a463c}' +
    '.ww-sheet input[type=text],.ww-sheet input[type=time],.ww-sheet textarea{width:100%;border:1px solid #ddd;border-radius:8px;padding:8px;font:inherit;font-size:13px;box-sizing:border-box}' +
    '.ww-tl-erow .ww-del{border:none;background:#f6eceb;color:#c0392b;border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:16px}' +
    '.ww-sheet .ww-add{border:1px dashed #c9b592;background:#faf7f2;color:#8a6b45;border-radius:10px;padding:9px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}' +
    '.ww-sheet-ft{display:flex;gap:8px;padding:12px 18px 16px}' +
    '.ww-sheet-ft button{flex:1;border:none;border-radius:10px;padding:10px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}' +
    '.ww-sheet-ok{background:linear-gradient(135deg,#e58d6f,#c96547);color:#fff}' +
    '.ww-sheet-cancel{background:#f2ede7;color:#555}' +
    '.ww-ipgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}' +
    '.ww-ipgrid button{border:1px solid #e6ded2;border-radius:10px;background:#fff;padding:10px 4px 6px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px}' +
    '.ww-ipgrid button.on{border-color:#c96547;background:#fbefe9}' +
    '.ww-ipgrid button .ww-ic{width:28px;height:28px;color:#3a2f27}' +
    '.ww-ipgrid button span{font-size:9px;line-height:1.2;text-align:center;color:#8a7d6e}' +
    '.ww-dc-erow{display:flex;align-items:center;gap:8px}' +
    '.ww-dc-erow input[type=color]{width:44px;height:34px;border:1px solid #ddd;border-radius:8px;padding:2px;cursor:pointer;background:#fff}';
  (document.head || document.documentElement).appendChild(WW_CAL_STYLE);

  applyAll(window.invitationData);
  window.__weddingWebReinject = applyAll;

  window.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'wedding-web:data-updated') {
      applyAll(event.data.data);
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
    '[data-field] { position: relative !important; z-index: 90001 !important; outline: 1px dashed rgba(124,58,237,.4) !important; outline-offset: 1px; }' +
    '[data-field-href] { outline: 1px dashed rgba(124,58,237,.35) !important; outline-offset: 1px; }' +
    '[data-image] { outline: 1px dashed rgba(124,58,237,.35) !important; outline-offset: 1px; }' +
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
      if (node.closest && node.closest('[data-edit-tl]')) return { kind: 'timeline', el: node, label: '✏️ Sửa lịch trình' };
      var dress = node.closest && node.closest('.ww-tl-dress');
      if (dress) return { kind: 'dress', el: dress, label: '🎨 Sửa dress code' };
      var tlrow = node.closest && node.closest('.ww-tl-row, .ww-tl-items');
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
        if (!wwCanEdit(f.getAttribute('data-field'))) return null;
        return { kind: 'field', el: f, label: isDateField(f.getAttribute('data-field')) ? '📅 Đổi ngày' : '✏️ Sửa chữ' };
      }
      var h = node.closest && node.closest('[data-field-href]');
      if (h) return { kind: 'href', el: h, label: '🔗 Sửa link' };
      var im = node.closest && node.closest('[data-image]');
      if (im) {
        if (!wwCanChangeImage(im.getAttribute('data-image'))) return null;
        return { kind: 'image', el: im, label: isBankQrField(im.getAttribute('data-image')) ? '📷 Đổi mã QR' : '🖼️ Đổi ảnh' };
      }
      var cal = node.closest && node.closest('#ww-cal');
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
    'bride.father_bride','bride.mother_bride','bride.address',
    'ceremony_short','ceremony_weekday','ceremony_time_weekday','ceremony_day','ceremony_month','ceremony_year',
    'ceremony_lunar_text','venue_address','venue_name','map_url',
    'reception_short','reception_weekday','reception_time_weekday','reception_time',
    'reception_day','reception_month','reception_year','reception_lunar_text',
    'reception_venue_address','reception_venue_name','reception_map_url',
    'thank_you_message','title_vi','extra_notes'];

  // Thông tin ngân hàng KHÔNG BAO GIỜ sửa tại chỗ — đi qua panel quét mã QR, vì
  // số tài khoản gõ tay sẽ lệch với mã QR đang hiện.
  var WW_NEVER_EDITABLE = ['groom.bank_name','groom.bank_account_name','groom.bank_account_number',
    'bride.bank_name','bride.bank_account_name','bride.bank_account_number'];

  function wwCanEdit(field) {
    if (!field) return false;
    if (WW_NEVER_EDITABLE.indexOf(field) !== -1) return false;
    var allow = window.__weddingWebEditable;
    // null/undefined = admin chưa cấu hình -> dùng bộ mặc định.
    if (allow == null) return WW_DEFAULT_EDITABLE.indexOf(field) !== -1;
    if (!Array.isArray(allow)) return false;
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
    var titleTxt = group === 'ceremony' ? 'Chọn ngày & giờ Lễ cưới' : 'Chọn ngày Đãi tiệc';
    mask.innerHTML =
      '<div class="ww-dp">' +
        '<div class="ww-dp-hd"><span>' + titleTxt + '</span><button data-x>&times;</button></div>' +
        '<div class="ww-dp-bd">' +
          '<div class="ww-dp-nav"><button data-prev>&lsaquo;</button><span data-mlabel></span><button data-next>&rsaquo;</button></div>' +
          '<div class="ww-dp-grid" data-grid></div>' +
          (group === 'ceremony'
            ? '<div class="ww-dp-time">🕒 <input type="time" data-time value="' + hh + ':' + mi + '"></div>'
            : '') +
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
        var parts = t2 ? String(t2.value || '16:00').split(':') : ['16', '00'];
        var iso = sel.y + '-' + pad(sel.m + 1) + '-' + pad(sel.d);
        if (group === 'ceremony') {
          post({ field: 'ceremony_date', kind: 'field', value: iso + 'T' + pad(parts[0]) + ':' + pad(parts[1]) + ':00Z' });
        } else {
          post({ field: 'reception_date', kind: 'field', value: iso });
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

    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // Album ảnh cho phép chọn nhiều file 1 lần -> trình sửa xử lý cắt tuần tự.
    if (field === 'gallery') input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', function () {
      var files = input.files ? Array.prototype.slice.call(input.files) : [];
      document.body.removeChild(input);
      if (!files.length) return;
      var ratio = elRatio(el);
      if (field === 'gallery' && files.length > 1) {
        post({ field: field, kind: 'image-batch', files: files, ratio: ratio });
      } else {
        post({
          field: field,
          kind: 'image',
          index: idxAttr !== null ? Number(idxAttr) : null,
          file: files[0],
          ratio: ratio,
        });
      }
    });

    input.click();
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
    return '<div class="ww-tl-erow" data-icon="' + (it.icon || '') + '">' +
      '<button type="button" class="ww-ipick">' + (it.icon && WW_ICONS[it.icon] ? wwIconSvg(it.icon) : '<span style="font-size:18px;color:#c9b592">+</span>') + '</button>' +
      '<input type="time" class="ww-t" value="' + (it.t || '') + '">' +
      '<input type="text" class="ww-l" placeholder="Nội dung mốc" value="' + esc(it.label || '').replace(/"/g, '&quot;') + '">' +
      '<button type="button" class="ww-del">&times;</button>' +
    '</div>';
  }

  function openTimelineEditor() {
    var data = window.invitationData || {};
    var items = wwTimelineItems(data);
    var rows = items.map(tlRowHtml).join('');
    var body = '<div class="ww-tl-rows">' + rows + '</div><button type="button" class="ww-add" data-add>+ Thêm mốc</button>';
    var mask = sheet('Lịch trình timeline', body, function (m) {
      var out = [];
      m.querySelectorAll('.ww-tl-erow').forEach(function (r) {
        var t = r.querySelector('.ww-t').value.trim();
        var l = r.querySelector('.ww-l').value.trim();
        var ic = r.getAttribute('data-icon') || '';
        if (t || l) out.push({ t: t, label: l, icon: ic });
      });
      post({ field: 'timeline', kind: 'field', value: out });
    });
    var rowsBox = mask.querySelector('.ww-tl-rows');
    mask.addEventListener('click', function (ev) {
      if (ev.target.closest && ev.target.closest('[data-add]')) {
        rowsBox.insertAdjacentHTML('beforeend', tlRowHtml({ t: '', label: '', icon: '' }));
        return;
      }
      var del = ev.target.closest && ev.target.closest('.ww-del');
      if (del) { del.closest('.ww-tl-erow').remove(); return; }
      var pick = ev.target.closest && ev.target.closest('.ww-ipick');
      if (pick) {
        var row = pick.closest('.ww-tl-erow');
        openIconPicker(row.getAttribute('data-icon') || '', function (id) {
          row.setAttribute('data-icon', id || '');
          pick.innerHTML = id && WW_ICONS[id] ? wwIconSvg(id) : '<span style="font-size:18px;color:#c9b592">+</span>';
        });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Popup sửa DRESS CODE — nội dung + bảng màu (chọn màu RGB tự do).
  // ---------------------------------------------------------------------------
  function dcRowHtml(hex) {
    return '<div class="ww-dc-erow"><input type="color" class="ww-c" value="' + (/^#[0-9a-fA-F]{6}$/.test(hex || '') ? hex : '#c8a06a') + '"><button type="button" class="ww-del">&times;</button></div>';
  }
  function openDressEditor() {
    var data = window.invitationData || {};
    var dc = wwDressCode(data);
    var body =
      '<label style="font-size:12px;color:#6e625c;font-weight:600">Nội dung</label>' +
      '<textarea class="ww-dc-t" rows="3" placeholder="VD: Trang phục lịch sự, ưu tiên tông màu ...">' + esc(dc.text) + '</textarea>' +
      '<label style="font-size:12px;color:#6e625c;font-weight:600">Bảng màu gợi ý</label>' +
      '<div class="ww-dc-colors">' + (dc.colors.length ? dc.colors.map(dcRowHtml).join('') : dcRowHtml('#c8a06a')) + '</div>' +
      '<button type="button" class="ww-add" data-addc>+ Thêm màu</button>';
    var mask = sheet('Dress code', body, function (m) {
      var text = m.querySelector('.ww-dc-t').value.trim();
      var colors = [];
      m.querySelectorAll('.ww-c').forEach(function (c) { colors.push(c.value); });
      post({ field: 'dresscode', kind: 'field', value: { text: text, colors: colors } });
    });
    var box = mask.querySelector('.ww-dc-colors');
    mask.addEventListener('click', function (ev) {
      if (ev.target.closest && ev.target.closest('[data-addc]')) { box.insertAdjacentHTML('beforeend', dcRowHtml('#8a1420')); return; }
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
  const baseHref = templateBaseUrl ? new URL('.', templateBaseUrl).href : ''

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
    img[data-image]:not(.ww-img-loaded) { filter: blur(6px); }
    img[data-image].ww-img-loaded { filter: none; }
    [data-image]:not(img):not(.ww-img-loaded) { filter: blur(4px); transition: filter .35s ease; }
    [data-image].ww-img-loaded { filter: none; }
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

  let output = htmlContent

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
