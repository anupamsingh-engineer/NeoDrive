# Sharing (Link Sharing)

Code: `src/routes/share.routes.js` (owner management), `src/routes/publicShare.routes.js`
(public resolution), `src/controllers/share.controller.js`,
`src/controllers/publicShare.controller.js`, `src/services/share.service.js`,
`src/repositories/share.repository.js`, `src/models/share.model.js`.

Read-only link sharing for a single file or an entire folder (including its subfolders,
read-only, drill-down included). Anyone with the link can view/download without an account —
this is the one feature in the API with a genuinely public, unauthenticated data-fetching
surface (`/s/*`), distinct from `/directory` and `/file` which are fully owner-scoped.

## Two route groups, two very different trust levels

| Group | Mount | Auth | Who calls it |
|---|---|---|---|
| **Management** — create/list/revoke | `/share` | `requireAuth, verifyCsrf` (mounted the same way as `/directory`, `/file`) | The owner, from the app |
| **Resolution** — view/download | `/s` | **none at all** | Anyone with the link, logged in or not |

This is the only pair of route groups in the backend that intentionally has no auth gate on one
side. There is no "optional auth" middleware anywhere in this codebase (see
[security.md](./security.md)) — `/s/*` is a plainly public router, mounted with no `requireAuth`
in `src/routes/index.js`, same tier as `/healthz` or `/webhooks/razorpay`.

## Model

```js
{
  token: String,               // unique, unguessable public identifier — see "Token generation" below
  resourceType: "File" | "Directory",
  resourceId: ObjectId,        // the shared File._id or Directory._id, depending on resourceType
  ownerId: ObjectId,           // ref User
  createdAt, updatedAt
}
```

Indexes: unique on `token` (the public lookup path); `{resourceType, resourceId}` (idempotent
re-share lookups, cascade-delete lookups); `{ownerId}` (list-my-shares).

There is **no `expiresAt`/`revoked` field** — v1 is deliberately revoke-only, no expiry, no
password. A share is either a live document (findable by token) or it doesn't exist. **Revoking
is a hard delete of the `Share` document**, not a soft-delete flag — this matches the codebase's
convention for File/Directory (both hard-delete; only `User.deleted` is a soft flag, for an
unrelated reason — see [architecture.md](./architecture.md)). A hard delete also means the
revoked token can never accidentally resolve again later: re-sharing the same resource always
mints a brand-new random token, never reuses the old one.

---

## `POST /share` — create or fetch a share link

Rate limit: `shareCreateLimiter` (20/min, keyed by user id).

**Request**
```json
{ "resourceType": "file", "resourceId": "665f2a..." }
```
`resourceType` is `"file"` or `"directory"`. `resourceId` must be an id the caller owns.

**Behavior**
1. **Root-directory guard**: if `resourceType: "directory"` and `resourceId` equals the caller's
   own root directory, `400 "Cannot share your root directory"` — mirrors `DELETE
   /directory/:id`'s own root guard (see [directories.md](./directories.md)); one accidental
   share shouldn't expose an entire account's contents.
2. **Ownership check**: `fileRepository.findByIdForUser` / `directoryRepository.findByIdForUser`
   — `404` if the resource doesn't exist or isn't owned by the caller. Same ownership chokepoint
   every other file/directory mutation uses.
3. **Idempotent**: if an active share already exists for this exact `(resourceType, resourceId,
   ownerId)`, that same share (same token, same URL) is returned — re-opening the Share dialog
   in the UI never mints a new link or orphans the old one.
4. Otherwise generates a token (`crypto.randomBytes(32)`, base64url — 256 bits) and inserts a new
   `Share` document.

