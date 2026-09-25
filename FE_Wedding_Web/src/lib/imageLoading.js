// Tối ưu tải ảnh cho thiệp cưới.
//
// Vì sao cần: thiệp là trang khách mời mở trên điện thoại, thường bằng 4G, và mỗi
// thiệp có 10-30 ảnh cưới. Trước đây mỗi ô ảnh tải thẳng tệp gốc (4-12 MB, 6000px)
// nên mở thiệp phải chờ rất lâu và tốn dung lượng của khách.
//
// Ba việc tệp này lo:
//   1. srcset/sizes  — trình duyệt tự chọn cỡ ảnh vừa đúng màn hình (400w cho điện
//                      thoại thay vì 1920w), và ưu tiên AVIF/WebP nếu hỗ trợ.
//   2. Ảnh nhoè LQIP — hiện ngay khối màu đúng bố cục trong lúc ảnh thật đang tải,
//                      kèm aspect-ratio nên không bị giật bố cục (CLS).
//   3. Lazy-load     — chỉ tải ảnh sắp lọt vào tầm nhìn; ảnh đầu tiên thì ngược lại,
//                      được ưu tiên cao nhất vì đó là ảnh quyết định điểm LCP.

// Điểm gãy phải khớp với WIDTHS trong BE imagePipelineService.js.
export const IMAGE_WIDTHS = [400, 800, 1280, 1920]

// sizes mặc định: ảnh trong thiệp gần như luôn tràn chiều ngang màn hình.
// Trình duyệt dùng chuỗi này để CHỌN cỡ trước khi CSS được áp, nên phải khai báo
// tường minh — thiếu nó thì trình duyệt mặc định coi ảnh rộng 100vw và tải bản lớn nhất.
export const DEFAULT_SIZES = '(max-width: 480px) 92vw, (max-width: 1024px) 88vw, 1200px'

// Gom srcset từ dữ liệu BE trả về. BE đã tính sẵn srcset_avif/webp/jpeg, nhưng vẫn
// dựng lại từ `variants` để phòng khi ảnh cũ chưa có các trường đó.
const srcsetFrom = (list) => (Array.isArray(list) && list.length
  ? list.map((v) => `${v.url} ${v.width}w`).join(', ')
  : null)

export const imageSources = (img) => {
  if (!img) return null
  const variants = img.variants || null
  return {
    avif: img.srcset_avif || (variants ? srcsetFrom(variants.avif) : null),
    webp: img.srcset_webp || (variants ? srcsetFrom(variants.webp) : null),
    jpeg: img.srcset_jpeg || (variants ? srcsetFrom(variants.jpeg) : null),
    src: img.image_url,
    width: img.width || null,
    height: img.height || null,
    blur: img.blur_data_url || null,
    color: img.dominant_color || null,
  }
}

