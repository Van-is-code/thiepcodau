# 📡 API Endpoints Reference

## Base URL
```
https://api.thiepcuoi.me
```

## Authentication

### Login
```
POST /api/users/login
Body: { "username": string, "password": string }
Response: { "token": string, ... }
```

### Register
```
POST /api/users/register
Body: { "username": string, "password": string }
Response: { "token": string, ... }
```

### Get Profile
```
GET /api/users/profile
Auth: Required (Bearer token)
Response: { "id": uuid, "username": string, "role": string, "slot": number, ... }
```

---

## Invitations

### Get All Invitations
```
GET /api/invitations
Auth: Required
Response: { "data": [{ "id": uuid, "title_vi": string, ... }] }
```

### Get Invitation by ID
```
GET /api/invitations/{id}
Auth: Required
Response: { "data": { invitation object } }
```

### Get Invitation by Slug (Public)
```
GET /api/invitations/slug/{slug}
Auth: Optional (public route)
Response: { "data": { invitation object } }
```

### Create Invitation
```
POST /api/invitations
Auth: Required
Body: {
  "title_vi": string,
  "template_id": number,
  "groom": string,
  "bride": string,
  "ceremony_date": datetime,
  "venue_address": string,
  ...
}
Response: { "data": { invitation object with id } }
```

### Update Invitation
```
PUT /api/invitations/{id}
Auth: Required
Body: { same as create }
Response: { "data": { updated invitation } }
```

### Delete Invitation
```
DELETE /api/invitations/{id}
Auth: Required
Response: { "success": true }
```

---

## Templates

### Get All Templates
```
GET /api/invitation-templates
Response: {
  "data": [
    { "id": 1, "name": "Mausen", "template_folder": "mausen", ... },
    { "id": 2, "name": "Mau Trang Do", "template_folder": "mautrangdo2", ... },
    { "id": 3, "name": "Thiep Mau Co Ban", "template_folder": "thiepmaucoban", ... }
  ]
}
```

### Get Template by ID
```
GET /api/invitation-templates/{id}
Response: { "data": { template object } }
```

---

## Guests

### Get Guests (by Invitation)
```
GET /api/guests?invitationId={invitationId}
Auth: Required
Response: { "data": [guest objects] }
```

### Create Guest
```
POST /api/guests
Auth: Required
Body: {
  "invitation_id": uuid,
  "name": string,
  "phone": string,
  "status": enum (invited, confirmed, declined),
  ...
}
Response: { "data": { guest object with id } }
```

### Update Guest
```
PUT /api/guests/{id}
Auth: Required
Body: { same as create }
Response: { "data": { updated guest } }
```

### Delete Guest
```
DELETE /api/guests/{id}
Auth: Required
Response: { "success": true }
```

---

## Check-ins & Messages

### Get Check-ins
```
GET /api/messages-checkins?invitationId={invitationId}
Auth: Optional
Response: {
  "data": [
    { "id": uuid, "name": string, "phone": string, "message": string, "timestamp": datetime },
    ...
  ]
}
```

### Create Check-in
```
POST /api/messages-checkins
Auth: Optional
Body: {
  "invitation_id": uuid,
  "name": string,
  "phone": string,
  "message": string
}
Response: { "data": { checkin object with id } }
```

---

## Grooms & Brides

### Get Grooms
```
GET /api/grooms
Auth: Required
Response: { "data": [{ "id": uuid, "name_groom": string, ... }] }
```

### Create Groom
```
POST /api/grooms
Auth: Required
Body: { "name_groom": string, "photo_url": string?, ... }
Response: { "data": { groom object with id } }
```

### Update Groom
```
PUT /api/grooms/{id}
Auth: Required
Body: { same as create }
Response: { "data": { updated groom } }
```

### Get Brides
```
GET /api/brides
Auth: Required
Response: { "data": [{ "id": uuid, "name_bride": string, ... }] }
```

### Create Bride
```
POST /api/brides
Auth: Required
Body: { "name_bride": string, "photo_url": string?, ... }
Response: { "data": { bride object with id } }
```

### Update Bride
```
PUT /api/brides/{id}
Auth: Required
Body: { same as create }
Response: { "data": { updated bride } }
```

---

## Payments (Sepay Integration)

### Request Payment
```
POST /api/payments/request-payment
Auth: Required
Body: { "slotQuantity": number, "amount": number? }
Response: {
  "data": {
    "order": { "id": uuid, "amount": number, "slotQuantity": number, "status": "pending" },
    "qrCode": { "qrUrl": string, "orderCode": uuid, "amount": number, "description": string }
  }
}
```