**Response `201`**
```json
{
  "success": true,
  "data": {
    "id": "665fa1...",
    "token": "kQ2f9x...64-char-url-safe-string",
    "url": "https://app.example.com/s/kQ2f9x...",
    "resourceType": "file",
    "resourceId": "665f2a...",
    "createdAt": "2026-08-01T12:00:00.000Z"
  }
}
```
`url` is built from `env.frontend.url` (the same trusted frontend origin used for password-reset
links — see [security.md](./security.md)) + `/s/<token>` — that path must exist as a real
frontend route (see the frontend's [sharing.md](../../frontend/docs/sharing.md)).

**Errors**: `400` validation / sharing own root directory · `404` resource not found or not
owned · `429` rate limited.

---

## `GET /share` — list my active share links

**Response `200`**
```json
{
  "success": true,
  "data": [
    {
      "id": "665fa1...",
      "token": "kQ2f9x...",
      "url": "https://app.example.com/s/kQ2f9x...",
      "resourceType": "directory",
      "resourceId": "665f1a...",
      "resourceName": "Vacation Photos",
      "createdAt": "2026-08-01T12:00:00.000Z"
    },
    {
      "id": "665fa2...",
      "token": "9xK2fQ...",
      "url": "https://app.example.com/s/9xK2fQ...",
      "resourceType": "file",
      "resourceId": "665f2a...",
      "resourceName": "beach.jpg",
      "resourceExtension": ".jpg",
      "createdAt": "2026-08-01T11:00:00.000Z"
    }
  ]
}
```
`resourceExtension` is only present for a `"file"` share — omitted entirely (not `null`) for a
`"directory"` share. Both `resourceName` and `resourceExtension` are looked up live from the
current `File`/`Directory` document at list time — not stored on the `Share` document itself, so
they stay in sync with the resource's current name even if it was renamed after sharing.
`resourceName: null` would mean the lookup failed to find the resource, which should never happen
in practice since cascade-delete (below) removes the `Share` document in the same request the
resource is deleted — a `null` here would indicate that invariant broke, not an expected case.

Sorted newest first. No pagination in v1 — a user's live share count is expected to stay small.

---

## `DELETE /share/:id` — revoke

`:id` is the `Share` document's own id (the `id` field from the create/list response — **not**
the shared file/directory's id).

**Behavior**: ownership-checked (`findByIdForOwner`), then hard-deleted. Takes effect
**immediately** — there is no cache in front of `GET /s/:token`, so the very next resolution
request after a revoke 404s. No grace period, no "still works for a few minutes."

**Response `200`**
```json
{ "success": true, "message": "Share revoked" }
```

**Errors**: `400` invalid `:id` · `404` not found / not owned by the caller (same generic
message either way — doesn't confirm whether the share id belongs to someone else).

---

## `GET /s/:token` — public: view file metadata or browse a shared folder

Rate limit: `shareResolveLimiter` (300/15m, keyed by IP — this is the unauthenticated surface, so
the limiter can't key on a user id).

No auth, no CSRF. Every response is a **hand-built whitelist**, never a raw Mongo document spread
— unlike the owner-facing `GET /directory/:id?` (which is fine returning its own owner's full
document), this endpoint must never leak `userId`, `parentDirId`, or any field beyond what a
visitor should see.

### File share

**Response `200`**
```json
{
  "success": true,
  "data": {
    "resourceType": "file",
    "file": { "id": "665f2a...", "name": "beach.jpg", "size": 204800, "extension": ".jpg" }
  }
}
```

### Directory share

`?dirId=<id>` (optional) drills into a subfolder of the share; omitted → the shared folder's own
root.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "resourceType": "directory",
    "shareRootId": "665f1a...",
    "directory": { "id": "665f1b...", "name": "2024" },
    "files": [
      { "id": "665f2a...", "name": "beach.jpg", "size": 204800, "extension": ".jpg" }
    ],
    "directories": [
      { "id": "665f1c...", "name": "Summer" }
    ],
    "ancestors": [
      { "id": "665f1b...", "name": "2024" }
    ]
  }
}
```

`ancestors` is the breadcrumb trail **cut at the share root** — it never includes the share root
itself (that maps to an implicit "Home" in the UI, same idea as the owner-side breadcrumb's
"Home" icon) and never includes anything above the share root in the owner's real folder tree.
Viewing the share root itself returns `ancestors: []`; viewing a direct child also returns
`ancestors: []` (there's nothing *between* the root and a direct child); a grandchild returns
`[{the intermediate folder}]`, and so on. See "The security boundary check" below for exactly how
this is computed and verified live end-to-end.

**Errors**: `404` for every failure case — missing token, revoked/deleted share, `dirId` outside
the shared subtree. All return the same generic message,
`"This link is invalid or has been revoked"` — deliberately indistinguishable, so a visitor
probing tokens or ids gets no signal about which case they hit.

---

## `GET /s/:token/file/:fileId?action=download` — public: download a file within a share

Same rate limit as above. `302` redirect to a signed CloudFront URL — reuses the exact same
signing call the owner-facing `GET /file/:id` uses
(`cloudfrontStorage.createGetSignedUrl`, see [files.md](./files.md#get-fileidactiondownload)),
just gated by a different authorization check in front of it.

- **File share**: `fileId` must equal the share's own `resourceId` — anything else is `404`.
- **Directory share**: `fileId` must resolve to a file whose `parentDirId` is the share root
  itself, or a descendant of it (verified via the same ancestor-chain walk as `GET /s/:token`) —
  anything else is `404`.

`?action=download` forces `Content-Disposition: attachment`; omitted defaults to `inline`, same
semantics as the owner-facing download endpoint.

**Errors**: `404` for every failure case, generic message, same anti-enumeration reasoning as
above.

---

## The security boundary check

The one property this whole feature depends on: **a visitor with a folder-share link can browse
anywhere inside that folder, and nowhere else** — not a sibling folder, not the owner's true
root, not an unrelated file elsewhere in the owner's drive.

Both `?dirId=` (browsing) and `:fileId` (downloading) go through the same check, built on top of
`directoryRepository.findAncestorChain` (already used elsewhere for breadcrumbs — see
[directories.md](./directories.md)):

```
given a target directory (or a file's parentDirId) and the share's resourceId (the share root):

  target === shareRoot?                       → allowed, it's the root of the share itself
  shareRoot appears in findAncestorChain(target)?  → allowed, target is a real descendant
  otherwise                                     → 404, not part of this share
```

Because `findAncestorChain` walks real `parentDirId` links stored in Mongo — not anything a
client supplies — there is no way to construct a `dirId`/`fileId` that satisfies this check
without the resource actually being a descendant of the shared folder. A bogus or unrelated id
simply fails the walk (an unrelated directory's ancestor chain will never contain the share root)
and 404s, same as a genuinely nonexistent id.

## Cascade delete

A `Share` document must never outlive the resource it points at. Both delete paths clean up
synchronously, in the same request, before responding — **not** queued (unlike S3 object
deletion, which *is* asynchronous via the `s3-cleanup` queue, see
[background-jobs.md](./background-jobs.md); there's no external system to wait on here, just
another Mongo delete):

- **`DELETE /file/:id`** (`file.service.js`'s `deleteFile`) — deletes any `Share` pointing at
  that file id.
- **`DELETE /directory/:id`** (`directory.service.js`'s `deleteDirectory`, recursive) — deletes
  any `Share` pointing at **any** file or directory id in the entire subtree being removed,
  including the directory being deleted itself (it could be directly shared, not just an
  ancestor of something shared deeper down) — reuses the same `collectDirectoryContents` walk the
  delete itself already does, so this is one extra bulk-delete query, not a second recursive
  walk.

## Caching

Deliberately **none**. `directoryService.getDirectory` (the owner-facing folder listing) is
cache-aside via Redis (`dir_listing`, 45s TTL — see [caching.md](./caching.md)); the public
resolution functions in `share.service.js` **do not** call it and **do not** touch that cache at
all — they query the repositories directly. Two reasons: revoke must take effect on the very next
request with zero lag, and a visitor's request must never read from or write into the owner's
`dir:listing:<userId>:<dirId>` cache namespace.

## Token generation

`crypto.randomBytes(32).toString("base64url")` — 256 bits of entropy, never the Mongo `_id`.
Unlike `RefreshToken.tokenHash` (see [security.md](./security.md)), the share token is stored
**in plaintext**, not hashed — a deliberate difference: what a refresh token hash protects against
is a DB dump handing over the ability to *log in as the user*, which hashing meaningfully raises
the bar on; what a share token protects is read access to one resource that a DB dump already
exposes directly (the `files`/`directories` collections themselves), so hashing it buys close to
no extra protection while breaking the product requirement that reopening the Share dialog (or
listing "my shares") shows the same usable link again.
