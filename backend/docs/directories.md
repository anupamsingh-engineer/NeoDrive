# Directories (Folders)

Code: `src/routes/directory.routes.js`, `src/controllers/directory.controller.js`,
`src/services/directory.service.js`, `src/repositories/directory.repository.js`,
`src/models/directory.model.js`.

All routes require auth + CSRF (mounted under `requireAuth, verifyCsrf` in
`src/routes/index.js`; CSRF is skipped for GET, per [security.md](./security.md)).

## Model

```js
{
  name: String,
  size: Number,           // bytes; sum of everything nested underneath, including subfolders
  userId: ObjectId,
  parentDirId: ObjectId | null,  // null only for a user's root directory
  createdAt, updatedAt
}
```

Every user has exactly one root directory (`user.rootDirId`), created transactionally alongside
the `User` document at registration (see [authentication.md](./authentication.md)). `size` is
**not** computed on read — it's maintained incrementally on every write that changes bytes under
a directory (upload, delete, nested delete) by walking the `parentDirId` chain up to root and
`$inc`-ing each ancestor. A nightly job recomputes it from scratch to correct any drift — see
[background-jobs.md](./background-jobs.md).

Ownership is enforced on every operation via `{ _id, userId }` queries — there is no way to
address another user's directory by guessing its ObjectId.

---

## `GET /directory/:id?`

`:id` is optional — omit it (`GET /directory`) to get the caller's root directory.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": "665f1a...",
    "name": "Photos",
    "size": 4193404,
    "userId": "665f0a...",
    "parentDirId": "665f00...",
    "createdAt": "...", "updatedAt": "...",
    "files": [
      { "id": "665f2a...", "name": "beach.jpg", "size": 204800, "extension": ".jpg", "isUploading": false, "parentDirId": "665f1a...", "userId": "665f0a...", "createdAt": "...", "updatedAt": "..." }
    ],
    "directories": [
      { "id": "665f1b...", "name": "2024", "size": 0, "userId": "665f0a...", "parentDirId": "665f1a...", "createdAt": "...", "updatedAt": "..." }
    ],
    "ancestors": [
      { "id": "665f00...", "name": "root-user@example.com" }
    ]
  }
}
```

- `files` / `directories` are the **direct children only** (one level, not recursive).
- `ancestors` is the breadcrumb trail from root down to (but not including) this directory,
  root-first — built by walking `parentDirId` up to `null`. Empty array `[]` for the root
  directory itself.
- Cached 45s per `(userId, dirId)` in Redis (`dir_listing` cache — see
  [caching.md](./caching.md)); every mutation below explicitly busts the relevant entries, so
  the 45s window only matters for concurrent/external drift, not for your own writes.

**Errors**: `400` invalid `:id` shape · `404` directory doesn't exist or isn't owned by the
caller (these two cases are indistinguishable in the response, deliberately — no existence
leak).

---

## `POST /directory/:parentDirId?`

Creates a new subfolder. `:parentDirId` is optional (defaults to the caller's root).

**Note the folder name is a header, not a body field**:
```
POST /directory/665f1a...
dirname: My New Folder
```
If the `dirname` header is omitted, the folder is named `"New Folder"`. There is no request
body.

**Response `201`**
```json
{ "success": true, "message": "Directory Created!" }
```

**Errors**: `400` invalid `:parentDirId` shape · `404` `"Parent Directory Does not exist!"`
(doesn't exist, or belongs to another user).

---

## `PATCH /directory/:id`

**Request**
```json
{ "newDirName": "Renamed Folder" }
```
`newDirName`: 1–255 chars.

**Response `200`**
```json
{ "success": true, "message": "Directory Renamed!" }
```

**Errors**: `400` validation · `404` not found / not owned.

---

## `DELETE /directory/:id`

Recursively deletes the directory and everything nested inside it — all descendant files and
subdirectories, at any depth.

**Behavior**
1. `400` `"Cannot delete your root directory"` if `:id` is the caller's root.
2. `404` if not found/not owned.
3. Walks the subtree collecting every descendant file (id + extension, for building S3 keys) and
   every descendant directory id.
4. Removes all of those file and directory documents from Mongo **immediately** (synchronously,
   before the response is sent).
5. Schedules the corresponding S3 objects for deletion **asynchronously** via the `s3-cleanup`
   queue — see [background-jobs.md](./background-jobs.md). This means a deleted file disappears
   from listings instantly, but the underlying S3 object is removed shortly after, not
   atomically with the same request.
6. Decrements the deleted directory's `size` up the ancestor chain (to root) and busts the
   listing cache for every directory whose `size` changed.

**Response `200`**
```json
{ "success": true, "message": "Files deleted successfully" }
```

**Errors**: `400` invalid id / root directory · `404` not found.

**Performance note**: the subtree walk (`collectDirectoryContents` in `directory.service.js`) is
a recursive per-directory query, not a single aggregation — fine for typical folder depths, but
worth knowing if you're deleting an unusually deep/wide tree.

---

## `GET /directory/download` and `GET /directory/:id/download`

Downloads the directory (or your root, if `:id` is omitted) and everything nested inside it as a
single `.zip` — the one read path in this app where the API server actually touches file bytes.
Every other download (`GET /file/:id`, and share downloads) is a redirect to a CloudFront signed
URL; this one streams a real response body, because building a zip means something has to
actually read every file's contents to compress them.

Rate limit: `directoryDownloadLimiter` (10/min, keyed by user id) — deliberately tighter than
other download endpoints, since this is the one download path that can meaningfully load the API
process itself.

**Behavior**
1. `404` if the directory doesn't exist or isn't owned by the caller.
2. Recursively walks the subtree (`collectFilesForZip` in `directory.service.js` — same
   recursive-per-directory shape as the delete walk above, but keeps each file's display name and
   builds its path inside the archive from the real subfolder names, not from the S3 key).
3. Rejects with `400` if the folder is empty (no files anywhere in the subtree, even if it has
   empty subfolders), or if it exceeds either limit below.
4. Streams a zip (`archiver`, moderate compression) directly as the response body — files are
   fetched from S3 and appended to the archive **one at a time, in order**, not fetched all at
   once, to avoid opening dozens/hundreds of S3 read streams simultaneously.

**Limits** (hardcoded in `directory.service.js`, not currently env-configurable):

| Limit | Value | Failure |
|---|---|---|
| File count | 2000 | `400 "This folder has too many files to download as a zip (limit: 2000)"` |
| Total bytes | 2 GB | `400 "This folder is too large to download as a zip (limit: 2 GB)"` |

**Response `200`**: `Content-Type: application/zip`, `Content-Disposition: attachment;
filename="<folder-name>.zip"` — not a JSON envelope, use as a plain link
(`<a href>`), same as a file download.

**Errors**: `400` invalid id / empty folder / over a size or count limit · `404` not found/not
owned · `429` rate limited. A failure that happens **mid-stream** (e.g. an S3 read error partway
through) can't cleanly become a JSON error at that point since headers are already sent — the
connection is simply destroyed; the browser sees a truncated/failed download, not an error
message.
