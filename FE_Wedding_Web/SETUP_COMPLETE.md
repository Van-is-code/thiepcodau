# 📋 Vite React Wedding Web - Complete Setup Summary

**Date Created:** March 31, 2026
**Framework:** Vite + React 18
**API Base URL:** https://api.thiepcuoi.me

## ✅ What Was Created

### 1. Configuration Files
- ✅ `package.json` - Dependencies & scripts
- ✅ `vite.config.js` - Vite configuration
- ✅ `index.html` - HTML entry point
- ✅ `.gitignore` - Git ignore rules
- ✅ `.env.example` - Environment variables template

### 2. Source Files (`src/`)
- ✅ `main.jsx` - React entry point
- ✅ `App.jsx` - Main app with routing (React Router v6)
- ✅ `api.js` - Axios API client with 20+ endpoints
- ✅ `index.css` - Global styles

### 3. Components
- ✅ `components/TemplateLoader.jsx` - Dynamic HTML template renderer

### 4. Pages
- ✅ `pages/Auth.jsx` - Login/Register with validation
- ✅ `pages/Dashboard.jsx` - Invitation management
- ✅ `pages/Pricing.jsx` - Payment/slots page
- ✅ `pages/Profile.jsx` - User profile page

### 5. Templates (`public/templates/`)
- ✅ `templates/mausen/mausen.html` - Classic template
- ✅ `templates/mautrangdo2/mautrangdo2.html` - Golden template
- ✅ `templates/thiepmaucoban/index.html` - Modern dark template

### 6. Documentation
- ✅ `VITE_SETUP.md` - Comprehensive setup documentation (2000+ words)
- ✅ `QUICK_START.md` - Quick start guide
- ✅ `SETUP_COMPLETE.md` - This file

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────┐
│         Browser / Vite Dev Server               │
│         http://localhost:5173                   │
└────────────────┬────────────────────────────────┘
                 │
         ┌───────┴────────┐
         │                │
    ┌────▼─────┐    ┌────▼─────┐
    │  Routes  │    │  Pages   │
    ├──────────┤    ├──────────┤
    │ / (dash) │    │ Auth     │
    │ /auth    │    │Dashboard │
    │ /pricing │    │Pricing   │
    │ /profile │    │Profile   │
    │ /:slug   │    │Template  │
    └────┬─────┘    └────▬─────┘
         │               │
         └───────┬───────┘
                 │
         ┌───────▼────────────────┐
         │   API Client (axios)   │
         │   src/api.js           │
         │                        │
         │  - Authentication      │
         │  - Invitations         │
         │  - Templates           │
         │  - Guests              │
         │  - Payments            │
         └───────┬────────────────┘
                 │
         ┌───────▼──────────────────┐
         │  API Server              │
         │ https://api.thiepcuoi.me │
         │                          │
         │  - User Management       │
         │  - Invitation CRUD       │
         │  - Template Management   │
         │  - Payment Processing    │
         └──────────────────────────┘

         ┌────────────────────────────────┐
         │   Static Files (Vite)          │
         │   /public/templates/           │
         │                                │
         │  - mausen/mausen.html          │
         │  - mautrangdo2/mausn.html      │
         │  - thiepmaucoban/index.html    │
         └────────────────────────────────┘
```

## 🔄 Request/Response Flow

### 1. Public Invitation View (No Auth Required)
```
User visits: http://localhost:5173/minh-hoa-2025
                    ↓
           URL parsed by React Router
                    ↓
           TemplateLoader component rendered
                    ↓
           Fetch invitation by slug from API
                    ↓
           Get template_id from invitation data
                    ↓
           Load HTML template from public/templates/
                    ↓
           Inject invitation data into template
                    ↓
           Display in iframe
```

### 2. Protected Routes (Auth Required)
```
User visits: http://localhost:5173/
                    ↓
           Check localStorage for token
                    ↓
      Token missing/invalid? Redirect to /auth
                    ↓
           Token valid? Render Dashboard
                    ↓
           Fetch invitations from API
                    ↓
           Display invitation list
