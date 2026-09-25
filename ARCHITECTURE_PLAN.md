# ARCHITECTURE_PLAN — Hệ thống Cộng tác viên (CTV), Thanh toán payOS, Hoa hồng & Ví

> Tài liệu phân tích trước khi sửa code. Phạm vi: thêm cơ chế CTV / khách hàng của CTV /
> sản phẩm thiệp / giá riêng / hoa hồng / đơn hàng / thanh toán payOS / entitlement /
> ví CTV (ledger) / rút tiền (thủ công + tự động) / đối soát / audit log.
> Nguyên tắc: **mở rộng kiến trúc hiện tại, không rewrite, không tạo hệ thống song song.**

---

## 1. Current architecture

| Thành phần | Chi tiết |
|---|---|
| Backend | `BE_Wedding_Web/` — Node.js, Express 5, Sequelize 6, PostgreSQL. Phân lớp `routes/ → controllers/ → services/ → models/`. Entry `src/server.js → src/app.js`. |
| Frontend | `FE_Wedding_Web/` — React 18, Vite 5, React Router 6, axios (`src/api.js`). Token lưu `localStorage.token`. |
| Auth | JWT (`src/middlewares/auth.js`): `authenticate`, `adminOnly`, `userOrAdmin`. Payload token: `{ id, username, role }`. `role` là STRING tự do trên `users.role` — hiện dùng `'admin'` / `'user'`. |
| Migrations | `sequelize-cli`, thư mục `src/database/migrations/`, config `src/database/config.js`. Chạy `npm run db:migrate`. Docker entrypoint tự migrate. Model dùng `timestamps: false`, `created_at`/`updated_at` set tay, PK `UUID`. |
| Payment hiện tại | **SePay**. `paymentService.requestPayment` tạo `Order` + URL `qr.sepay.vn/img`. `handleWebhook` bóc `DH<orderId>` từ nội dung CK, so số tiền, set `Order.status='paid'`, tạo `Invoice`, `user.increment('slot')`. Idempotency: `Transaction.transaction_id` UNIQUE + check `order.status`. **Chưa verify chữ ký.** Đang khoá bằng `ENABLE_SLOT_PURCHASE=false`; webhook vẫn mở. |
| Entitlement hiện tại | `users.slot` (INT). `invitationService.create` / `createDraft` yêu cầu `slot > 0` rồi `user.decrement('slot', 1)`. Không tách Purchased / Used / Available. Khoá sửa: `edit_count` vs `INVITATION_MAX_EDITS`, `edit_deadline = ceremony + 3d`. |
| Admin API | `/api/admin/*` (`authenticate + adminOnly`): `stats`, users CRUD + `POST /users/:id/slots` (delta), `POST /users/:id/invitations` (tạo hộ, không trừ lượt), invitations list/lock/unlock/delete, templates. |
| Chưa có | CTV, ví/ledger, hoa hồng, payout, audit log, scheduler/cron, payOS, tách sản phẩm single/combo, "customer thuộc CTV". |

### Existing entities (giữ nguyên)

`users(id, username, password(bcrypt), role, slot)` · `invitations` (= "wedding card", `users_id`, `template_id`, `edit_count`, `edit_deadline`, …) · `grooms` · `brides` · `guests` · `messages_checkins` · `invitation_images` · `invitation_templates` · `music_tracks` · `orders(id, users_id, amount, slot_quantity, status[pending|paid|cancelled], transaction_id, transfer_content)` · `invoices(order_id, transaction_id, payment_method, paid_at)` · `transactions` (log webhook SePay).

### Existing APIs (giữ nguyên, chỉ thêm nhánh mới)

`/api/users` (register*/login/profile) · `/api/invitations` (+ `/draft`, `/:id/editor-save`, `/:id/template`, `/:id/music`, `/:id/bank`) · `/api/guests` · `/api/grooms` · `/api/brides` · `/api/messages-checkins` · `/api/invitation-templates` · `/api/media-upload` · `/api/bank-qr` · `/api/music-library` · `/api/mail` · `/api/payments` (SePay — giữ, vẫn khoá) · `/api/admin/*`.

---

## 2. Nguyên tắc nghiệp vụ đã chốt (rút gọn)

- 2 sản phẩm gốc: **single** (1 thiệp, sàn 200.000) và **combo** (2 thiệp, sàn 300.000). Không tạo sản phẩm 3/4/5 thiệp.
- Mỗi CTV có `single_price`, `combo_price`, `commission_rate` riêng. Ràng buộc `ctv_price >= admin_base_price` — validate ở **FE + controller + service** (service là nguồn chân lý).
- Khi tạo đơn: **snapshot** `product_code, admin_base_price, ctv_selling_price, commission_rate, commission_amount, ctv_earning_amount`. Admin đổi giá/% sau này **không** ảnh hưởng đơn cũ.
- Hoa hồng tính trên `ctv_selling_price`: `commission_amount = round(selling_price * commission_rate)`; `ctv_earning_amount = selling_price - commission_amount` (nền tảng giữ `commission_amount`, CTV hưởng `ctv_earning_amount`).
- Khách của CTV: tạo ra ở trạng thái `PENDING_PAYMENT` → không tạo/sửa thiệp (CTV cũng không). Sau webhook PAID → `ACTIVE`.
- Mua thêm: mỗi lần = **1 Order độc lập**. Mua 1 + mua 1 = 2× giá lẻ (KHÔNG gộp combo). Combo chỉ khi chọn combo ngay từ đầu. Không giới hạn số lần mua thêm.
- Entitlement rõ ràng: **Purchased / Used / Available**; không cho `Available < 0`.
- Tiền khách trả **vào tài khoản merchant của Admin** (payOS), không chuyển thẳng CTV. CTV tích luỹ số dư ví; Admin đối soát & chuyển khoản thủ công.
- Webhook payOS là **nguồn xác nhận duy nhất** (verify chữ ký). `returnUrl`/query/client **không** được đổi trạng thái. Webhook **idempotent**.
- `/pay/:token` mở lại nhiều lần: PAID → màn "đã thanh toán"; PENDING + link còn hạn → **QR/link cũ**; EXPIRED → cho tạo link mới **cho chính Order đó** (không tạo Customer/Order mới).
- Rút tiền (theo yêu cầu bổ sung của chủ dự án):
  - **Thủ công**: CTV tạo phiếu rút + số tiền → Admin xem ở trang quản lý → phê duyệt → tự chuyển khoản → hệ thống **trừ ví** CTV khi phê duyệt (thực ra: giữ tiền ngay lúc tạo phiếu, xem §Wallet).
  - **Tự động**: mặc định 1 thứ trong tuần, hệ thống quét, nếu ví còn tiền (≥ ngưỡng) → tự tạo phiếu rút với đúng số dư → Admin duyệt & chuyển sau.
  - Hai cơ chế chạy song song được.
