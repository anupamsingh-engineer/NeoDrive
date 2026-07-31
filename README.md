# NeoDrive

A Google-Drive-style file storage app — React frontend, Node/Express backend, direct-to-S3
uploads, CloudFront-signed downloads, MongoDB Atlas, Redis, and BullMQ background jobs. This is
a two-package monorepo: [`backend/`](./backend) and [`frontend/`](./frontend) each have their own
README, docs, and deployment path — this file is the map between them.

## How it fits together

```mermaid
flowchart TB
    User["User's browser"]

    subgraph FE["Frontend — React SPA (static build)"]
        direction TB
        FECF["CloudFront\n(frontend hosting)"]
        FES3[("S3\nfrontend static build")]
        FECF --> FES3
    end

    subgraph BE["Backend — Node/Express API + Worker (EC2, Docker)"]
        direction TB
        API["API process\n(server.js)"]
        Worker["Worker process\n(worker.js)"]
    end

    subgraph Data["Data & Infra"]
        direction TB
        Mongo[("MongoDB Atlas")]
        Redis[("Redis")]
        FileS3[("S3\nuser files")]
        FileCF["CloudFront\n(file downloads)"]
        FileCF --> FileS3
    end

    User -->|"1 load the app"| FECF
    User -->|"2 API calls (cookies)"| API
    User -->|"3 direct file upload"| FileS3
    User -->|"4 direct file download"| FileCF

    API --> Mongo
    API --> Redis
    API -->|presigned URLs, HEAD checks| FileS3
    API -->|enqueue jobs| Redis
    Redis -->|jobs consumed| Worker
    Worker --> Mongo
    Worker --> FileS3
    Worker -->|send email| Resend["Resend API"]
```

Two separate S3/CloudFront pairs, on purpose: one hosts the frontend's static build, the other
stores and serves user files. Neither the frontend's static assets nor a user's uploaded files
ever pass through the API server itself — steps 1, 3, and 4 above go straight to S3/CloudFront;
only step 2 (actual API calls — auth, directory/file metadata, presigned-URL requests) hits the
backend.

This is the *runtime* picture. For the full request-by-request detail — auth, directory/file
operations, signed URLs, caching, queues on the backend; bootstrap, the Redux/RTK Query store,
routing, upload on the frontend — see each package's own **Flow Diagrams**, linked below.

---

## Backend

Node/Express API: dual-JWT cookie auth with refresh rotation and reuse detection, RBAC, a
directory/file tree with atomic quota reservation, two-phase S3 uploads, CloudFront-signed
downloads, Redis cache-aside, BullMQ background jobs (email, S3 cleanup, nightly size
reconciliation), and a full observability stack (pino, Prometheus, OpenTelemetry).

- **[backend/README.md](./backend/README.md)** — setup, scripts, architecture summary, and the
  backend's own embedded **[Flow Diagrams](./backend/README.md#flow-diagrams)**
- **[backend/docs/index.md](./backend/docs/index.md)** — one doc per feature: auth, users,
  directories, files, subscriptions/webhooks, background jobs, caching, security, observability,
  error handling, plus a flat [API reference](./backend/docs/api-reference.md)
