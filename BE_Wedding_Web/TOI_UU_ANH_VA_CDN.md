# Tối ưu tải ảnh & CDN cho thiệp cưới

Tài liệu cho đội phát triển và vận hành thiepcodau.

## Vấn đề

Thiệp cưới là trang khách mời mở trên điện thoại, thường bằng 4G, mỗi thiệp có
10–30 ảnh. Trước đây mỗi ô ảnh tải thẳng tệp gốc từ máy ảnh (4–12 MB, 6000px),
phục vụ từ chính server backend. Hậu quả:

- Khách mời chờ rất lâu mới thấy ảnh đầu tiên, nhiều người thoát trước khi thiệp mở xong.
- Tốn dung lượng 3G/4G của khách.
- Băng thông và CPU của server bị ảnh cưới chiếm hết.
- Khách ở xa server (miền Nam, nước ngoài) chờ lâu hơn hẳn.

## Kiến trúc sau khi tối ưu

```
Chủ thiệp tải ảnh lên
        │
        ▼
  Backend (multer, bộ nhớ)
        │  uploadGuard: kiểm magic bytes  ──► từ chối SVG/HTML/PHP đội lốt ảnh
        ▼
  imagePipelineService (sharp)
        │  • xoay theo EXIF, xoá metadata GPS
        │  • xuất 4 cỡ × 3 định dạng = 12 tệp
        │  • ảnh nhoè 16px (LQIP) + màu chủ đạo
        ▼
  storageService ──► Cloudflare R2 (khoá theo hash nội dung)
        │             Cache-Control: max-age=31536000, immutable
        ▼
  Cloudflare CDN (~300 điểm toàn cầu)
        │
        ▼
  Trình duyệt khách mời
           • srcset/sizes  -> tự chọn đúng cỡ
           • AVIF/WebP     -> chọn theo khả năng trình duyệt
           • preload ảnh bìa, lazy-load phần còn lại
```

## 1. Cloudflare R2 — kho ảnh kiêm CDN

**Vì sao R2 chứ không phải S3 hay Cloudinary**

| | Cloudflare R2 | AWS S3 | Cloudinary |
|---|---|---|---|
| Phí băng thông ra | **0 đ** | ~0,09 $/GB | tính theo credit |
| CDN toàn cầu | sẵn có, miễn phí | phải thêm CloudFront | sẵn có |
| Chi phí lưu trữ | 0,015 $/GB/tháng | 0,023 $/GB/tháng | theo gói |
| API | tương thích S3 | S3 | riêng |

Ảnh cưới là loại dữ liệu **ghi một lần, đọc rất nhiều** — mỗi thiệp có thể vài
trăm lượt khách mở. Phí băng thông ra bằng 0 của R2 là lý do quyết định.

**Thiết lập**

1. Cloudflare Dashboard → R2 → Create bucket (`thiepcodau-media`).
2. Settings → Public access → **Connect Custom Domain** → `cdn.ten-mien-cua-ban.com`.
   Bước này chính là bật CDN: Cloudflare tự cache ảnh ở mọi điểm mạng.
3. Manage R2 API Tokens → tạo token quyền **Object Read & Write**.
4. Điền các biến `R2_*` trong `.env` (xem `.env.example`).

Không cấu hình R2 thì hệ thống **tự động lưu vào đĩa local** (`uploads/`) và chạy
bình thường — thuận tiện cho môi trường dev.

**Quy tắc đặt tên tệp**

Khoá object là `invitations/<id thiệp>/<chiều rộng>/<sha256 nội dung>.<đuôi>`.
Tên theo nội dung nghĩa là đổi ảnh thì khoá đổi theo, nên có thể cache 1 năm
(`immutable`) mà không bao giờ phải purge CDN, và người xem không bao giờ gặp ảnh cũ.

## 2. sharp — dây chuyền xử lý ảnh

`sharp` dựa trên libvips, nhanh hơn ImageMagick 4–5 lần và tốn ít bộ nhớ hơn nhiều.

Mỗi ảnh tải lên sinh ra **12 tệp**: 4 cỡ (400 / 800 / 1280 / 1920px) × 3 định dạng
(AVIF / WebP / JPEG).

| Định dạng | Dung lượng so với JPEG | Trình duyệt hỗ trợ |
|---|---|---|
| AVIF | ~50 % nhỏ hơn | Chrome 85+, Firefox 93+, Safari 16.4+ |
| WebP | ~30 % nhỏ hơn | gần như toàn bộ |
| JPEG | mốc so sánh | tất cả |