- Refund: trạng thái đơn `PENDING / PAID / CANCELLED / EXPIRED / REFUNDED`. Refund → đảo entitlement + tạo `wallet_transactions` điều chỉnh âm (không sửa/xoá txn cũ).
- Audit log mọi hành vi quan trọng với `actor / action / entity / entity_id / old_value / new_value / timestamp`.

---

## 3. Proposed entities (bảng mới) & Database changes

Tất cả PK `UUID` (`defaultValue UUIDV4`), `timestamps: false`, `created_at`/`updated_at` set tay — đồng bộ style hiện có. Tiền: `DECIMAL(14,2)` (VND — luôn nguyên, nhưng để DECIMAL cho an toàn số học). `commission_rate`: `DECIMAL(5,4)` (0.0000–1.0000).

### 3.1. `products` — 2 dòng, admin cấu hình giá sàn

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | UUID PK | |
| code | STRING(20) UNIQUE | `'single'` \| `'combo'` |
| name | STRING(100) | "Thiệp lẻ" / "Combo 2 thiệp" |
| card_quantity | INTEGER | 1 \| 2 |
| base_price | DECIMAL(14,2) | giá sàn admin (single 200000, combo 300000) |
| active | BOOLEAN default true | |
| created_at / updated_at | DATE | |

Seed trong migration: `single / 1 / 200000`, `combo / 2 / 300000`.

### 3.2. `ctv_profiles` — hồ sơ CTV (1–1 với `users` role='ctv')

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK `users.id` UNIQUE, ON DELETE CASCADE | tài khoản đăng nhập của CTV |
| display_name | STRING(150) | |
| email | STRING(150) | |
| phone | STRING(30) | |
| status | ENUM(`active`,`locked`) default `active` | khoá CTV = chặn mọi thao tác ghi |
| single_price | DECIMAL(14,2) | ≥ `products[single].base_price` |
| combo_price | DECIMAL(14,2) | ≥ `products[combo].base_price` |
| commission_rate | DECIMAL(5,4) | vd 0.4000 |
| auto_payout_enabled | BOOLEAN default false | |
| auto_payout_weekday | SMALLINT null | 0=CN … 6=T7 |
| auto_payout_min_amount | DECIMAL(14,2) default 0 | ngưỡng tối thiểu để auto tạo phiếu |
| bank_name / bank_account_number / bank_account_name | STRING | để admin chuyển khoản |
| created_at / updated_at | DATE | |

### 3.3. `customers` — tài khoản khách, thuộc về 1 CTV

Bọc quanh 1 `users` row (role='user') để tái dùng auth/login + `invitationService` sẵn có.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK `users.id` UNIQUE, ON DELETE CASCADE | tài khoản login của khách |
| ctv_id | UUID FK `ctv_profiles.id` null, ON DELETE SET NULL | null = khách legacy/admin tạo |
| name | STRING(150) | |
| email | STRING(150) | |
| phone | STRING(30) | |
| status | ENUM(`pending_payment`,`active`,`locked`) default `pending_payment` | |
| cards_purchased | INTEGER default 0 | cache, rebuild từ `card_entitlements` |
| cards_used | INTEGER default 0 | cache |
| cards_available | INTEGER default 0 | cache; **luôn == `users.slot`** của khách |
| activated_at | DATE null | |
| created_at / updated_at | DATE | |

> **Cầu nối entitlement:** `users.slot` vẫn là bộ đếm "Available" mà `invitationService` đang dùng. Khi khách có `customers` row, mọi thao tác cộng/trừ slot đi qua service mới để đồng thời: (a) ghi `card_entitlements`, (b) cập nhật 3 cache trên `customers`, (c) `users.slot = cards_available`. Không có 2 nguồn chân lý — ledger là gốc, phần còn lại là cache.

### 3.4. `card_entitlements` — ledger entitlement (immutable)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | UUID PK | |
| customer_id | UUID FK `customers.id` | |
| order_id | UUID FK `orders.id` null | với dòng `purchase` / `refund` |
| invitation_id | UUID null | với dòng `card_created` |
| delta | INTEGER | `+card_quantity` (mua), `-1` (tạo thiệp), `±N` (refund/admin) |
| reason | ENUM(`purchase`,`card_created`,`refund`,`admin_adjust`) | |
| purchased_after / used_after / available_after | INTEGER | snapshot 3 số sau khi áp dụng |
| note | STRING(255) null | |
| created_at | DATE | |