- **[backend/docs/flow-diagrams.md](./backend/docs/flow-diagrams.md)** ·
  [Artifact ↗](https://claude.ai/code/artifact/d2fad691-e000-4b18-9463-b81fb05db9f9)
- Deployment: [EC2 + Docker + nginx + Let's Encrypt](./backend/docs/ec2-deployment.md)

```bash
cd backend
npm install
cp .env.example .env   # fill in secrets, including a MongoDB Atlas DB_URL
npm run dev:all         # Redis (Docker) + migrations + API + worker, one command, hot reload
```

### Backend flow diagrams (preview)

Five of the nine diagrams from [backend/README.md#flow-diagrams](./backend/README.md#flow-diagrams) —
click to expand. The full set (request lifecycle, login, refresh rotation, directories, caching)
plus a timeouts cheat-sheet is there.

<details>
<summary><strong>Auth — registration (OTP → verification token → account)</strong></summary>

The verification token exists specifically so a page reload between steps 2 and 3 doesn't force
the user through a brand new OTP email.

```mermaid
sequenceDiagram
    participant U as Browser
    participant API as Express API
    participant Mongo
    participant Redis

    U->>API: POST /auth/send-otp {email}
    API->>Redis: SETNX cooldown key (60s)
    API->>Mongo: upsert OTP doc (10m TTL index)
    API-->>U: 201 sent (worker emails it, async)

    U->>API: POST /auth/verify-otp {email, otp}
    API->>Mongo: match otp, delete record (consumed)
    API-->>U: 200 { verificationToken } — 30m JWT, purpose-scoped

    U->>API: POST /auth/register {name, email, password, verificationToken}
    API->>API: verify token: signature + expiry + purpose + email match
    API->>Mongo: transaction — create User + root Directory
    API->>Mongo: create RefreshToken doc
    API-->>U: 201 Set-Cookie accessToken + refreshToken + csrfToken
```

</details>

<details>
<summary><strong>File upload — two-phase commit</strong></summary>

Quota is reserved at *initiate*, not at *complete* — an abandoned upload still counts against
quota until explicitly deleted.

```mermaid
sequenceDiagram
    participant U as Browser
    participant API as Express API
    participant Mongo
    participant S3

    U->>API: POST /file/upload/initiate {parentDirId, name, size, contentType}
    API->>API: reject blocked extensions (.exe, .bat, .sh, ...)
    API->>Mongo: atomic reserveRootSize (compare-and-increment)
    alt quota exceeded
        API-->>U: 507 Not enough storage
    else reserved
        API->>Mongo: reserve size on intermediate ancestors too
        API->>Mongo: insert File doc (isUploading: true)
        API->>S3: presigned PUT URL (5 min expiry)
        alt any failure past reservation
            API->>Mongo: rollback — delete File doc, reverse reservation
            API-->>U: error
        else success
            API-->>U: 201 { uploadSignedUrl, fileId }
        end
    end

    Note over U,S3: client PUTs the raw bytes directly — never through this API
    U->>S3: PUT uploadSignedUrl
    S3-->>U: 200 OK

    U->>API: POST /file/upload/complete {fileId}
    API->>S3: HEAD object
    alt missing, or ContentLength mismatch
        API->>Mongo: release reservation — delete File doc, reverse ancestor sizes
        API-->>U: 400 / 404
    else verified
        API->>Mongo: isUploading = false
        API-->>U: 200 Upload completed
    end
```

</details>

<details>
<summary><strong>File download — signed URL generation</strong></summary>

The API never streams file bytes — it only ever hands out a time-limited pointer. `action`
controls inline vs. forced download; nothing else about the URL changes.

```mermaid
sequenceDiagram
    participant U as Browser
    participant API as Express API
    participant CF as CloudFront

    U->>API: GET /file/:id?action=download
    API->>API: verify ownership (findByIdForUser)
    API->>API: build key = fileId + extension
    API->>API: sign CloudFront URL —\ndateLessThan = now + 1h,\nContent-Disposition: inline|attachment
    API-->>U: 302 Redirect to signed URL
    U->>CF: GET signed URL
    CF->>CF: validate signature + expiry
    CF-->>U: file bytes (served from the edge, S3 origin behind it)
```

</details>

<details>
<summary><strong>Background queues</strong></summary>

If the worker process isn't running, jobs pile up in Redis and nothing happens — OTP/reset emails
never send, deleted files' S3 objects never get cleaned up — even though the API endpoints that
enqueued them already returned success.

```mermaid
flowchart LR
    subgraph API["API process — producer only"]
        A1["otpService.requestOtp"] -->|send-otp| EmailQ[("email queue")]
        A2["authService.forgotPassword"] -->|send-password-reset| EmailQ
        A3["directory/file delete"] -->|delete-single / delete-batch| S3Q[("s3-cleanup queue")]
        A4["app boot"] -->|cron 0 2 * * *| ReconQ[("directory-size-reconcile queue")]
    end

    subgraph Worker["worker.js — consumer only, separate process"]
        EmailQ --> EW["emailWorker\nconcurrency 10, 3 retries, 3s backoff"] --> Resend["Resend API"]
        S3Q --> SW["s3CleanupWorker\nconcurrency 5, 3 retries, 2s backoff"] --> S3del["S3 DeleteObject(s)"]
        ReconQ --> RW["directorySizeReconcileWorker\nconcurrency 1, nightly"] --> Recompute["recompute every dir size\nbottom-up, correct drift, bust cache"]
    end
```

</details>

<details>
<summary><strong>Observability — logs, metrics, traces</strong></summary>

Every log line auto-carries `requestId`/`userId`/`traceId` via `AsyncLocalStorage` — no value is
threaded manually through service calls. Tracing is fully opt-in: nothing starts unless
`OTEL_EXPORTER_OTLP_ENDPOINT` is set.

```mermaid
flowchart LR
    Req(["Incoming request"]) --> RC["requestContext middleware\nopens AsyncLocalStorage,\nseeds requestId"]
    RC --> Auth["requireAuth sets userId\nonce resolved"]

    subgraph Logs["Logging — pino"]
        RC --> HL["httpLogger\n1 line/request, level bumped\nwarn on 4xx, error on 5xx"]
        HL --> LogOut["structured JSON logs\n(pretty-printed outside prod)"]
    end

    subgraph Metrics["Metrics — prom-client"]
        RC --> MM["metrics middleware\ntimes every request"]
        MM --> MReg["/metrics — http_requests_total,\nlatency histogram, auth/upload/\ncache/queue counters, storage_bytes_used"]
        MReg -->|scrape 15s| Prom[("Prometheus")]
        Prom --> Graf["Grafana\nNeoDrive Backend - Overview"]
    end

    subgraph Traces["Tracing — OpenTelemetry (opt-in)"]
        Instr["instrumentation.js\nloaded before server.js/worker.js"] -.auto-instruments.-> ReqSpan["HTTP / Express /\nMongoose / ioredis spans"]
        ReqSpan -->|OTLP/HTTP| Jaeger["Jaeger UI"]
    end
```

</details>

## Frontend

React 19 + Redux Toolkit/RTK Query client: cookie-based auth (no client-readable token
anywhere), a from-scratch UI component library on Tailwind CSS v4, a 3-step signup wizard that
survives a page reload, direct-to-S3 upload with progress, and a multi-provider analytics module.

- **[frontend/README.md](./frontend/README.md)** — setup, scripts, stack summary, and the
  frontend's own embedded **[Flow Diagrams](./frontend/README.md#flow-diagrams)**
- **[frontend/docs/index.md](./frontend/docs/index.md)** — one doc per concern: auth, routing,
  state/API, file management, analytics, styling, environment variables, build & deploy,
  contributing
- **[frontend/docs/flow-diagrams.md](./frontend/docs/flow-diagrams.md)** ·
  [Artifact ↗](https://claude.ai/code/artifact/1482b2f2-a52d-410f-a2eb-e3ff7a039c15)
- Deployment: [S3 + CloudFront + ACM + GitHub Actions](./frontend/docs/s3-cloudfront-deployment.md)

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in VITE_API_BASE_URL etc.
npm run dev                   # http://localhost:5173
```

### Frontend flow diagrams (preview)

Four of the eleven diagrams from [frontend/README.md#flow-diagrams](./frontend/README.md#flow-diagrams) —
click to expand. The full set (bootstrap, registration, session-guard logout, directory browsing,
analytics) plus a config/timeouts cheat-sheet is there.

<details>
<summary><strong>Redux store & RTK Query architecture</strong></summary>

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
<summary><strong>Auth — token refresh & reauth (client-side)</strong></summary>

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
<summary><strong>File upload — two-phase commit (client side)</strong></summary>

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
<summary><strong>Routing — AuthGuard decision tree</strong></summary>

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

Run both at once (two terminals): backend's `npm run dev:all` in `backend/`, frontend's
`npm run dev` in `frontend/` — the frontend expects the backend at `http://localhost:4000` by
default.

---

## Deployment

Each package deploys independently, to different infrastructure, via its own GitHub Actions
workflow — both live at the repo root (`.github/workflows/`, the only place GitHub Actions looks)
and are scoped with an `on.push.paths` filter so a change to one package never triggers the
other's pipeline:

| | Backend | Frontend |
|---|---|---|
| Target | EC2 (Docker Compose) | S3 (private, OAC) + CloudFront |
| Workflow | `.github/workflows/deploy-backend.yml` | `.github/workflows/deploy-frontend.yml` |
| Triggers on | `backend/**` | `frontend/**` |
| Guide | [backend/docs/ec2-deployment.md](./backend/docs/ec2-deployment.md) | [frontend/docs/s3-cloudfront-deployment.md](./frontend/docs/s3-cloudfront-deployment.md) |

See [frontend/docs/build-and-deploy.md#how-two-workflows-share-one-repo](./frontend/docs/build-and-deploy.md#how-two-workflows-share-one-repo)
for exactly how the path-filtering works.

## Full stack locally, via Docker

```bash
npm run docker:up      # first run / after a backend code change - rebuilds the image
npm run docker:start   # subsequent runs
npm run docker:down    # stop everything
```

This is a thin root-level wrapper (`docker-compose.yml` → `include:` → `backend/docker-compose.yml`)
— it brings up the backend's API/worker/Redis/observability stack (MongoDB is Atlas, not
containerized). The frontend isn't part of this — run it separately with `npm run dev` in
`frontend/`, or build+deploy it to S3/CloudFront per the guide above.
