# Architecture

## Stack

React 19 + Vite 7, Redux Toolkit + RTK Query for state/data, React Router v7 for routing,
Tailwind CSS v4 (CSS-first `@theme` config, not a `tailwind.config.js`), framer-motion for
animation. No TypeScript, no external component library.

## Render / bootstrap lifecycle

```
main.jsx
  → 127.0.0.1 → localhost self-redirect (cookie SameSite reasons, see authentication.md)
  → initAnalytics()                      (skipped in dev — see analytics.md)
  → <BrowserRouter>
      <Provider store>                    Redux store (redux-persist rehydrates `auth.user` only)
        <PersistGate>                     shows FullScreenLoader until rehydration finishes
          <App>
            useIdleTimeout()               starts watching for inactivity (no-op until authenticated)
            useEffect → dispatch(bootstrapAuth())   GET /users/me — the only way to know if the
                                                      httpOnly session cookie is still valid
            <MotionConfig reducedMotion="user">
              <ErrorBoundary>
                <PageViewTracker />         fires analytics pageviews on route change
                <Toaster />                 global toast host (components/ui/Toast)
                <Routes>
                  <AuthGuard>                redirect logic based on auth.isAuthenticated
                    <PagesRouter>            → PrivateRoutes (/app/*) | PublicRoutes (/*)
```

`isAuthLoading` starts `true` and gates everything behind `AuthGuard` — the app always shows a
full-screen loader first, never flashes a logged-out (or logged-in) view before `bootstrapAuth()`
resolves. See [authentication.md](./authentication.md) for the full sequence.

## Folder map

```
src/
├── main.jsx                Entry point: store/router/persist wiring, host self-redirect
├── App.jsx                 Idle timeout, bootstrapAuth dispatch, ErrorBoundary/AuthGuard wiring
├── index.css                Tailwind import + @theme design tokens (see styling.md)
├── analytics/                Multi-provider tracking module (see analytics.md)
│   ├── index.js               initAnalytics / track / identify / resetIdentity
│   ├── events.js               EVENTS name constants
│   └── PageViewTracker.jsx     fires trackPageView() on every route change
├── components/
│   ├── ui/                    Shared component library — Button, Modal, Table, Toast, etc.
│   │                           (barrel-exported from components/ui/index.js)
│   ├── layout/
│   │   ├── app/                 AppLayout + AppHeader/AppSider/AppFooter (authenticated shell)
│   │   └── public/               PublicLayout + PublicHeader/PublicFooter (marketing/auth shell)
│   └── common/
│       ├── Guard/                AuthGuard — the one auth-redirect decision point
│       ├── ErrorBoundary.jsx     Top-level React error boundary
│       └── PageNotFound.jsx
├── configs/                    Env/API config — see environment-variables.md for what's real
│   ├── EnvironmentConfig.js      dev/prod env objects, suppresses console.* in prod
│   ├── apiConfig.js               API_CONFIG (baseUrl/timeout), AUTH_CONFIG (idle timeout minutes)
│   ├── apiRoutes.js                every backend endpoint path, one object, mirrors backend routes
│   ├── NavigationConfig.js         path prefix constants
│   ├── constants.js                 legacy, effectively unused (see environment-variables.md)
│   └── conf.js                       legacy, mostly-unused integration ids (see environment-variables.md)
├── hooks/
│   ├── useIdleTimeout.js          logs out after N minutes of inactivity
│   ├── useSessionGuard.js          60s background poll of GET /users/me while authenticated
│   ├── useAnalytics.js              track/identify/resetIdentity hook wrapper for components
│   ├── useDebounce.jsx, useBreakpoint.jsx, useToggle.jsx
├── motion/                     Shared framer-motion variants (fadeIn, staggerContainer, modalPanel, ...)
├── pages/
│   ├── public/                 Home, Login, Register, ForgotPassword, ResetPassword, ShareView (chromeless, /s/:token), _shared (AuthCard, GoogleSignInButton)
│   └── app/                    drive (file manager, incl. ShareModal), profile, subscriptions, users (admin)
├── router/
│   ├── PagesRouter.jsx           top-level split: /app/* vs everything else
│   └── routes/                    PrivateRoutes.jsx, PublicRoutes.jsx
├── store/
│   ├── index.js                    configureStore + persistStore
│   ├── rootReducer.js
│   ├── persist/index.js             persistConfig — whitelists `auth` + `registration`, transforms strip tokens / expired signup progress
│   ├── api/
│   │   ├── baseApi.js                 RTK Query's createApi() base
│   │   ├── baseQuery.js                fetchBaseQuery + CSRF header + 401 reauth + 409 retry + toasts
│   │   └── features/                    authApi, directoryApi, fileApi, shareApi, subscriptionApi, userApi
│   ├── slices/
│   │   ├── auth-slice/                    authSlice, authThunks, authSelectors, initialState
│   │   └── registrationSlice.js            signup wizard progress (step/email/verificationToken) — see authentication.md
│   └── middleware/                       loggingMiddleware.js — written but not currently
│                                           registered on the store, see state-and-api.md
└── utils/
    ├── csrf.js                    reads the csrfToken cookie
    ├── jwt.js                      decode-only JWT payload reader (no verification) — UI hints only
    ├── logger.js                   leveled logger, no-ops in production
    ├── utils.js, common.constant.js
```

## Patterns used throughout

| Pattern | Where | Why |
|---|---|---|
| **Cookie-only auth, no client-readable token** | `baseQuery.js`, `persist/index.js`, `authThunks.js` | Mirrors the backend's httpOnly cookie model — see [authentication.md](./authentication.md) |
| **Session re-derived on load, never trusted from persisted state** | `persist/index.js`'s `authTransform`, `App.jsx`'s `bootstrapAuth()` | A cookie can expire or be revoked while the tab is closed; only `GET /users/me` knows the truth |
| **Mutex-guarded single-flight token refresh** | `baseQuery.js` | Many components can 401 near-simultaneously; only one `/auth/refresh` call should fire, the rest wait and retry |
| **One RTK Query slice per backend feature, tag-based cache invalidation** | `store/api/features/*` | Matches the backend's own feature boundaries (auth/directory/file/subscription/user) — see [state-and-api.md](./state-and-api.md) |
| **Lazy-loaded routes with a shared `Suspense` fallback** | `router/routes/*` | Keeps the initial bundle small; every page is `React.lazy()` |
| **Centralized endpoint paths** | `configs/apiRoutes.js` | One file to update if a backend route changes, instead of hunting through every `*Api.js` |
| **Direct-to-storage upload via XHR (not RTK Query) for progress events** | `pages/app/drive/hooks/useFileUpload.js` | RTK Query's `fetchBaseQuery` has no upload-progress hook; the actual S3 PUT uses raw `XMLHttpRequest` instead — see [file-management.md](./file-management.md) |
| **Analytics behind a provider-agnostic facade** | `analytics/index.js` | Components call `track()`/`identify()`, never a specific SDK — providers can be swapped without touching call sites |
| **Public route as a sibling, not nested inside the shared layout wrapper** | `router/routes/PublicRoutes.jsx` (`/s/:token`) | `ShareView` needs to render chromeless and stay reachable regardless of auth state — nesting it under `PublicLayout` would add marketing chrome it doesn't want; see [sharing.md](./sharing.md) |

See [authentication.md](./authentication.md), [state-and-api.md](./state-and-api.md), and
[file-management.md](./file-management.md) for the full detail behind each of these.