// Danh sách host cần bắt tay sớm (DNS + TLS) để ảnh đầu tiên không mất 200-300ms
// chỉ để mở kết nối. Lấy từ chính URL ảnh nên tự đúng dù đổi CDN.
export const preconnectOrigins = (images = []) => {
  const set = new Set()
  for (const img of images) {
    const url = img && img.image_url
    if (!url || !/^https?:\/\//i.test(url)) continue
    try { set.add(new URL(url).origin) } catch { /* URL hỏng thì bỏ qua */ }
  }
  return [...set]
}

// Ảnh LCP: ảnh bìa, hoặc ảnh đầu tiên theo sort_order. Chỉ ảnh này được preload +
// fetchpriority=high; preload thêm ảnh khác sẽ giành băng thông và làm CHẬM LCP.
export const findLcpImage = (images = []) => {
  if (!Array.isArray(images) || !images.length) return null
  const cover = images.find((i) => i && i.is_cover && i.image_url)
  if (cover) return cover
  const sorted = [...images]
    .filter((i) => i && i.image_url)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  return sorted[0] || null
}

// ---------------------------------------------------------------------------
// Script chạy BÊN TRONG iframe của mẫu thiệp.
//
// Trả về chuỗi JS được nhúng vào tài liệu iframe (xem templateEngine.buildIframeDocument).
// Viết bằng ES5 vì mẫu thiệp có thể chạy trên trình duyệt cũ của khách mời.
// ---------------------------------------------------------------------------
export const buildImageLoadingScript = () => `
(function () {
  var SIZES = ${JSON.stringify(DEFAULT_SIZES)};

  // Trình duyệt có hỗ trợ lazy-load gốc không. Có thì dùng thẳng, rẻ hơn IntersectionObserver.
  var NATIVE_LAZY = 'loading' in HTMLImageElement.prototype;

  // Dò định dạng ảnh mà trình duyệt hỗ trợ.
  //
  // QUAN TRỌNG: srcset trên thẻ <img> KHÔNG tự thương lượng định dạng (chỉ <picture>
  // với <source type> mới làm được). Nhét srcset toàn AVIF vào một trình duyệt không
  // đọc được AVIF thì ảnh hỏng hoàn toàn, không có đường lui. Vì vậy phải tự dò rồi
  // chọn đúng bộ srcset. canvas.toDataURL trả về 'data:image/png' khi không hỗ trợ.
  var FORMAT = (function () {
    try {
      var c = document.createElement('canvas');
      c.width = 1; c.height = 1;
      if (c.toDataURL('image/webp').indexOf('data:image/webp') === 0) return 'webp';
    } catch (e) { /* canvas bị chặn -> dùng jpeg cho chắc */ }
    return 'jpeg';
  })();

  // AVIF phải dò bằng cách giải mã thật (canvas không mã hoá được AVIF).
  // Dò không đồng bộ: chưa có kết quả thì tạm dùng WebP, xong thì nâng cấp cho ảnh sau.
  var AVIF_OK = false;
  (function () {
    var probe = new Image();
    probe.onload = function () { AVIF_OK = probe.width > 0; };
    probe.onerror = function () { AVIF_OK = false; };
    probe.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=';
  })();

  // Chọn bộ srcset hợp với trình duyệt, theo thứ tự ưu tiên nén tốt nhất.
  function pickSrcset(item) {
    if (AVIF_OK && item.srcset_avif) return item.srcset_avif;
    if (FORMAT === 'webp' && item.srcset_webp) return item.srcset_webp;
    return item.srcset_jpeg || item.srcset_webp || item.srcset_avif || null;
  }

  // Một IntersectionObserver dùng chung cho mọi ô ảnh nền (CSS background-image
  // không có thuộc tính loading="lazy" nên phải tự làm). rootMargin 300px = bắt đầu
  // tải khi ảnh còn cách màn hình ~1 lần vuốt, đủ sớm để khách không thấy ô trống.
  var bgObserver = null;
  function observeBackground(el, url) {
    if (!('IntersectionObserver' in window)) {
      el.style.setProperty('background-image', 'url("' + url + '")', 'important');
      return;
    }
    if (!bgObserver) {
      bgObserver = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (!entries[i].isIntersecting) continue;
          var t = entries[i].target;
          var u = t.getAttribute('data-bg-src');
          if (u) {
            // Tải trước vào bộ nhớ rồi mới gán -> không thấy cảnh ảnh vẽ dở từ trên xuống.
            var pre = new Image();
            pre.onload = function () {
              t.style.setProperty('background-image', 'url("' + u + '")', 'important');
              t.classList.add('ww-img-loaded');
            };
            pre.src = u;
            t.removeAttribute('data-bg-src');
          }
          bgObserver.unobserve(t);
        }
      }, { rootMargin: '300px 0px', threshold: 0.01 });
    }
    el.setAttribute('data-bg-src', url);
    bgObserver.observe(el);
  }

  // Đặt ảnh cho thẻ <img>: srcset nhiều cỡ + lazy + chống giật bố cục.
  // priority=true dành riêng cho ảnh LCP (ảnh bìa) — tải ngay, ưu tiên cao nhất.
  function applyImg(el, item, priority) {
    var srcset = pickSrcset(item);
    if (srcset) {
      el.setAttribute('srcset', srcset);
      el.setAttribute('sizes', SIZES);
    }
    el.src = item.image_url;

    // width/height thật -> trình duyệt chừa sẵn đúng chỗ, ảnh tải xong không đẩy
    // nội dung bên dưới nhảy xuống (Cumulative Layout Shift).
    if (item.width && item.height && !el.getAttribute('width')) {
      el.setAttribute('width', item.width);
      el.setAttribute('height', item.height);
    }

    if (priority) {
      el.setAttribute('fetchpriority', 'high');
      el.setAttribute('loading', 'eager');
      el.removeAttribute('decoding');
    } else {
      if (NATIVE_LAZY) el.setAttribute('loading', 'lazy');
      // decoding=async: giải mã ảnh ngoài luồng chính -> cuộn không bị khựng.
      el.setAttribute('decoding', 'async');
      el.setAttribute('fetchpriority', 'low');
    }

    // Nền là ảnh nhoè (hoặc màu chủ đạo) trong lúc chờ -> không còn ô trắng.
    if (item.blur_data_url) {
      el.style.setProperty('background-image', 'url("' + item.blur_data_url + '")');
      el.style.setProperty('background-size', 'cover');
      el.style.setProperty('background-position', 'center');
    } else if (item.dominant_color) {
      el.style.setProperty('background-color', item.dominant_color);
    }
    el.addEventListener('load', function () {
      el.style.removeProperty('background-image');
      el.classList.add('ww-img-loaded');
    }, { once: true });
  }

  // Đặt ảnh cho ô vẽ bằng CSS background-image (mẫu kiểu LadiPage).
  function applyBackground(el, item, priority) {
    // Ảnh nhoè vào ngay để có cái nhìn thấy liền.
    if (item.blur_data_url) {
      el.style.setProperty('background-image', 'url("' + item.blur_data_url + '")', 'important');
      el.style.setProperty('background-size', 'cover', 'important');
    } else if (item.dominant_color) {
      el.style.setProperty('background-color', item.dominant_color, 'important');
    }

    // Ô nền không dùng được srcset -> tự chọn cỡ theo bề rộng thật của ô nhân DPR.
    var url = pickWidth(item, el.getBoundingClientRect().width);
    if (priority) {
      el.style.setProperty('background-image', 'url("' + url + '")', 'important');
      el.classList.add('ww-img-loaded');
    } else {
      observeBackground(el, url);
    }
  }

  // Chọn phiên bản nhỏ nhất vẫn đủ nét cho bề rộng hiển thị.
  function pickWidth(item, cssWidth) {
    var variants = item.variants;
    if (!variants) return item.image_url;
    var list = (AVIF_OK && variants.avif) || (FORMAT === 'webp' && variants.webp) || variants.jpeg
      || variants.webp || variants.avif;
    if (!list || !list.length) return item.image_url;
    var dpr = window.devicePixelRatio || 1;
    var need = Math.ceil((cssWidth || window.innerWidth || 400) * dpr);
    for (var i = 0; i < list.length; i++) {
      if (list[i].width >= need) return list[i].url;
    }
    return list[list.length - 1].url;
  }

  window.__weddingWebImage = {
    applyImg: applyImg,
    applyBackground: applyBackground,
    pickWidth: pickWidth,
    pickSrcset: pickSrcset,
    // Phơi ra để kiểm thử tự động xác nhận đã chọn đúng định dạng.
    support: function () { return { webp: FORMAT === 'webp', avif: AVIF_OK }; }
  };
})();
`
