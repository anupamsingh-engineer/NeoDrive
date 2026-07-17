# Production-Grade React Template with Redux Toolkit

> A modern, fully-featured React template with Redux Toolkit, RTK Query, authentication, and production-ready configurations. No UI library bloat—just solid fundamentals.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/react-19.1.0-blue)](https://react.dev)
[![Redux Toolkit](https://img.shields.io/badge/redux--toolkit-2.8.2-purple)](https://redux-toolkit.js.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 🌟 Features

### Core Features
- **✅ Modern React 19** with hooks and functional components
- **✅ Redux Toolkit** with state persistence
- **✅ RTK Query** for efficient API data management
- **✅ React Router v7** with protected routes
- **✅ Authentication** with JWT token management
- **✅ Vite** for lightning-fast development

### Production Features
- **✅ Error Boundary** with fallback UI
- **✅ Global Logging System** with severity levels
- **✅ Environment Configuration** for all settings
- **✅ API Error Handling** with automatic retry
- **✅ Session Management** with token refresh
- **✅ Protected Routes** with role-based access
- **✅ Redux Persist** for state recovery

### Developer Experience
- **✅ ESLint** configured and ready
- **✅ Comprehensive Logging** for debugging
- **✅ Redux DevTools** for state inspection
- **✅ Environment Variables** for configuration
- **✅ Code Splitting** for optimal bundle size
- **✅ Source Maps** available (configurable)

### Documentation
- **✅ Complete Setup Guide** (SETUP.md)
- **✅ Development Standards** (CONTRIBUTING.md)
- **✅ Feature Examples** (ADDING_FEATURES.md)
- **✅ Quick Start** (QUICK_START.md)

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation & Setup

```bash
# 1. Install dependencies
npm install

# 2. Start development server (already configured)
npm run dev

# 3. Open browser
http://localhost:5173
```

That's it! The app is ready to develop.

### Login
- URL: `http://localhost:5173/auth/login`
- Try any credentials (DummyJSON API accepts all)
- Example: `username: emilys`, `password: emilyspass`

## 📖 Documentation

Read the documentation in this order:

| Document | Purpose | Read Time |
|----------|---------|-----------|
| [QUICK_START.md](./QUICK_START.md) | 5-minute setup and overview | 5 min |
| [SETUP.md](./SETUP.md) | Complete guide and configuration | 20 min |
| [ADDING_FEATURES.md](./ADDING_FEATURES.md) | How-to for common tasks | 15 min |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Development standards | 10 min |
| [IMPROVEMENTS.md](./IMPROVEMENTS.md) | Technical improvements made | 10 min |

## 📁 Project Structure

```
react-redux-rtk-template/
├── src/
│   ├── components/          # Reusable components
│   │   ├── common/         # ErrorBoundary, Guard, etc.
│   │   └── layout/         # AppLayout, PublicLayout
│   ├── pages/              # Page components
│   │   ├── app/            # Protected pages
│   │   └── public/         # Public pages
│   ├── store/              # Redux setup
│   │   ├── api/            # RTK Query endpoints
│   │   ├── slices/         # Redux slices
│   │   └── middleware/     # Custom middleware
│   ├── router/             # Route definitions
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utilities (logger, common)
│   ├── configs/            # Configuration files
│   └── App.jsx             # Root component
├── .env.example            # Environment template
├── .env.local              # Development config (auto-created)
├── vite.config.js          # Vite configuration
├── package.json            # Dependencies
└── index.html              # HTML entry point
```

## 🔧 Available Commands

```bash
# Development
npm run dev                 # Start dev server on :5173
npm run preview            # Preview production build

# Building
npm run build              # Create optimized production build

# Code Quality
npm run lint               # Check for linting issues
npm run lint:fix           # Auto-fix linting issues

# Additional
npm run type-check         # Type checking (when TypeScript added)
npm run format             # Code formatting (when Prettier added)
```

## 🔑 Key Concepts

### Authentication Flow

```
1. User visits app
   ↓
2. AuthGuard checks isAuthenticated
   ↓
3. If not authenticated → Redirect to /auth/login
4. If authenticated → Allow access to /app/*
   ↓
5. Token stored in localStorage (key: "app_token")
6. Token included in API requests via authorization header
7. On 401/403 → Clear token & redirect to login
```

### State Management

- **Redux**: Global app state (auth, user settings)
- **RTK Query**: Server state (API data, caching)
- **Local State**: Component-specific state (forms, toggles)

### API Requests

```javascript
// RTK Query handles:
✅ Request caching
✅ Automatic refetch on reconnect
✅ Token refresh
✅ Error handling with logging
✅ Request deduplication

// Base URL from: import.meta.env.VITE_API_BASE_URL
```

## 🌐 Environment Variables

Create `.env.production` for production deployment:

```env
VITE_API_BASE_URL=https://your-api.example.com
VITE_API_TIMEOUT=30000
VITE_API_RETRY_ATTEMPTS=3
VITE_SESSION_TIMEOUT=30
VITE_APP_NAME=Your App Name
VITE_APP_VERSION=1.0.0
VITE_SOURCEMAP=false
```

See `.env.example` for complete list with descriptions.

## 🛠️ Development Tips

### Logging

Use the global logger utility:

```javascript
import logger from '@/utils/logger';

logger.info('User action', { userId: 123 });   // Important info
logger.warn('Rate limit approaching');          // Warnings
logger.error('API failed', error);              // Errors
logger.debug('Debug info', { data });           // Dev only
```

Logs are:
- ✅ **Development**: All logs printed
- ✅ **Production**: Only info, warn, error (no debug/log)

### Creating API Endpoints

```javascript
// src/store/api/features/userApi.js
export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUser: builder.query({
      query: (userId) => `/users/${userId}`,
    }),
    updateUser: builder.mutation({
      query: ({ userId, data }) => ({
        url: `/users/${userId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['User'],
    }),
  }),
});
```

See [ADDING_FEATURES.md](./ADDING_FEATURES.md) for more examples.

### Protected Routes

```javascript
<Route path="admin" element={
  <PrivateRoute requiredRole="admin">
    <AdminPanel />
  </PrivateRoute>
} />
```

## 🚀 Deployment

### Build Production Bundle

```bash
npm run build
# Creates optimized dist/ folder
```

### Deploy Options

#### Vercel (Recommended)
```bash
npm i -g vercel
vercel
```

#### Netlify
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

#### Traditional Hosting
```bash
# Build the app
npm run build

