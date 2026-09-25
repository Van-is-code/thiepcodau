# ✨ Wedding Web Frontend - Vite React Setup Complete!

## 🎯 Summary of What Was Created

Your Vite React wedding web application is now fully configured with:

### ✅ Core Setup
- **Build Tool**: Vite 5.x (ultra-fast development)
- **Framework**: React 18 with JSX
- **Routing**: React Router v6 with protected routes
- **HTTP Client**: Axios with interceptors
- **API**: Connected to https://api.thiepcuoi.me

### ✅ Project Structure

```
FE_Wedding_Web/
├── 📄 Configuration Files
│   ├── package.json           ← Dependencies & scripts
│   ├── vite.config.js         ← Vite settings
│   ├── index.html             ← HTML entry point
│   ├── .gitignore             ← Git configuration
│   └── .env.example           ← Environment template
│
├── 📁 src/ (Source Code)
│   ├── main.jsx               ← React entry point
│   ├── App.jsx                ← Main app with routing
│   ├── api.js                 ← API client (20+ endpoints)
│   ├── index.css              ← Global styles
│   │
│   ├── 📁 components/         ← Reusable components
│   │   └── TemplateLoader.jsx ← Dynamic template renderer
│   │
│   └── 📁 pages/              ← Page components
│       ├── Auth.jsx           ← Login/Register page
│       ├── Dashboard.jsx      ← Invitation management
│       ├── Pricing.jsx        ← Payment/slots page
│       └── Profile.jsx        ← User profile page
│
├── 📁 public/                 ← Static files
│   └── 📁 templates/          ← Wedding invitation templates
│       ├── mausen/            ← Template 1 (Classic)
│       │   └── mausen.html
│       ├── mautrangdo2/       ← Template 2 (Golden)
│       │   └── mautrangdo2.html
│       └── thiepmaucoban/     ← Template 3 (Modern)
│           └── index.html
│
└── 📄 Documentation
    ├── QUICK_START.md         ← 5-min setup guide (START HERE!)
    ├── VITE_SETUP.md          ← Complete documentation
    ├── SETUP_COMPLETE.md      ← This detailed summary
    ├── PAYMENT_GUIDE.md       ← Payment integration
    └── README.md              ← Original API docs
```

---

## 🚀 Getting Started in 3 Steps

### Step 1️⃣: Install Dependencies
```bash
npm install
```

### Step 2️⃣: Start Development Server
```bash
npm run dev
```

### Step 3️⃣: Open in Browser
```
http://localhost:5173
```

---

## 🎨 How the Template System Works

### The Flow
```
1. User visits: http://localhost:5173/minh-hoa-2025
                          ↓
2. React Router extracts slug: "minh-hoa-2025"
                          ↓
3. TemplateLoader fetches from API using slug
                          ↓
4. API returns invitation with template_id (e.g., 1)
                          ↓
5. TemplateLoader maps: template_id 1 → mausen/mausen.html
                          ↓
6. HTML template is loaded from public/templates/
                          ↓
7. Invitation data is injected into template
                          ↓
8. Template displays in iframe with populated data
```

### Template Data Injection

Templates use HTML with `data-field` attributes that get auto-populated:

```html
<!-- Before: In template HTML -->
<h1 data-field="title_vi">Default Title</h1>
<p data-field="groom">Groom Name</p>
<p data-field="bride">Bride Name</p>
<p data-field="ceremony_date">Date</p>

<!-- After: Populated with invitation data -->
<h1 data-field="title_vi">Đám Cưới Minh & Hoa</h1>
<p data-field="groom">Nguyễn Văn Minh</p>
<p data-field="bride">Phạm Thị Hoa</p>
<p data-field="ceremony_date">15/10/2025</p>
```

### Template ID Mapping

```javascript
// In src/components/TemplateLoader.jsx
const templateMap = {
  1: '/templates/mausen/mausen.html',        // Classic
  2: '/templates/mautrangdo2/mautrangdo2.html',  // Golden
  3: '/templates/thiepmaucoban/index.html',  // Modern Dark
}
```

