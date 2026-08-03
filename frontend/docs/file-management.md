# File Management (the Drive page)

Code: `src/pages/app/drive/`. Read alongside the backend's
**[directories.md](../../backend/docs/directories.md)** and
**[files.md](../../backend/docs/files.md)** — this page is a thin client over exactly those two
feature sets, nothing more.

## Data source

One query drives the whole page: `useGetDirectoryQuery(dirId)` (`directoryApi`), where `dirId` is
the `:dirId` route param (`undefined` at `/app/drive` → the caller's root directory). The response
already contains everything the page renders — direct child `files[]`, direct child
`directories[]`, and the breadcrumb `ancestors[]` — see
[backend directories.md](../../backend/docs/directories.md#get-directoryid) for the exact shape.
**The breadcrumb trail is never reconstructed or cached client-side** — it's built fresh each
render from `directory.ancestors + the current directory itself`, so back/forward navigation,
page refresh, and deep-linking into a nested folder all just work without any client-side
navigation-history bookkeeping.

## Upload: the real 3-step flow

`hooks/useFileUpload.js` drives it, fed by both the file picker (`Toolbar`) and drag-and-drop
(`UploadDropzone`) — both only ever hand over raw `File` objects, so one hook serves both entry
points.

```
1. uploadInitiate({ parentDirId, name, size, contentType })   → RTK Query mutation
     ↳ backend reserves quota, returns { uploadSignedUrl, fileId }

2. XMLHttpRequest PUT <uploadSignedUrl>, raw file bytes         → NOT RTK Query
     ↳ goes straight to S3, not this app's API — see why below

3. uploadComplete({ fileId })                                  → RTK Query mutation
     ↳ backend verifies the object landed and its size matches, marks it ready
```

**Step 2 deliberately bypasses `fetchBaseQuery`/RTK Query and uses a raw `XMLHttpRequest`
instead.** This is the one place in the app that isn't RTK Query, and it's for a specific reason:
`xhr.upload.onprogress` is how the upload progress bar (`UploadProgressTray`) gets real byte-level
progress events — `fetch`-based APIs (which `fetchBaseQuery` uses internally) have no equivalent
upload-progress hook. Each upload gets a client-side-only incrementing id (`nextUploadId`, module
scope) purely to key the progress-tray UI; it has no relationship to the server's `fileId`.

Each file uploads independently and in parallel (`uploadFiles` just maps `uploadFile` over every
selected/dropped file — no queueing/throttling), tracked in a local `queue` state array
(`{ id, name, progress, status }`) rather than Redux — this is transient UI state, not something
worth centralizing. On success, the item is marked `done` and auto-dismissed from the tray after
2.5s; on failure at any step, it's marked `error` and a toast shows the failure reason. Either way,
`uploadComplete`'s success invalidates the `Directory` `"LIST"` tag, so the directory listing
refetches and the new file appears without any manual reload.

## Preview

`utils.js` decides preview behavior purely from file extension — no content-type sniffing, no
server round-trip to ask "can I preview this":

```js
isPreviewable(ext)  // .png .jpg .jpeg .gif .webp .svg .bmp → FilePreviewLightbox (an <img>)
isVideo(ext)         // .mp4 .webm .ogv .ogg .mov .m4v      → VideoPreviewModal (an HTML5 <video>)
```

Both preview components get their source directly from
`getFileDownloadHref(fileId)` (`fileApi.js`) — a plain URL string, not an RTK Query result (see
[state-and-api.md](./state-and-api.md#the-five-api-slices) for why `GET /file/:id` isn't a normal
query: it's a redirect to a signed CloudFront URL, so the browser just needs the link, not a
fetched-and-parsed response). Download uses the same helper with `action=download`, which the
backend maps to `Content-Disposition: attachment` instead of `inline` — see
[backend files.md](../../backend/docs/files.md#get-fileidactiondownload).

## Folder download (zip)

A folder gets the same Download icon as a file, both in `FileList`/`FileGrid` (per-row) and as a
"Download" button in `Toolbar` for whichever folder is currently open (root included). Both use
`getDirectoryDownloadHref(dirId)` (`directoryApi.js`) — a plain URL, same shape as
`getFileDownloadHref`, but **not** a redirect this time: the backend streams a real `.zip`
response body directly, since compressing a folder means actually reading every file's bytes
(the one place in this app where that happens — see
[backend directories.md](../../backend/docs/directories.md#get-directorydownload-and-get-directoryiddownload)).
There's no client-side check for an empty/oversized folder before firing the request — a bad case
just surfaces as the browser receiving a small JSON error body instead of a zip, same trade-off
the plain-anchor file download pattern already accepts.

## Rename / delete

Both directories and files share the same `RenameModal`/`ConfirmDialog` UI in `DrivePage`,
branching only on `renaming.type`/`deleting.type` (`"directory"` vs `"file"`) to call the matching
mutation (`renameDirectory`/`renameFile`, `deleteDirectory`/`deleteFile`). Deleting a directory
shows an extra warning line ("This deletes everything inside it too.") — matching the backend's
actual recursive-delete behavior, see
[backend directories.md](../../backend/docs/directories.md#delete-directoryid). Both mutation
families invalidate the `Directory` `"LIST"` tag on success, so the listing always reflects the
change immediately.

A `Share` action sits alongside Rename/Delete on both files and folders — opens `ShareModal`,
which fetches (idempotently) a public link rather than mutating anything in this listing. Full
detail in [sharing.md](./sharing.md), since it also covers the public page on the other end of
that link.

## View mode

`useDriveViewMode` toggles between `FileList` (table rows) and `FileGrid` (card tiles), persisted
to plain `localStorage` (key `drive-view-mode`) — not Redux/redux-persist, since it's a pure
per-browser UI preference with no server or cross-device relevance. `LayoutGroup` +
`AnimatePresence` (framer-motion) animate the transition between the two layouts.

## Toolbar & folder creation

`Toolbar` exposes the view-mode toggle, "New Folder" (opens `NewFolderModal`), and the file picker
that also feeds `uploadFiles`. `NewFolderModal`'s submitted name is passed as `createDirectory({
parentDirId, dirname })` — internally sent as the `dirname` **header**, not a JSON body field,
matching the backend's actual contract (see
[state-and-api.md](./state-and-api.md#the-five-api-slices)).
