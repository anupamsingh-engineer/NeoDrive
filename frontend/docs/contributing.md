# Contributing

Conventions actually used in this codebase — extracted from the real patterns in
`src/`, not generic React advice. Run `npm run lint` / `npm run lint:fix` before submitting.

## Adding a new API endpoint

Follow the existing feature-slice pattern (`src/store/api/features/*.js`) — one file per backend
feature, injected into the single shared `baseApi`:

```js
// src/store/api/features/xApi.js
import { baseApi } from "../baseApi";
import { API_ROUTES } from "../../../configs/apiRoutes";

export const xApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getX: builder.query({
      query: () => API_ROUTES.X.GET,
      providesTags: ["X"],
    }),
  }),
  overrideExisting: true,
});

export const { useGetXQuery } = xApi;
```

1. Add the path to `configs/apiRoutes.js` first — never hardcode a URL string inline in a `query`
   function. If it's a new backend feature, add the corresponding tag to `baseApi.js`'s
   `tagTypes` array.
2. `overrideExisting: true` is set on every existing slice — keep it, it's what makes Vite's HMR
   not throw on hot-reloading an endpoint definition during dev.
3. If the endpoint should trigger a toast/reauth/CSRF automatically, you get all three for free —
   they're handled once, centrally, in `baseQuery.js`. Don't add per-endpoint error handling for
   those three concerns. See [state-and-api.md](./state-and-api.md).

## Adding a new page

1. Create `src/pages/{public,app}/YourPage/index.jsx`.
2. Add a lazy import + `<Route>` in the matching router file
   (`router/routes/PublicRoutes.jsx` or `PrivateRoutes.jsx`) — every existing route is
   `React.lazy()`-loaded inside a shared `Suspense`; follow that, don't eager-import.
3. If it needs role-gating, wrap it the way `/app/users` does (`RequireRole` in
   `PrivateRoutes.jsx`), not a check inside the page component — keeps the "can even see this
   route" decision in one place. See [routing-and-pages.md](./routing-and-pages.md).

## Component conventions

- **Functional components with hooks only.** No class components anywhere in this codebase.
- **No external UI library.** Build on `src/components/ui/*` (barrel-exported from
  `components/ui/index.js`); don't add `antd`/`@ant-design/icons` — `eslint.config.js` has a
  standing `no-restricted-imports` rule that will fail the build if you do (see
  [styling.md](./styling.md#no-external-ui-library)). If a needed primitive doesn't exist yet, add
  it to `components/ui/` following an existing one's shape (variant/size lookup objects +
  `motion.*` for interaction, not raw CSS transitions).
- **Toasts, not `alert()`.** `import { toast } from "../components/ui/Toast"` (or via the `ui`
  barrel) — `toast.success/error/warning(message)`.
- **Logging**: `import logger from "@/utils/logger"` (or relative path) —
  `logger.info/warn/error/debug`. No-ops in production except `error` is expected to still reach
  a monitoring tool eventually (currently just suppressed like the rest — see
  `configs/EnvironmentConfig.js`).
- **Motion**: reuse variants from `src/motion/index.js` (`fadeIn`, `staggerContainer`, `listItem`,
  `modalPanel`, etc.) instead of inventing new transition timings per component — see
  [styling.md](./styling.md#motion-srcmotionindexjs).

## State management rules

- **Server data → RTK Query, always.** Never fetch inside a `useEffect` + `useState` and never put
  API response data into a hand-written Redux slice. If you're tempted to add a new Redux slice
  for something the API returns, it almost certainly belongs in an RTK Query endpoint's cache
  instead (see [state-and-api.md](./state-and-api.md) — the entire app has exactly one non-`auth`
  reducer, `api`, and that's intentional).
- **Redux (the `auth` slice) is for client-derived auth state only** — not a general-purpose
  global store. There is currently no second hand-written slice in this app; think hard before
  adding one.
- **Purely local/UI state** (a modal's open/closed, an upload progress queue, a view-mode toggle)
  stays in component `useState`, not Redux — see `useFileUpload`'s `queue` state or
  `useDriveViewMode`'s `localStorage`-backed toggle for the pattern
  ([file-management.md](./file-management.md)).

## What NOT to do (specific to this app, not generic advice)

- **Don't read or write an auth token anywhere.** There isn't one to read — both JWTs are httpOnly
  cookies. If you find yourself wanting `localStorage.getItem("token")` or a `Bearer` header,
  something's wrong; re-read [authentication.md](./authentication.md).
- **Don't call a storage SDK directly for uploads/downloads.** Uploads go through
  `fileApi.uploadInitiate` → a raw `XMLHttpRequest` PUT to the presigned URL → `uploadComplete`;
  downloads/previews go through `getFileDownloadHref()`. See
  [file-management.md](./file-management.md) — both exist specifically to match the backend's
  two-phase-commit and signed-URL contracts exactly.
- **Don't add a new hardcoded secret/key.** `pages/app/subscriptions/index.jsx`'s hardcoded
  Razorpay key is a known bug, not a pattern to follow — see
  [environment-variables.md](./environment-variables.md#vars-that-look-wired-but-arent).

## Linting

```bash
npm run lint       # check
npm run lint:fix    # autofix what's fixable
```

Notable non-default rules in `eslint.config.js`: `no-unused-vars` ignores names matching
`^[A-Z_]` (so unused destructured constants used only for documentation/shape don't fail), and
`react/jsx-uses-vars` is explicitly enabled so member-expression JSX tags (`<motion.div>`) are
correctly recognized as using their import — plain `no-unused-vars` misses those.
