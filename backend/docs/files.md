# Files

Code: `src/routes/file.routes.js`, `src/controllers/file.controller.js`,
`src/services/file.service.js`, `src/services/file.storageOps.js`,
`src/services/storage/s3.storage.js`, `src/services/storage/cloudfront.storage.js`,
`src/repositories/file.repository.js`, `src/models/file.model.js`.

All routes require auth + CSRF (mounted under `requireAuth, verifyCsrf`; CSRF skipped for GET).

## Model

```js
{
  name: String,
  size: Number,          // bytes, set at upload-initiate time and never changed
  extension: String,     // lowercased, from the filename, e.g. ".jpg"
  userId: ObjectId,
  isUploading: Boolean,  // true from initiate until complete confirms the S3 object
  parentDirId: ObjectId,
  createdAt, updatedAt
}
```

S3 object key = `` `${fileId}${extension}` `` (see `objectKey()` in `file.storageOps.js`) — the
key is derived entirely from the Mongo `_id`, so it's assigned before the object exists and never
needs to be looked up separately.

## Why upload is two requests, not one

The API server never receives file bytes. Uploads go **directly from the browser to S3** using a
short-lived presigned PUT URL — this avoids routing potentially multi-GB payloads through Express
(whose JSON/urlencoded body parser is capped at 1mb for everything else) and keeps the API
server's own bandwidth/CPU out of the upload path entirely.

```
1. POST /file/upload/initiate  → server reserves quota, creates a File doc (isUploading: true),
                                   returns a presigned S3 PUT URL + fileId
2. (client)  PUT <uploadSignedUrl>  with the raw file bytes, Content-Type header matching what
                                       was declared in step 1  — goes straight to S3, not through this API
3. POST /file/upload/complete  → server HEADs the S3 object, verifies it actually landed and
                                   its size matches what was reserved, flips isUploading to false
```

If step 3 never happens (client crash, network failure, abandoned upload), the `File` document
stays `isUploading: true` and its reserved bytes stay counted against the user's quota — there is
no automatic sweeper for orphaned in-progress uploads in this codebase today.

---

## `POST /file/upload/initiate`

Rate limit: `uploadLimiter` (60 / min, keyed by user id).

**Request**
```json
{
  "parentDirId": "665f1a...",
  "name": "beach.jpg",
  "size": 204800,
  "contentType": "image/jpeg"
}
```

| Field | Required | Notes |
|---|---|---|
| `parentDirId` | no | defaults to the caller's root directory |
| `name` | no | defaults to `"untitled"` |
| `size` | **yes** | bytes, must be > 0 — this is the number reserved against quota and later checked against the real S3 object |
| `contentType` | **yes** | passed through as the S3 object's `Content-Type` and as a signable header on the presigned URL |

**Behavior**
1. Looks up the parent directory (`404` if missing/not owned) and the caller's `User` record (for
   `maxStorageInBytes`).
2. Extension is taken from `name` and lowercased. Rejected outright (`400`) if it's in the
   blocklist: `.exe .bat .cmd .sh .msi .dll .scr .com .ps1 .vbs .jar`.
3. If the declared `contentType` doesn't match what the extension normally maps to (via
   `mime-types`), it's logged as a warning — **not** rejected.
4. **Quota reservation** (atomic, race-safe): an atomic compare-and-increment on the root
   directory's `size` — the update only applies if `rootDir.size + size <= maxStorageInBytes`, so
   two concurrent uploads can't both pass a check-then-write race and jointly overshoot the
   quota. Fails → `507 Insufficient Storage`.
5. Same `size` delta is then added up every intermediate ancestor directory between the target
   folder and root (root itself already handled atomically in step 4).
6. Creates the `File` document (`isUploading: true`) and requests a presigned S3 `PutObject` URL
   (5 minute expiry).
7. **On any failure after step 6** (including the S3 presign call itself failing) — the entire
   reservation is rolled back: the `File` document is deleted and the quota delta is reversed on
   every ancestor. This is why the reservation happens *before* the file document/S3 call: it's
   the one thing that must not be left half-done.

**Response `201`**
```json
{
  "success": true,
  "data": {
    "uploadSignedUrl": "https://<bucket>.s3.<region>.amazonaws.com/665f2a....jpg?X-Amz-...",
    "fileId": "665f2a..."
  }
}
```

**Errors**: `400` validation / blocked extension · `404` parent directory not found ·
`507` insufficient storage · `429` rate limited.

**Client responsibility (step 2, not an API call to this backend)**:
```
PUT <uploadSignedUrl>
Content-Type: image/jpeg
<raw file bytes>
```

---

## `POST /file/upload/complete`

**Request**
```json
{ "fileId": "665f2a..." }
```

**Behavior**
- `404` if the file doesn't exist or isn't owned by the caller.
- Issues a `HEAD` request against the S3 object.
  - **Object missing / HEAD fails** → releases the entire reservation (deletes the `File` doc,
    reverses the quota delta up the ancestor chain), `404`
    `"File could not be uploaded properly."`
  - **Object's `ContentLength` doesn't match the `size` declared at initiate** → same rollback,
    `400 "File size does not match."`
  - **Match** → flips `isUploading` to `false`. (Quota was already reserved at initiate time —
    nothing further to increment here.)
- Records upload-duration metric (`createdAt` → now) and increments completion counters — see
  [observability.md](./observability.md).

**Response `200`**
```json
{ "success": true, "data": { "message": "Upload completed" } }
```

**Errors**: `400` size mismatch · `404` file not found / verification failed.

---

## `GET /file/:id?action=download`

Redirects (`302`) to a time-limited CloudFront signed URL for the file — this endpoint itself
never streams bytes.

- `?action=download` → `Content-Disposition: attachment` (browser downloads it).
- Any other value / omitted → `Content-Disposition: inline` (browser renders it in-place —
  images, PDFs, etc.).
- Signed URL expiry: `CLOUDFRONT_URL_EXPIRY_SECONDS` (default 3600s / 1 hour).

**Errors**: `400` invalid `:id` · `404` file not found / not owned.

---

## `PATCH /file/:id`

**Request**
```json
{ "newFilename": "beach-vacation.jpg" }
```
`newFilename`: 1–255 chars. Note: renaming only changes the display `name` field — it does
**not** change the file's extension-derived S3 key, so the underlying object key is untouched.

**Response `200`**
```json
{ "success": true, "message": "Renamed" }
```

**Errors**: `400` validation · `404` not found / not owned.

---

## `DELETE /file/:id`

**Behavior**
1. `404` if not found/not owned.
2. Deletes the `File` document immediately.
3. Reverses its `size` up the ancestor chain to root (quota was reserved at initiate time
   regardless of whether the upload ever completed, so it's always released here — even for a
   file that's still `isUploading: true`).
4. Schedules the S3 object for asynchronous deletion via the `s3-cleanup` queue — see
   [background-jobs.md](./background-jobs.md). Same eventual-consistency caveat as directory
   delete: gone from the API immediately, removed from S3 shortly after.

**Response `200`**
```json
{ "success": true, "message": "File Deleted Successfully" }
```

**Errors**: `400` invalid `:id` · `404` not found.