### 3.5. `orders` — **MỞ RỘNG bảng có sẵn** (thêm cột, không tạo bảng mới)

Cột thêm:

| Cột | Kiểu | Ghi chú |
|---|---|---|
| kind | ENUM(`legacy_slot`,`ctv`) default `legacy_slot` | phân biệt luồng cũ / mới |
| ctv_id | UUID FK `ctv_profiles.id` null | |
| customer_id | UUID FK `customers.id` null | |
| product_id | UUID FK `products.id` null | |
| product_code | STRING(20) null | snapshot `single`/`combo` |
| card_quantity | INTEGER null | snapshot (đồng bộ với `slot_quantity` sẵn có) |
| admin_base_price | DECIMAL(14,2) null | snapshot |
| ctv_selling_price | DECIMAL(14,2) null | snapshot (== `amount` với đơn CTV) |
| commission_rate | DECIMAL(5,4) null | snapshot |
| commission_amount | DECIMAL(14,2) null | snapshot — nền tảng giữ |
| ctv_earning_amount | DECIMAL(14,2) null | snapshot — CTV hưởng |
| payment_provider | STRING(20) default `payos` | |
| payos_order_code | BIGINT UNIQUE null | payOS yêu cầu orderCode dạng số |
| payos_payment_link_id | STRING(64) null | |
| payos_checkout_url | STRING(500) null | |
| payos_qr | TEXT null | chuỗi QR thô (FE tự render ảnh) |
| order_token | UUID UNIQUE | token công khai cho `/pay/:token` |
| expired_at | DATE null | |
| paid_at | DATE null | |

`status`: **mở rộng ENUM** `pending, paid, cancelled` → thêm `expired, refunded` (Postgres: `ALTER TYPE "enum_orders_status" ADD VALUE ...`).

### 3.6. `payment_transactions` — sự kiện thanh toán payOS (idempotency + audit)

Giữ bảng `transactions` (SePay) nguyên vẹn; đây là bảng riêng cho payOS.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | UUID PK | |
| order_id | UUID FK `orders.id` | |
| provider | STRING(20) default `payos` | |
| event_id | STRING(120) UNIQUE | **khoá idempotency** — từ `data.reference` (+`orderCode`) của payOS |
| provider_txn_ref | STRING(120) null | mã tham chiếu ngân hàng |
| amount | DECIMAL(14,2) | |
| status | ENUM(`pending`,`succeeded`,`failed`) | |
| signature_valid | BOOLEAN | |
| raw_payload | JSONB | toàn bộ payload webhook |
| processed_at | DATE null | |
| created_at | DATE | |

### 3.7. `wallets` — ví CTV (1–1)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | UUID PK | |
| ctv_id | UUID FK `ctv_profiles.id` UNIQUE | |
| balance | DECIMAL(14,2) default 0 | **== SUM(`wallet_transactions.amount`)** — số dư rút được |
| pending_balance | DECIMAL(14,2) default 0 | tổng tiền đang "giữ" cho phiếu rút `pending` |
| total_earned | DECIMAL(14,2) default 0 | luỹ kế hoa hồng nhận |
| total_paid | DECIMAL(14,2) default 0 | luỹ kế đã chi trả (phiếu approved) |
| updated_at | DATE | |

### 3.8. `wallet_transactions` — ledger ví (immutable)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | UUID PK | |
| wallet_id | UUID FK `wallets.id` | |
| ctv_id | UUID FK `ctv_profiles.id` | denorm để query |
| amount | DECIMAL(14,2) | có dấu |
| type | ENUM(`commission_credit`,`refund_debit`,`payout_hold`,`payout_release`,`adjustment`) | |
| order_id | UUID null | |
| payout_request_id | UUID null | |
| balance_after | DECIMAL(14,2) | |
| note | STRING(255) null | |
| created_by | ENUM(`system`,`admin`,`cron`) | |
| created_at | DATE | |

**Mô hình tiền của phiếu rút** (giữ `balance == SUM(ledger)` luôn đúng):
- Tạo phiếu → txn `payout_hold` `-amount`, `wallets.pending_balance += amount`, phiếu `pending`.
- Admin **reject** / CTV **cancel** → txn `payout_release` `+amount`, `pending_balance -= amount`, phiếu `rejected|cancelled`.
- Admin **approve** (đã chuyển khoản) → không thêm txn tiền (tiền đã rời ví lúc hold), `pending_balance -= amount`, `total_paid += amount`, phiếu `approved` + lưu `payment_reference / approved_by / approved_at`.

### 3.9. `payout_requests` — phiếu rút tiền (thủ công + tự động)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | UUID PK | |
| ctv_id | UUID FK `ctv_profiles.id` | |
| wallet_id | UUID FK `wallets.id` | |
| amount | DECIMAL(14,2) | ≤ `wallet.balance` tại thời điểm tạo |
| type | ENUM(`manual`,`auto`) | |
| status | ENUM(`pending`,`approved`,`rejected`,`cancelled`) default `pending` | |
| requested_by | ENUM(`ctv`,`system`) | |
| hold_txn_id | UUID FK `wallet_transactions.id` null | txn `payout_hold` tương ứng |
| note | TEXT null | ghi chú CTV |
| admin_note | TEXT null | |
| payment_reference | STRING(120) null | mã CK admin nhập khi approve |
| approved_by | UUID FK `users.id` null | |
| approved_at / rejected_at | DATE null | |
| period_start / period_end | DATE null | cho phiếu `auto` / đối soát |
| created_at / updated_at | DATE | |

### 3.10. `audit_logs`

