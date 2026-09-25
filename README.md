# Wedding_Web — Hệ thống thiệp cưới online

Nền tảng tạo & quản lý thiệp cưới điện tử: người dùng chọn mẫu, sửa nội dung trực
tiếp trên thiệp, chia sẻ link cho khách, theo dõi xác nhận tham dự và mua thêm lượt
tạo thiệp qua chuyển khoản (SePay).

Repo gồm 2 phần chạy độc lập:

| Thư mục | Vai trò | Công nghệ |
|---|---|---|
| `BE_Wedding_Web/` | API + phục vụ gói mẫu thiệp tĩnh | Node.js, Express 5, Sequelize, PostgreSQL |
| `FE_Wedding_Web/` | Giao diện người dùng (dashboard, trình sửa thiệp, trang thiệp công khai) | React 18, Vite, React Router |

Mẫu thiệp nằm ở `BE_Wedding_Web/uploads/templates/`. Hiện có **1 giao diện hoàn
chỉnh**: `duccuong-nguyenquyet` (mẫu LadiPage, có bìa phong bì → nội dung). Thêm mẫu
mới = upload gói `.zip` qua `POST /api/invitation-templates/upload` (chỉ admin), không
cần build lại FE.

## Chạy bằng Docker (khuyến nghị)

```bash
cp BE_Wedding_Web/.env.example BE_Wedding_Web/.env   # điền secret thật
cp FE_Wedding_Web/.env.example FE_Wedding_Web/.env   # nếu có
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- PostgreSQL: cổng host `5433` (trong mạng Docker là `db:5432`)

## Chạy thủ công

### Backend

```bash
cd BE_Wedding_Web
npm install
cp .env.example .env          # cấu hình DB, JWT, Cloudinary, SePay, GMAIL_*
npm run db:migrate
npm run db:seed                # tạo tài khoản admin mặc định
npm run dev                    # http://localhost:3000
```

Tài liệu API (Swagger, chỉ admin): http://localhost:3000/api-docs

### Frontend

```bash
cd FE_Wedding_Web
npm install
echo "VITE_API_URL=http://localhost:3000" > .env.local
npm run dev                    # http://localhost:5173
```

## Tính năng chính

- Đăng nhập (JWT), phân quyền admin / user, hạn mức "slot" tạo thiệp.
- Chọn mẫu → tạo thiệp nháp → **sửa trực tiếp trên thiệp** (chạm chữ/ảnh để sửa).
- Trang thiệp công khai theo slug + link cá nhân hoá theo từng khách (`?guest=...`).
- Khách xác nhận tham dự (RSVP) + gửi lời chúc; dashboard thống kê, lọc, xuất CSV.
- Gửi thiệp qua email (Gmail) — `POST /api/mail/invitation`.
- Upload ảnh/video lên Cloudinary, nhạc nền upload local theo từng thiệp.
- **Quét QR ngân hàng** — `POST /api/bank-qr/scan`: người dùng chỉ tải lên ảnh QR,
  hệ thống tự giải mã VietQR/Napas, bóc BIN → tên ngân hàng, số tài khoản, tên chủ
  tài khoản, và **sinh lại mã QR sạch** (không dùng ảnh gốc).

### Giới hạn sửa & khoá thiệp

- Mỗi thiệp được **bấm "Lưu" tối đa 5 lần** trong trình sửa (đổi `INVITATION_MAX_EDITS`).
  Trình sửa gom mọi thay đổi text/ngày, bấm "Lưu" (có popup xác nhận, hiện số lượt
  còn lại) mới ghi 1 lần = trừ 1 lượt. Ảnh/nhạc upload ngay, không tính lượt.
- **Đổi mẫu**: không giới hạn, không tính lượt — nhưng cũng bị chặn khi thiệp đã khoá.
- Thiệp **khoá sửa** khi: hết 5 lượt, HOẶC quá **ngày cưới + 3 ngày**
  (`INVITATION_LOCK_DAYS`). Hạn này neo vào **ngày cưới GỐC** (lần đầu user chọn),
  đổi ngày sau đó không dời hạn.
- Khoá chỉ chặn **sửa** — xem / chia sẻ / RSVP / xuất CSV vẫn bình thường.
- Admin **mở khoá** lại được (reset lượt + bỏ hạn) ở trang `/admin`.

### Cấp tài khoản & trang admin

- **Tự đăng ký + mua gói SePay đang TẮT** (`ALLOW_PUBLIC_REGISTER`, `ENABLE_SLOT_PURCHASE`
  — mặc định `false`). Admin cấp tài khoản + cộng slot khi khách liên hệ.
- Trang **`/admin`** (chỉ role admin): tổng quan, quản lý tài khoản khách, quản lý mọi
  thiệp (xem, khoá/mở khoá, xoá), quản lý mẫu.
- Tab **Tài khoản khách** → nút **"Quản lý thiệp"** mở panel theo từng khách:
  danh sách thiệp của khách đó + số khách mời / RSVP mỗi thiệp + nút **"Tạo thiệp
  cho khách này"** (thiệp thuộc tài khoản khách, **không trừ lượt** của khách) →
  mở thẳng trình sửa. Mọi thứ (thiệp, khách mời, RSVP) đều gắn theo tài khoản khách,
  chỉ thao tác được sau khi bấm vào đúng khách.
- **Data isolation**: user thường chỉ thấy/sửa thiệp — và **chỉ xem RSVP / khách mời**
  của thiệp mình sở hữu (route đọc `messages-checkins` / `guests` giờ cần đăng nhập
  + kiểm chủ sở hữu); admin thấy tất cả.

### Trình sửa: QR ngân hàng · Nhạc nền · Cắt ảnh

- **QR ngân hàng (1 mã / thiệp)**: bấm ô ảnh trong mục *Quà cưới* (template gắn
  `data-image="bank_qr"`) hoặc nút **"QR Ngân Hàng"** → tải ảnh QR → hệ thống bóc
  STK / tên / ngân hàng, sinh QR chuẩn → lưu `extra_data.bank` + ảnh
  `image_type: bank_qr` (hiện ngay trong mục Quà cưới). `PATCH /invitations/:id/bank`.
- **Nhạc nền**: nút **"Nhạc Nền"** → dán 1 hoặc nhiều link nhạc, hoặc chọn từ
  **kho nhạc hệ thống**; để trống = hệ thống tự chọn 1 bài ngẫu nhiên. Lưu
  `extra_data.music_playlist` + `music_url`. `PATCH /invitations/:id/music`.
- **Cắt ảnh**: mọi lần tải ảnh trong trình sửa mở popup **crop** theo đúng tỉ lệ
  khung (đọc từ `data-image-ratio` hoặc kích thước ô) — kéo/zoom rồi cắt, không
  gửi ảnh gốc. Có nút "Dùng ảnh gốc".
- QR / nhạc **không tính** vào 5 lượt sửa; đều bị chặn khi thiệp đã khoá.

### Kho nhạc (admin)

Trang `/admin` → tab **Kho Nhạc**: tải file `.mp3` lên (lưu `media/music/`) hoặc
dán link nhạc; danh sách + nghe thử + xoá. Khách chọn từ kho này trong trình sửa.
`GET /api/music-library` (đã đăng nhập), `POST` / `DELETE` (chỉ admin).

Chi tiết endpoint: xem `BE_Wedding_Web/README.md`.

## Chạy Docker từ đâu

Thư mục OneDrive `Tài liệu` tồn tại 2 bản (khác chuẩn hoá Unicode) khiến Docker
Desktop trên Windows **không mở được build context** từ đường dẫn này. Cách chạy:

- Copy project sang đường dẫn ASCII (vd. `C:\ww`) rồi `docker compose up --build` ở đó, **hoặc**
- Chuyển hẳn project ra khỏi `OneDrive\Tài liệu\...`.

Tài khoản seed sẵn: `admin` / `admin123` (admin), `user` / `02092005` (user).
Seed mẫu + thiệp demo: `docker compose exec backend node scripts/seed-demo-invitation.js`.

## Ghi chú dọn dẹp

- Backend cũ (Express 4 ở `/src`) và site LadiPage tĩnh (`/vobe2`, các file `*.html`)
  đã được gỡ. Chức năng còn dùng (gửi email mời cưới) đã port sang
  `BE_Wedding_Web/src/services/mailService.js`.
- `BE_Wedding_Web/` trước đây là repo Git riêng
  (`github.com/Van-is-code/BE_Wedding_Web`); `.git` của nó được đổi tên thành
  `_BE_Wedding_Web_git_backup/` ở gốc repo — xoá khi không cần lịch sử đó nữa.
- Các mẫu `mausen`, `mautrangdo2`, `thiepmaucoban` đã xoá (chưa hoàn chỉnh).
- Mẫu `duccuong-nguyenquyet` đã được dọn: gỡ toàn bộ ảnh cưới của couple gốc
  (`NN_*.jpg`, `LVT*.jpg`, ảnh photomode, `chure/codau.png`, ảnh Supabase) — **261 MB → 12 MB**.
  Mọi chỗ từng hiển thị ảnh couple nay dùng `www.ziuwedding.site/images/placeholder.svg`
  ("Thêm ảnh của bạn") và `qr-placeholder.svg` ("Thêm mã QR") để hướng dẫn chủ thiệp.
  Còn thiếu: gắn thuộc tính `data-image` vào các vùng ảnh này để sửa/upload được qua
  trình sửa thiệp (hiện các vùng đó chưa nối vào editor).
- `wedding-invitation.html` (trang cũ của route `/moi-cuoi` trong BE Express 4) đã xoá.
  Mẫu còn 2 trang: `vobe2.html` (entry, khớp `html_path` trong DB) và `phongbibe2.html`
  (bìa phong bì).
