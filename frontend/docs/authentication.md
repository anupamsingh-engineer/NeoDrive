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
2. `App.jsx` dispatches `bootstrapAuth()` on mount. It first checks `getState().auth.user` —
   **if there's no persisted user, it skips the network call entirely** and dispatches
   `handleLogout()` immediately (just flips `isAuthLoading` off; there was nothing to log out of).
   A brand-new or already-logged-out visitor never fires `GET /users/me` at all, which means they
   also never trigger the `401 → attempt /auth/refresh (also 401, no refresh cookie either)` pair
   that used to fire on every single anonymous page load. Only if a persisted `user` exists (this
   browser was logged in last time) does it actually call `GET /users/me` to check whether that
   session is still valid:
   - Succeeds → `setAuthenticated(user)` — `isAuthenticated: true`, real user data from the
     response (not the possibly-stale persisted copy).
   - Fails (cookie truly expired, or refresh also fails — see below) → `handleLogout()`.
3. Until step 2 resolves, `AuthGuard` renders a full-screen loader for every route — there's no
   flash of the wrong state.

The tradeoff of skipping the check in step 2: if persisted state is ever cleared independently of
the actual session cookies (e.g. `localStorage` wiped by hand while the cookies survive), this
shows the visitor as logged out even though the cookies might still work — they just log in again.
Cookies remain the sole source of truth for whether a session is *actually* valid; the persisted
`user` is only ever used as a hint for whether it's worth asking.

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

**Register** (`pages/public/Register`) is a three-step flow — `"email"` → `"otp"` → `"details"` —
deliberately split rather than combining the code and the name/password form on one screen:

1. **`email`**: `sendOtp({ email })` → advance to `otp`.
2. **`otp`**: `verifyOtp({ email, otp })` — checks the code **without consuming it** (see
   [backend authentication.md](../../backend/docs/authentication.md#post-authverify-otp)) — only
   advances to `details` on success. A wrong or expired code fails right here, before the user has
   typed a single character of their name/password, instead of after — the old two-screen version
   combined OTP entry with the full details form, so a bad code meant losing everything already
   typed into that form. "Resend code" and "Change email" (back to step 1) are both available here.
3. **`details`**: name + password + confirm — submits `register({ name, email, password, otp })`,
   which re-validates and *actually consumes* the same code server-side. This can still fail here
   (most likely: the 10-minute OTP TTL expired while the user was filling in this form) — the
   error is shown and the user can go back and request a fresh code.

Password rules are duplicated client-side purely for instant feedback — `PASSWORD_RULES` in
`Register/index.jsx` mirrors the backend's zod schema byte-for-byte
(`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/`) — the backend re-validates
independently regardless, this is UX only.

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
3. **On a `401`** (and the failing request wasn't itself `/auth/refresh`):
   - **Circuit breaker first**: if a refresh attempt already failed within the last 3 seconds
     (`REFRESH_FAILURE_COOLDOWN_MS`, matching the backend's own reuse-detection grace window —
     see [backend authentication.md](../../backend/docs/authentication.md#post-authrefresh)),
     skip straight to `forceLogout()` without touching the network. This exists specifically so
     that a burst of several requests failing around the same moment (e.g. several queries
     in-flight right as a session dies) doesn't have each one independently attempt — and fail —
     its own doomed refresh call.
   - Otherwise, acquires the mutex (10s timeout — a stuck refresh can't deadlock every subsequent
     API call forever). **After** acquiring it, checks whether another request's refresh already
     succeeded *since this request's own 401 was observed* (`lastSuccessfulRefreshAt` vs. the
     timestamp captured before acquiring) — if so, the cookies are already fresh, so it just
     retries the original request instead of firing a second, redundant `POST /auth/refresh`. This
     check exists because the `mutex.isLocked()` check just above isn't atomic with actually
     acquiring the lock — two 401s arriving close together can both see it as unlocked and both
     decide to be "the one" to refresh, before either has actually acquired it.
   - Otherwise, calls `POST /auth/refresh` for real (no body — the httpOnly refresh cookie does
     the work, and a successful response rotates all three cookies again), then retries the
     original request. A `409` from the refresh call itself (the backend's own benign
     "another request already refreshed moments ago, this isn't reuse" response) is treated the
     same as success, **not** a failure — retry with the now-fresh cookies rather than force a
     logout for a session that's actually still fine. A hard failure (`401`, or a thrown error)
     records `lastRefreshFailureAt` (arming the circuit breaker above) and calls `forceLogout()`.
4. If the mutex is already held (another request got there first), just waits for it to release
   and retries — it doesn't fire a second refresh.
5. **On a `409`** on the *original* request (not the refresh call — same benign race, just
   surfaced one level up): retries the whole `baseQueryWithReauth` call once, so a second
   401/409 on the retry is still fully re-evaluated rather than blindly relabeled.
6. Other error statuses: logged, and surfaced as a toast for anything that isn't handled inline
   by the calling component (401/403/404/507 are left for the component; 429/500 get a generic
   toast; everything else gets the backend's own `message`).

**Why this matters**: before the circuit breaker and the post-acquire success check existed, a
burst of near-simultaneous 401s (several components' queries failing around the same moment, or a
UI bug that fires several requests in quick succession — see the logout button note below) could
each independently race to refresh, occasionally have one of them get a benign `409` misread as a
hard failure, force-logout a session that was actually fine, and repeat — a visible storm of
`refresh`/`login`/`me` calls in the network tab, not a single clean retry.

## Logout

`logoutUser()`/`logoutAllUser()` (`authThunks.js`) both: call the corresponding API endpoint
(swallowing failure — local logout proceeds either way), dispatch `handleLogout()` (resets the
auth slice), then `persistor.purge()` (clears the persisted store entirely). No hard page reload —
`AuthGuard` reacts to `isAuthenticated` flipping to `false` and navigates client-side. A hard
`window.location` redirect here would remount `App.jsx`, re-fire `bootstrapAuth()`, get a 401
(now-logged-out), call this again — an infinite-reload loop, not just a one-time redirect.

Both are plain `createAsyncThunk`s, not RTK Query mutations, so there's no built-in `isLoading` to
disable a button with automatically — `pages/app/profile/index.jsx` tracks a local `signingOut`
state and disables/loading-states both "Sign Out" buttons while a call is in flight. This isn't
just polish: without it, a rapid double/triple-click each dispatched its own `logoutUser()`, each
firing its own `POST /auth/logout`, each independently racing through the reauth logic above if
the access token happened to be invalid at that moment — a burst of `logout` calls in the network
tab from one intended click.

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