| Cột | Kiểu |
|---|---|
| id | UUID PK |
| actor_type | ENUM(`admin`,`ctv`,`system`,`customer`) |
| actor_id | UUID null |
| action | STRING(60) — vd `ctv.create`, `order.create`, `payment.paid`, `customer.activate`, `entitlement.add`, `commission.create`, `wallet.credit`, `payout.request`, `payout.approve`, `payout.reject`, `refund`, `ctv.lock`, `price.update`, `commission.update` |
| entity_type | STRING(40) |
| entity_id | UUID null |
| old_value | JSONB null |
| new_value | JSONB null |
| ip | STRING(60) null |
| created_at | DATE |

Index: `(entity_type, entity_id)`, `(actor_type, actor_id)`, `(created_at)`.

### 3.11. `app_settings` — cấu hình toàn cục (key/value)

| Cột | Kiểu |
|---|---|
| key | STRING(60) PK |
| value | JSONB |
| updated_at | DATE |

Dùng cho: `auto_payout.default_weekday`, `auto_payout.run_hour`, `auto_payout.last_run_date` (chống chạy 2 lần/ngày).

### 3.12. Quan hệ (models/index.js)

```
User 1—1 CtvProfile            (user_id)
User 1—1 Customer              (user_id)
CtvProfile 1—N Customer        (ctv_id)
CtvProfile 1—1 Wallet          (ctv_id)
CtvProfile 1—N Order           (ctv_id)
CtvProfile 1—N PayoutRequest   (ctv_id)
Customer 1—N Order             (customer_id)
Customer 1—N CardEntitlement   (customer_id)
Product 1—N Order              (product_id)
Order 1—N PaymentTransaction   (order_id)
Order 1—1 Invoice              (đã có)
Wallet 1—N WalletTransaction   (wallet_id)
PayoutRequest 1—N WalletTransaction (payout_request_id)
Invitation N—1 Customer        (qua users_id → customers.user_id; suy ra trong service, không FE)
```

---

## 4. API changes

### 4.1. Middleware mới (`src/middlewares/auth.js`)
`ctvOnly` (role === `ctv`), `adminOrCtv`. Giữ `authenticate`, `adminOnly`, `userOrAdmin`.

### 4.2. CTV API — `/api/ctv/*` (`authenticate + ctvOnly`, ownership ép trong service theo `req.user.id → ctv_profiles`)

| Method & path | Mô tả |
|---|---|
| `GET /me` | hồ sơ CTV + giá + % + ví (balance/pending/paid) + cấu hình auto payout |
| `PATCH /me/payout-settings` | `auto_payout_enabled`, `auto_payout_weekday`, `auto_payout_min_amount`, bank info |
| `GET /dashboard` | doanh thu tháng, hoa hồng tháng, #khách, #đơn, số dư |
| `GET /customers` `POST /customers` | list / tạo khách (tạo `users` role user + `customers` `pending_payment`) |
| `GET /customers/:id` `PATCH /customers/:id` | chi tiết / sửa thông tin khách (không sửa status/quota) |
| `GET /customers/:id/orders` | lịch sử đơn của khách |
| `GET /customers/:id/cards` | thiệp của khách + Purchased/Used/Available |
| `POST /orders` | body `{ customerId, productCode }` → **giá tính ở BE**, tạo Order (snapshot) + payОС link |
| `GET /orders` `GET /orders/:id` | |
| `POST /orders/:id/cancel` | chỉ khi `pending` |
| `GET /orders/:id/payment` | lấy lại checkoutUrl/QR (không tạo mới nếu còn hạn) |
| `GET /wallet` | số dư + ledger phân trang |
| `GET /payout-requests` `POST /payout-requests` | list / tạo phiếu rút thủ công `{ amount, note }` |
| `POST /payout-requests/:id/cancel` | huỷ phiếu `pending` |
| Sửa thiệp | **tái dùng** `/api/invitations/*` — `invitationService` mở quyền cho CTV-của-khách khi `customer.status='active'` |

### 4.3. Admin API — thêm vào `/api/admin/*`

| Method & path | Mô tả |
|---|---|
| `GET /ctvs` `POST /ctvs` | list / tạo CTV (tạo `users` role ctv + `ctv_profiles` + `wallets`) |
| `GET /ctvs/:id` `PATCH /ctvs/:id` | chi tiết / set `single_price`,`combo_price`,`commission_rate` (validate ≥ sàn), bank |
| `POST /ctvs/:id/lock` `POST /ctvs/:id/unlock` | |
| `DELETE /ctvs/:id` | vô hiệu hoá (soft: status locked + user vô hiệu) |
| `GET /ctvs/:id/stats` | tổng đơn, doanh thu, hoa hồng, đã trả, chưa trả, số dư, #khách |
| `GET /products` `PATCH /products/:id` | sửa `base_price` giá sàn |
| `GET /orders` `GET /orders/:id` | tất cả đơn, filter `ctvId/customerId/status` |
| `GET /customers` | tất cả khách |
| `GET /payment-transactions` | log webhook payОС |
| `GET /reconciliation` | bảng đối soát mỗi CTV (doanh thu / hoa hồng / đã trả / chưa trả / số dư) |
| `GET /payout-requests` | filter `status`; `POST /payout-requests/:id/approve` `{ payment_reference, admin_note }`; `POST /payout-requests/:id/reject` `{ admin_note }` |
| `POST /ctvs/:id/payout-requests` | admin tạo phiếu hộ CTV |
| `POST /payout/run-auto-sweep` | chạy quét auto-payout thủ công (test/vận hành) |
| `POST /orders/:id/refund` | `{ reason }` → status `refunded`, đảo entitlement, `wallet_transactions` `refund_debit` |
| `GET /audit-logs` | filter `entity_type/entity_id/actor/action`, phân trang |

