# User Management

Code: `src/routes/user.routes.js`, `src/controllers/user.controller.js`,
`src/services/user.service.js`, `src/models/user.model.js`.

All routes require auth (`requireAuth`); mutating routes additionally require CSRF
(`verifyCsrf`). Admin-only routes are gated by `authorizeRoles(...)` — see
[security.md](./security.md) for the RBAC model. Roles: `Admin`, `Manager`, `User`
(`src/config/constants.js` → `ROLES`).

---

## `GET /users/me` — requires auth

Returns the caller's own profile.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "name": "Jane Doe",
    "email": "user@example.com",
    "picture": "https://.../avatar.jpg",
    "role": "User",
    "maxStorageInBytes": 16106127360,
    "usedStorageInBytes": 4193404
  }
}
```

**Caching note**: `name`/`email`/`picture`/`role`/`maxStorageInBytes` come from a Redis
cache-aside read (`user_profile`, key `user:profile:<userId>`, 5 min TTL — see
[caching.md](./caching.md)), so a change to those fields (e.g. a subscription upgrade bumping
`maxStorageInBytes`) can take up to 5 minutes to show up *unless* the write path explicitly
busts the cache (subscription webhook handling does — see
[subscriptions-billing.md](./subscriptions-billing.md)). `usedStorageInBytes` is **not** part of
that cached value — it's read fresh from the user's root directory's `size` field on every call,
so it's always current.

**Errors**: `404` if the user record is gone (shouldn't normally happen for an authenticated
caller; would indicate the DB record was deleted after the access token was issued but before
`tokensValidAfter`/deletion checks caught it).

---

## `GET /users` — requires auth + role `Admin` or `Manager`

Paginated list of all non-deleted users, with a live "currently logged in" flag.

**Query params** (validated via `paginationSchema`)

| Param | Type | Default | Constraints |
|---|---|---|---|
| `page` | number | `1` | integer, ≥ 1 |
| `limit` | number | `20` | integer, 1–100 |

`GET /users?page=2&limit=50`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "users": [
      { "id": "665f...", "name": "Jane Doe", "email": "user@example.com", "isLoggedIn": true }
    ],
    "pagination": { "page": 2, "limit": 50, "total": 134, "totalPages": 3 }
  }
}
```

`isLoggedIn` is computed by checking whether the user has any live `RefreshToken` document
(`distinct("userId")` across all active sessions) — not a stored field, always fresh.

**Errors**: `403` if caller isn't Admin/Manager.

---

## `POST /users/:userId/logout` — requires auth + CSRF + role `Admin` or `Manager`

Force-logs-out a specific user: deletes all of their `RefreshToken` documents and bumps their
`tokensValidAfter`, so every session (and any still-unexpired access token) is invalidated
immediately. Same effect as that user calling `/auth/logout-all` themselves.

**Response**: `204 No Content`.

**Errors**: `400` invalid `:userId` shape · `403` caller isn't Admin/Manager.

---

## `DELETE /users/:userId` — requires auth + CSRF + role `Admin`

Soft-deletes a user: sets `deleted: true` on the `User` document. The document (and their files/
directories) is **not** actually removed from the database — `deleted: true` is checked
everywhere a login or `requireAuth` lookup happens, so the account simply can no longer
authenticate. Also revokes all their sessions and invalidates their cached profile.

**Response**: `204 No Content`.

**Errors**: `403` — either caller isn't Admin, or caller tried to delete their own account
(`"You can not delete yourself."`) · `400` invalid `:userId` shape.

**Not covered by this endpoint**: the deleted user's files/directories are left in place (still
attributed to their `userId`) and their S3 objects are untouched — this is account
deactivation, not a GDPR-style data purge.
