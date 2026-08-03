# State Management & API Integration

Code: `src/store/index.js`, `src/store/rootReducer.js`, `src/store/api/*`,
`src/store/slices/*`, `src/store/middleware/*`.

## Redux store shape

```js
{
  api: { ... },          // baseApi.reducerPath — all RTK Query cache state lives here
  auth: { isAuthenticated, user, isAuthLoading, loginError, networkError },
  registration: { step, email, verificationToken, verificationTokenExpiresAt },
}
```

Three top-level keys. There is no client-side "directory tree" or "file list" slice — **all
server data lives in the RTK Query cache**, not hand-written reducers. `auth` and `registration`
are the only genuinely client-owned state, and even `auth` is mostly a mirror of what
`GET /users/me` last returned (see [authentication.md](./authentication.md)). `registration`
exists purely so the signup wizard survives a page reload — see
[authentication.md](./authentication.md#register-persisted-across-reloads).

`redux-persist` (`store/persist/index.js`) persists `auth` (only the `user` object out of it —
see [authentication.md](./authentication.md#boot-sequence)) and `registration` (step/email/token,
never the password typed into its details step). `blacklist: ["api"]` means the RTK Query cache
is never persisted; it's always refetched fresh on load (`keepUnusedDataFor: 60` in `baseApi.js` —
cached data is dropped 60s after the last component using it unmounts).

## `loggingMiddleware` — written, not wired in

`store/middleware/loggingMiddleware.js` is a real, working Redux middleware (logs every action
with a redacted payload, previous/next state, and timing, in dev only) — but **it's never added to
the store**. `store/index.js`'s middleware chain is:

```js
middleware: (getDefaultMiddleware) =>
  getDefaultMiddleware({ serializableCheck: { ... } }).concat(baseApi.middleware),
```

Only `baseApi.middleware` (required for RTK Query to function) is concatenated —
`loggingMiddleware` is absent. If you want it, add `.concat(loggingMiddleware)` there; as-is it's
dead code left from the original template.

## RTK Query setup

`baseApi.js` is the single `createApi()` instance every feature slice injects endpoints into
(`injectEndpoints`) — not six separate APIs. This means they all share one cache, one
`tagTypes` list (`["User", "Directory", "Share"]`), and the same `baseQueryWithReauth` (see
[authentication.md](./authentication.md#token-refresh-transparent-mutex-guarded) for the CSRF /
401-reauth / 409-retry logic that wraps every single request through this app).

`refetchOnFocus: true, refetchOnReconnect: true` at the `baseApi` level means every query
auto-refetches when the tab regains focus or the network reconnects — a stale directory listing
self-heals without any manual "refresh" action.

### The six API slices

| Slice | Endpoints | Cache tags |
|---|---|---|
| `authApi` | `sendOtp, verifyOtp, register, login, loginWithGoogle, refresh, logout, logoutAll, forgotPassword, resetPassword` | `register`/`login`/`loginWithGoogle` invalidate `User` (though the auth slice is updated directly via matchers too — see [authentication.md](./authentication.md)) |
| `userApi` | `getCurrentUser, getAllUsers, logoutUserById, deleteUser` | provides/invalidates `User` |
| `directoryApi` | `getDirectory, createDirectory, renameDirectory, deleteDirectory` | provides `{Directory, id: dirId\|"ROOT"}` + `{Directory, id: "LIST"}`; every mutation invalidates `"LIST"` |
| `fileApi` | `uploadInitiate, uploadComplete, renameFile, deleteFile` | mutations invalidate `{Directory, id: "LIST"}` — a file change refetches whatever directory listing is currently showing |
| `shareApi` | `createShare, listShares, revokeShare, getShareView` | `createShare`/`revokeShare` invalidate `{Share, id: "LIST"}`; `listShares` provides it (powers `/app/shared`); `getShareView` is unauthenticated but still a normal query (see [sharing.md](./sharing.md)) |
| `subscriptionApi` | `getPlans, createSubscription` | no tags — plans are static, and a new subscription doesn't change anything the cache tracks (see the note on `maxStorageInBytes` below) |

One notable shape mismatch handled deliberately: `createDirectory`'s folder name travels as a
**request header** (`dirname`), not a JSON body field — matching the backend's actual (slightly
unusual) contract exactly, see
[backend directories.md](../../backend/docs/directories.md#post-directoryparentdirid).

`GET /file/:id` (download/preview) is **not** an RTK Query endpoint at all — it's a 302 redirect
to a signed CloudFront URL, not JSON, so `fetchBaseQuery` (which expects a JSON/text response
body) isn't the right tool. `fileApi.js` instead exports a plain helper,
`getFileDownloadHref(fileId, action)`, that builds the URL for use in a real `<a href>` or
`window.open()` — see [file-management.md](./file-management.md). `shareApi.js` has the exact
same shape for the same reason: `getShareFileHref(token, fileId, action)` is a plain URL-builder,
not a query, because `GET /s/:token/file/:fileId` is also a redirect — see
[sharing.md](./sharing.md).

## Error handling & toasts

Centralized in `baseQueryWithReauth` (`store/api/baseQuery.js`), not repeated per-component:

| Status | Behavior |
|---|---|
| `401` | Handled by the reauth flow (refresh + retry) — see [authentication.md](./authentication.md) |
| `409` | Benign refresh race — retried once automatically, invisible to the component |
| `429` | Toast: *"Too many requests. Please slow down."* |
| `500` | Toast: *"Server error. Please try again later."* |
| `403`, `404`, `507` | **No automatic toast** — left for the calling component to handle inline (e.g. a 507 on upload-initiate should show "not enough storage" in context, not a generic banner) |
| anything else | Toast with the backend's own `message` (see [backend error-handling.md](../../backend/docs/error-handling.md) for what that message will actually say) |

Every error is also logged via `logger.error("API Error", { status, endpoint })` regardless of
whether it gets a toast.

## A real gap: `maxStorageInBytes` after a subscription

`createSubscription`'s comment says it plainly: *"maxStorageInBytes only updates once Razorpay's
webhook fires"* (see [backend subscriptions-billing.md](../../backend/docs/subscriptions-billing.md)).
Nothing in `subscriptionApi` invalidates the `User` tag on `createSubscription` — it can't, since
the quota grant hasn't happened yet at that point (it lands asynchronously, out-of-band, when
Razorpay calls `/webhooks/razorpay`). The UI's storage-used bar (Profile page) only picks up the
new quota once `useSessionGuard`'s 60s poll (see [authentication.md](./authentication.md)) or a
manual `GET /users/me` refetch happens to run after the webhook lands — there's no
push/websocket to make it instant.

## A real bug worth knowing about: hardcoded Razorpay key

`pages/app/subscriptions/index.jsx` does this:

```js
const RAZORPAY_KEY_ID = "rzp_test_TEPFKSsYkRQS2R";
```

...instead of `import.meta.env.VITE_RAZORPAY_KEY_ID` — even though that env var is defined in
`.env.example`, threaded through as a Docker build `ARG` (`Dockerfile`), and listed in the CSP.
The whole pipeline to configure it exists; the one line that should read it doesn't. In practice
this means **every environment currently checks out against Razorpay's test key**, regardless of
what `VITE_RAZORPAY_KEY_ID` is actually set to at build time — worth fixing before a real
production payment flow depends on it. See
[environment-variables.md](./environment-variables.md#vars-that-look-wired-but-arent).
