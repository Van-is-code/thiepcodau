# 🚀 Quick Start Guide - Wedding Web Frontend

## Prerequisites
- Node.js 16+ and npm
- VS Code (recommended)

## Installation & Setup

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start Development Server
```bash
npm run dev
```

The app will start at `http://localhost:5173`

### Step 3: Test the Application

#### Access Features:
1. **Login/Register**: Go to `http://localhost:5173/auth`
   - Create a new account or login
   - Use credentials from your backend

2. **Dashboard**: Go to `http://localhost:5173/`
   - View all your invitations
   - Click "Xem Thiệp →" to view a public invitation

3. **View Public Invitation**: Go to `http://localhost:5173/:slug`
   - Example: `http://localhost:5173/minh-hoa-2025`
   - The URL slug must exist in your database

4. **Profile**: Go to `http://localhost:5173/profile`
   - View your account information
   - Check your available slots

## 📋 Project Structure

```
FE_Wedding_Web/
├── public/
│   └── templates/              # Template HTML files
│       ├── mausen/
│       ├── mautrangdo2/
│       └── thiepmaucoban/
├── src/
│   ├── components/
│   │   └── TemplateLoader.jsx  # Dynamic template renderer
│   ├── pages/
│   │   ├── Auth.jsx            # Login/Register
│   │   ├── Dashboard.jsx       # Invitation list
│   │   ├── Pricing.jsx         # Payment page
│   │   └── Profile.jsx         # User profile
│   ├── App.jsx                 # Main app & routing
│   ├── api.js                  # API client
│   ├── index.css               # Global styles
│   └── main.jsx                # Entry point
├── index.html                  # HTML template
├── vite.config.js              # Vite configuration
├── package.json                # Dependencies
├── VITE_SETUP.md               # Detailed documentation
└── README.md                   # Original README
```

## 🔌 API Integration

The application connects to: `https://api.thiepcuoi.me`

### Key Endpoints Used:
- `POST /api/users/login` - User authentication
- `POST /api/users/register` - User registration
- `GET /api/invitations` - List invitations
- `GET /api/invitations/:id` - Get invitation details
- `GET /api/invitations/slug/:slug` - Get invitation by slug (public view)
- `GET /api/invitation-templates` - List templates
- And more... (see `src/api.js`)

## 🎨 Template System

### How Templates Work

1. **Invitation Template ID** → Maps to HTML file
   - `template_id: 1` → `public/templates/mausen/mausen.html`
   - `template_id: 2` → `public/templates/mautrangdo2/mautrangdo2.html`
   - `template_id: 3` → `public/templates/thiepmaucoban/index.html`

2. **Open an Invitation by URL**
   ```
   http://localhost:5173/minh-hoa-2025
   ```
   The `minh-hoa-2025` slug is matched with `invitation_slug` in database

3. **The TemplateLoader Component**:
   - Fetches invitation data from API
   - Gets the `template_id`
   - Loads the corresponding HTML file from `public/templates/`
   - Injects invitation data (names, dates, locations, etc.)
   - Displays in an iframe

### Adding a New Template

1. Create HTML file in `public/templates/your-template/index.html`
2. Use `data-field` attributes for dynamic content:
   ```html
   <h1 data-field="title_vi">Thiệp Cưới</h1>
   <p data-field="groom">Chú Rể</p>
   <p data-field="bride">Cô Dâu</p>
   <p data-field="venue_address">Địa Điểm</p>
   ```
3. Update `src/components/TemplateLoader.jsx`:
   ```javascript
   const templateMap = {
     1: '/templates/mausen/mausen.html',
     2: '/templates/mautrangdo2/mautrangdo2.html',
     3: '/templates/thiepmaucoban/index.html',
     4: '/templates/your-template/index.html',  // Add this
   }
   ```
4. In your database, set invitation `template_id` to 4

## 🔐 Authentication Flow

1. User visits `/auth`
2. Enters username & password
3. Backend returns bearer token
4. Token stored in localStorage
5. Token automatically sent in all API requests

## 📦 Build for Production

```bash
npm run build
```

Output files will be in `dist/` folder

Deploy to your hosting:
- Vercel: `vercel deploy`
- Netlify: `netlify deploy --prod --dir=dist`
- Traditional hosting: Upload `dist/` files

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 5173 already in use | Change port in `vite.config.js` or kill the process |
| API connection error | Check API server is running at `https://api.thiepcuoi.me` |
| Template not loading | Verify template file path and template ID mapping |
| Login fails | Check credentials and API response in browser console |
| Styling issues | Clear browser cache or hard refresh (Ctrl+Shift+R) |

## 📚 Additional Resources

- **Vite Documentation**: https://vitejs.dev
- **React Documentation**: https://react.dev
- **React Router**: https://reactrouter.com
- **Axios**: https://axios-http.com
- **Tailored Setup Guide**: See `VITE_SETUP.md`

## 🎯 What's Implemented

✅ Vite + React setup
✅ React Router with protected routes
✅ API client with axios
✅ Login/Register authentication
✅ Dashboard with invitation list
✅ Dynamic template loader
✅ Template HTML files (3 templates)
✅ Responsive design
✅ Token-based authentication
✅ Error handling

## 🔄 Next Steps

After setup is working:

1. **Customize Templates**: Edit templates in `public/templates/`
2. **Add Features**: Create new components in `src/components/`
3. **Style Components**: Update CSS in component files or `src/index.css`
4. **Deploy**: Build and deploy to your hosting platform
5. **Test Payment**: Integrate Sepay payment (see `PAYMENT_GUIDE.md`)

## 💡 Development Tips

- Use Chrome DevTools to debug
- Check Network tab to see API requests
- Use React DevTools extension for component debugging
- Check console for error messages
- Verify data structure matches API documentation

## 📞 Need Help?

1. Check `VITE_SETUP.md` for detailed documentation
2. Review API documentation at `https://api.thiepcuoi.me`
3. Check `PAYMENT_GUIDE.md` for payment setup
4. Review component files in `src/` for examples

---

**Happy coding! 🎉**
