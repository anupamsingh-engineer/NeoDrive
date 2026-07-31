# NeoDrive Frontend — Documentation

Deep-dive reference for how this frontend actually works: routing, auth/session handling, state
management, the file upload/download flow, analytics, styling, and how it builds and deploys.
Written to match the real, current code — not the generic template this project started from (see
[the note on stale docs](#a-note-on-the-old-docs) below if you're wondering why this folder
exists).

If you want backend-side details (request/response payloads, patterns, deployment), see
**[../../backend/docs/index.md](../../backend/docs/index.md)** — this app is a client for that
API, and [authentication.md](./authentication.md) / [state-and-api.md](./state-and-api.md) both
assume you've read that backend's [authentication.md](../../backend/docs/authentication.md) and
[security.md](../../backend/docs/security.md).

## Reading order

| Doc | What's in it |
|---|---|
| [architecture.md](./architecture.md) | Folder map, render/data-flow lifecycle, the patterns used throughout (RTK Query, lazy routes, cookie-only auth) |
| [flow-diagrams.md](./flow-diagrams.md) | Visual reference: sequence/flow diagrams for app bootstrap, the Redux/RTK Query store, every auth flow, routing, file upload, cache invalidation, analytics, plus a config/timeouts cheat-sheet |
| [authentication.md](./authentication.md) | Cookie-based session bootstrap, login/register/Google, CSRF header injection, token refresh + mutex, idle timeout, background session revalidation, reload-proof signup wizard |
| [routing-and-pages.md](./routing-and-pages.md) | Full route tree, `AuthGuard` redirect rules, role-gating, every page and what it does |
| [state-and-api.md](./state-and-api.md) | Redux Toolkit + RTK Query setup, the 5 API slices, `redux-persist` config, error handling/toast rules |
| [file-management.md](./file-management.md) | The Drive page: two-phase upload (direct-to-S3 with progress), download/preview, rename/delete, folder navigation |
| [analytics.md](./analytics.md) | The multi-provider analytics module (GA4/GTM/PostHog/Mixpanel/Hotjar), event catalog, and a real gap worth knowing about |
| [styling.md](./styling.md) | Tailwind v4 design tokens, the custom UI component library (no external UI kit), motion/animation primitives |
| [environment-variables.md](./environment-variables.md) | Every `VITE_*` var, what it does, build-time vs runtime, and two vars that are wired but not actually read yet |
| [build-and-deploy.md](./build-and-deploy.md) | Vite build/chunking, the Docker multi-stage build, `nginx.conf`, CSP, and how two GitHub Actions workflows share one repo |
| [s3-cloudfront-deployment.md](./s3-cloudfront-deployment.md) | Production deployment: S3 + CloudFront + ACM SSL on a custom domain + GitHub Actions CI/CD |
| [contributing.md](./contributing.md) | Real component/hook conventions used in this codebase, linting, PR expectations |

## Conventions

**Stack**: React 19, Redux Toolkit + RTK Query, React Router v7 (lazy-loaded routes), Tailwind CSS
v4, framer-motion, Vite. No TypeScript, no external UI component library — `src/components/ui/`
is a from-scratch component set.

**Auth model**: both JWTs live in httpOnly cookies the frontend never reads directly — there is no
token in Redux, localStorage, or a request header. The only thing read client-side is a
JS-visible `csrfToken` cookie, mirrored into an `x-csrf-token` header on mutating requests. See
[authentication.md](./authentication.md).

**API base URL**: `import.meta.env.VITE_API_BASE_URL`, read via `src/configs/EnvironmentConfig.js`
→ `src/configs/apiConfig.js`. All endpoint paths live in one place,
`src/configs/apiRoutes.js`, which mirrors the backend's route list exactly — see
[environment-variables.md](./environment-variables.md).

**Where this maps in the code**

```
src/pages/*                 → route-level screens, one folder per page (lazy-loaded)
src/router/*                → route trees (PrivateRoutes = /app/*, PublicRoutes = everything else)
src/store/api/features/*    → one RTK Query slice per backend feature (auth/directory/file/subscription/user)
src/store/slices/*          → Redux slices for client-only state (currently just auth)
src/components/ui/*         → the shared component library (Button, Modal, Table, Toast, ...)
src/components/layout/*     → AppLayout (sidebar+header, authenticated) / PublicLayout (marketing+auth pages)
src/components/common/*     → AuthGuard, ErrorBoundary, PageNotFound
src/hooks/*                 → useIdleTimeout, useSessionGuard, useAnalytics, useDebounce, useBreakpoint, useToggle
src/configs/*                → env/API config, nav config (some entries here are unused legacy — see environment-variables.md)
src/analytics/*              → the multi-provider tracking module
src/motion/*                  → shared framer-motion variants (fadeIn, staggerContainer, modalPanel, ...)
```

## A note on the old docs

This folder replaces twelve loose `.md` files that used to sit at the frontend root
(`README_PRODUCTION.md`, `START_HERE.md`, `QUICK_START.md`, `SETUP.md`, `ADDING_FEATURES.md`,
`CONTRIBUTING.md`, `IMPROVEMENTS.md`, `PRODUCTION_CHECKLIST.md`, `design.md`, `security.md`,
`EVENTS.md`). Most of them were leftover boilerplate from the generic
`react-redux-rtk-template` scaffold this project was bootstrapped from — they describe a
DummyJSON demo login, `localStorage`-token auth, and generic `/users` CRUD examples, none of
which match this app anymore (auth is cookie-based, the real API is the NeoDrive backend in
this repo). `design.md` described an entirely unrelated product's design system, not this one.
They were checked against the actual source and retired rather than moved as-is — see each new
doc for what's real today. `EVENTS.md`'s content survives, verified and updated, in
[analytics.md](./analytics.md).