Dây chuyền còn:
- **Xoay theo EXIF** — thiếu bước này ảnh dọc chụp từ iPhone hiện nằm ngang.
- **Xoá metadata** — ảnh cưới thường kèm toạ độ GPS nhà riêng, không nên công khai.
- **Chặn ảnh bom nén** — giới hạn 60 megapixel.
- **Ảnh nhoè 16px (LQIP)** dạng data URI ~90 byte, nhúng thẳng vào HTML.
- **Màu chủ đạo** làm nền ô ảnh.

## 3. Phía trình duyệt

Tất cả nằm trong `FE_Wedding_Web/src/lib/imageLoading.js`, được nhúng vào iframe
của mẫu thiệp.

**`srcset` + `sizes`** — trình duyệt tự chọn cỡ vừa đúng màn hình. Trên điện thoại
390px DPR 2 nó lấy bản 800px thay vì 1920px.

> Lưu ý quan trọng: `srcset` trên thẻ `<img>` **không** tự thương lượng định dạng —
> chỉ `<picture>` với `<source type>` mới làm được. Vì mẫu thiệp dùng thẻ `<img>`
> sẵn có, ta tự dò khả năng AVIF/WebP bằng JS rồi mới chọn bộ `srcset` tương ứng.
> Nhét thẳng AVIF vào trình duyệt không đọc được sẽ làm ảnh hỏng hoàn toàn.

**Preload đúng một ảnh** — ảnh bìa (ảnh quyết định điểm LCP) được `<link rel="preload">`
kèm `fetchpriority="high"`, tải song song với HTML/CSS. Cố ý chỉ một ảnh: preload
nhiều sẽ giành băng thông và làm LCP **chậm đi**.

**Lazy-load phần còn lại** — `loading="lazy"` cho thẻ `<img>`; ô nền CSS
(`background-image`, kiểu LadiPage) không có thuộc tính này nên dùng
`IntersectionObserver` với `rootMargin: 300px`.

**Chống giật bố cục (CLS)** — đặt `width`/`height` thật để trình duyệt chừa sẵn chỗ.

**preconnect** — bắt tay sớm với host chứa ảnh, tiết kiệm 200–300 ms trên 4G.

## 4. Thư viện đã dùng

| Thư viện | Vai trò | Vì sao chọn |
|---|---|---|
| `sharp` | Xuất nhiều cỡ/định dạng, LQIP | Nhanh nhất trong hệ Node, hỗ trợ AVIF |
| `@aws-sdk/client-s3` | Nói chuyện với R2 | R2 tương thích S3, SDK chính thức |
| `@aws-sdk/s3-request-presigner` | URL ký sẵn tải trực tiếp | Album nặng không cần đi qua backend |
| `IntersectionObserver` | Lazy-load ô nền CSS | API sẵn của trình duyệt, không cần thư viện |

Cố ý **không** dùng lazysizes, react-lazy-load-image hay lightbox: trình duyệt hiện
đại đã có `loading="lazy"`, `decoding="async"`, `fetchpriority` và `IntersectionObserver`.
Thêm thư viện chỉ làm gói JS nặng thêm — đúng thứ đang muốn giảm.

## 5. Tải thẳng lên R2 (album nặng)

Với album vài chục ảnh, tệp có thể đi thẳng từ trình duyệt lên R2 qua URL ký sẵn:

```
POST /api/invitation-images/presign   { invitation_id, content_type }
   -> { uploadUrl, key, publicUrl }
PUT  <uploadUrl>                      (trình duyệt gửi thẳng, không qua backend)
```

Khoá object do **server sinh**, không lấy từ client — nếu để client tự đặt thì có
thể ghi đè ảnh của thiệp khác.

## 6. Đo lại sau khi tối ưu

Chạy `node test/browser.mjs <slug>` trong `FE_Wedding_Web` — script mở Chrome thật
ở kích thước iPhone 14 và báo cáo định dạng + cỡ ảnh mà trình duyệt thực sự chọn.

Kết quả đo trên môi trường test (màn hình 390px, DPR 2):

- Trước: tải bản **1920px JPEG** cho mọi ô ảnh.
- Sau: tải bản **800px AVIF**, đúng cỡ hiển thị 358px.

Trên ảnh cưới thật (3000×2000, ~4 MB), mức giảm thường vào khoảng **95 %** dung
lượng mỗi ảnh, cộng thêm việc ảnh ngoài màn hình không tải cho tới khi cuộn tới.