### Get Orders
```
GET /api/payments/orders?page=1&limit=20
Auth: Required
Response: {
  "data": {
    "items": [order objects],
    "pagination": { "total": number, "page": number, "limit": number, "totalPages": number }
  }
}
```

### Get Order by ID
```
GET /api/payments/orders/{orderId}
Auth: Required
Response: { "data": { order object with invoice details } }
```

### Cancel Order
```
DELETE /api/payments/orders/{orderId}
Auth: Required
Response: { "data": { "id": uuid, "status": "cancelled" } }
```

### Payment Webhook (from Sepay)
```
POST /api/payments/webhook
Body: {
  "orderCode": uuid,
  "transactionCode": string,
  "amount": number,
  "status": "success"
}
Response: { "success": true, "order": { order object with updated slots } }
```

---

## Error Responses

### 400 Bad Request
```json
{ "success": false, "message": "Invalid input", "errors": { "field": "error message" } }
```

### 401 Unauthorized
```json
{ "success": false, "message": "Token invalid or expired" }
```

### 403 Forbidden
```json
{ "success": false, "message": "Access denied" }
```

### 404 Not Found
```json
{ "success": false, "message": "Resource not found" }
```

### 500 Internal Server Error
```json
{ "success": false, "message": "Internal server error" }
```

---

## Frontend Usage Examples

### Using apiTest in Browser Console

```javascript
// Run full diagnostics
await apiTest.runFullDiagnostics()

// Test specific endpoints
await apiTest.testInvitations()
await apiTest.testProfile()

// Manual API call
const token = localStorage.getItem('token')
fetch('https://api.thiepcuoi.me/api/invitations', {
  headers: { 'Authorization': 'Bearer ' + token }
})
.then(r => r.json())
.then(d => console.log(d))
```

### Using api client in Code

```javascript
import { api } from './api'

// Login
const loginRes = await api.login('username', 'password')
localStorage.setItem('token', loginRes.data.data.token)

// Get invitations
const invRes = await api.getInvitations()
console.log(invRes.data.data)

// Get invitation by slug
const invBySlug = await api.getInvitationBySlug('my-wedding')

// Get profile
const profileRes = await api.getProfile()

// Create invitation
const newInv = await api.createInvitation({
  title_vi: 'Thiệp Cưới',
  template_id: 1,
  groom: 'Groom Name',
  bride: 'Bride Name',
  ceremony_date: '2024-12-25',
  venue_address: 'Some Address'
})

// Request payment
const paymentRes = await api.requestPayment(5) // 5 slots
const qrUrl = paymentRes.data.data.qrCode.qrUrl
// Show QR to user...
```

---

## Template Data Fields

Each template expects these fields to be injected via `data-field` attributes:

```json
{
  "id": "uuid",
  "title_vi": "Wedding Invitation Title",
  "groom": "Groom Name",
  "bride": "Bride Name",
  "ceremony_date": "2024-12-25",
  "venue_address": "Wedding Location Address",
  "reception_date": "2024-12-25",
  "reception_venue_address": "Reception Location Address",
  "thank_you_message": "Thank you for attending our wedding!",
  "invitation_slug": "my-wedding",
  "template_id": 1,
  "music_url": "https://...",
  "invitation_images": [
    { "image_type": "cover", "image_url": "https://..." },
    { "image_type": "groom", "image_url": "https://..." },
    { "image_type": "bride", "image_url": "https://..." }
  ]
}
```

### Template Attributes
```html
<!-- Text fields -->
<h1 data-field="title_vi">Title</h1>
<p data-field="groom">Groom</p>

<!-- Image fields -->
<img data-image="cover" src="placeholder.jpg" />
<img data-image="groom" src="placeholder.jpg" />

<!-- Audio -->
<audio>
  <source src="" type="audio/mpeg" />
</audio>
```

---

## Status Codes Mapping

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 204 | No Content - Successful, no content returned |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Need authentication |
| 403 | Forbidden - Access denied |
| 404 | Not Found - Resource doesn't exist |
| 422 | Unprocessable Entity - Validation failed |
| 500 | Internal Server Error - Backend error |

---

## Rate Limiting
No rate limiting mentioned in current API docs. Confirm with backend team if applicable.

---

**Last Updated:** 2024-03-31  
**For more details:** Check `/api-docs` on backend
