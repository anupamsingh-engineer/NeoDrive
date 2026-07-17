# Production-Grade React Template

A modern, production-ready React template with Redux Toolkit, RTK Query, and authentication.

## Features

✅ **Modern Stack**
- React 19.1.0
- Redux Toolkit with RTK Query
- React Router v7 for routing
- Redux Persist for state persistence
- Vite for fast development and optimized builds

✅ **Production Features**
- Authentication with JWT tokens
- Protected routes (Private/Public separation)
- Error Boundary with detailed error handling
- Comprehensive logging utility
- Environment-based configuration
- Optimized bundle splitting
- API error handling with mutex-based token refresh

✅ **Code Quality**
- ESLint configured
- React hooks best practices
- Proper error handling
- Logger utility for production use

## Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
# Clone or extract the template
cd react-redux-rtk-template

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env.local
```

### Development

```bash
# Start development server
npm run dev

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

### Build for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── common/           # Reusable components (ErrorBoundary, Guard, etc.)
│   └── layout/           # Layout components (AppLayout, PublicLayout)
├── configs/              # Configuration files
│   ├── apiConfig.js      # API and app configuration
│   ├── constants.js      # App constants
│   └── NavigationConfig.js
├── pages/                # Page components
│   ├── app/              # Protected pages (Dashboard, Settings)
│   └── public/           # Public pages (Login, Home)
├── router/               # Routing configuration
│   ├── routes/           # Route definitions
│   └── PagesRouter.jsx
├── store/                # Redux store
│   ├── api/              # RTK Query setup
│   ├── slices/           # Redux slices
│   ├── middleware/       # Custom middleware
│   ├── persist/          # Persist configuration
│   └── index.js
├── hooks/                # Custom React hooks
├── utils/                # Utility functions
│   ├── logger.js         # Logging utility
│   └── common.constant.js
├── App.jsx               # Root component
└── main.jsx              # Entry point
```

## Configuration

### Environment Variables

Create a `.env.local` file (copy from `.env.example`):

```env
# API Configuration
VITE_API_BASE_URL=https://your-api.com
VITE_API_TIMEOUT=30000
VITE_API_RETRY_ATTEMPTS=3

# Session Configuration
VITE_SESSION_TIMEOUT=30

# App Info
VITE_APP_NAME=My App
VITE_APP_VERSION=1.0.0

# Optional: Enable source maps in production
VITE_SOURCEMAP=false
```

### API Configuration

Edit `src/configs/apiConfig.js` to customize API settings:

```javascript
export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'https://your-api.com',
  timeout: 30000,
  retryAttempts: 3,
};
```

## Authentication Flow

1. **Login**: User enters credentials on `/auth/login`
2. **Token Storage**: JWT token stored in localStorage (key: `app_token`)
3. **Protected Routes**: Routes under `/app/*` require authentication
4. **Auto Redirect**: Unauthenticated users redirected to login
5. **Session Expiry**: 401/403 responses trigger logout and redirect
6. **Token Refresh**: Automatic token refresh from API response if provided

### Auth Guard

The `AuthGuard` component handles route protection:
- Redirects unauthenticated users to `/auth/login`
- Redirects authenticated users away from auth routes
- Shows loading state while checking authentication

## Logging

Use the logger utility for consistent logging:

```javascript
import logger from '@/utils/logger';

logger.info('User logged in', { userId: 123 });
logger.warn('API rate limit approaching');
logger.error('Failed to fetch data', error);
logger.debug('Debug info', { data });
```

**Logging behavior:**
- Development: All logs printed to console
- Production: Only info, warn, error printed (debug and log suppressed)

## Error Handling

### ErrorBoundary

Catches React component errors:
- Shows fallback UI with reload button
- Logs error details in development
- Can be integrated with error tracking services

### API Error Handling

Automatic handling of:
- Network errors
- 401/403 authentication errors (session expiry)
- Other HTTP errors with proper logging

## Performance Optimizations

### Code Splitting

Vite automatically creates chunks for:
- `vendor-react`: React libraries
- `vendor-redux`: Redux libraries
- `vendor-router`: React Router
- `vendor-persist`: Redux Persist
- Application code split by route with lazy loading

### Bundle Analysis

Check bundle size:
```bash
npm run build
# Check `dist/` folder for file sizes
```

## Best Practices

### Component Development

✅ **Do:**
- Use functional components with hooks
- Extract complex logic into custom hooks
- Use Redux for global state
- Use React Query (RTK Query) for API data
- Implement proper error boundaries
- Log important user actions

❌ **Don't:**
- Use class components unless necessary
- Store API responses in Redux (use RTK Query)
- Make API calls in components (use hooks)
- Ignore error handling
- Use localStorage for sensitive data

### State Management

- **Global State**: Use Redux for user auth, app settings
- **Server State**: Use RTK Query for API data
- **Local State**: Use useState for component-specific state
- **Persist**: Configure in `src/store/persist/index.js`

### API Integration

Create new API endpoints in `src/store/api/`:

```javascript
// src/store/api/features/userApi.js
import { baseApi } from '../baseApi';

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

export const { useGetUserQuery, useUpdateUserMutation } = userApi;
```

## Deployment

### Build for Production

```bash
npm run build
# Creates optimized `dist/` folder
```

### Environment Variables for Production

Set these environment variables in your hosting platform:

```
VITE_API_BASE_URL=https://production-api.com
VITE_APP_NAME=Production App
NODE_ENV=production
```

### Deploy to Common Platforms

**Vercel:**
```bash
npm i -g vercel
vercel
```

**Netlify:**
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

**GitHub Pages:**
```bash
npm run build
# Deploy `dist/` folder to gh-pages branch
```

## Troubleshooting

### Issue: "Cannot find module"
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear cache: `npm cache clean --force`

### Issue: Port 5173 already in use
- Change port in `vite.config.js`
- Or kill process: `lsof -ti:5173 | xargs kill -9`

### Issue: 401 errors after logout
- Session expired - refresh the page
- Check token in localStorage: `localStorage.getItem('app_token')`

### Issue: Blank page after build
- Check browser console for errors
- Verify API base URL in `.env`
- Check that `dist/index.html` exists

## Next Steps

### Add Features
1. **Form Validation**: Add Zod or Yup for schema validation
2. **UI Components**: Add Shadcn/ui or build custom components
3. **Styling**: Add Tailwind CSS or styled-components
4. **Testing**: Add Vitest and React Testing Library
5. **Type Safety**: Migrate to TypeScript

### Production Ready
1. **Error Tracking**: Integrate Sentry or LogRocket
2. **Analytics**: Add Google Analytics or Mixpanel
3. **Monitoring**: Set up error tracking and performance monitoring
4. **Documentation**: Create API documentation (Swagger/OpenAPI)
5. **Security**: Add CORS, CSP headers, rate limiting

## Learning Resources

- [React Documentation](https://react.dev)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org)
- [RTK Query Guide](https://redux-toolkit.js.org/rtk-query/overview)
- [Vite Documentation](https://vite.dev)
- [React Router v7](https://reactrouter.com)

## License

MIT

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review component examples
3. Refer to official documentation
4. Open an issue if needed

---

**Last Updated**: 2024
**Template Version**: 1.0.0
