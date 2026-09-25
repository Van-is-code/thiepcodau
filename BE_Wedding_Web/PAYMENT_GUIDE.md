# Hệ Thống Thanh Toán Sepay - Hướng Dẫn Sử Dụng

## Tổng Quan
Hệ thống thanh toán cho phép người dùng mua thêm slots (lượt tạo thiệp) thông qua Sepay. Mỗi khi thanh toán thành công, số slots sẽ được cộng vào tài khoản người dùng và hóa đơn sẽ được lưu vào database.

## Cấu Hình

### 1. Cấp Nhật File .env
Thêm các biến environment sau vào file `.env` của bạn:

```env
# Sepay Payment Integration
SEPAY_API_URL=https://api.sepay.vn/v2
SEPAY_API_KEY=your_sepay_api_key
SEPAY_PARTNER_CODE=your_sepay_partner_code

# Slot Configuration (giá tiền cho mỗi slot, tính bằng VND)
SLOT_PRICE=50000
```

### 2. Chạy Migrations
```bash
npm run db:migrate
```

Lệnh này sẽ tạo 2 bảng mới:
- `orders`: Lưu thông tin đơn hàng
- `invoices`: Lưu thông tin hóa đơn

## API Endpoints

### 1. Yêu Cầu Thanh Toán (Tạo QR Code)
**POST** `/api/payments/request-payment`

**Header:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "slotQuantity": 5,
  "amount": null
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tạo đơn thanh toán thành công",
  "data": {
    "order": {
      "id": "uuid-order-id",
      "amount": 250000,
      "slotQuantity": 5,
      "status": "pending"
    },
    "qrCode": {
      "qrUrl": "https://api.sepay.vn/v2/qr-pay?...",
      "orderCode": "uuid-order-id",
      "amount": 250000,
      "description": "Mua 5 lượt tạo thiệp"
    }
  }
}
```

### 2. Webhook Callback (Sepay gọi về khi thanh toán thành công)
**POST** `/api/payments/webhook`

**Body từ Sepay:**
```json
{
  "orderCode": "uuid-order-id",
  "transactionCode": "transaction-id-from-sepay",
  "amount": 250000,
  "status": "success"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Thanh toán thành công",
  "order": {
    "id": "uuid-order-id",
    "status": "paid",
    "slotAdded": 5
  }
}
```

### 3. Lấy Chi Tiết Đơn Hàng
**GET** `/api/payments/orders/:orderId`

**Header:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Lấy thông tin đơn hàng thành công",
  "data": {
    "id": "uuid-order-id",
    "users_id": "user-uuid",
    "amount": 250000,
    "slot_quantity": 5,
    "status": "paid",
    "transaction_id": "sepay-transaction-id",
    "created_at": "2024-03-31T10:00:00.000Z",
    "user": {
      "id": "user-uuid",
      "username": "user123",
      "slot": 10
    },
    "invoice": {
      "id": "invoice-uuid",
      "order_id": "uuid-order-id",
      "transaction_id": "sepay-transaction-id",
      "payment_method": "sepay",
      "paid_at": "2024-03-31T10:05:00.000Z"
    }
  }
}
```

### 4. Lấy Danh Sách Đơn Hàng
**GET** `/api/payments/orders?page=1&limit=20`

