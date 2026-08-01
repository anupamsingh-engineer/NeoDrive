# Flow Diagrams

Visual reference for how this frontend actually works — app bootstrap, the Redux/RTK Query
store, every auth flow, routing, file upload, cache invalidation, and analytics. This doc is
diagram-first; for full detail follow the links out to the relevant deep-dive doc. A rendered
version of this same content is also published as an Artifact, and the same diagrams are embedded
directly in [../README.md](../README.md) as collapsible sections.

Every diagram here was checked directly against the source it describes: `src/main.jsx`,
`src/App.jsx`, `src/store/index.js`, `src/store/rootReducer.js`, `src/store/persist/index.js`,
`src/store/api/baseApi.js`, `src/store/api/baseQuery.js`, `src/store/api/features/*.js`,
`src/store/slices/auth-slice/*`, `src/store/slices/registrationSlice.js`,
`src/components/common/Guard/index.jsx`, `src/hooks/{useSessionGuard,useIdleTimeout}.js`,
`src/pages/app/drive/*`, `src/pages/public/ShareView/*`, `src/analytics/*`.

---

## 1. System overview

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

The frontend never talks to S3/CloudFront through the backend for the actual file bytes — see
[file-management.md](./file-management.md). Auth tokens are httpOnly cookies the browser manages
automatically; only `auth.user` (profile) and `registration` (signup progress) ever reach
`localStorage` — see [authentication.md](./authentication.md).

---

## 2. App bootstrap / render lifecycle

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

The persisted-`user` check in `bootstrapAuth()` is why a brand-new or already-logged-out visitor
makes **zero** auth network calls on load — see
[authentication.md](./authentication.md#boot-sequence).

---

## 3. Redux store & RTK Query architecture

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

One `createApi()` instance, five feature files injecting into it — not five separate APIs. That's
why they all share one cache, one tag list, and the same reauth logic. See
[state-and-api.md](./state-and-api.md).

---

## 4. Auth — login

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

---

## 5. Auth — registration (3-step, survives a reload)

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

Only `step`/`email`/`verificationToken` are persisted — never the password, never the raw OTP.
Full detail: [authentication.md](./authentication.md#register-persisted-across-reloads).

---

## 6. Auth — token refresh & reauth (client-side)

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

The post-acquire "did someone else already refresh" check and the 409-as-success handling are
both fixes for a real race that used to cause a burst of redundant refresh calls — see
[authentication.md](./authentication.md#token-refresh-transparent-mutex-guarded).

---

## 7. Auth — logout & background session guard

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

---

## 8. Routing — `AuthGuard` decision tree

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

See [routing-and-pages.md](./routing-and-pages.md) for the full route table and every page.

---

## 9. File upload — two-phase commit (client side)

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

---

## 10. Directory browsing & cache invalidation

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

The breadcrumb trail is never reconstructed client-side — it comes straight from the API's
`ancestors[]` on every response, so back/forward/refresh/deep-links all just work. See
[file-management.md](./file-management.md).

---

## 10b. Sharing — owner creates a link, an anonymous visitor opens it

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
    Note over API: idempotent - same token/url if\nalready shared, see backend sharing.md
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

`ShareModal` calls `createShare` on every open, not just once — it relies entirely on the
backend's idempotency rather than tracking "is this already shared" client-side. `ShareView`'s
`?dirId=` navigation is query-string based, unlike `DrivePage`'s path-param style — see
[sharing.md](./sharing.md) for why.

---

## 11. Analytics

```mermaid
flowchart LR
    Boot["main.jsx: initAnalytics()"] --> Dev{"import.meta.env.DEV?"}
    Dev -->|yes| NoOp["skip providers,\nconsole.debug only"]
    Dev -->|no| Init["init PostHog/Mixpanel if keys set\n(dynamic import), inject Hotjar if set"]
    Route["route change"] --> PVT["PageViewTracker"]
    PVT --> Track["trackPageView(pathname)"]
    Track --> Providers["gtag / dataLayer / posthog / mixpanel\neach wrapped in try/catch, silent no-op if absent"]
```

`track()`/`identify()` exist via `useAnalytics()` but have **no call sites** anywhere yet — only
automatic page views actually fire. See [analytics.md](./analytics.md#the-event-catalog-analyticseventsjs--a-real-gap).

---

## 12. Config & timeouts cheat-sheet

| What | Value | Source |
|---|---|---|
| Idle logout timeout | 30m | `AUTH_CONFIG.sessionTimeout` (hardcoded — `VITE_SESSION_TIMEOUT` isn't actually read) |
| Background session-guard poll | 60s | `useSessionGuard.js` `POLL_INTERVAL` |
| Refresh mutex acquire timeout | 10s | `baseQuery.js` `MUTEX_TIMEOUT_MS` |
| Refresh-failure circuit breaker | 3s | `baseQuery.js` `REFRESH_FAILURE_COOLDOWN_MS` |
| RTK Query unused-cache retention | 60s | `baseApi.js` `keepUnusedDataFor` |
| API request timeout | 30s | `apiConfig.js` `API_CONFIG.timeout` |
| Email-verification token (persisted) | 30m | mirrors the backend's `EMAIL_VERIFICATION_TOKEN_EXPIRY` |
| Drive view-mode preference | indefinite | plain `localStorage`, key `drive-view-mode` (not Redux) |
| Share link lifetime | none — revoke-only, no expiry (v1) | see [sharing.md](./sharing.md) |
| Vite dev server | `:5173` | `vite.config.js` |
| Razorpay key used at checkout | **hardcoded test key**, not `VITE_RAZORPAY_KEY_ID` | known gap, see [environment-variables.md](./environment-variables.md#vars-that-look-wired-but-arent) |

See [environment-variables.md](./environment-variables.md) for every `VITE_*` var and which of
them are actually wired up.
