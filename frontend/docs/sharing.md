# Sharing

Code: `src/store/api/features/shareApi.js`, `src/pages/app/drive/components/ShareModal.jsx`,
`src/pages/public/ShareView/index.jsx`. Read alongside the backend's
**[sharing.md](../../backend/docs/sharing.md)** — this doc covers the two client-side halves of
that feature: the owner's "Share" action on the Drive page, and the standalone public page
anyone with a link lands on.

Unlike every other feature in this app, sharing has **two audiences reading two different
docs-worth of behavior**: the owner (authenticated, inside `/app/drive`) and the visitor
(anonymous, on a page that isn't gated by `AuthGuard` at all).

## Owner side: the Share action

`ShareModal.jsx` follows the same structural pattern as `RenameModal.jsx` (see
[file-management.md](./file-management.md)) — a controlled `open`/`onClose` modal owned by
`DrivePage`'s `sharing` state (`{type, id, name}`, the same shape as `renaming`/`deleting`) — but
its data flow is different: **it fetches on open**, not just on submit.

```
open Share dialog
  → createShare({resourceType: item.type, resourceId: item.id}).unwrap()
  → shows the returned link + a Copy button + a "Turn off link" button
```

`createShare` is called every single time the dialog opens, with no "does a share already exist"
check on the client — that's deliberate. The backend endpoint is idempotent (see
[backend sharing.md](../../backend/docs/sharing.md#post-share--create-or-fetch-a-share-link)): if
this file/folder is already shared, it returns the *same* token/url instead of minting a new one.
This means the modal never needs its own "check if shared first" round trip or local cache of
share state — it just always asks, and the backend guarantees the answer is stable.

"Turn off link" calls `revokeShare(share.id)` (the **share document's** id, returned alongside
the token — not the file/folder's own id) and closes the modal on success.

**Where the action lives**: `FileList.jsx`/`FileGrid.jsx` gained a `Share2` icon button
(`lucide-react`) alongside the existing Download/Rename/Delete actions, wired through
`sharedListProps.onShare` in `DrivePage` exactly like `onRename`/`onDelete`. Share is offered for
**both** files and directories (Download is file-only).

## Visitor side: `ShareView`

A public page at `/s/:token`, registered as a route **sibling** to (not nested inside)
`PublicLayout` in `PublicRoutes.jsx` — deliberately chromeless (no `PublicHeader`/`PublicFooter`),
since it's a file/folder browser, not a marketing page. `AuthGuard` only special-cases `/app/*`
and `/auth/*` paths (see [routing-and-pages.md](./routing-and-pages.md)), so this route is left
alone regardless of whether the visitor happens to be logged in — the same page works for both.

### Navigation is query-string based, not path-based

`DrivePage` navigates subfolders via a path param (`/app/drive/:dirId`). `ShareView` instead uses
`?dirId=` (`useSearchParams()`), because that's the exact contract the backend's
`GET /s/:token?dirId=` endpoint expects (see
[backend sharing.md](../../backend/docs/sharing.md#get-stoken--public-view-file-metadata-or-browse-a-shared-folder)).
This is an easy detail to get wrong by instinct-copying `DrivePage`'s pattern — worth remembering
it's intentionally different here, not an oversight.

```js
const { token } = useParams();               // which share
const dirId = searchParams.get("dirId");      // which subfolder within it (undefined = share root)
useGetShareViewQuery({ token, dirId });
```

### What it renders

- **File share** → name/size/icon, a Download link, and — if the extension qualifies
  (`isPreviewable`/`isVideo` from `pages/app/drive/utils.js`, reused unmodified) — a Preview
  button that opens the same `FilePreviewLightbox`/`VideoPreviewModal` components the Drive page
  uses, just pointed at `getShareFileHref(token, fileId)` instead of `getFileDownloadHref(fileId)`.
- **Directory share** → a read-only table (files + subfolders), breadcrumbs via the shared
  `Breadcrumbs` UI component, and the same preview components for previewable files inside it.
  There is no Rename/Delete/Share UI anywhere on this page — the backend response itself doesn't
  return the fields those actions would need, and there is no mutation endpoint reachable without
  auth anyway.
- **Invalid/revoked token** → a generic "This link is invalid or has been turned off" empty
  state. The backend returns the exact same `404` for a missing token, a revoked one, or a
  `dirId` that escapes the shared folder (see
  [backend sharing.md](../../backend/docs/sharing.md#the-security-boundary-check)) — this page
  doesn't attempt to distinguish them either, on purpose.

This page intentionally does **not** reuse `FileList`/`FileGrid` — those components are wired
directly to authenticated mutations (`onRename`, `onDelete`, `getFileDownloadHref` baked into
their imports) that don't apply here and shouldn't be reachable from a public page. `ShareView`
renders its own minimal read-only table instead, trading a little markup duplication for zero
risk of a public page accidentally inheriting an authenticated action.

## API layer

`shareApi.js` (injected into the same `baseApi` as every other feature — see
[state-and-api.md](./state-and-api.md)):

| Endpoint | Kind | Notes |
|---|---|---|
| `createShare` | mutation | `POST /share`, invalidates the `Share` `"LIST"` tag |
| `revokeShare` | mutation | `DELETE /share/:id`, invalidates the `Share` `"LIST"` tag |
| `getShareView` | query | `GET /s/:token?dirId=` — public, but still returns JSON, so it's a normal RTK Query endpoint despite carrying no auth |
| `getShareFileHref(token, fileId, action)` | plain function, **not** an RTK Query endpoint | Builds a URL string for `<a href>`/`<img src>`, mirroring `getFileDownloadHref` in `fileApi.js` — `GET /s/:token/file/:fileId` is a redirect, not JSON, so `fetchBaseQuery` isn't the right tool for it either |

`getShareView` goes through the same `baseQueryWithReauth` wrapper as every other query — that's
harmless here (an anonymous visitor's request never gets a `401`, so the reauth branch simply
never triggers), but worth knowing it isn't a separately-configured "public" base query, just the
same one used everywhere else in the app.
