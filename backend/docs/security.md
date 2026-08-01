# Security Model

Code: `src/middlewares/auth.middleware.js`, `csrf.middleware.js`, `rbac.middleware.js`,
`rateLimit.middleware.js`, `src/services/token.service.js`, `src/utils/cookies.js`, `app.js`.

## Authentication: cookie or Bearer

`requireAuth` (`src/middlewares/auth.middleware.js`) extracts a token in this priority order:

1. `accessToken` HttpOnly cookie (browser clients — the default flow described in
   [authentication.md](./authentication.md))
2. `Authorization: Bearer <token>` header (non-browser/API clients)

Then, for every protected request:
1. Verify the JWT signature/expiry (`verifyAccessToken` — also rejects a purpose-scoped token
   that accidentally ends up here, since access tokens must **not** carry a `purpose` claim).
2. Check the access-token blacklist in Redis (set on logout — see below) — blacklisted → `401
   "Session has been logged out"`.
3. Look up the user; missing or soft-deleted → `401 "Account no longer exists"`.
4. Compare the token's `iat` against `user.tokensValidAfter` (set whenever *all* sessions are
   revoked — logout-all, password reset, admin force-logout, account deletion) — a token issued
   before that instant → `401 "Session has been revoked, please log in again"`. This is what
   makes "log out everywhere" effective immediately, even against access tokens that haven't
   technically expired yet.

The blacklist check and user lookup run concurrently (`Promise.all`) since neither depends on the
other's result.

`req.user` is then set to a minimal projection (`_id, email, name, role, rootDirId,
maxStorageInBytes`) — that's what every controller downstream reads, never the full Mongoose
document.

## CSRF: signed double-submit cookie

Applies only to **cookie-authenticated, non-safe-method** requests — `verifyCsrf` short-circuits
for `GET`/`HEAD`/`OPTIONS` and for any request carrying a `Bearer` header (no ambient cookie, so
no CSRF surface).

- Token format: `${random}.${HMAC-SHA256(random, CSRF_SECRET)}` — the signature ties the cookie
  value to a server-only secret, so an attacker who can merely plant a cookie (e.g. from a
  related subdomain) still cannot forge a header value that verifies.
- Issued as the `csrfToken` cookie (readable by JS — `httpOnly: false`, unlike the auth cookies)
  on every successful auth response and every refresh.
- The client is expected to read that cookie and echo it back as an `x-csrf-token` header on
  every mutating request. The middleware requires **both** to be present, **equal**, and the
  cookie's signature to verify (`crypto.timingSafeEqual`, not `===`, to avoid a timing side
  channel) — otherwise `403 "Invalid or missing CSRF token"`.

Enforced on: `/directory/*`, `/file/*`, `/subscriptions/*`, `/share/*` (all mutating methods,
applied at the router-group level in `src/routes/index.js`), plus `/auth/logout` and
`/auth/logout-all` specifically (the only `/auth/*` routes that require an existing session). The
public `/s/*` share-resolution routes carry no session cookie at all and are exempt entirely — see
[sharing.md](./sharing.md).

## Rate limiting

`express-rate-limit` backed by `rate-limit-redis` (`RedisStore`), so limits are shared correctly
across multiple API instances, not per-process.

| Limiter | Window | Limit | Key | Applied to |
|---|---|---|---|---|
| `globalLimiter` | 15 min | 300 | IP (default) | every request (mounted app-wide in `app.js`, after body parsing) |
| `authLimiter` | 15 min | 10 | `ip:email` from body | `/auth/send-otp`, `verify-otp`, `register`, `login`, `google`, `forgot-password`, `reset-password` |
| `refreshLimiter` | 15 min | 120 | IP | `/auth/refresh` — deliberately higher: no email in the body to key on, and it fires automatically (every 401, on a timer, twice under React StrictMode in dev) |
| `uploadLimiter` | 1 min | 60 | user id (falls back to IP) | `/file/upload/initiate` |
| `shareCreateLimiter` | 1 min | 20 | user id (falls back to IP) | `POST /share` |
| `shareResolveLimiter` | 15 min | 300 | IP | `/s/*` — the one fully-public data-fetching surface, so it can't key on a user id |

All of them return `429 "Too many requests, please try again later"` via the shared `handler`.

## RBAC

Three roles (`src/config/constants.js` → `ROLES`): `Admin`, `Manager`, `User`. Enforced with
`authorizeRoles(...allowedRoles)` (`src/middlewares/rbac.middleware.js`) — `403` if `req.user.role`
isn't in the allow-list. Currently gates:

| Route | Allowed roles |
|---|---|
| `GET /users` | Admin, Manager |
| `POST /users/:userId/logout` | Admin, Manager |
| `DELETE /users/:userId` | Admin |

Everything else is either public or "any authenticated user, acting only on their own
resources" (ownership is enforced separately, at the repository query level — see
[directories.md](./directories.md)/[files.md](./files.md)).

## Account lockout

5 wrong passwords in a row (`MAX_LOGIN_ATTEMPTS`) locks the account for 30 minutes
(`LOCK_DURATION_MS`) — see [authentication.md](./authentication.md#account-lockout). Tracked on
the `User` document itself (`loginAttempts`, `lockUntil`), not in Redis, so it survives a Redis
restart.

## Refresh-token rotation & reuse (theft) detection

Full flow in [authentication.md](./authentication.md#post-authrefresh). Summary: every refresh
call presents a token, the server verifies its hash matches what's stored, then atomically swaps
in a new hash (compare-and-swap, not a plain update — so two concurrent refreshes can't silently
clobber each other). A refresh token whose hash *doesn't* match what's currently stored, and
wasn't just rotated moments ago, is treated as **evidence of theft**: every session for that user
is revoked immediately, not just the one token. A legitimate concurrent-request race is
distinguished from actual reuse by a 3-second grace window on the document's `updatedAt`.

## Share-link tokens

The one deliberately public, unauthenticated surface in the API (`/s/*`, see
[sharing.md](./sharing.md)) — a 256-bit random token (`crypto.randomBytes(32)`, base64url),
never the Mongo `_id`, stored in plaintext (unlike `RefreshToken.tokenHash` — the two protect
against different threat models, see [sharing.md](./sharing.md#token-generation) for why hashing
it wouldn't add meaningful protection here). Folder shares enforce a containment check on every
`dirId`/`fileId` a visitor supplies, walking real `parentDirId` links rather than trusting
anything client-supplied — see
[sharing.md](./sharing.md#the-security-boundary-check). Every failure mode (missing token, revoked,
outside the shared subtree) returns the same generic `404`, deliberately indistinguishable.

## Session limits

At most `MAX_SESSIONS_PER_USER` (default 5) live sessions per user — a new login past that limit
silently evicts the oldest `RefreshToken` document rather than rejecting the new login.

## Access-token blacklist (logout)

A `JWT` doesn't self-invalidate before its expiry. `/auth/logout` compensates by writing
`auth:blacklist:<sha256(token)>` into Redis with a TTL equal to the token's *remaining* lifetime
— so the blacklist entry never outlives the token it's blocking, and `requireAuth` checks this on
every request. If Redis is unavailable, the blacklist check fails open (logs a warning, treats
the token as not blacklisted) — see [caching.md](./caching.md) for the fail-open philosophy
applied here too.

## Cookie configuration

`src/utils/cookies.js`:

| | `accessToken` | `refreshToken` | `csrfToken` |
|---|---|---|---|
| `httpOnly` | yes | yes | **no** |
| `path` | `/` | `/auth/refresh` | `/` |
| `secure` | prod only | prod only | prod only |
| `sameSite` | `none` (prod) / `lax` (dev) | same | same |
| `maxAge` | 15 min (fixed) | `REFRESH_TOKEN_EXPIRY` | `REFRESH_TOKEN_EXPIRY` |

`sameSite: "none"` in production assumes the frontend and API may live on different origins/
subdomains — that combination requires `secure: true` as well (browsers reject `SameSite=None`
without `Secure`), which is why both flip together on `env.isProduction`.

## Other request-level hardening (`app.js`)

- **helmet**, with `crossOriginResourcePolicy: { policy: "cross-origin" }` — the default
  same-origin policy would block browsers from `fetch()`-ing file download URLs, which redirect
  to a different-origin CloudFront domain.
- **CORS**: explicit allow-list (`CLIENT_URL_1`, `CLIENT_URL_2` env vars) with `credentials: true`
  (required for cookies to be sent cross-origin); any origin not on the list is rejected outright
  rather than reflected.
- **express-mongo-sanitize**: strips `$`/`.`-prefixed keys from `req.body`/`req.query`/
  `req.params` to prevent NoSQL operator injection via user input.
- **hpp**: guards against HTTP parameter pollution (duplicate query-string keys resolving to an
  array where a single value was expected).
- **Body size cap**: `1mb` on JSON/urlencoded bodies — irrelevant to file uploads, which never
  pass file bytes through this server at all (see [files.md](./files.md)).