### 4.4. Payment API — `/api/payments/*` (thêm nhánh payОС; giữ nhánh SePay)

| Method & path | Auth | Mô tả |
|---|---|---|
| `POST /payos/webhook` | none | verify chữ ký (SDK) → tìm order theo `payos_order_code` → so `amount` → **insert `payment_transactions` theo `event_id` (idempotent)** → nếu mới & PAID: chạy settlement transaction |
| `GET /public/:token` | none | tóm tắt đơn + trạng thái; nếu `pending` & link còn hạn → trả checkoutUrl/QR; `paid` → màn đã thanh toán; `expired` → cờ cho tạo lại |
| `POST /public/:token/refresh` | none | tạo payОС link mới **cho chính Order** khi hết hạn — không tạo Customer/Order mới |

### 4.5. FE `src/api.js`
Thêm `api.ctv.*` và mở rộng `api.admin.*` tương ứng bảng trên. Thêm `api.payments.public(token)`, `api.payments.publicRefresh(token)`.

---

## 5. Permission changes

- Role mới `ctv`. Seeder thêm 1 CTV demo + 1 customer demo (chỉ dev).
- `/api/ctv/*`: `ctvOnly` + **ownership trong service** — luôn resolve `ctv_id` từ token, **không bao giờ** tin `ctvId` trong body/query. CTV A không đọc/ghi được resource của CTV B (kiểm ở mọi service: customer, order, wallet, payout, invitation).
- CTV **không** được đổi: `commission_rate`, `admin_base_price`, `payment_status`, `wallet_balance`, `customer.status`, entitlement. Các field này bị strip khỏi payload ở controller + không có setter ở service CTV.
- `invitationService`: `ensureOwnerOrAdmin` → `ensureCanEdit(invitation, actor)` = owner (customer) **hoặc** admin **hoặc** CTV sở hữu customer; **và** `customer.status === 'active'` (trừ admin). Khách `pending_payment` → 423/403 khi tạo/sửa.
- Webhook: chỉ đổi trạng thái khi chữ ký hợp lệ + amount khớp + order `pending`. Không PAID 2 lần (unique `event_id` + check status trong transaction).

---

## 6. Payment flow (payОС)

```
CTV → POST /api/ctv/orders { customerId, productCode }
  service: ctv active? customer thuộc ctv? product active?
           giá = ctv_profiles[single|combo]_price  (đã ≥ sàn khi lưu)
           snapshot { product_code, card_quantity, admin_base_price,
                      ctv_selling_price, commission_rate,
                      commission_amount = round(price*rate),
                      ctv_earning_amount = price - commission_amount }
           Order.create(status=pending, kind='ctv', order_token=uuid,
                        expired_at=now+ N giờ)
           payОС.createPaymentLink({ orderCode: payos_order_code, amount: price,
                        description, returnUrl, cancelUrl })
           lưu payos_* lên Order
  → trả { order, checkoutUrl, qr, payUrl: FE `/pay/<order_token>` }

CTV gửi link/QR cho khách → khách thanh toán → payОС gọi:
POST /api/payments/payos/webhook
  verify signature (SDK)              — sai → 200 ack, không xử lý
  order = findByPayosOrderCode       — không thấy → log + 200
  amount khớp order.ctv_selling_price — lệch → payment_transactions.failed + 200
  INSERT payment_transactions(event_id) — trùng → no-op (idempotent) + 200
  nếu order.status==='pending':
    BEGIN TRANSACTION
      order.status='paid', paid_at=now
      customer: pending_payment → active, activated_at=now
      entitlementService.credit(customer, order, +card_quantity)  → card_entitlements + cache + users.slot
      walletService.credit(ctv, order, +ctv_earning_amount, 'commission_credit') → wallet.balance/total_earned + wallet_transactions
      Invoice.create(payment_method='payos')
      auditLog x (payment.paid, customer.activate, entitlement.add, commission.create, wallet.credit)
    COMMIT
  → 200
```

`/pay/:token` (FE, không auth): gọi `GET /api/payments/public/:token`.
- `paid` → "Đã thanh toán — tài khoản đã kích hoạt".
- `pending` + `expired_at > now` → hiện lại `checkoutUrl` + QR cũ (KHÔNG tạo mới khi reload/đăng nhập lại/mở lại sau vài ngày).
- `pending` + hết hạn hoặc `expired` → nút "Tạo lại mã" → `POST /public/:token/refresh` (payОС link mới, cùng Order).

---

## 7. CTV flow

```
Admin tạo CTV (giá, %, bank) ─┐
                              ▼
CTV login → Dashboard (doanh thu/hoa hồng tháng, #khách, #đơn, số dư)
  → Khách hàng → [Tạo khách] (status=pending_payment)
  → Chi tiết khách → [Tạo đơn mới] chọn single|combo
       → BE tính giá + hoa hồng (FE chỉ hiển thị) → [Tạo QR]
  → gửi QR/link cho khách
  → (khách trả) webhook PAID → customer active, +entitlement, +ví
  → Chi tiết khách: Purchased/Used/Available, lịch sử đơn/thanh toán
  → [Quản lý thiệp] (chỉ khi active) — sửa thiệp hộ khách
  → Ví: số dư + ledger; [Tạo phiếu rút] {amount}
  → Cấu hình auto payout (bật/tắt, thứ trong tuần, ngưỡng)
```

## 8. Customer flow