When creating an invitation in your database, set the `template_id` to match.

---

## 🔐 Authentication & Routes

### Login/Register
```
http://localhost:5173/auth
```
- Create new account or login with existing credentials
- Token is automatically stored and used for all requests

### Protected Pages (Login Required)
```
http://localhost:5173/                    ← Dashboard
http://localhost:5173/dashboard           ← Same as /
http://localhost:5173/pricing             ← Payment page
http://localhost:5173/profile             ← User profile
```

### Public Pages (No Login Required)
```
http://localhost:5173/auth                ← Login/Register
http://localhost:5173/:slug               ← Public invitation (e.g., /minh-hoa-2025)
```

---

## 📊 API Integration

### Base URL
```
https://api.thiepcuoi.me
```

### Key Endpoints Used

**Authentication**
```
POST /api/users/login              ← Login
POST /api/users/register           ← Register
GET  /api/users/profile            ← Get profile
```

**Invitations**
```
GET  /api/invitations              ← List all
GET  /api/invitations/:id          ← Get one
GET  /api/invitations/slug/:slug   ← Get by slug (public)
POST /api/invitations              ← Create
PUT  /api/invitations/:id          ← Update
DELETE /api/invitations/:id        ← Delete
```

**Templates**
```
GET /api/invitation-templates      ← List all templates
```

### Using API in Components

```javascript
import { api } from '../api'

// Example: Fetch invitations
const response = await api.getInvitations()
const data = response.data.data

// Example: Get by slug
const response = await api.getInvitationBySlug('minh-hoa-2025')

// Example: Create invitation
const response = await api.createInvitation({
  title_vi: 'Đám Cưới...',
  ceremony_date: '2025-10-15',
  // ... other fields
})
```

---

## 🎯 Testing the Setup

### 1. Test Login/Register
1. Go to `http://localhost:5173/auth`
2. Click "Đăng Ký" to create account OR login with existing
3. Should see Bearer token in success message

### 2. Test Dashboard
1. After login, go to `http://localhost:5173/`
2. Should see list of invitations
3. Click "Xem Thiệp →" to view invitation

### 3. Test Template Rendering
1. Find an invitation with `template_id` in database
2. Visit `http://localhost:5173/{invitation_slug}`
3. Should see template with populated data

### 4. Test Different Templates
- Invite ID 1 displays `mausen/mausen.html` (Classic)
- Invite ID 2 displays `mautrangdo2/mautrangdo2.html` (Golden) 
- Invite ID 3 displays `thiepmaucoban/index.html` (Modern)

---

## 🛠️ Customization Guide

### Adding New Template

1. **Create HTML file:**
   ```html
   <!-- public/templates/my-template/index.html -->
   <!DOCTYPE html>
   <html>
   <head>
     <title data-field="title_vi">Thiệp Cưới</title>
   </head>
   <body>
     <h1 data-field="groom">Chú Rể</h1>
     <h1 data-field="bride">Cô Dâu</h1>
     <!-- Add more data-field attributes -->
   </body>
   </html>
   ```

2. **Add mapping:**
   ```javascript
   // src/components/TemplateLoader.jsx
   const templateMap = {
     1: '/templates/mausen/mausen.html',
     2: '/templates/mautrangdo2/mautrangdo2.html',
     3: '/templates/thiepmaucoban/index.html',
     4: '/templates/my-template/index.html',  // ADD THIS
   }
   ```

3. **Link in database:**
   - Create invitation with `template_id: 4`

### Modifying Existing Template

1. Edit HTML file: `public/templates/mausen/mausen.html`
2. Refresh browser (dev server auto-reloads)
3. Changes visible immediately

### Styling Components

- **Global styles**: `src/index.css`
- **Page styles**: Inline in component JSX
- **CSS-in-JS**: Supported via styled-components (add if needed)

---

## 📦 Available Scripts

```bash
# Development server (watch mode)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Install dependencies
npm install

# Update packages
npm update
```

