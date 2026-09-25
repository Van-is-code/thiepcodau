# 💍 Wedding Web - Frontend

Giao diện React + Vite cho hệ thống quản lý thiệp cưới.

## 🚀 Công Nghệ

- **Vite 5.x** - Build tool cực nhanh
- **React 18** - UI framework
- **React Router v6** - Client-side routing
- **Axios** - HTTP client

## 📥 Cài Đặt

1. **Cài đặt dependencies:**
   ```bash
   npm install
   ```

2. **Chạy development server:**
   ```bash
   npm run dev
   ```
   Mở: `http://localhost:5173`

3. **Build production:**
   ```bash
   npm run build
   ```

## 📂 Cấu Trúc Thư Mục

```
src/
  ├── api.js                 # API client (Axios)
  ├── App.jsx                # Routes & authentication
  ├── main.jsx               # Entry point
  ├── index.css              # Global styles
  ├── pages/
  │   ├── Auth.jsx           # Login & Register
  │   ├── Dashboard.jsx      # Invitations list
  │   ├── Profile.jsx        # User profile
  │   └── Pricing.jsx        # Buy slots
  ├── components/
  │   └── TemplateLoader.jsx # Template renderer
  └── utils/
      └── (utilities)

public/
  └── templates/             # HTML invitation templates
      ├── mausen/
      ├── mautrangdo2/
      └── thiepmaucoban/
```

## 🔑 API Integration

API Base URL: `https://api.thiepcuoi.me`

### Authentication
- **Login:** `POST /api/users/login`
- **Register:** `POST /api/users/register`
- **Profile:** `GET /api/users/profile`

### Invitations
- **List:** `GET /api/invitations`
- **By Slug:** `GET /api/invitations/slug/:slug`
- **Create:** `POST /api/invitations`
- **Update:** `PUT /api/invitations/:id`
- **Delete:** `DELETE /api/invitations/:id`

### Templates
- **List:** `GET /api/invitation-templates`
- **Get Template:** `GET /api/invitation-templates/:id`

### Payments
- **Request Payment:** `POST /api/payments/request-payment`
- **Get Orders:** `GET /api/payments/orders`

## 🎨 Pages

### Auth Page (`/auth`)
- Login form
- Register form
- Token display
- Password strength meter

### Dashboard (`/`)
- List user's invitations
- Links to view invitations
- Navigation to pricing and profile

### Profile (`/profile`)
- User information
- Slot count
- Join date

### Pricing (`/pricing`)
- Package options (1, 5, 10, 20 slots)
- Price calculation
- Payment initiation (Sepay integration)

### Template Loader (`/:slug`)
- Public invitation view
- Dynamic template loading
- Data injection from API

## 🔐 Security

- Token stored in localStorage
- Axios interceptor adds `Authorization: Bearer {token}`
- Protected routes redirect to `/auth` if not authenticated
- Token-based API calls

## 🎯 Features

✅ User authentication (login/register)
✅ Create & manage invitations
✅ Multiple invitation templates
✅ Public invitation sharing (via slug)
✅ User profile management
✅ Buy additional slots (Sepay integration)
✅ Responsive design
✅ Error handling with retry

## 📋 Environment Variables

Create `.env.local`:
```env
VITE_API_URL=https://api.thiepcuoi.me
```

(Optional - default is built into `src/api.js`)

## 🐛 Troubleshooting

### Login works but Dashboard shows blank
1. Check browser console for errors (F12)
2. Verify API endpoint: `https://api.thiepcuoi.me`
3. Check Network tab (F12 → Network) for failed requests
4. Ensure backend is running

### Template not loading
1. Check invitation slug is correct
2. Verify template_id in database matches template folder
3. Check `public/templates/` folder exists
4. See browser console for errors

### Cannot reach API
1. Check if backend is running
2. Verify API URL in `src/api.js`
3. Check CORS headers if running locally
4. Look at Network tab (F12) for actual error

## 📚 Production Deployment

1. **Build:**
   ```bash
   npm run build
   ```

2. **Deploy `dist/` folder** to:
   - Vercel
   - Netlify
   - AWS S3
   - GitHub Pages
   - Any static hosting

## 📞 Support

- Check API endpoints in `src/api.js`
- See console logs (F12 → Console)
- Check Network requests (F12 → Network)
- Review backend API documentation
Ngoài endpoint chính phía trên, hệ thống cũng hỗ trợ alias theo snake_case/singular:
- `/user`, `/invitation`, `/invitation_templates`, `/private_invitation`, `/invitation_images`, `/guest`, `/messages_checkins`, `/groom`, `/bride`

## Mapping bảng SQL
- `users`
- `invitation_templates`
- `invitations`
- `invitation_images`
- `private_invitation`
- `guest`
- `messages_checkins`
- `groom`
- `bride`

## Postman
Collection mới nằm tại file: `postman.json`
- Import file này vào Postman
- Cập nhật biến `baseUrl` nếu cần
- Cập nhật các biến id (`userId`, `invitationId`, ...) theo dữ liệu thực tế trước khi gọi endpoint detail/update/delete

## Payment API (Mua slot)
Base URL: `http://localhost:3000/api/payments`

### 1. Tạo đơn thanh toán và lấy QR
- Method: `POST`
- URL: `/request-payment`
- Auth: Bearer token (user đã đăng nhập)
- Body:

```json
{
   "slotQuantity": 5,
   "amount": 250000
}
```

- Ghi chú:
   - `slotQuantity`: số slot muốn mua (số nguyên dương)
   - `amount`: tổng tiền FE tính sẵn (VND, số nguyên dương)

- Response mẫu:

```json
{
   "success": true,
   "message": "Tạo đơn thanh toán thành công",
   "data": {
      "order": {
         "id": "order-uuid",
         "amount": 250000,
         "slotQuantity": 5,
         "status": "pending",
         "transferContent": "WeddingWebA1B2C3D4E5"
      },
      "qrCode": {
         "qrUrl": "https://api.sepay.vn/v2/qr-pay?...",
         "orderCode": "order-uuid",
         "amount": 250000,
         "transferContent": "WeddingWebA1B2C3D4E5"
      }
   }
}
```

### 2. Webhook/IPN từ SePay
- Method: `POST`
- URL: `/webhook`
- Auth: không cần Bearer token (gọi server-to-server từ SePay)
- Body (theo dữ liệu SePay gửi):

```json
{
   "orderCode": "order-uuid",
   "transactionCode": "txn-id",
   "amount": 250000,
   "status": "success",
   "transferContent": "WeddingWebA1B2C3D4E5"
}
```

- Kết quả khi thành công:
   - Cập nhật order sang `paid`
   - Tạo hóa đơn trong bảng `invoices`
   - Cộng slot cho user theo `slot_quantity`

### 3. Lấy danh sách đơn hàng của user
- Method: `GET`
- URL: `/orders?page=1&limit=20`
- Auth: Bearer token

### 4. Lấy chi tiết một đơn hàng
- Method: `GET`
- URL: `/orders/:orderId`
- Auth: Bearer token

### 5. Hủy đơn hàng
- Method: `DELETE`
- URL: `/orders/:orderId`
- Auth: Bearer token
- Ghi chú: chỉ hủy được đơn đang `pending`

### Trạng thái đơn hàng
- `pending`: chờ thanh toán
- `paid`: đã thanh toán thành công
- `cancelled`: đã hủy


