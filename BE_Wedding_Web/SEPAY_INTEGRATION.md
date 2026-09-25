# Sepay Payment Integration Guide

## Overview

This document describes the updated Sepay payment integration based on the official Sepay documentation: https://sepay.vn/lap-trinh-cong-thanh-toan.html

## Architecture

The payment flow follows this sequence:
1. **User initiates payment** → POST `/api/payment/request-payment`
2. **System creates order** with status `pending`
3. **Frontend displays QR code** from `https://qr.sepay.vn`
4. **User scans and pays** using their bank app
5. **Bank pushes transaction to SePay** → SePay webhook to `/api/payment/webhook`
6. **System processes webhook** → Updates order status to `paid`, adds slots to user
7. **Frontend polls status** → POST `/api/payment/check-payment-status`
8. **Frontend shows success** when status becomes `paid`

## Key Implementation Details

### 1. Order Code Format
- Order codes follow the pattern: `DH{order-uuid}`
- Example: `DH550e8400e29b41d4a716446655440000`
- This code is embedded in the QR code transfer content for identification

### 2. QR Code Generation
- Uses VietQR standard via Sepay's public QR service: `https://qr.sepay.vn/img`
- Parameters:
  - `bank`: Bank code (from https://qr.sepay.vn/banks.json)
  - `acc`: Bank account number (configured in .env)
  - `amount`: Payment amount in VND
  - `des`: Transfer content (order code)
  - `template`: `compact` or empty for standard view

### 3. Webhook Handling
- **Endpoint**: `POST /api/payment/webhook`
- **Data structure** from SePay:
  ```json
  {
    "id": "transaction_id_from_sepay",
    "gateway": "bank_name",
    "transactionDate": "2024-07-25 14:02:37",
    "accountNumber": "0903252427",
    "code": null,
    "content": "DH550e8400e29b41d4a716446655440000",
    "transferType": "in",
    "transferAmount": 500000,
    "accumulated": 5000000,
    "subAccount": null,
    "referenceCode": "MBVCB.3278907687",
    "description": "..."
  }
  ```

### 4. Transaction Processing
- Extract order ID from `content` field using regex: `/DH([\w-]+)/i`
- Validate:
  - Order exists and matches the extracted ID
  - Amount matches order total
  - Transaction is not duplicate (by transaction_id)
  - Only process `transferType: "in"` (money in)
- Store all transactions in `transactions` table for audit trail
- Update order status to `paid` and create invoice

### 5. Duplicate Prevention
- Use Sepay's transaction `id` as unique identifier
- Check if transaction was already processed
- Return success on retry to prevent Sepay re-queuing

### 6. Slot Addition
- After successful payment, increment user's `slot` count by `slot_quantity`
- This is the main business logic for slot packages

## Database Schema

### orders table
```sql
id UUID PRIMARY KEY
users_id UUID NOT NULL
amount DECIMAL(10,2) NOT NULL
slot_quantity INTEGER NOT NULL
status ENUM('pending', 'paid', 'cancelled') NOT NULL
transaction_id STRING(255)
transfer_content STRING(255) NOT NULL -- Format: DH{order_id}
created_at TIMESTAMP
updated_at TIMESTAMP
```

### transactions table
```sql
id UUID PRIMARY KEY
transaction_id STRING(255) UNIQUE NOT NULL -- From SePay
order_id UUID -- Matched from transfer content
gateway STRING(100) NOT NULL
transaction_date TIMESTAMP NOT NULL
account_number STRING(100)
sub_account STRING(250)
amount_in DECIMAL(10,2)
amount_out DECIMAL(10,2)
accumulated DECIMAL(10,2)
code STRING(250)
transaction_content TEXT -- DH{order_id}
reference_number STRING(255)
body TEXT
status ENUM('success', 'unmatched', 'order_not_found', 'amount_mismatch', 'duplicate_order')
created_at TIMESTAMP
updated_at TIMESTAMP
```

## API Endpoints

### 1. Request Payment (Create Order & QR)
```
POST /api/payment/request-payment
Authorization: Bearer {token}
Content-Type: application/json

{
  "slotQuantity": 1,
  "amount": 500000
}

Response:
{
  "success": true,
  "message": "Tạo đơn thanh toán thành công",
  "data": {
    "order": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "amount": 500000,
      "slotQuantity": 1,
      "status": "pending",
      "transferContent": "DH550e8400-e29b-41d4-a716-446655440000"
    },
    "qrCode": {
      "qrUrl": "https://qr.sepay.vn/img?bank=MBBank&acc=0903252427&amount=500000&des=...",
      "orderCode": "DH550e8400-e29b-41d4-a716-446655440000",
      "amount": 500000,
      "transferContent": "DH550e8400-e29b-41d4-a716-446655440000",
      "bankCode": "MBBank",
      "accountNumber": "0903252427"
    }
  }
}
```

### 2. Check Payment Status (Frontend Poll)
```
POST /api/payment/check-payment-status
Content-Type: application/json

{
  "orderId": "550e8400-e29b-41d4-a716-446655440000"
}

Response:
{
  "success": true,
  "data": {
    "payment_status": "paid", // pending | paid | cancelled | order_not_found | error
    "message": "paid"
  }
}
```

### 3. Webhook from SePay
```
POST /api/payment/webhook
Content-Type: application/json

{webhook data from SePay...}

Response:
{
  "success": true,
  "message": "Thanh toán thành công"
}
```

### 4. Get Order Details
```
GET /api/payment/orders/{orderId}
Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "Lấy thông tin đơn hàng thành công",
  "data": {
    "id": "...",
    "users_id": "...",
    "amount": 500000,
    "slot_quantity": 1,
    "status": "paid",
    "transaction_id": "...",
    "transfer_content": "DH...",
    "created_at": "...",
    "updated_at": "...",
    "user": {...},
    "invoice": {...}
  }
}
```

### 5. Get User Orders
```
GET /api/payment/orders?page=1&limit=20
Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "Lấy danh sách đơn hàng thành công",
  "data": {
    "items": [...],
    "pagination": {
      "total": 10,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

### 6. Cancel Order
```
DELETE /api/payment/orders/{orderId}
Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "Hủy đơn hàng thành công",
  "data": {...}
}
```

## Environment Configuration

```env
# Sepay Configuration
SEPAY_API_URL=https://api.sepay.vn/v2
MERCHANT_ID=your_merchant_id
SECRET_KEY=your_secret_key

