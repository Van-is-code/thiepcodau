# Cloudflare R2 — tạo, cấu hình, và nối vào hệ thống

Kho ảnh cho thiệp cưới. Đọc từ trên xuống, làm theo thứ tự, khoảng 15 phút.

> **Vì sao R2 chứ không phải chỗ khác**
> Thiệp cưới được gửi cho hàng trăm khách mời, mỗi người mở là tải ảnh về một
> lần. Khoản tốn tiền thật không phải chỗ *lưu* mà là chỗ *tải ra*. AWS S3 tính
> khoảng 0,09 USD mỗi GB tải ra; R2 **miễn phí hoàn toàn khoản đó**, chỉ tính
> ~0,015 USD/GB/tháng tiền lưu. Một album 10 GB tốn khoảng **0,15 USD/tháng**
> dù có bao nhiêu khách mời xem đi nữa.

---

## Mục lục

1. [Gói miễn phí được gì](#1-gói-miễn-phí-được-gì)
2. [Tạo tài khoản và bucket](#2-tạo-tài-khoản-và-bucket)
3. [Lấy khoá API](#3-lấy-khoá-api)
4. [Bật domain công khai](#4-bật-domain-công-khai--bắt-buộc)
5. [Mở CORS để tải thẳng](#5-mở-cors-để-trình-duyệt-tải-thẳng-lên)
6. [Điền cấu hình vào hệ thống](#6-điền-cấu-hình-vào-hệ-thống)
7. [Kiểm tra đã chạy chưa](#7-kiểm-tra-đã-chạy-chưa)
8. [Hệ thống xử lý ảnh thế nào](#8-hệ-thống-xử-lý-ảnh-thế-nào)
9. [Gặp lỗi thì xem ở đây](#9-gặp-lỗi-thì-xem-ở-đây)
10. [Chi phí và theo dõi](#10-chi-phí-và-theo-dõi)

---

## 1. Gói miễn phí được gì

Mỗi tháng, không cần thẻ tín dụng để bắt đầu:

| Khoản | Miễn phí mỗi tháng | Vượt rồi tính |
|---|---|---|
| Dung lượng lưu | **10 GB** | ~0,015 USD/GB |
| Ghi (tải lên, xoá) | 1 triệu lượt | 4,50 USD/triệu |
| Đọc (xem ảnh) | 10 triệu lượt | 0,36 USD/triệu |
| **Băng thông tải ra** | **Không giới hạn** | **0 USD** |

Quy ra thực tế: 10 GB chứa được khoảng **3.500–4.000 ảnh cưới đã xử lý**
(mỗi ảnh gốc 20 MB còn ~2,8 MB sau khi hệ thống nén và cắt cỡ). Tức khoảng
**60–70 đám cưới** với album 60 ảnh mỗi đám — vẫn nằm trong mức miễn phí.

Cloudflare có thể yêu cầu thêm thẻ để mở R2 ở một số tài khoản, nhưng không trừ
tiền khi còn trong hạn mức trên.

---

## 2. Tạo tài khoản và bucket

**Bước 1.** Vào <https://dash.cloudflare.com> → đăng ký (email + mật khẩu). Nếu đã
có tài khoản Cloudflare để trỏ domain thì dùng luôn, không cần tạo mới.

**Bước 2.** Menu trái → **R2 Object Storage**. Lần đầu sẽ hiện màn hình giới
thiệu, bấm **Purchase R2 Plan** / **Enable R2**. Có thể phải thêm thẻ để xác minh
— vẫn không bị trừ tiền khi còn trong hạn mức miễn phí.

**Bước 3.** Bấm **Create bucket**:

| Ô | Điền |
|---|---|
| Bucket name | `thiepcodau-media` |
| Location | **Automatic** (Cloudflare tự chọn nơi gần) |
| Default storage class | **Standard** |

Bấm **Create bucket**.

> Tên bucket đặt rồi **không đổi được**. Chỉ dùng chữ thường, số và dấu gạch ngang.

**Bước 4.** Ghi lại **Account ID** — ở cột phải trang R2 overview, là chuỗi 32 ký
tự hex như `8f2a...c4`. Cũng thấy được trong endpoint
`https://<account_id>.r2.cloudflarestorage.com`.

---

## 3. Lấy khoá API

Trang R2 → **Manage R2 API Tokens** (góc phải) → **Create API Token**.

| Ô | Chọn |
|---|---|
| Token name | `thiepcodau-server` |
| Permissions | **Object Read & Write** |
| Specify bucket(s) | **Apply to specific buckets** → chọn `thiepcodau-media` |
| TTL | Forever (hoặc đặt hạn rồi nhớ gia hạn) |

Bấm **Create API Token**. Màn hình kế hiện:

```
Access Key ID        : 1a2b3c4d5e6f...
Secret Access Key    : 7g8h9i0j...
```

> **Secret Access Key chỉ hiện đúng một lần.** Chép ngay vào chỗ an toàn. Mất thì
> phải tạo token mới, không xem lại được.

Đừng chọn "Apply to all buckets": khoá đó lỡ lộ là mất sạch mọi bucket, trong khi
khoá giới hạn một bucket chỉ mất đúng bucket ảnh.

---

## 4. Bật domain công khai — bắt buộc

Mặc định bucket R2 **đóng kín**, không ai xem được ảnh trong đó. Phải mở một đường
công khai, nếu không thiệp sẽ hiện ô trắng.

Bucket `thiepcodau-media` → tab **Settings** → mục **Public access**.

### Cách A — Custom domain (nên dùng)

Cần một domain đã trỏ nameserver về Cloudflare.

1. **Public access → Custom Domains → Connect Domain**
2. Nhập tên miền con, ví dụ `cdn.thiepminh.io.vn`
3. Cloudflare tự thêm bản ghi DNS và cấp chứng chỉ HTTPS, đợi 1–2 phút
4. Xong → ảnh có địa chỉ `https://cdn.thiepminh.io.vn/invitations/.../abc.avif`

Được cache trên toàn mạng Cloudflare nên khách mời ở đâu cũng tải nhanh.

### Cách B — r2.dev (chỉ để thử)

**Public access → Allow Access → r2.dev subdomain → Allow**. Được địa chỉ dạng
`https://pub-xxxxxxxx.r2.dev`.

Chạy được ngay không cần domain, **nhưng Cloudflare bóp băng thông** đường này và
không cam kết tốc độ. Thử thì được, chạy thật nên chuyển sang cách A.

Dù chọn cách nào, **chép lại địa chỉ đó** — đó là giá trị `R2_PUBLIC_BASE_URL`.

---

## 5. Mở CORS để trình duyệt tải thẳng lên

Hệ thống đẩy ảnh **thẳng từ máy khách lên R2**, không đi qua máy chủ. Với máy chủ
đặt ở nhà thì đây là khác biệt lớn: đường lên của mạng nhà thường chỉ vài Mbps,
ảnh cưới 20 MB đi qua đó là khách ngồi chờ rất lâu. Đẩy lên Cloudflare thì máy
khách nói chuyện với điểm mạng gần nhất, còn máy chủ chỉ việc kéo bản gốc về bằng
đường xuống — luôn rộng hơn đường lên.

Muốn vậy phải cho phép trình duyệt gọi sang R2: bucket → **Settings** →
**CORS policy** → **Add CORS policy**, dán vào:

```json
[
  {
    "AllowedOrigins": ["https://thiepminh.io.vn"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

Phải trùng **đúng địa chỉ người dùng gõ vào trình duyệt** — chính là `PUBLIC_URL`
trong `BE_Wedding_Web/.env`. Sai một ký tự là trình duyệt chặn mà không báo gì rõ ràng.

Đang thử trong mạng nhà thì thêm cả địa chỉ LAN:

```json
"AllowedOrigins": ["https://thiepminh.io.vn", "http://192.168.1.50:1001"]
```

> **Không bắt buộc.** Bỏ qua bước này thì hệ thống tự quay về cách cũ (tải qua máy
> chủ), vẫn chạy bình thường, chỉ chậm hơn khi tải ảnh nặng.

---

## 6. Điền cấu hình vào hệ thống

Mở `BE_Wedding_Web/.env` trên máy chủ:

```bash
STORAGE_DRIVER=r2

R2_ACCOUNT_ID=8f2a...c4                        # bước 2
R2_ACCESS_KEY_ID=1a2b3c4d5e6f...               # bước 3
R2_SECRET_ACCESS_KEY=7g8h9i0j...               # bước 3
R2_BUCKET=thiepcodau-media                     # tên bucket bước 2
R2_PUBLIC_BASE_URL=https://cdn.thiepminh.io.vn    # bước 4, KHÔNG có dấu / ở cuối
```

Áp dụng:

```bash
./deploy.sh update
```

**Cả năm biến đều bắt buộc.** Thiếu `R2_PUBLIC_BASE_URL` thì hệ thống coi như chưa
cấu hình R2 và tự quay về lưu trên ổ máy chủ — cố ý làm vậy, vì thiếu nó thì ảnh
đẩy lên được nhưng không dựng được link, thiệp hiện ô trắng mà không báo lỗi gì.
Hỏng ồn ào còn hơn hỏng im lặng.

`STORAGE_DRIVER` để trống cũng được: hệ thống tự chọn `r2` khi đủ năm biến, không
đủ thì dùng ổ cục bộ.

---

## 7. Kiểm tra đã chạy chưa

```bash
./deploy.sh doctor        # báo nếu đặt r2 mà thiếu khoá
./deploy.sh logs thiepminh-api  # xem có lỗi R2 không
```

Rồi kiểm bằng tay — đây mới là bước chắc chắn:

1. Mở trình sửa thiệp, tải lên một ảnh
2. Bấm chuột phải vào ảnh vừa hiện → **Mở ảnh trong tab mới**
3. Địa chỉ phải bắt đầu bằng `R2_PUBLIC_BASE_URL` của bạn

```
✅ https://cdn.thiepminh.io.vn/invitations/.../800/a1b2c3.avif
❌ /uploads/invitations/...        ← vẫn đang lưu cục bộ, xem lại bước 6
```

**Kiểm xem có đang đẩy thẳng không:** mở DevTools (F12) → tab Network → tải một
ảnh lên. Thấy một dòng `PUT` tới `r2.cloudflarestorage.com` là đúng. Không thấy
thì đang đi đường cũ qua máy chủ — kiểm lại CORS ở bước 5.

Vào bucket trên Cloudflare bấm **Objects** sẽ thấy các tệp vừa lên.

---

## 8. Hệ thống xử lý ảnh thế nào

Biết luồng này thì lúc gặp lỗi mới biết nhìn vào đâu.

```
Máy khách                Cloudflare R2              Máy chủ
   │                          │                        │
   │──── xin link ký sẵn ─────────────────────────────>│
   │<─── link (hạn 10 phút) ──────────────────────────│
   │                          │                        │
   │──── PUT ảnh gốc 20MB ───>│  invitations/<id>/original/...
   │                          │                        │
   │──── báo đã xong ─────────────────────────────────>│
   │                          │<── kéo bản gốc về ─────│
   │                          │                        │  kiểm đúng là ảnh (magic bytes)
   │                          │                        │  xoay theo EXIF, xoá toạ độ GPS
   │                          │                        │  tạo 4 cỡ × 3 định dạng
   │                          │<── đẩy 12 tệp lên ─────│
   │                          │── xoá bản gốc ────────>│
   │<─── thiệp hiện ảnh ──────│                        │
```

Vì sao server vẫn phải kéo bản gốc về: tệp trên R2 ngay sau bước PUT vẫn là **ảnh
gốc** — chưa ai kiểm có đúng là ảnh không, chưa xoá toạ độ GPS trong EXIF, chưa có
bản nhỏ cho điện thoại. Dùng thẳng bản đó là bắt khách mời tải 20 MB mỗi tấm.

Bản gốc **không được giữ lại**. Kho chỉ chứa 12 tệp đã xử lý, cộng một ảnh nhoè
~135 byte nhúng thẳng vào HTML để hiện ngay trong lúc ảnh thật đang tải.

**Đo thật trên ảnh cưới 19,58 MB (4541×6812):**

| | Dung lượng |
|---|---|
| Ảnh gốc | 19,58 MB |
| Tổng 12 tệp trên kho | 2,82 MB (**14%**) |
| Khách xem bằng điện thoại tải về | **61 KB** |
| Khách xem bằng máy tính tải về | **411 KB** |

Mức nén tăng dần theo cỡ: cỡ 400–800px (điện thoại) dùng mức nhẹ vì màn hình
không đủ điểm ảnh để thể hiện chi tiết mịn; cỡ 1920px nâng lên vì đó là chỗ người
ta phóng to soi lưới voan và hạt ren trên váy.

Mọi tệp được đặt tên theo mã băm nội dung và gắn
`Cache-Control: max-age=31536000, immutable` — đổi ảnh thì tên tệp đổi theo, nên
cache được một năm mà không bao giờ phải xoá cache thủ công, và khách không bao
giờ thấy ảnh cũ.

Giới hạn: **15 MB** và **60 MP** mỗi ảnh, **60 ảnh** mỗi thiệp. Đổi được bằng
`MAX_IMAGE_BYTES` và `MAX_IMAGES_PER_INVITATION`.

---

## 9. Gặp lỗi thì xem ở đây

| Hiện tượng | Nguyên nhân | Cách sửa |
|---|---|---|
| Ảnh vẫn ở `/uploads/...` | Thiếu một trong năm biến | Xem lại bước 6, rồi `./deploy.sh update` |
| `Chưa cấu hình Cloudflare R2. Thiếu: ...` | Thông báo nói thẳng biến nào thiếu | Điền đúng biến đó |
| Ảnh lên được nhưng mở ra **404** | Chưa bật public access | Làm bước 4 |
| Tải lên **403** | Token sai quyền, hoặc chỉ có Read | Tạo token mới, chọn **Object Read & Write** |
| DevTools báo lỗi CORS | `AllowedOrigins` không khớp | Phải trùng **chính xác** `PUBLIC_URL`, kể cả `http`/`https` và cổng |
| Tải lên rất chậm | Đang đi đường cũ qua máy chủ | Kiểm CORS bước 5; xem Network có dòng `PUT` sang r2 không |
| `SignatureDoesNotMatch` | Secret chép thiếu/thừa ký tự | Tạo token mới, chép lại cẩn thận |
| `NoSuchBucket` | Sai tên bucket | So `R2_BUCKET` với tên trên dashboard |
| Ảnh cũ vẫn hiện sau khi đổi | Không phải lỗi | Tên tệp theo mã băm nội dung nên đổi ảnh là đổi link; tải lại trang bằng Ctrl+F5 |
| Muốn quay về lưu cục bộ | | Đặt `STORAGE_DRIVER=local` rồi `update` |

**Ảnh cũ lưu trên máy chủ có tự chuyển sang R2 không?** Không. Đổi
`STORAGE_DRIVER` chỉ áp dụng cho ảnh tải lên **từ lúc đó về sau**. Ảnh cũ vẫn nằm
ở `uploads/` và vẫn hiện bình thường. Muốn chuyển hết thì phải tải lại từng ảnh.

---

## 10. Chi phí và theo dõi

Xem tại **R2 → bucket → Metrics**: dung lượng đang dùng, số lượt đọc/ghi.

Ước tính thực tế, mỗi thiệp 60 ảnh:

| Số đám cưới | Dung lượng | Tiền mỗi tháng |
|---|---|---|
| 10 | ~1,7 GB | 0 USD (trong hạn mức) |
| 50 | ~8,5 GB | 0 USD |
| 100 | ~17 GB | ~0,11 USD |
| 500 | ~85 GB | ~1,13 USD |

Băng thông tải ra không tính tiền, dù có bao nhiêu khách mời xem.

**Nên đặt cảnh báo:** Cloudflare → Notifications → tạo cảnh báo khi dung lượng R2
vượt ngưỡng bạn chọn, để không bị bất ngờ hoá đơn.

**Về khoá bí mật:** `BE_Wedding_Web/.env` để quyền 600 và đã nằm trong `.gitignore`.
Nghi lộ thì vào **Manage R2 API Tokens**, xoá token cũ, tạo token mới, cập nhật
env rồi `./deploy.sh restart`. Ảnh đã lưu không bị ảnh hưởng.