**Header:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Lấy danh sách đơn hàng thành công",
  "data": {
    "items": [
      {
        "id": "uuid-order-id",
        "amount": 250000,
        "slot_quantity": 5,
        "status": "paid",
        "created_at": "2024-03-31T10:00:00.000Z",
        "invoice": { ... }
      }
    ],
    "pagination": {
      "total": 10,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

### 5. Hủy Đơn Hàng
**DELETE** `/api/payments/orders/:orderId`

**Header:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Hủy đơn hàng thành công",
  "data": {
    "id": "uuid-order-id",
    "status": "cancelled"
  }
}
```

## Quy Trình Thanh Toán

### Từ Phía Frontend:
1. Người dùng chọn số lượng slots muốn mua
2. Gọi API `POST /api/payments/request-payment` với số lượng slots
3. Nhận lại QR code
4. Hiển thị QR code cho người dùng quét
5. Người dùng quét mã QR bằng ứng dụng ngân hàng hỗ trợ Sepay
6. Thanh toán thành công

### Từ Phía Backend:
1. Frontend gọi API yêu cầu thanh toán
2. Backend tạo Order với status = "pending"
3. Tạo QR code và trả về cho Frontend
4. Khi Sepay gọi webhook, backend:
   - Kiểm tra đơn hàng
   - Xác minh số tiền
   - Tạo Invoice
   - Cộng slots cho user
   - Cập nhật status Order = "paid"

## Cọ Nhật Slots Cho User
Sau khi thanh toán thành công, slots sẽ tự động được cộng. Bạn có thể kiểm tra số slots như sau:

**GET** `/api/user` (hoặc `/api/users`)

**Header:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Lấy thông tin cá nhân thành công",
  "data": {
    "id": "user-uuid",
    "username": "user123",
    "role": "user",
    "slot": 10,
    "created_at": "2024-03-31T10:00:00.000Z",
    "updated_at": "2024-03-31T10:00:00.000Z"
  }
}
```

## Bảng Dữ Liệu

### orders
| Trường | Kiểu | Ghi Chú |
|--------|------|--------|
| id | UUID | Khóa chính |
| users_id | UUID | Liên kết tới users |
| amount | DECIMAL | Số tiền (VND) |
| slot_quantity | INT | Số lượng slots được mua |
| status | ENUM | pending, paid, cancelled |
| transaction_id | STRING | ID giao dịch từ Sepay |
| created_at | DATETIME | Thời gian tạo |
| updated_at | DATETIME | Thời gian cập nhật |

### invoices
| Trường | Kiểu | Ghi Chú |
|--------|------|--------|
| id | UUID | Khóa chính |
| order_id | UUID | Liên kết tới orders |
| transaction_id | STRING | ID giao dịch từ Sepay |
| payment_method | STRING | Phương thức thanh toán (sepay) |
| paid_at | DATETIME | Thời gian thanh toán |
| created_at | DATETIME | Thời gian tạo |
| updated_at | DATETIME | Thời gian cập nhật |

## Lưu Ý Quan Trọng

1. **Không có hồi lại slots**: Sau khi thanh toán thành công, slots sẽ được cộng vĩnh viễn vào tài khoản user.
2. **Chỉ hủy được đơn hàng pending**: Không thể hủy đơn hàng đã thanh toán.
3. **Webhook verification**: Trong môi trường production, hãy xác minh signature từ Sepay để đảm bảo dữ liệu từ Sepay là chính chủ.
4. **Xử lý lỗi**: Nếu webhook bị lỗi, đơn hàng sẽ vẫn ở trạng thái "paid" nhưng slots có thể chưa được cộng. Cần có cơ chế retry hoặc manual reconciliation.

## Tích Hợp Dengan Sepay (Sẵn Sàng)

Code hiện tại đã sẵn sàng để tích hợp với Sepay API thực sự. Bạn chỉ cần:

1. Đăng ký tài khoản Sepay
2. Lấy API Key và Partner Code
3. Cập nhật `.env` với thông tin từ Sepay
4. Gọi Sepay API để lấy QR code thực sự thay vì URL mẫu
5. Xác minh signature trong webhook handler

## Giá Trị Mặc Định

- **Slot Price**: 50,000 VND/slot (có thể thay đổi qua `SLOT_PRICE` trong `.env`)
- **User mới**: Nhận 0 slots (cần mua để tạo thiệp)
- **Admin**: Nhận 999 slots khi tạo tài khoản

## Cần Trợ Giúp?

Liên hệ team development hoặc xem API docs tại `/api-docs`
