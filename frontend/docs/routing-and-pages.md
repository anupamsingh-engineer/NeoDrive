# Routing & Pages

Code: `src/router/PagesRouter.jsx`, `src/router/routes/PrivateRoutes.jsx`,
`src/router/routes/PublicRoutes.jsx`, `src/pages/**`.

## Route tree

```
/                                   → PublicLayout
  /  or  /home                        Home              (marketing landing page)
  /auth/login                          Login
  /auth/register                       Register           (3-step OTP signup: email -> verify code -> details)
  /auth/forgot-password                ForgotPassword
  /auth/reset-password                 ResetPassword       (?token= from the email link)
  *                                     PageNotFound

/s/:token                           → ShareView          (chromeless, sibling to PublicLayout —
                                                             see below, NOT nested inside it)

/app                                → AppLayout (header + sidebar, requires auth)
  /app                                  → redirect to /app/drive
  /app/drive                            Drive               (root directory listing)
  /app/drive/:dirId                      Drive               (subfolder listing)
  /app/profile                          Profile
  /app/subscriptions                    Subscriptions       (plans + Razorpay checkout)
  /app/users                            UsersList           (Admin/Manager only — role-gated inline, see below)
  *                                      PageNotFound
```

`PagesRouter` does the top-level split (`/app/*` vs everything else); `AuthGuard` (see
[authentication.md](./authentication.md)) wraps *that* and decides whether the visitor is even
allowed to be looking at either half. Every page component is `React.lazy()`-loaded, with a
shared `FullScreenLoader` `Suspense` fallback per router file.

## Role gating

`/app/users` is guarded twice, for different reasons:

1. **Navigation**: `AppSider` filters it out of the sidebar entirely unless
   `user.role` is `Admin` or `Manager` (`components/layout/app/AppSider.jsx`).
2. **Direct navigation**: `PrivateRoutes.jsx` wraps the route in a `RequireRole` component that
   redirects to `/app/drive` if the current user's role isn't in the allowed list — so typing the
   URL directly doesn't bypass the sidebar's hiding of it.

Within the page itself, **Admin and Manager can both view** the users list, but only **Admin** can
delete a user — that finer-grained check happens inline in `UsersList`
(`currentUser?.role === "Admin"`), not at the route level. This mirrors the backend's own RBAC
split exactly (`GET /users` → Admin+Manager; `DELETE /users/:id` → Admin only — see
[backend security.md](../../backend/docs/security.md#rbac)).

## Share links (`/s/:token`)

Registered as a **sibling** route to `PublicLayout`, not nested inside it — it deliberately
renders without `PublicHeader`/`PublicFooter` (chromeless), since it's a file/folder browser, not
a marketing page. `AuthGuard` only special-cases paths starting with `/app` or `/auth` (see
above); every other path, including this one, is left alone regardless of the visitor's auth
state — exactly what's needed for a link that has to work for both a logged-in user and a
complete stranger. Full detail: [sharing.md](./sharing.md).

## Pages

### Public

| Page | Route | What it does |
|---|---|---|
| **Home** (`pages/public/Home`) | `/`, `/home` | Marketing landing page — `Hero`, `Features`, `PricingTeaser`, `CtaSection` components |
| **Login** (`pages/public/Login`) | `/auth/login` | Email/password form + `GoogleSignInButton`; redirects to `location.state.from` after success (set by `AuthGuard` when it bounced an unauthenticated visitor here) |
| **Register** (`pages/public/Register`) | `/auth/register` | 3-step OTP signup: email (`sendOtp`) → code (`verifyOtp`, consumes it and returns a `verificationToken`) → name/password (`register`, spends the token, auto-authenticates). Split into three screens so a wrong/expired code doesn't discard an already-filled-in name/password form. Progress (step/email/token, never the password) is persisted in Redux and survives a page reload — see [authentication.md](./authentication.md#register-persisted-across-reloads) |
| **ForgotPassword** | `/auth/forgot-password` | Submits an email to `POST /auth/forgot-password`; always shows the same generic success message regardless of whether the email exists (matches the backend's anti-enumeration design) |
| **ResetPassword** | `/auth/reset-password` | Reads `?token=` from the URL (the link sent by email), submits a new password to `POST /auth/reset-password` |
| **ShareView** (`pages/public/ShareView`) | `/s/:token` | Renders a shared file or a read-only, drill-down-able shared folder — no `PublicLayout` chrome (see "Share links" above). Works for both anonymous and logged-in visitors. Full breakdown in [sharing.md](./sharing.md) |

`pages/public/_shared/` holds `AuthCard` (the shared card chrome around all four auth forms) and
`GoogleSignInButton` (see [authentication.md](./authentication.md)).

### App (authenticated)

| Page | Route | What it does |
|---|---|---|
| **Drive** (`pages/app/drive`) | `/app/drive`, `/app/drive/:dirId` | The file manager — grid/list toggle, upload (drag-drop + picker), folder create/rename/delete, file rename/delete, preview (image/video lightbox). Full breakdown in [file-management.md](./file-management.md) |
| **Profile** (`pages/app/profile`) | `/app/profile` | Name/email/picture/role, a storage-used progress bar (`usedStorageInBytes` / `maxStorageInBytes` from `GET /users/me`), and logout / logout-everywhere buttons |
| **Subscriptions** (`pages/app/subscriptions`) | `/app/subscriptions` | Lists plans from `GET /subscriptions/plans`, starts Razorpay Checkout on `POST /subscriptions` — see [state-and-api.md](./state-and-api.md) for the payment flow detail and a real bug worth knowing about |
| **UsersList** (`pages/app/users`) | `/app/users` | Admin/Manager: paginated user table, force-logout-everywhere per user, delete (Admin only) — thin client over [backend users.md](../../backend/docs/users.md) |

## Layout shells

- **`PublicLayout`**: `PublicHeader` (logo, nav, auth links) + page content + `PublicFooter`.
- **`AppLayout`**: `AppHeader` + `AppSider` (desktop: fixed sidebar; mobile/tablet: `Drawer`
  overlay, breakpoint via `useBreakpoint`) + page content (wrapped in `PageTransition`) +
  `AppFooter`. Also where `useSessionGuard()` is mounted — see
  [authentication.md](./authentication.md#background-session-revalidation-usesessionguard).
