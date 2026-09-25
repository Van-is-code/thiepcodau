# Wedding Web Frontend - Vite React

A modern React application for wedding invitations built with Vite, featuring API integration with dynamic template loading.

## 🎯 Project Overview

This frontend application allows users to:
- Create and manage wedding invitations
- View invitation templates dynamically based on template ID
- Share invitations via unique URLs
- Manage guest lists and check-ins
- Handle payments for additional slots

## 📋 Tech Stack

- **Vite** - Ultra-fast build tool
- **React 18** - UI library
- **React Router v6** - Client-side routing
- **Axios** - HTTP client
- **CSS-in-JS** - Dynamically styled components

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 3. Build for Production

```bash
npm run build
```

### 4. Preview Production Build

```bash
npm run preview
```

## 🏗️ Project Structure

```
src/
├── main.jsx              # Entry point
├── App.jsx               # Main app with routing
├── api.js                # API client and endpoints
├── index.css             # Global styles
├── components/
│   └── TemplateLoader.jsx # Dynamic template renderer
├── pages/
│   ├── Auth.jsx          # Login/Register page
│   ├── Dashboard.jsx     # Invitation management
│   ├── Pricing.jsx       # Slot purchase
│   └── Profile.jsx       # User profile
└── public/
    └── templates/        # HTML templates
        ├── mausen/
        ├── mautrangdo2/
        └── thiepmaucoban/
```

## 🔌 API Configuration

### Base URL
```
https://api.thiepcuoi.me
```

### Features

The API client (`src/api.js`) provides methods for:

#### Authentication
- `api.login(username, password)` - User login
- `api.register(username, password)` - New user registration

#### Invitations
- `api.getInvitations()` - List all invitations
- `api.getInvitationById(id)` - Get specific invitation
- `api.getInvitationBySlug(slug)` - Get by URL slug
- `api.createInvitation(data)` - Create new invitation
- `api.updateInvitation(id, data)` - Update invitation
- `api.deleteInvitation(id)` - Delete invitation

#### Templates
- `api.getTemplates()` - List all templates
- `api.getTemplateById(id)` - Get template details

#### Guests & Checkins
- `api.getGuests(invitationId)` - Get guest list
- `api.createGuest(data)` - Add guest
- `api.getCheckins(invitationId)` - Get check-ins
- `api.createCheckin(data)` - Record attendance

#### Payments
- `api.requestPayment(slotQuantity, amount)` - Create payment order
- `api.getOrders(page, limit)` - Get user's orders
- `api.getOrderById(orderId)` - Get order details
- `api.cancelOrder(orderId)` - Cancel order

#### Profile
- `api.getProfile()` - Get user profile
- `api.updateProfile(data)` - Update profile

## 🎨 Template System

### How It Works

1. **Template Loading**: When a user visits `/:slug`, the TemplateLoader component:
   - Fetches the invitation by slug from the API
   - Retrieves the `template_id` from the invitation
   - Loads the corresponding HTML template

2. **Template Mapping**: Template IDs map to template files:
   - `template_id: 1` → `/templates/mausen/mausen.html`
   - `template_id: 2` → `/templates/mautrangdo2/mautrangdo2.html`
   - `template_id: 3` → `/templates/thiepmaucoban/index.html`

3. **Data Injection**: Invitation data is injected into the template HTML:
   ```html
   <!-- Elements with data-field attribute are auto-populated -->
   <h1 data-field="title_vi">Thiệp Cưới</h1>
   <p data-field="groom">Chú rể</p>
   <p data-field="bride">Cô dâu</p>
   <p data-field="venue_address">Địa điểm</p>
   ```

### Creating Custom Templates

1. Create a new HTML file in `public/templates/your-template/`
2. Use `data-field` attributes for dynamic content:
   ```html
   <div data-field="groom">Default Name</div>
   ```
3. Add template ID mapping in `TemplateLoader.jsx`:
   ```javascript
   const templateMap = {
     4: '/templates/your-template/index.html',
   }
   ```
4. Update the database to link invitations to the new template ID

## 🔐 Authentication

### Login Flow

1. User enters credentials on `/auth`
2. API returns bearer token on successful login
3. Token is stored in localStorage
4. Token is automatically added to all subsequent requests

### Protected Routes

Routes that require authentication:
- `/` (Dashboard)
- `/dashboard`
- `/pricing`
- `/profile`

Public routes:
- `/auth` (Login/Register)
- `/:slug` (Public invitation view)

## 📱 Responsive Design

The application is fully responsive:
- Desktop (>800px)
- Tablet (600px-800px)
- Mobile (<600px)

## 🎯 Usage Examples

### View Public Invitation

```
http://localhost:5173/minh-hoa-2025
```

The URL slug (`minh-hoa-2025`) must match the `invitation_slug` in the database.

### Access Dashboard

1. Go to `/auth`
2. Login with your credentials
3. View all your invitations in the dashboard
4. Click "Xem Thiệp →" to view invitation
5. Share the public URL with guests

### Manage Slots

1. Go to `/pricing`
2. Select number of slots to purchase
3. Make payment
4. Slots are automatically added to your account

## 🌐 Environment Variables

Create a `.env` file if needed (currently API URL is hardcoded):

```env
VITE_API_URL=https://api.thiepcuoi.me
VITE_APP_NAME=Thiệp Cưới
```

Update Vite config to use environment variables:
```javascript
import.meta.env.VITE_API_URL
```

## 🐛 Common Issues

### API Not Responding

1. Check that API server is running: `https://api.thiepcuoi.me`
2. Check browser console for CORS errors
3. Verify authentication token is valid

### Template Not Loading

1. Check template file exists in `/public/templates/`
2. Verify template ID mapping in `TemplateLoader.jsx`
3. Check that invitation has correct `template_id` in database

### Token Expired

1. Clear localStorage and log in again
2. Token is automatically added to requests via axios interceptor

## 📚 API Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* response data */ }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": { /* field errors */ }
}
```

## 🔄 Component Communication

### Using API in Components

```javascript
import { api } from '../api'

// In useEffect
const fetchData = async () => {
  try {
    const response = await api.getInvitations()
    setData(response.data.data)
  } catch (error) {
    console.error('Error:', error)
  }
}
```

## 📦 Deployment

### Build for Production

```bash
npm run build
```

Output will be in the `dist/` folder.

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

### Deploy to Netlify

```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

## 🤝 Contributing

When adding new features:

1. Create components in `/src/components/`
2. Create pages in `/src/pages/`
3. Add API methods to `/src/api.js`
4. Add routes to `/src/App.jsx`
5. Test with `npm run dev`

## 📞 Support

For API documentation, see `PAYMENT_GUIDE.md` for payment-related endpoints.

## 📄 License

MIT License - See LICENSE file for details

---

**Last Updated:** March 31, 2026
**Vite Version:** 5.x
**React Version:** 18.x
