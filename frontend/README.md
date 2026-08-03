# NeoDrive Frontend

React 19 + Redux Toolkit/RTK Query client for the NeoDrive API (`../backend`) — file/folder
storage with cookie-based auth, direct-to-S3 uploads, CloudFront-signed downloads, folder-as-zip
downloads, read-only link sharing (a Share action + a "Shared Links" management page, plus a
chromeless public `/s/:token` page for anyone with a link), and Razorpay subscriptions.

**Looking for how a specific part of this app actually works?** See
**[docs/](./docs/index.md)** — auth/session handling, routing, state management, the file upload
flow, sharing, analytics, styling, environment variables, and build/deploy, all verified against
the real code (not the generic template this project started from).

**New to this codebase?** Jump to **[Flow Diagrams](#flow-diagrams)** below — rendered inline,
click any section to expand — or read the prose version with a full config/timeouts cheat-sheet
at [docs/flow-diagrams.md](./docs/flow-diagrams.md).

## Stack

- **React 19** with Redux Toolkit + RTK Query (server state lives entirely in the RTK Query
  cache — see [docs/state-and-api.md](./docs/state-and-api.md))
- **React Router v7**, every page lazy-loaded (see [docs/routing-and-pages.md](./docs/routing-and-pages.md))
- **Cookie-based auth** — both JWTs are httpOnly cookies the frontend never reads; only a
  JS-visible CSRF cookie is used, mirrored into a request header on mutations (see
  [docs/authentication.md](./docs/authentication.md))
- **Tailwind CSS v4** (CSS-first `@theme` config, no `tailwind.config.js`) + a from-scratch UI
  component library (no external UI kit) + framer-motion (see [docs/styling.md](./docs/styling.md))
- **Vite** for dev/build; production deploys as a static site on **S3 + CloudFront** with a
  custom domain and ACM-issued TLS (see
  [docs/s3-cloudfront-deployment.md](./docs/s3-cloudfront-deployment.md)); Docker + nginx also
  available for local/alternative container-based serving (see
  [docs/build-and-deploy.md](./docs/build-and-deploy.md))

## Setup

```bash
npm install
cp .env.example .env.local   # fill in VITE_API_BASE_URL etc. — see docs/environment-variables.md
npm run dev                   # http://localhost:5173
```

The backend must be running first (`../backend`, default `http://localhost:4000`) — see
[../backend/docs/installation.md](../backend/docs/installation.md) or
[../backend/README.md](../backend/README.md) to get it up via Docker.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server with HMR, `:5173` |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` / `npm run lint:fix` | ESLint |

## Full documentation

| Doc | What's in it |
|---|---|
| [docs/architecture.md](./docs/architecture.md) | Folder map, render/bootstrap lifecycle, the patterns used throughout |
| [docs/flow-diagrams.md](./docs/flow-diagrams.md) | Visual reference: bootstrap, Redux/RTK Query store, every auth flow, routing, upload, caching, analytics, config cheat-sheet |
| [docs/authentication.md](./docs/authentication.md) | Cookie session bootstrap, login/register/Google, CSRF, token refresh, idle timeout, background session revalidation |
| [docs/routing-and-pages.md](./docs/routing-and-pages.md) | Full route tree, `AuthGuard` rules, role-gating, every page |
| [docs/state-and-api.md](./docs/state-and-api.md) | Redux/RTK Query setup, the 6 API slices, error handling, two real bugs worth knowing about |
| [docs/file-management.md](./docs/file-management.md) | The Drive page: two-phase upload with progress, preview, rename/delete |
| [docs/sharing.md](./docs/sharing.md) | The owner's Share action on the Drive page, and the public, unauthenticated `/s/:token` page anyone with a link lands on |
| [docs/analytics.md](./docs/analytics.md) | The multi-provider analytics module, event catalog, and a real gap (tracking isn't called anywhere yet) |
| [docs/styling.md](./docs/styling.md) | Tailwind design tokens, the UI component library, motion primitives |
| [docs/environment-variables.md](./docs/environment-variables.md) | Every `VITE_*` var — including two that are wired but not actually read |
| [docs/build-and-deploy.md](./docs/build-and-deploy.md) | Vite build/chunking, Docker multi-stage build, `nginx.conf`, CSP, how the two repo-root GitHub Actions workflows avoid triggering each other |
| [docs/s3-cloudfront-deployment.md](./docs/s3-cloudfront-deployment.md) | Production deployment: S3 (private, OAC) + CloudFront + ACM SSL + GitHub Actions CI/CD |
| [docs/contributing.md](./docs/contributing.md) | Real conventions used in this codebase — how to add an endpoint/page, state rules, what not to do |

This app is the client half of a two-part system — see
**[../backend/docs/index.md](../backend/docs/index.md)** for the API it talks to (every request
payload, the auth/CSRF model from the server side, and the EC2/Docker/nginx production deployment
guide for the backend).

## Flow Diagrams

Click a section to expand. Full prose + a one-page config/timeouts cheat-sheet:
[docs/flow-diagrams.md](./docs/flow-diagrams.md). Polished standalone version (same diagrams,
sidebar navigation): [Artifact ↗](https://claude.ai/code/artifact/1482b2f2-a52d-410f-a2eb-e3ff7a039c15).

<details>
<summary><strong>1. System overview</strong></summary>

The frontend never proxies file bytes through the backend — uploads go straight to S3, downloads
redirect straight to CloudFront. Auth tokens are httpOnly cookies; only `auth.user` and
`registration` (signup progress) ever reach `localStorage`.

```mermaid
flowchart LR
    Browser["Browser"]

    subgraph Frontend["Frontend — static build (Vite)"]
        RR["React app"]
        Redux["Redux store\n(auth + registration + RTK Query cache)"]
    end

    Browser --> RR
    RR <--> Redux
    RR -->|fetch, credentials: include| API["Backend API"]
    RR -->|direct PUT, presigned URL| S3[("S3 bucket")]
    RR -->|302 redirect, then GET| CF["CloudFront"]
    API --> S3
    CF --> S3
    Redux -->|redux-persist| LS[("localStorage")]
```

</details>

<details>
<summary><strong>2. App bootstrap / render lifecycle</strong></summary>

The persisted-`user` check in `bootstrapAuth()` is why a brand-new or already-logged-out visitor
makes zero auth network calls on load.

```mermaid
flowchart TD
    Start(["main.jsx executes"]) --> HostCheck{"hostname === 127.0.0.1?"}
    HostCheck -->|yes| Redirect["redirect to localhost\n(cookie SameSite correctness)"]
    HostCheck -->|no| InitAn["initAnalytics()"]
    InitAn --> Render["createRoot().render()"]
    Render --> BR["BrowserRouter"] --> Provider["Redux Provider"] --> PG["PersistGate"]
    PG -->|rehydrating| Loader["FullScreenLoader"]
    PG -->|rehydrated| App["App.jsx mounts"]
    App --> Idle["useIdleTimeout() starts watching\n(no-op while unauthenticated)"]
    App --> Boot["dispatch(bootstrapAuth())"]
    Boot --> HasUser{"persisted auth.user\nexists?"}
    HasUser -->|no| Skip["skip network entirely —\nhandleLogout(), isAuthLoading=false"]
    HasUser -->|yes| Me["GET /users/me"]
    Me -->|200| SetAuth["setAuthenticated(user)"]
    Me -->|fails, incl. reauth| HL["handleLogout()"]
    Skip --> Guard["AuthGuard evaluates the route"]
    SetAuth --> Guard
    HL --> Guard
    Guard --> Pages["PagesRouter renders the matched page"]
```

</details>

<details>
<summary><strong>3. Redux store & RTK Query architecture</strong></summary>

One `createApi()` instance, five feature files injecting into it — not five separate APIs. That's
why they all share one cache, one tag list, and the same reauth logic.

```mermaid
flowchart TD
    Store["configureStore"] --> Reducer["rootReducer"]
    Reducer --> ApiSlice["api — baseApi.reducerPath\n(RTK Query cache: all server data)"]
    Reducer --> AuthSlice["auth — isAuthenticated, user,\nisAuthLoading, loginError, networkError"]
    Reducer --> RegSlice["registration — step, email,\nverificationToken, expiresAt"]

    ApiSlice --> Base["baseApi = createApi({\n  baseQuery: baseQueryWithReauth,\n  tagTypes: [User, Directory],\n  keepUnusedDataFor: 60\n})"]
    Base --> AuthApi["authApi — send/verify-otp, register,\nlogin, google, refresh, logout(-all),\nforgot/reset-password"]
    Base --> UserApi["userApi — getCurrentUser, getAllUsers,\nlogoutUserById, deleteUser"]
    Base --> DirApi["directoryApi — getDirectory, createDirectory,\nrenameDirectory, deleteDirectory"]
    Base --> FileApi["fileApi — uploadInitiate, uploadComplete,\nrenameFile, deleteFile"]
    Base --> SubApi["subscriptionApi — getPlans, createSubscription"]

    Store --> Persist["redux-persist"]
    Persist --> WL["whitelist: auth, registration\nblacklist: api — never persisted"]
    WL --> AT["authTransform — persists only `user`,\nforces isAuthenticated:false on rehydrate"]
    WL --> RT["registrationTransform — drops back to\notp/email step if verificationToken expired"]
```

</details>

<details>
<summary><strong>4. Auth — login</strong></summary>

```mermaid
sequenceDiagram
    participant U as User
    participant Login as LoginPage
    participant RTK as authApi
    participant API as Backend
    participant Store as auth slice

    U->>Login: submit email + password
    Login->>RTK: login({email, password}).unwrap()
    RTK->>API: POST /auth/login (credentials: include)
    API-->>RTK: 200 Set-Cookie x3 + { user }
    RTK->>Store: matchFulfilled -> onAuthenticated(user)
    Store->>Store: isAuthenticated = true
    Login->>Login: navigate("/app/drive")
    Note over Login,Store: AuthGuard independently redirects once<br/>isAuthenticated flips too - navigate() here is just faster UX
```

</details>

<details>
<summary><strong>5. Auth — registration (3-step, survives a reload)</strong></summary>

Only `step`/`email`/`verificationToken` are persisted — never the password, never the raw OTP.

```mermaid
sequenceDiagram
    participant U as User
    participant Reg as RegisterPage
    participant Store as registration slice (persisted)
    participant API as Backend

    U->>Reg: enter email, submit
    Reg->>API: POST /auth/send-otp
    Reg->>Store: otpSent({email}) -> step="otp"
    Note over Store: localStorage from here on -<br/>a reload resumes at this exact step

    U->>Reg: enter code, submit
    Reg->>API: POST /auth/verify-otp
    API-->>Reg: { verificationToken }
    Reg->>Store: otpVerified({token, expiresAt}) -> step="details"

    U->>Reg: name + password, submit
    Reg->>API: POST /auth/register {..., verificationToken}
    API-->>Reg: 201 Set-Cookie x3 + { user }
    Reg->>Store: registrationReset() + auth onAuthenticated
    Reg->>Reg: navigate("/app/drive")
```

</details>

<details>
<summary><strong>6. Auth — token refresh & reauth (client-side)</strong></summary>

The post-acquire "did someone else already refresh" check and the 409-as-success handling are
both fixes for a real race that used to cause a burst of redundant refresh calls.

```mermaid
sequenceDiagram
    participant Comp as Any component
    participant BQ as baseQueryWithReauth
    participant Mutex
    participant API as Backend

    Comp->>BQ: any query/mutation
    BQ->>API: request (Cookie: accessToken)
    API-->>BQ: 401
    BQ->>BQ: circuit breaker —<br/>refresh failed <3s ago?
    alt yes
        BQ-->>Comp: forceLogout(), return original error
    else no
        BQ->>Mutex: acquire (10s timeout)
        BQ->>BQ: did someone else already<br/>refresh since my 401?
        alt yes
            BQ->>API: retry original request
        else no
            BQ->>API: POST /auth/refresh
            alt success, or benign 409
                BQ->>API: retry original request
            else hard failure
                BQ->>BQ: forceLogout()
            end
        end
        Mutex->>Mutex: release
    end
    BQ-->>Comp: final result
```

</details>

<details>
<summary><strong>7. Auth — logout & background session guard</strong></summary>

```mermaid
sequenceDiagram
    participant Guard as useSessionGuard (in AppLayout)
    participant RTK as userApi
    participant API as Backend
    participant Store as auth slice

    loop every 60s while authenticated, plus on focus/reconnect
        Guard->>RTK: getCurrentUser
        RTK->>API: GET /users/me
        alt success
            API-->>RTK: 200 { user }
            RTK-->>Guard: dispatch(setUser(data))
        else error — session genuinely gone
            Note over RTK,API: baseQuery already tried its own<br/>reauth first; this only fires after that failed too
            Guard->>Store: dispatch(logoutUser()) — no navigate()
            Note over Guard: AuthGuard alone reacts to isAuthenticated=false.<br/>An earlier version called navigate() here directly,<br/>which raced ahead of the state flip and caused<br/>a login<->drive bounce loop - fixed by removing it
        end
    end
```

</details>

<details>
<summary><strong>8. Routing — AuthGuard decision tree</strong></summary>

```mermaid
flowchart TD
    Req["Route render"] --> Loading{"isAuthLoading?"}
    Loading -->|yes| Spinner["FullScreenLoader"]
    Loading -->|no| C1{"not authenticated AND\npath starts with /app?"}
    C1 -->|yes| ToLogin["redirect /auth/login\n(state: {from: location})"]
    C1 -->|no| C2{"authenticated AND\npath starts with /auth?"}
    C2 -->|yes| ToDrive["redirect /app/drive"]
    C2 -->|no| C3{"path === '/' AND\nauthenticated?"}
    C3 -->|yes| ToDrive2["redirect /app/drive"]
    C3 -->|no| Render["render matched route"]
    Render --> Split{"path starts\nwith /app?"}
    Split -->|yes| Private["PrivateRoutes —\nAppLayout + RequireRole for /users"]
    Split -->|no| Public["PublicRoutes — PublicLayout"]
```

</details>

<details>
<summary><strong>9. File upload — two-phase commit (client side)</strong></summary>

```mermaid
sequenceDiagram
    participant U as User
    participant Drive as useFileUpload
    participant RTK as fileApi
    participant API as Backend
    participant S3

    U->>Drive: drop / select a file
    Drive->>RTK: uploadInitiate({parentDirId, name, size, contentType})
    RTK->>API: POST /file/upload/initiate
    API-->>RTK: { uploadSignedUrl, fileId }
    Note over Drive,S3: raw XMLHttpRequest, not RTK Query -<br/>onprogress drives the progress tray
    Drive->>S3: PUT uploadSignedUrl (raw bytes)
    S3-->>Drive: 200 OK
    Drive->>RTK: uploadComplete({fileId})
    RTK->>API: POST /file/upload/complete
    API-->>RTK: 200 { message }
    RTK->>RTK: invalidatesTags [Directory:LIST]
    Note over Drive: getDirectory auto-refetches -<br/>new file appears, no manual reload
```

</details>

<details>
<summary><strong>10. Directory browsing & cache invalidation</strong></summary>

The breadcrumb trail is never reconstructed client-side — it comes straight from the API's
`ancestors[]` on every response, so back/forward/refresh/deep-links all just work.

```mermaid
flowchart TD
    Nav["navigate to /app/drive/:dirId"] --> Query["useGetDirectoryQuery(dirId)"]
    Query --> Tag["providesTags:\n[Directory:dirId, Directory:LIST]"]
    Tag --> Render["render files[] + directories[]\n+ breadcrumb from ancestors[]"]
    Render --> Action{"create / rename / delete\na file or folder?"}
    Action -->|yes| Mutation["mutation fires,\ninvalidatesTags: [Directory:LIST]"]
    Mutation --> Refetch["every active Directory:LIST\nsubscriber auto-refetches"]
    Refetch --> Render
    Action -->|just navigating| Query
```

</details>

<details>
<summary><strong>10b. Sharing — owner creates a link, an anonymous visitor opens it</strong></summary>

`ShareModal` calls `createShare` on every open (idempotent server-side, so no client-side "is
this already shared" tracking needed). `ShareView` is a chromeless public page at `/s/:token`,
reachable with no session at all.

```mermaid
sequenceDiagram
    participant O as Owner (DrivePage)
    participant SM as ShareModal
    participant RTK as shareApi
    participant API as Backend
    participant V as Visitor (ShareView, no session)

    O->>SM: click "Share" on a file/folder
    SM->>RTK: createShare({resourceType, resourceId})
    RTK->>API: POST /share (Cookie: accessToken)
    Note over API: idempotent - same token/url if already shared
    API-->>SM: { token, url }
    SM->>SM: render link + Copy + "Turn off link"

    Note over O,V: owner sends the url to anyone

    V->>V: navigate to /s/:token  (chromeless, no AuthGuard gate)
    V->>RTK: getShareView({token, dirId})
    RTK->>API: GET /s/:token?dirId=  (no cookies)
    alt invalid/revoked/out-of-bounds
        API-->>V: 404
        V->>V: render "link invalid" empty state
    else live
        API-->>V: { file } or { directory, files, directories, ancestors }
        V->>V: render file card, or a read-only table + breadcrumbs
    end

    V->>V: click Download / Preview
    V->>API: GET /s/:token/file/:fileId?action=  (plain <a href>, not RTK Query)
    API-->>V: 302 -> CloudFront signed URL
```

</details>

<details>
<summary><strong>11. Analytics</strong></summary>

`track()`/`identify()` exist via `useAnalytics()` but have no call sites anywhere yet — only
automatic page views actually fire.

```mermaid
flowchart LR
    Boot["main.jsx: initAnalytics()"] --> Dev{"import.meta.env.DEV?"}
    Dev -->|yes| NoOp["skip providers,\nconsole.debug only"]
    Dev -->|no| Init["init PostHog/Mixpanel if keys set\n(dynamic import), inject Hotjar if set"]
    Route["route change"] --> PVT["PageViewTracker"]
    PVT --> Track["trackPageView(pathname)"]
    Track --> Providers["gtag / dataLayer / posthog / mixpanel\neach wrapped in try/catch, silent no-op if absent"]
```

</details>

Full config/timeouts cheat-sheet (idle timeout, session-guard poll, mutex/circuit-breaker
windows, RTK Query cache retention, and the two `VITE_*` vars that look wired but aren't):
[docs/flow-diagrams.md#12-config--timeouts-cheat-sheet](./docs/flow-diagrams.md#12-config--timeouts-cheat-sheet).