```

### 3. API Request with Auth
```
Any API call
    ↓
axios interceptor checks localStorage
    ↓
Add "Authorization: Bearer {token}" header
    ↓
Send request to https://api.thiepcuoi.me
    ↓
Receive response & parse JSON
    ↓
Update component state & render
```

## 📊 Data Structure

### Invitation Object (from API)
```javascript
{
  id: "uuid",
  users_id: "uuid",
  template_id: 1,           // Maps to template file
  invitation_slug: "minh-hoa-2025",  // Used in URL
  title_vi: "Đám Cưới Minh & Hoa",
  ceremony_date: "2025-10-15T09:00:00",
  venue_address: "Trung Tâm Tiệc Cưới, Hà Nội",
  reception_date: "2025-10-15",
  reception_venue_address: "Nhà Hàng Ngọc Lan, Hà Nội",
  thank_you_message: "Message...",
  groom: { name_groom: "Nguyễn Văn Minh" },
  bride: { name_bride: "Phạm Thị Hoa" },
  invitation_images: [
    { image_type: "cover", image_url: "..." }
  ]
}
```

### Template Mapping
```javascript
template_id: 1  →  /templates/mausen/mausen.html
template_id: 2  →  /templates/mautrangdo2/mautrangdo2.html
template_id: 3  →  /templates/thiepmaucoban/index.html
```

## 🚀 Getting Started (3 Steps)

### Step 1: Install
```bash
npm install
```

### Step 2: Start Dev Server
```bash
npm run dev
```

### Step 3: Open Browser
```
http://localhost:5173
```

## 🔐 Authentication System

### Login Process
1. User submits username & password to `/auth`
2. Backend validates credentials
3. Backend returns JWT token
4. Token stored in `localStorage`
5. Token sent in `Authorization` header for all requests

### Token Management
- **Storage**: `localStorage.getItem('token')`
- **Clear on logout**: `localStorage.removeItem('token')`
- **Auto-include**: Axios interceptor adds to headers

### Protected Routes
- `/` (Dashboard)
- `/dashboard`
- `/pricing`
- `/profile`

### Public Routes
- `/auth` (Login/Register)
- `/:slug` (Public invitation view)

## 📝 API Endpoints Used

### Authentication
```
POST /api/users/login        - Login
POST /api/users/register     - Register
GET  /api/users/profile      - Get profile
```

### Invitations
```
GET    /api/invitations              - List all
GET    /api/invitations/:id          - Get one
GET    /api/invitations/slug/:slug   - Get by slug
POST   /api/invitations              - Create
PUT    /api/invitations/:id          - Update
DELETE /api/invitations/:id          - Delete
```

### Templates
```
GET /api/invitation-templates        - List templates
GET /api/invitation-templates/:id    - Get template
```

### Guests & Checkins
```
GET  /api/guests                     - List guests
POST /api/guests                     - Create guest
GET  /api/messages-checkins          - List checkins
POST /api/messages-checkins          - Create checkin
```

### Payments
```
POST   /api/payments/request-payment - Create payment order
GET    /api/payments/orders          - List orders
GET    /api/payments/orders/:id      - Get order
DELETE /api/payments/orders/:id      - Cancel order
```

## 🎨 Template System Details

### Template Data Injection

Templates use HTML elements with `data-field` attributes:

```html
<!-- Basic field -->
<h1 data-field="title_vi">Default Title</h1>

<!-- Nested data -->
<p data-field="groom">Groom Name</p>

<!-- Date field -->
<p data-field="ceremony_date">Date</p>

<!-- Address field -->
<p data-field="venue_address">Venue</p>