---

## 🔄 Request Flow Example

### View Invitation by Public URL

```
Browser: http://localhost:5173/minh-hoa-2025
    ↓
React Router: Match route to TemplateLoader
    ↓
Extract slug: "minh-hoa-2025"
    ↓
API Call: GET /api/invitations/slug/minh-hoa-2025
    ↓
Response:
{
  id: "uuid",
  template_id: 1,
  groom: "Nguyễn Văn Minh",
  bride: "Phạm Thị Hoa",
  ceremony_date: "2025-10-15T09:00:00",
  venue_address: "Hà Nội"
}
    ↓
Load: public/templates/mausen/mausen.html
    ↓
Find all [data-field] elements
    ↓
Inject corresponding data values
    ↓
Render in iframe
```

---

## ✨ Features Implemented

- ✅ Complete Vite + React setup
- ✅ React Router with protected routes
- ✅ Axios API client with auth interceptor
- ✅ User authentication (login/register)
- ✅ Token-based authorization
- ✅ Dashboard with invitation list
- ✅ Dynamic template loading system
- ✅ 3 pre-built invitation templates
- ✅ Responsive design
- ✅ Form validation with password strength
- ✅ Error handling & loading states
- ✅ localStorage token management
- ✅ Automatic auth header injection
- ✅ User profile page
- ✅ Production-ready structure

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `QUICK_START.md` | **Start here!** 5-minute setup |
| `VITE_SETUP.md` | Complete technical documentation |
| `SETUP_COMPLETE.md` | This file (overview & guide) |
| `PAYMENT_GUIDE.md` | Payment integration (Sepay) |
| `README.md` | Original API documentation |

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 5173 in use | Kill process: `netstat -ano \| findstr :5173` |
| API not connecting | Verify API running at https://api.thiepcuoi.me |
| Template not rendering | Check `template_id` in database and mapping |
| White page after login | Check token in localStorage (DevTools) |
| Styling not updating | Hard refresh: Ctrl+Shift+R |
| 404 on template | Verify file path in `public/templates/` |

---

## 🎯 Next Steps

### Immediate (Today)
1. ✅ Run `npm install`
2. ✅ Run `npm run dev`
3. ✅ Test login at `/auth`
4. ✅ View invitation at `/:slug`

### Short Term (This Week)
1. Customize templates design
2. Test with real API credentials
3. Add more templates
4. Customize styling/branding

### Medium Term (This Month)
1. Implement guest management
2. Add payment integration (Sepay)
3. Customize dashboard features
4. Deploy to production

### Long Term
1. Add image uploads
2. Add music/audio support
3. Guest check-in features
4. Analytics/statistics

---

## 💡 Pro Tips

- **Use React DevTools**: Browser extension for debugging
- **Use Axios DevTools**: See all API requests
- **Check Network tab**: Monitor API calls
- **Use console logs**: Debug component state
- **Live reload**: Changes auto-update without refresh
- **Test mobile**: Use F12 Device Toolbar

---

## 📞 Support

### Documentation
- Vite: https://vitejs.dev
- React: https://react.dev
- React Router: https://reactrouter.com
- Axios: https://axios-http.com

### Your API
- Base: https://api.thiepcuoi.me
- Docs in: `PAYMENT_GUIDE.md` & `README.md`

---

## 🎉 You're Ready!

Your wedding web invitation system is ready to use!

### Start Development:
```bash
npm install && npm run dev
```

### Access:
```
http://localhost:5173
```

### Features Ready:
- ✅ Login/Register system
- ✅ Template-based invitations
- ✅ Dynamic data injection
- ✅ Public sharing via URL
- ✅ User dashboard
- ✅ Protected pages
- ✅ Responsive design

### Next: Read `QUICK_START.md` for detailed walkthrough!

---

**Created:** March 31, 2026  
**Framework:** Vite 5.x + React 18  
**API:** https://api.thiepcuoi.me  
**Status:** ✅ Ready to Use

**Happy Coding! 🚀✨**