```
CTV tạo khách → nhận username/password (CTV cấp cho khách)
Khách login:
  status=pending_payment → màn "Chưa kích hoạt" + [QR thanh toán] (từ order pending mới nhất) + "Đang chờ thanh toán"
                           → KHÔNG có nút tạo/sửa thiệp
  status=active           → "Thiệp của tôi": [Tạo thiệp] (Available>0), [Chỉnh sửa]
Mua thêm: CTV tạo Order mới cho khách cũ → PAID → cards_available += card_quantity
```

## 9. Wallet flow

```
Order PAID → wallet_transactions(+commission_credit, ctv_earning_amount)
             wallet.balance += earning ; total_earned += earning
CTV tạo phiếu rút amount → wallet_transactions(-payout_hold, amount)
                           wallet.balance -= amount ; pending_balance += amount
Admin approve (đã CK) → pending_balance -= amount ; total_paid += amount
                        payout_requests: approved + payment_reference
Admin reject / CTV cancel → wallet_transactions(+payout_release, amount)
                            wallet.balance += amount ; pending_balance -= amount
Refund order → wallet_transactions(-refund_debit, earning)
               (nếu balance không đủ → vẫn ghi âm, balance có thể < 0, cảnh báo đối soát)
Bất biến: wallet.balance == SUM(wallet_transactions.amount)  ✓ luôn đúng
```

## 10. Auto-payout (scheduler nhẹ, không thêm dependency)

- `src/jobs/autoPayoutJob.js` + `setInterval` trong `server.js` (mỗi 15 phút), guard bằng `AUTO_PAYOUT_ENABLED=true`.
- Mỗi lần chạy: nếu `weekday(now) === app_settings.auto_payout.default_weekday` (hoặc per-CTV `auto_payout_weekday`) **và** `hour(now) >= run_hour` **và** `app_settings.auto_payout.last_run_date !== today`:
  - với mỗi CTV `auto_payout_enabled && status=active && wallet.balance >= max(auto_payout_min_amount, 1)` và **không** có phiếu `pending`:
    → tạo `payout_requests(type='auto', requested_by='system', amount = wallet.balance, period = tuần trước)` → hold.
  - set `last_run_date = today`.
- Admin duyệt & chuyển khoản thủ công (giống phiếu manual).
- Endpoint `POST /api/admin/payout/run-auto-sweep` để chạy tay.

---

## 11. Transactional integrity

- Settlement webhook + refund + payout: bọc trong **một** `sequelize.transaction`. Idempotency key `payment_transactions.event_id` UNIQUE — `INSERT` trong transaction, đụng unique → rollback/no-op → webhook trùng **không** cộng lần 2.
- `entitlementService.credit/debit` và `walletService.credit/hold/release` nhận `{ transaction }` bắt buộc khi gọi trong settlement.
- Guard `cards_available >= 0` ở DB (CHECK) + service (khoá dòng `customers` bằng `SELECT ... FOR UPDATE` qua `lock: transaction.LOCK.UPDATE`).
- `wallet` cập nhật với row lock để tránh race 2 phiếu rút đồng thời.

## 12. Migration plan (thứ tự chạy)

```
20260901000001-create-products-and-app-settings      (+ seed 2 products)
20260901000002-create-ctv-profiles-and-wallets
20260901000003-create-customers
20260901000004-extend-orders-for-ctv                  (addColumn + ALTER TYPE enum add value)
20260901000005-create-card-entitlements
20260901000006-create-payment-transactions
20260901000007-create-wallet-transactions
20260901000008-create-payout-requests
20260901000009-create-audit-logs
20260901000010-seed-dev-ctv            (chỉ chạy khi NODE_ENV!==production)
```

Tất cả `down` đầy đủ. Không sửa migration cũ. Backward-compatible: cột thêm vào `orders` đều `null`; `users.role` vẫn string.

## 13. Testing plan

`npm test` → `node --test test/`. Không thêm dependency (dùng `node:test` + `node:assert`).

| File | Nội dung |
|---|---|
| `test/pricing.test.js` | quote(): giá < sàn → reject; = sàn → ok; > sàn → ok. Case 1–5 §35. |
| `test/commission.test.js` | 10/20/30/40%. Snapshot: đổi `commission_rate` sau khi tạo Order → đơn cũ giữ nguyên. |
| `test/entitlement.test.js` | mua 1; mua combo (+2); mua thêm nhiều lần; `available` không âm; Purchased/Used/Available nhất quán. |
| `test/wallet.test.js` | commission_credit; refund_debit; payout hold → release; `balance == SUM(ledger)`; approve không cộng/trừ nhầm. |
| `test/webhook-idempotency.test.js` | cùng `event_id` xử lý 2 lần → chỉ 1 credit quota + 1 credit commission. |
| `test/ownership.test.js` | helper `assertCtvOwnsCustomer` — CTV A ↛ customer của CTV B (DENY). Strip field `commission_rate`/`payment_status`/`wallet` khỏi payload CTV. |

Các test nhắm **module logic thuần** (pricing, commission, entitlement reducer, wallet reducer, idempotency guard) — tách khỏi Sequelize để chạy không cần DB. Test tích hợp cần DB được đánh dấu skip nếu không có `DATABASE_URL`.

## 14. Risks