<!-- Message field -->
<div data-field="thank_you_message">Thank you message</div>
```

The TemplateLoader component automatically:
1. Finds all `[data-field]` elements
2. Gets corresponding value from invitation data
3. Updates element's text content

### Adding New Templates

1. **Create HTML file**
   ```
   public/templates/new-template/index.html
   ```

2. **Add data-field attributes**
   ```html
   <h1 data-field="title_vi">Title</h1>
   ```

3. **Update mapping** in `src/components/TemplateLoader.jsx`
   ```javascript
   const templateMap = {
     4: '/templates/new-template/index.html'
   }
   ```

4. **Link in database** - Set `template_id = 4` for invitations

## 📦 Dependencies

### Core
- `react@18.2.0` - UI framework
- `react-dom@18.2.0` - React DOM
- `react-router-dom@6.20.0` - Routing
- `axios@1.6.0` - HTTP client

### Dev
- `vite@5.0.0` - Build tool
- `@vitejs/plugin-react@4.2.0` - React plugin

## 🔄 Workflow Example

### Create & View Invitation

1. **Dashboard** (`/`)
   - Shows list of user's invitations
   - Each invitation has "Xem Thiệp →" button

2. **Click to View**
   - Redirects to `/:slug`
   - Example: `/minh-hoa-2025`

3. **TemplateLoader Component**
   - Fetches invitation from API
   - Gets `template_id` (e.g., 1)
   - Loads `templates/mausen/mausen.html`
   - Injects invitation data
   - Displays in iframe

4. **Share with Guests**
   - Copy public URL
   - Share on social media
   - Guests view without login

## 🛠️ Development Tips

### Add New Page
1. Create file in `src/pages/NewPage.jsx`
2. Add route in `src/App.jsx`
3. Import and use in routing

### Add New API Endpoint
1. Add method to `src/api.js`
2. Export from API object
3. Import in components with `import { api } from '../api'`

### Modify Template
1. Edit HTML in `public/templates/`
2. Run dev server - changes are live
3. Refresh browser to see updates

### Debug API Issues
1. Open DevTools (F12)
2. Network tab → monitor requests
3. Check request/response headers & body
4. Verify authentication token is sent

## 📈 Production Build

```bash
# Create optimized build
npm run build

# Preview production build
npm run preview

# Output folder: dist/
```

Deploy `dist/` folder to your hosting:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Traditional web hosting

## ✨ Features Implemented

- ✅ User authentication (login/register)
- ✅ Protected routes with token validation
- ✅ Dynamic template loading based on invitation
- ✅ Public invitation sharing via URL slug
- ✅ Responsive design
- ✅ API error handling
- ✅ Loading states
- ✅ Form validation
- ✅ Password strength indicator
- ✅ Dashboard with invitation list
- ✅ User profile page
- ✅ Axios interceptor for auth
- ✅ localStorage token management
- ✅ Modal/Dialog ready structure

## 🎯 Next Steps

After this setup is working:

1. **Test API Connection**
   - Verify API server is running
   - Test login with real credentials

2. **Customize Styling**
   - Update colors in templates
   - Modify page layouts
   - Add custom CSS

3. **Add More Templates**
   - Create new template designs
   - Update mapping
   - Link in database

4. **Implement Payment**
   - Integrate Sepay API
   - Update pricing page
   - Test payment flow

5. **Deploy**
   - Build production
   - Deploy to hosting
   - Set up CI/CD

## 📞 Support & Resources

- **Vite Docs**: https://vitejs.dev
- **React Docs**: https://react.dev
- **React Router**: https://reactrouter.com
- **Axios Docs**: https://axios-http.com
- **API Server**: https://api.thiepcuoi.me

## 📄 Documentation Files

- `QUICK_START.md` - Fast 5-minute setup
- `VITE_SETUP.md` - Comprehensive guide
- `PAYMENT_GUIDE.md` - Payment integration
- `README.md` - Original backend info
- `Wedding_Web.postman_collection.json` - API endpoints

---

## 🎉 You're All Set!

Your Vite React wedding web frontend is ready to use.

**Start development:**
```bash
npm install && npm run dev
```

**Access the app:**
```
http://localhost:5173
```

**Create a test invitation:**

1. Login at `/auth`
2. Should appear in Dashboard
3. Click to view as `/:slug`
4. See template render with your data

**Happy coding! 🚀**
