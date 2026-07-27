# Authentication & Sessions

Code: `src/routes/auth.routes.js`, `src/controllers/auth.controller.js`,
`src/services/auth.service.js`, `src/services/otp.service.js`, `src/services/token.service.js`,
`src/services/googleAuth.service.js`, `src/models/user.model.js`, `src/models/otp.model.js`,
`src/models/refreshToken.model.js`.

## Model

- **Dual JWT**: a short-lived **access token** (default 15m, `ACCESS_TOKEN_EXPIRY`) authorizes
  requests; a long-lived **refresh token** (default 30d, `REFRESH_TOKEN_EXPIRY`) is exchanged for
  a new pair via `/auth/refresh`. Both are set as HttpOnly cookies; a matching
  `Authorization: Bearer <accessToken>` header also works for the access token (mobile/API
  clients) and is exempt from CSRF.
- Every refresh token is backed by a `RefreshToken` document (one per session/device) storing only
  a SHA-256 hash of the raw token, never the token itself. A user can have at most
  `MAX_SESSIONS_PER_USER` (default 5) live sessions — issuing a new one past that evicts the
  oldest.
- Signing up (password or Google) creates the `User` document **and** their root `Directory`
  document in a single Mongo transaction (`createUserWithRootDirectory` in `auth.service.js`) —
  this is why Mongo must run as a replica set (see [installation.md](./installation.md)).

## Cookies set on every successful auth response

| Cookie | HttpOnly | Path | Lifetime | Purpose |
|---|---|---|---|---|
| `accessToken` | yes | `/` | 15 min (fixed) | Sent on every request |
| `refreshToken` | yes | `/auth/refresh` only | matches `REFRESH_TOKEN_EXPIRY` (default 30d) | Only ever sent to the refresh endpoint |
| `csrfToken` | **no** (JS-readable) | `/` | matches `REFRESH_TOKEN_EXPIRY` | Client mirrors this into an `x-csrf-token` header on mutating requests — see [security.md](./security.md) |

`secure` is true only in production; `sameSite` is `"none"` in production (cross-site capable)
and `"lax"` in development.

---

## `POST /auth/send-otp`

Rate limit: `authLimiter` (10 / 15 min, keyed by `ip:email`).

**Request**
```json
{ "email": "user@example.com" }
```

**Behavior**
- Enforces a resend cooldown (`OTP_RESEND_COOLDOWN_SECONDS`, default 60s) via a Redis `SET NX`
  lock — a second call inside the window gets `429`.
- Generates a 6-digit numeric OTP (`crypto.randomInt`, not `Math.random`), upserts it onto an
  `OTP` document keyed by email (replaces any previous one, resets `attemptCount` to 0), and
  enqueues a `send-otp` email job (see [background-jobs.md](./background-jobs.md)) — the HTTP
  response does not wait for the email to actually send.
- The OTP document has a Mongo TTL index (`expires: OTP_TTL_SECONDS`, default 600s) — it's
  auto-deleted by Mongo once it expires, no explicit cleanup needed.

**Response `201`**
```json
{ "success": true, "data": { "message": "OTP sent successfully to user@example.com" } }
```

**Errors**: `400` invalid email · `429` cooldown still active / too many requests.

---

## `POST /auth/verify-otp`

Rate limit: `authLimiter`.

Optional standalone check — lets a client confirm the OTP is correct *before* showing the rest of
the registration form. It does **not** consume/delete the OTP; `/auth/register` re-validates and
consumes it independently, so calling this first is not required.

**Request**
```json
{ "email": "user@example.com", "otp": "123456" }
```

**Response `200`**
```json
{ "success": true, "message": "OTP Verified!" }
```

**Errors**: `400` — `"Invalid or expired OTP"` (wrong code, no record, or record expired) or
`"Too many attempts, please request a new OTP"` (after `OTP_MAX_VERIFY_ATTEMPTS`, default 5 —
the OTP record is deleted at that point, a new `send-otp` call is required).

---

## `POST /auth/register`

Rate limit: `authLimiter`.

**Request**
```json
{
  "name": "Jane Doe",
  "email": "user@example.com",
  "password": "Str0ng!Pass",
  "otp": "123456"
}
```

| Field | Rule |
|---|---|
| `name` | 3–100 chars |
| `email` | valid email, lowercased |
| `password` | 8–72 chars; must contain lowercase, uppercase, digit, and special character |
| `otp` | exactly 6 digits, must match a live, unconsumed OTP for `email` |

**Behavior**
1. Validates and **consumes** the OTP (deletes the record — it cannot be reused).
2. `409` if the email is already registered.
3. Creates the `User` + their root `Directory` in one transaction.
4. Issues a new session (access + refresh token pair; see "Session issuance" below).