# Bank Account for QR Generation
SEPAY_BANK_CODE=MBBank  # or VCB, VIB, ACB, etc.
SEPAY_ACCOUNT_NUMBER=your_bank_account
```

## Setting Up Webhook in SePay Dashboard

1. Go to https://my.sepay.vn/
2. Navigate to: Tích hợp Webhooks → Thêm Webhooks
3. Configure:
   - **Tài khoản ngân hàng**: Select your bank account
   - **Gọi đến URL**: `https://your-domain.com/api/payment/webhook`
   - **Kiểu chứng thực**: API Key (optional, for added security)
4. Save and test the webhook

## Frontend Implementation (JavaScript)

```javascript
// Request payment and show QR
async function requestPayment(slotQuantity, amount) {
  const response = await fetch('/api/payment/request-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ slotQuantity, amount })
  });
  
  const data = await response.json();
  if (data.success) {
    const orderId = data.data.order.id;
    const qrUrl = data.data.qrCode.qrUrl;
    
    // Display QR code
    document.getElementById('qr-image').src = qrUrl;
    
    // Start polling for payment status every 2 seconds
    pollPaymentStatus(orderId);
  }
}

// Poll for payment status
async function pollPaymentStatus(orderId) {
  const interval = setInterval(async () => {
    const response = await fetch('/api/payment/check-payment-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
    
    const data = await response.json();
    
    if (data.data.payment_status === 'paid') {
      clearInterval(interval);
      // Show success message
      alert('Thanh toán thành công!');
      // Redirect or update UI
    }
  }, 2000); // Poll every 2 seconds
}
```

## Testing

### Test Transaction Flow
1. Call `POST /api/payment/request-payment` to create an order
2. Note the order ID and transfer content (DH...)
3. In SePay dashboard (test mode), trigger a webhook with matching transaction
4. Verify webhook is processed correctly
5. Check that order status changed to `paid`
6. Verify user slot count was incremented

### View Transaction Logs
- Check `transactions` table for all received transactions
- Filter by `status` to identify issues:
  - `success`: Processed successfully
  - `unmatched`: Order code not found in content
  - `order_not_found`: No matching order in database
  - `amount_mismatch`: Received amount doesn't match order
  - `duplicate_order`: Transaction already processed

## Security Considerations

1. **Validate webhook origin** (recommended but optional in basic setup)
2. **Use HTTPS** for all endpoints
3. **Never log sensitive data** (transaction details)
4. **Validate all inputs** on webhook handler
5. **Use transaction IDs** for deduplication (prevents replay attacks)
6. **Monitor webhook logs** in SePay dashboard regularly

## Troubleshooting

### Webhook not received
- Check webhook URL in SePay dashboard matches your domain
- Verify your server can be reached from internet
- Check firewall/network rules
- Review webhook logs in SePay dashboard

### Transactions not matched to orders
- Verify order code format is `DH{order_id}`
- Check regex pattern extracts correctly
- Ensure transfer content matches exactly

### Amount mismatch errors
- Verify exact amount in request matches bank transfer
- Check decimal handling for currency

## References

- Official Guide: https://sepay.vn/lap-trinh-cong-thanh-toan.html
- Webhook Docs: https://docs.sepay.vn/tich-hop-webhooks.html
- QR Code Tool: https://qr.sepay.vn/
- Bank Codes: https://qr.sepay.vn/banks.json