| Rủi ro | Giảm thiểu |
|---|---|
| `ALTER TYPE ... ADD VALUE` không chạy trong transaction (Postgres) | migration tách riêng, không bọc transaction; hoặc tạo enum mới + swap cột. |
| payОС orderCode phải là số & duy nhất | `payos_order_code = BIGINT` sinh từ `Date.now()` + suffix; UNIQUE; retry nếu đụng. |
| Webhook đến trước khi FE lưu xong payos_* | order đã tạo trước khi gọi payОС; webhook tra theo `payos_order_code` đã set; nếu chưa có → 200 ack để payОС retry. |
| `users.slot` vs `customers.cards_available` lệch | chỉ 1 service ghi; `card_entitlements` là gốc; có script `reconcile-entitlements`. |
| Race 2 phiếu rút đồng thời rút quá số dư | row lock `wallets` + check `amount <= balance` trong transaction. |
| Đổi giá CTV ảnh hưởng đơn đang `pending` | đơn `pending` giữ giá đã snapshot; chỉ đơn tạo sau mới theo giá mới. Không hồi tố. |
| Refund khi entitlement đã dùng | vẫn đảo commission (wallet âm nếu cần) + đánh dấu `refunded`; cảnh báo ở đối soát; không tự xoá thiệp đã tạo. |
| Legacy `/api/payments` (SePay) | giữ nguyên, vẫn khoá bằng `ENABLE_SLOT_PURCHASE`; không đụng path cũ. |
| Chưa có credentials payОС | code đọc từ `.env`; nếu thiếu → endpoint tạo đơn trả 503 rõ ràng; `.env.example` cập nhật. |

## 15. Files sẽ thêm/sửa (tổng quan)

**BE — thêm:** `src/models/{Product,CtvProfile,Customer,CardEntitlement,PaymentTransaction,Wallet,WalletTransaction,PayoutRequest,AuditLog,AppSetting}.js` · `src/database/migrations/2026090100000{1..10}-*.js` · `src/services/{pricingService,ctvService,customerService,orderService,entitlementService,walletService,payoutService,auditService,payosService}.js` · `src/controllers/{ctvController,adminCtvController,adminPayoutController,payosWebhookController,publicPaymentController}.js` · `src/routes/{ctvRoutes,payosRoutes}.js` · `src/jobs/autoPayoutJob.js` · `src/utils/money.js` · `test/*.test.js`

**BE — sửa:** `src/models/index.js` (quan hệ) · `src/middlewares/auth.js` (`ctvOnly`,`adminOrCtv`) · `src/app.js` (mount `/api/ctv`, `/api/payments/payos`, `/api/payments/public`) · `src/routes/adminRoutes.js` + `src/controllers/adminController.js` + `src/services/adminService.js` (nhánh CTV/đối soát/payout/refund/audit) · `src/services/invitationService.js` (`ensureCanEdit` cho CTV + chặn khi khách chưa active) · `src/server.js` (khởi động job) · `package.json` (`@payos/node`, script `test`) · `.env.example`

**FE — thêm:** `src/pages/ctv/CtvDashboard.jsx` (+ tabs: Dashboard, Khách hàng, Chi tiết khách, Tạo đơn, Ví, Phiếu rút, Cấu hình) · `src/pages/PayPage.jsx` (`/pay/:token`, không auth) · `src/pages/ctv/ctv.css`

**FE — sửa:** `src/api.js` (`api.ctv.*`, `api.admin.*` mở rộng, `api.payments.public*`) · `src/App.jsx` (routes `/ctv`, `/pay/:token` đặt trước `/:slug`) · `src/pages/dashboard/DashboardLayout.jsx` (link CTV khi `role==='ctv'`) · `src/pages/admin/AdminPage.jsx` (tabs: CTV, Đơn hàng, Đối soát, Phiếu rút, Nhật ký) · `src/pages/dashboard/*` (màn khách `pending_payment`)

---

## 16. Acceptance (đối chiếu §39 prompt) — bám sát checklist, xác minh bằng test dữ liệu thật ở cuối mỗi phase.

---

## 17. TRẠNG THÁI TRIỂN KHAI (cập nhật 2026-08-30)

### Đã xong — Backend (`BE_Wedding_Web/`)
- **Migrations** `20260901000001..09` + seeder `20260901000001-add-ctv-demo` — đã tạo, syntax-check pass. **Cần chạy `npm run db:migrate` trên môi trường có DB đúng credentials** (môi trường phát triển hiện tại DB `postgres` sai mật khẩu nên chưa migrate được — code không phụ thuộc việc này để load).
- **Models** (10 mới) + `models/index.js` (quan hệ) + `Order.js` (thêm 19 cột) — load sạch.
- **Services**: `pricingService`, `entitlementService`, `walletService`, `payosService`, `orderService`, `customerService`, `ctvService`, `payoutService`, `adminCtvService`, `auditService` + sửa `invitationService` (quyền CTV + chặn khách chưa ACTIVE + entitlement qua ledger).
- **Utils thuần** (test được không cần DB): `money.js`, `entitlementMath.js`, `walletMath.js`.
- **Controllers/Routes**: `ctvController` + `ctvRoutes` (`/api/ctv/*`); `adminCtvController` + nhánh mới trong `adminRoutes` (`/api/admin/ctvs|products|ctv-orders|ctv-customers|payment-transactions|reconciliation|payout-requests|audit-logs|payout/run-auto-sweep`); `paymentController` + `paymentRoutes` thêm `payos/webhook`, `public/:token`, `public/:token/refresh`.
- **Scheduler**: `jobs/autoPayoutJob.js` + gọi trong `server.js` (bật bằng `AUTO_PAYOUT_ENABLED=true`).
- **Dependency**: `@payos/node@^1.0.10` đã cài; API (`createPaymentLink`, `getPaymentLinkInformation`, `cancelPaymentLink`, `verifyPaymentWebhookData`, `confirmWebhook`) khớp wrapper.
- **`.env.example`** cập nhật khối payOS + auto-payout; **`package.json`** `test` → `node --test`.
- **Tests** `test/*.test.js` — **29/29 pass** (`npm test`): money/commission (§35 Case 1–5), entitlement (mua lẻ/combo/mua thêm/không âm), wallet ledger (`balance == SUM(ledger)`, hold/release/refund/approve), webhook idempotency (§24/§31 — cùng `event_id` chỉ cộng 1 lần).
- Server boot OK; `/api/ctv/*` chặn khi thiếu token; webhook payOS body rác → `200 {ack:true}` không crash.

