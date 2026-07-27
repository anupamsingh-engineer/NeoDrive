# Authentication & Session Handling

Code: `src/store/api/features/authApi.js`, `src/store/api/baseQuery.js`,
`src/store/slices/auth-slice/*`, `src/components/common/Guard/index.jsx`,
`src/hooks/useIdleTimeout.js`, `src/hooks/useSessionGuard.js`, `src/utils/csrf.js`,
`src/pages/public/Login|Register|ForgotPassword|ResetPassword`.

Read this alongside the backend's own
**[authentication.md](../../backend/docs/authentication.md)** and
**[security.md](../../backend/docs/security.md)** — this doc is the client-side half of that same
system, not a separate one.

## The core fact everything else follows from

**Both JWTs live in httpOnly cookies. The frontend never reads, stores, or attaches a token.**
`fetchBaseQuery` is configured with `credentials: "include"` (`baseQuery.js`) so the browser sends
`accessToken`/`refreshToken` automatically on every request to the API origin — there is no
`Authorization` header, no token in Redux, no token in `localStorage`. This is a deliberate
departure from the original template this app was scaffolded from (which stored a bearer token in
`localStorage`/Redux) — see `store/persist/index.js`'s comment: *"unlike the old token-in-Redux
setup"*.

One consequence: **the frontend cannot know whether a session is valid just by looking at its own
state.** `isAuthenticated` is never trusted from persisted/rehydrated Redux state — it's always
re-derived by actually asking the server.

## Boot sequence

1. `redux-persist` rehydrates the store. Its `authTransform` (`store/persist/index.js`) only ever
   restores the `user` object (name/email/picture/role/maxStorageInBytes — nothing secret, purely
   for instant paint) and forces `isAuthenticated: false, isAuthLoading: true` regardless of what
   was persisted.
2. `App.jsx` dispatches `bootstrapAuth()` on mount, which calls `GET /users/me`:
   - Succeeds → `setAuthenticated(user)` — `isAuthenticated: true`, real user data from the
     response (not the possibly-stale persisted copy).
   - Fails (no valid cookie, or refresh also fails — see below) → `handleLogout()`.
3. Until step 2 resolves, `AuthGuard` renders a full-screen loader for every route — there's no
   flash of the wrong state.

## `AuthGuard` (`components/common/Guard/index.jsx`)

The single place redirect decisions happen:

| Condition | Result |
|---|---|
| `isAuthLoading` | Full-screen loader, nothing else renders |
| Not authenticated, path starts with `/app` | Redirect to `/auth/login`, preserving `state={{ from: location }}` so Login can send the user back afterward |
| Authenticated, path starts with `/auth` | Redirect to `/app/drive` (can't revisit login/register while already signed in) |
| Authenticated, path is exactly `/` | Redirect to `/app/drive` |
| Anything else | Render the matched route normally |

## Login / Register / Google sign-in

All three (`authApi.login`, `.register`, `.loginWithGoogle`) resolve to the same response shape
(`{ data: { user, message, ... } }`, matching the backend exactly — see
[backend authentication.md](../../backend/docs/authentication.md)) and are all wired to the same
Redux matcher in `authSlice.js`:

```js
builder.addMatcher(authApi.endpoints.login.matchFulfilled, onAuthenticated);
builder.addMatcher(authApi.endpoints.register.matchFulfilled, onAuthenticated);
builder.addMatcher(authApi.endpoints.loginWithGoogle.matchFulfilled, onAuthenticated);
```

`onAuthenticated` sets `isAuthenticated: true` and `user` directly from the response — no need to
follow up with a `bootstrapAuth()` call. `login.matchRejected` distinguishes a network failure
(`"Failed to fetch"` → `networkError`) from a real API rejection (`loginError`, from the
response's `message`), so the Login page can show the right one.

**Register** (`pages/public/Register`) is OTP-based, matching the backend flow exactly: email →
`sendOtp` → user enters the 6-digit code → `register` (which validates *and consumes* the OTP
server-side; a separate `verifyOtp` call exists in `authApi` for an optional "OTP looks right"
UI check, but isn't required before `register`). Password rules are duplicated client-side purely
for instant feedback — `PASSWORD_RULES` in `Register/index.jsx` mirrors the backend's zod schema
byte-for-byte (`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/`) — the backend
re-validates independently regardless, this is UX only.

**Google sign-in** (`pages/public/_shared/GoogleSignInButton.jsx`) loads Google Identity Services
on demand (script injected only if `VITE_GOOGLE_CLIENT_ID` is configured), renders Google's own
button, and hands the resulting credential (`response.credential`) to `authApi.loginWithGoogle`.

## CSRF

```js
// utils/csrf.js
export function getCsrfTokenFromCookie() {
  const match = document.cookie.split("; ").find((row) => row.startsWith("csrfToken="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}
```

The backend sets a **non**-httpOnly `csrfToken` cookie (signed double-submit pattern) on every
login/register/google/refresh response, and rotates it every time. `baseQuery.js` reads it fresh
from `document.cookie` on every mutation (never cached in Redux, since a refresh rotates it
without any corresponding Redux update) and attaches it as `x-csrf-token`:

```js
prepareHeaders: (headers, { type }) => {
  if (type === "mutation") {
    const csrfToken = getCsrfTokenFromCookie();
    if (csrfToken) headers.set(CSRF_HEADER, csrfToken);
  }
  return headers;
},
```

RTK Query's `type` is `"mutation"` for anything defined with `builder.mutation` — queries (GETs)
never attach it, matching the backend's own exemption of safe methods from CSRF checking.

## Token refresh (transparent, mutex-guarded)

`baseQueryWithReauth` wraps every request:

1. Waits for any in-flight refresh to finish first (`mutex.waitForUnlock()`).
2. Runs the actual request.
3. **On a `401`** (and the failing request wasn't itself `/auth/refresh`): acquires the mutex
   (10s timeout — a stuck refresh can't deadlock every subsequent API call forever), calls
   `POST /auth/refresh` (no body — the httpOnly refresh cookie does the work, and a successful
   response rotates all three cookies again), then retries the original request once. If the
   refresh itself fails, dispatches `handleLogout()`.
4. If the mutex is already held (another request got there first), just waits for it to release
   and retries — it doesn't fire a second refresh.
5. **On a `409`** (the backend's benign "token already refreshed by a concurrent request, please
   retry" response — see [backend authentication.md](../../backend/docs/authentication.md#post-authrefresh)):
   retries the whole `baseQueryWithReauth` call once, so a second 401/409 on the retry is still
   fully re-evaluated rather than blindly relabeled.
6. Other error statuses: logged, and surfaced as a toast for anything that isn't handled inline
   by the calling component (401/403/404/507 are left for the component; 429/500 get a generic
   toast; everything else gets the backend's own `message`).

## Logout

`logoutUser()`/`logoutAllUser()` (`authThunks.js`) both: call the corresponding API endpoint
(swallowing failure — local logout proceeds either way), dispatch `handleLogout()` (resets the
auth slice), then `persistor.purge()` (clears the persisted store entirely). No hard page reload —
`AuthGuard` reacts to `isAuthenticated` flipping to `false` and navigates client-side. A hard
`window.location` redirect here would remount `App.jsx`, re-fire `bootstrapAuth()`, get a 401
(now-logged-out), call this again — an infinite-reload loop, not just a one-time redirect.

## Idle timeout (`useIdleTimeout`)

Runs continuously from `App.jsx` (unconditionally mounted; internally no-ops while unauthenticated).
Watches `mousemove/keydown/mousedown/touchstart/scroll` and calls `logoutUser()` after
`AUTH_CONFIG.sessionTimeout` minutes of inactivity — currently **hardcoded to 30** in
`configs/apiConfig.js`, not actually read from the `VITE_SESSION_TIMEOUT` env var that
`.env.example` defines (see [environment-variables.md](./environment-variables.md#vars-that-look-wired-but-arent)).

## Background session revalidation (`useSessionGuard`)

Mounted once, in `AppLayout` (so it only runs for `/app/*` routes, not the public marketing/auth
pages). Polls `GET /users/me` every 60s while authenticated (`refetchOnFocus`/`refetchOnReconnect`
too), merges fresh fields into `auth.user` on success, and force-logs-out with a toast if the poll
ever errors — since `baseQuery` already retries once via `/auth/refresh` on a 401, an error
surfacing here means the session is genuinely gone (account deleted, or `logout-all` triggered
from another device/the admin panel — see [backend users.md](../../backend/docs/users.md)). This
is also how a storage-quota change from a subscription webhook (see
[backend subscriptions-billing.md](../../backend/docs/subscriptions-billing.md)) shows up in the
UI without a manual refresh — within 60s, not instantly.
