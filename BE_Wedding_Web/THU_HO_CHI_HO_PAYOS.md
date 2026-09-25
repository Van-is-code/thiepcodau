# Thu hộ & chi hộ qua payOS

Tài liệu cho đội phát triển và vận hành thiepcodau.

## Mô hình dòng tiền

Cộng tác viên (CTV) bán thiệp cho khách của mình với giá tự đặt (không thấp hơn giá
sàn của admin). Khách **trả toàn bộ tiền vào tài khoản payOS của nền tảng** — nền
tảng thu **hộ** CTV. Sau đó nền tảng **chi hộ** phần hoa hồng về tài khoản ngân
hàng CTV.

```
Khách hàng
    │  trả 400.000đ
    ▼
payOS (tài khoản NỀN TẢNG)            ◄── THU HỘ
    │
    ├── 160.000đ  phần nền tảng giữ (hoa hồng 40%)
    └── 240.000đ  thu hộ cho CTV
            │
            │  CTV tạo phiếu rút, admin duyệt
            ▼
    payOS Payouts ──► tài khoản ngân hàng CTV    ◄── CHI HỘ
```

## Bất biến kế toán

Hệ thống luôn giữ đúng các đẳng thức sau. Có test tự động canh giữ
(`test/collection-disbursement.test.js`):

```
gross_amount === platform_amount + ctv_amount          (mỗi dòng thu hộ)
wallet.balance === SUM(wallet_transactions.amount)      (ví CTV khớp sổ cái)
SUM(ctv_amount nơi status='pending_settlement') === số tiền còn nợ CTV
```

## THU HỘ

Mỗi đơn được thanh toán sinh **đúng một** dòng trong `collection_records`.

Cột `order_id` là UNIQUE ở tầng DB — payOS gửi lại webhook bao nhiêu lần cũng chỉ
có một dòng. Đây là lớp chống trùng thứ hai, cạnh `payment_transactions.event_id`.

| Trạng thái | Ý nghĩa |
|---|---|
| `pending_settlement` | Đã thu của khách, **chưa** chi lại cho CTV |
| `settled` | Đã nằm trong một phiếu rút đã chi thành công |

**API**

```
GET  /api/ctv/collections                  CTV xem sổ thu hộ của chính mình
GET  /api/admin/collections/summary        Tổng quan toàn hệ (hoặc ?ctvId=)
GET  /api/admin/collections/by-ctv         Đối soát theo từng CTV
```

## CHI HỘ

**Hai chế độ duyệt phiếu rút**

| `mode` | Hành vi |
|---|---|
| `manual` (mặc định) | Admin tự chuyển khoản, hệ thống chỉ ghi nhận |
| `payos` | payOS chuyển thẳng vào tài khoản ngân hàng CTV |

```
POST /api/admin/payout-requests/:id/approve   { "mode": "payos" }
```

Đặt `PAYOUT_MODE=payos` trong `.env` để dùng chi hộ tự động làm mặc định.

**Yêu cầu**: hồ sơ CTV phải có `bank_bin` (mã BIN 6 số, ví dụ `970422` = MB Bank)
và `bank_account_number`. payOS nhận mã BIN, không nhận tên ngân hàng dạng chữ.
Tra BIN tại `src/config/vietqrBanks.js`.

### Thứ tự thực hiện — và vì sao lại như vậy

Việc duyệt chia làm **hai giai đoạn tách bạch**:

1. **Trong transaction DB**: khoá dòng phiếu rút, chốt ví (`pending_balance` →
   `total_paid`), đánh dấu `provider_state='processing'`, chụp ảnh thông tin ngân
   hàng, đánh dấu các khoản thu hộ là đã tất toán.
2. **Sau khi transaction đã commit**: gọi payOS.

Lý do: nếu gọi API bên ngoài *bên trong* transaction, một lần timeout mạng sẽ
rollback toàn bộ phiếu rút **trong khi tiền có thể đã thực sự được chuyển đi**.
Sai lệch kiểu đó không có cách nào cứu bằng dữ liệu.

### Chống chuyển tiền hai lần

Ba lớp độc lập:

1. `referenceId` gửi cho payOS chính là **id phiếu rút**. payOS tự chống trùng:
   gửi lại cùng `referenceId` trả về đúng lệnh cũ, không chi thêm lần nữa.
2. Header `x-idempotency-key` ở tầng HTTP.
3. Cột `provider_payout_id` có **UNIQUE index** ở DB — một phiếu không thể gắn hai
   lệnh chi, và một lệnh chi không thể ghi cho hai phiếu.

### Khi lệnh chi thất bại

`payoutDisbursementService.markFailed()` hoàn nguyên đầy đủ:

- Ví: `total_paid` giảm, `pending_balance` tăng lại, rồi nhả hold để tiền quay về
  số dư khả dụng.
- Các khoản thu hộ: quay lại `pending_settlement`.
- Phiếu rút: về `pending` để admin xử lý lại, ghi `failure_reason`.
- Gửi cảnh báo Telegram.

Bỏ bước này thì CTV **mất tiền trên sổ sách mà thực tế chưa nhận được đồng nào**.

### Webhook

```
POST /api/payments/payos/payout-webhook
```

Không cần đăng nhập — bảo vệ bằng **chữ ký HMAC-SHA256**. Chữ ký được tính trên
phần thân đã sắp xếp khoá theo bảng chữ cái, so sánh bằng `crypto.timingSafeEqual`
(dùng `===` sẽ rò rỉ thông tin qua thời gian phản hồi, cho phép dò dần từng byte).

Bỏ verify thì bất kỳ ai cũng POST giả một lệnh `SUCCEEDED` để đánh dấu phiếu đã trả
trong khi thực tế chưa chuyển đồng nào.

Khai URL này tại payOS → Chi hộ → Webhook.

### Khi webhook không tới

```
POST /api/admin/payouts/reconcile   { "older_than_minutes": 15 }
```

Tra lại payOS cho mọi lệnh còn treo `processing` quá 15 phút và cập nhật kết quả.

## Cấu hình

Xem mục `payOS — CHI HỘ` trong `.env.example`. Chi hộ dùng **cặp khoá riêng**,
khác với khoá thu tiền vào (`PAYOS_CLIENT_ID` / `PAYOS_API_KEY`).

`PAYOS_PAYOUT_MOCK=true` giả lập toàn bộ cho môi trường dev — không gọi API thật,
không verify chữ ký. **Tuyệt đối không bật ở production**; `src/config/env.js` đã
chặn khởi động nếu phát hiện `PAYOS_MOCK=true` ở production.

## Kiểm tra

```bash
npm test                                   # 47 test, gồm 11 test thu hộ/chi hộ
```

Các tình huống đã phủ: bất biến `gross = platform + ctv`, chi hộ thành công, chi hộ
thất bại và hoàn nguyên, thất bại rồi duyệt lại không nhân đôi tiền, không rút quá
số dư, chữ ký webhook không phụ thuộc thứ tự khoá, sửa một đồng là chữ ký khác hẳn,
trạng thái lạ từ payOS không bao giờ bị coi là thành công.