### Đã xong — Frontend (`FE_Wedding_Web/`) — build pass (112 modules)
- `src/api.js`: `api.ctv.*`, `api.admin.*` (nhánh CTV), `api.payPublic.*`.
- `src/pages/ctv/CtvDashboard.jsx` — Dashboard / Khách hàng (+ tạo, chi tiết, tạo đơn + QR, quản lý thiệp) / Đơn hàng / Ví & Rút tiền (+ sổ cái, phiếu rút) / Cấu hình (auto payout + ngân hàng).
- `src/pages/PayPage.jsx` — `/pay/:token` công khai, tự poll trạng thái, nút tạo lại mã khi hết hạn.
- `src/pages/admin/AdminCtvTabs.jsx` — 6 tab admin mới: CTV, Giá Sàn, Đơn CTV, Đối Soát, Phiếu Rút (duyệt/từ chối/chạy quét), Nhật Ký; nhúng vào `AdminPage.jsx`.
- `src/App.jsx` route `/pay/:token` (công khai) + `/ctv`; `DashboardLayout.jsx` link CTV + tự điều hướng CTV → `/ctv`.

### Đã kiểm thử tích hợp (2026-08-30) — Postgres thật + migrations thật + HTTP API + UI Chrome
- **`docker compose` KHÔNG chạy được trên máy này** vì đường dẫn repo có dấu tiếng Việt (`Tài liệu`) → Docker/BuildKit báo `unable to prepare context: path ... not found`. Đã né bằng: container `postgres:16-alpine` độc lập (cổng 5433) + chạy BE/FE bằng `npm run dev` trên host. Nếu chuyển repo sang đường dẫn ASCII (vd `C:\dev\thiepcodau`) thì `docker compose up --build` chạy bình thường — đã để sẵn `docker-compose.override.yml` bật `PAYOS_MOCK=true`.
- **Migrations**: `npx sequelize-cli db:migrate` chạy sạch toàn bộ 20 migration (11 cũ + 9 mới), gồm cả `ALTER TYPE enum_orders_status ADD VALUE`. Seeder tạo admin / user / ctv1 + 2 products + ví.
- **`PAYOS_MOCK=true`** (mới, chỉ dev/test): payОС giả lập — `createPaymentLink` trả link/QR giả, webhook bỏ qua verify chữ ký, chỉ cần `{data:{orderCode,amount,code:"00",reference}}`. Cho phép chạy trọn vòng đời mà không cần credentials.
- **E2E script** (`scratchpad/e2e.sh`, 22 nhóm): **84/84 assertion PASS** — giá sàn (backend chặn 180k), snapshot giá/HH trên đơn, khách PENDING_PAYMENT không tạo được thiệp (khách + CTV), tạo đơn → `/pay/:token` → reload giữ QR cũ, webhook → PAID+ACTIVE+entitlement+ví (đúng `ctv_earning` không theo giá admin), webhook trùng `reference` → không cộng lần 2, mua thêm lẻ (không auto combo), combo (+2), tạo thiệp trừ ledger, rút thủ công (hold→approve/cancel), 1 phiếu pending tại 1 thời điểm (409), refund đảo entitlement+ví, đối soát, chống cross-CTV (404/403), CTV không sửa được commission/giá của mình, phân quyền role, đơn hết hạn → refresh sinh `payos_order_code` mới cho **cùng** đơn (không tạo đơn/khách mới), audit log đủ 10 action.
- **DB invariant checks**: `wallets.balance == SUM(wallet_transactions.amount)` sau mọi thao tác (kể cả refund âm, payout hold/release, approve qua UI); `card_entitlements` khớp Purchased/Used/Available.
- **Chrome (extension Claude)**: CTV Dashboard (stats, danh sách khách, chi tiết khách + preview giá/HH, tạo đơn + QR), trang `/pay/:token` (render QR + nút payОС, **tự chuyển "Đã thanh toán" sau webhook** nhờ poll 5s), Admin tab CTV (danh sách CTV + ví/HH/doanh thu), Admin tab Phiếu Rút (danh sách + duyệt qua form inline — đã thay `window.prompt` bằng form trong bảng), duyệt phiếu 64.000đ qua UI → ví cập nhật đúng (`pending_balance 0`, `total_paid +64000`, ledger khớp).
- Sửa nhỏ trong lúc test: `payUrl()` helper ở `CtvDashboard.jsx` (link `/pay` bị nối đôi origin khi BE có `FRONTEND_URL`); form duyệt/từ chối phiếu rút inline thay `window.prompt`.

### Còn lại / bước tiếp theo
- Chạy migrations trên DB thật + smoke test end-to-end với credentials payOS sandbox.
- Màn "khách PENDING_PAYMENT" phía trang khách (§28) mới ở mức chặn từ backend + thông báo lỗi; chưa có UI gate riêng trên `InvitationsPage`. Cần thêm `customer` status vào `GET /api/users/profile` để FE hiển thị thân thiện.
- `payout_periods` (đối soát theo kỳ §21) — hiện dùng báo cáo đối soát tính trực tiếp; chưa có bảng kỳ.
- Wrap `invitationService.create/createDraft` (nhánh customer) trong transaction (hiện theo phong cách non-transaction sẵn có của file).