# Upload dist/ folder to your hosting
# Set VITE_* environment variables on host
```

### Environment Variables on Host

Set these on your hosting platform (Vercel, Netlify, etc.):
```
VITE_API_BASE_URL=https://your-production-api.com
VITE_API_TIMEOUT=30000
VITE_APP_NAME=Your App
VITE_SOURCEMAP=false
```

## 📊 Performance

### Bundle Size Optimization

Vite automatically creates optimized chunks:
- `vendor-react.js` - React libraries
- `vendor-redux.js` - Redux libraries
- `vendor-router.js` - Router
- `vendor-persist.js` - Persist
- `index.js` - Application code

### Performance Tips

✅ Use lazy loading for routes
```javascript
const Dashboard = lazy(() => import('./Dashboard'));
```

✅ Memoize expensive components
```javascript
const Component = memo(({ data }) => { ... });
```

✅ Optimize dependencies
```javascript
useEffect(() => { ... }, [dep]); // Complete deps array
```

## 🔒 Security

### Best Practices Implemented

✅ Token stored securely in localStorage
✅ Automatic session expiry handling
✅ Environment variables for sensitive config
✅ Protected API endpoints (401/403 handling)
✅ Error logging without exposing sensitive data
✅ HTTPS ready (configure on host)

### Before Production

- [ ] Change API endpoint to production
- [ ] Update VITE_APP_NAME and VITE_APP_VERSION
- [ ] Review .env.production settings
- [ ] Set VITE_SOURCEMAP=false for smaller builds
- [ ] Test authentication flow
- [ ] Configure CORS on backend
- [ ] Review API security headers

## 🐛 Troubleshooting

### Port 5173 Already in Use
Change in `vite.config.js`:
```javascript
server: { port: 3000 }
```

### CORS Errors
Ensure your API allows requests from your domain:
```
Access-Control-Allow-Origin: https://your-domain.com
```

### Token Issues
Clear localStorage and refresh:
```javascript
localStorage.clear(); location.reload();
```

### Build Fails
```bash
rm -rf node_modules dist
npm install
npm run build
```

## 📚 Learning Resources

- [React Documentation](https://react.dev)
- [Redux Toolkit Docs](https://redux-toolkit.js.org)
- [RTK Query Guide](https://redux-toolkit.js.org/rtk-query/overview)
- [Vite Documentation](https://vite.dev)
- [React Router](https://reactrouter.com)

## 🎓 What's Included

### State Management
- Redux Toolkit configureStore
- Redux Persist for state recovery
- RTK Query for API data
- Redux DevTools integration

### Routing
- React Router v7
- Protected routes (AuthGuard)
- Lazy loaded pages
- 404 fallback

### API Integration
- Base query with error handling
- Token management
- Automatic retry on failure
- Request logging

### Components
- ErrorBoundary with fallback UI
- Auth Guard for route protection
- Layout components
- Login page with form handling

### Utilities
- Logger utility (dev/prod modes)
- LocalStorage helpers
- Custom hooks
- Configuration management

## 🤝 Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Code style guidelines
- Component organization
- State management patterns
- Testing practices
- Git workflow

## 📝 License

MIT - Free to use for personal and commercial projects

## 🎉 What's Next?

1. **Read** [QUICK_START.md](./QUICK_START.md) - 5 minute overview
2. **Run** `npm run dev` - Start developing
3. **Explore** the existing code and components
4. **Follow** [CONTRIBUTING.md](./CONTRIBUTING.md) for best practices
5. **Add Features** using [ADDING_FEATURES.md](./ADDING_FEATURES.md)

## 📞 Support

For questions or issues:
1. Check the relevant documentation file
2. Review examples in ADDING_FEATURES.md
3. Look at existing components
4. Check console for error messages

---

## ✨ Why This Template?

### ✅ Production Ready
- Error handling and logging
- Environment configuration
- Build optimization
- Security best practices

### ✅ No UI Library Bloat
- Lightweight and focused
- Learn React fundamentals
- Easy to add your preferred UI library
- Full control over styling

### ✅ Well Documented
- 5 comprehensive guides
- Code examples for everything
- Clear project structure
- Development standards

### ✅ Scalable Architecture
- Organized folder structure
- Reusable patterns
- Easy to extend
- Team-friendly standards

---

**Ready to build something great?** Start with:

```bash
npm run dev
```

Happy coding! 🚀

---

**Template Version**: 1.0.0
**Last Updated**: 2024
**Status**: ✅ Production Ready