**Response `201`** (cookies set: `accessToken`, `refreshToken`, `csrfToken`)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "665f...",
      "name": "Jane Doe",
      "email": "user@example.com",
      "picture": "https://.../default-avatar.jpg",
      "role": "User",
      "maxStorageInBytes": 16106127360
    },
    "message": "Registered and logged in"
  }
}
```

**Errors**: `400` validation / invalid-or-expired OTP · `409` email already exists.

---

## `POST /auth/login`

Rate limit: `authLimiter`.

**Request**
```json
{ "email": "user@example.com", "password": "Str0ng!Pass" }
```

**Behavior**
- Generic `401 "Invalid credentials"` for both "no such user" and "wrong password" — this
  endpoint never reveals whether an email is registered.
- `400` if the account was created via Google and has no password set
  (`"This account uses Google sign-in, please continue with Google"`).
- `403` if the account is currently locked (see lockout below).
- On a wrong password: increments `loginAttempts`; at `MAX_LOGIN_ATTEMPTS` (default 5) the
  account is locked for `LOCK_DURATION_MS` (default 30 min).
- On success: resets `loginAttempts` to 0, issues a new session.

**Response `200`** — same shape as register, `"message": "Logged in"`.

**Errors**: `400` bad request (Google-only account) · `401` invalid credentials · `403` locked.

---

## `POST /auth/google`

Rate limit: `authLimiter`.

**Request**
```json
{ "idToken": "<Google ID token from the frontend's Google Sign-In flow>" }
```

**Behavior**
- Verifies the ID token against `GOOGLE_CLIENT_ID` via `google-auth-library`.
- Existing, non-deleted user → logs them in (refreshes their `picture` from Google only if it
  isn't already a `googleusercontent.com` URL, so a user-uploaded picture is never clobbered).
- Existing but soft-deleted user → `403` `"Your account has been deleted. Contact app owner to recover."`
- No existing user → creates one (+ root directory), `isNewUser: true`.

**Response** `201` (new user) or `200` (existing):
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "name": "...", "email": "...", "picture": "...", "role": "User", "maxStorageInBytes": 16106127360 },
    "isNewUser": true,
    "message": "Account created and logged in"
  }
}
```

---

## `POST /auth/refresh`

Rate limit: `refreshLimiter` (120 / 15 min per IP — deliberately higher/looser than the login
limiter since this is credential-less and fires automatically on every 401).

No request body — reads the `refreshToken` cookie (path-scoped to `/auth/refresh`, so it's the
only endpoint that ever receives it).

**Behavior (rotation with reuse detection)**
1. Verify the JWT signature/expiry → `401` if invalid.
2. Look up the backing `RefreshToken` document by the token's `tokenId` claim.
3. Compare the *incoming* token's hash against the stored `tokenHash`:
   - **Mismatch, but the document was updated within the last 3 seconds** → `409
     "Token already refreshed, please retry"`. This is the benign case: two requests raced to
     refresh the same not-yet-rotated token (e.g. two tabs), one already won.
   - **Mismatch, older than 3 seconds** → treated as **theft**: every session for that user is
     deleted and `tokensValidAfter` is bumped (which also instantly invalidates any still-valid
     access tokens for that user, everywhere) → `401`.
   - **Match** → proceed.
4. Atomically rotate: a compare-and-swap update that only succeeds if the stored hash still
   equals what was just read. If another request won the race in between, this returns `409` too.
5. Issue a new access + refresh token pair.

**Response `200`** (new cookies set)
```json
{ "success": true, "message": "Token refreshed" }
```

**Errors**: `401` invalid/expired/stolen session · `409` benign race, client should retry once.

---

## `POST /auth/logout` — requires auth + CSRF

Blacklists the *current* access token in Redis until its natural expiry (so it can't be reused
even though it hasn't technically expired yet), deletes the specific `RefreshToken` document for
this session, clears all three cookies. Other sessions/devices are untouched.

**Response**: `204 No Content`.

## `POST /auth/logout-all` — requires auth + CSRF

Deletes **every** `RefreshToken` document for the user and bumps `tokensValidAfter` — logs out
every device/session at once, including ones whose access token hasn't expired yet.

**Response**: `204 No Content`.

---

## `POST /auth/forgot-password`

Rate limit: `authLimiter`.

**Request**
```json
{ "email": "user@example.com" }
```

Always returns the same generic success message regardless of whether the email is registered
(anti-enumeration) — the actual side effect (enqueue a `send-password-reset` email with a signed,
purpose-scoped reset token, `PASSWORD_RESET_TOKEN_EXPIRY` default 15m) only happens if the user
exists and isn't soft-deleted.

**Response `200`**
```json
{ "success": true, "data": { "message": "If an account with that email exists, a reset link has been sent." } }
```

## `POST /auth/reset-password`

Rate limit: `authLimiter`.

**Request**
```json
{ "token": "<token from the reset email>", "password": "N3wStr0ng!Pass" }
```

`token` is a JWT signed with the *access* secret and `purpose: "password_reset"` — verified with
`verifyPurposeToken`, which rejects tokens with a mismatched purpose (so an access token can never
be replayed here). Same password strength rule as registration.

**Behavior**: sets the new password (re-hashed via the `User` model's `pre("save")` hook), then
revokes **every** existing session for that user (same as `logout-all`) — the user must log back
in on all devices with the new password.

**Response `200`**
```json
{ "success": true, "data": { "message": "Password has been reset, please log in again" } }
```

**Errors**: `400` invalid/expired/wrong-purpose token.

---

## Session issuance (`issueNewSession`, internal to `auth.service.js`)

Shared by register/login/google — not its own endpoint, but explains what "issues a session"
means above:

1. If the user already has `MAX_SESSIONS_PER_USER` active `RefreshToken` documents, deletes the
   oldest one (evict-oldest, not reject-new).
2. Creates the `RefreshToken` document first (with a placeholder hash), signs the access token
   (payload: `{ sub, email, username, roles: [role] }`) and refresh token (payload:
   `{ sub, tokenId, jti }` — the random `jti` guarantees a unique signed string per rotation even
   when two rotations land in the same second, since HMAC signing is otherwise deterministic),
   then updates the document with the real hash.

## Account lockout

`MAX_LOGIN_ATTEMPTS` (default 5) wrong passwords in a row locks the account for
`LOCK_DURATION_MS` (default 30 min, `1800000`). A locked account gets `403` on `/auth/login`
regardless of whether the password given this time is correct. Lockout only applies to
password login — there's no equivalent brute-force surface on Google sign-in.

See [security.md](./security.md) for the full security model (CSRF, rate limits, RBAC) and
[error-handling.md](./error-handling.md) for the error envelope shape.
