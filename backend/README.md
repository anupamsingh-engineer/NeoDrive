# NeoDrive Backend (v2)

Production-grade rebuild of the storage app API: file/folder storage backed by S3 +
CloudFront, MongoDB, Redis, BullMQ background jobs, and a full observability stack
(structured logs, Prometheus metrics, OpenTelemetry tracing).

**Looking for API request/response payloads, or a deep dive into how a specific feature works?**
See **[docs/](./docs/index.md)** — one doc per feature (auth, users, directories, files, sharing,
subscriptions/webhooks, background jobs, caching, security, observability, error handling) plus a
flat [API reference](./docs/api-reference.md) of every route.

**New to this codebase?** Jump to **[Flow Diagrams](#flow-diagrams)** below — rendered inline,
click any section to expand — or read the prose version with a full timeouts/expiry cheat-sheet
at [docs/flow-diagrams.md](./docs/flow-diagrams.md).

## Architecture

Layered, capstone-style: `routes -> controllers -> services -> repositories -> models`.
Repositories are the only layer that touches Mongoose; services are plain exported
functions (no classes, no DI container - imports are the wiring).

- **Auth**: dual JWT (access + refresh) with rotation-and-reuse-detection, Redis-backed
  access-token blacklist, RBAC, account lockout, purpose-scoped tokens for password
  reset. See `src/services/auth.service.js` and `src/services/token.service.js`.
- **Storage**: S3 presigned uploads + CloudFront signed downloads (`src/services/storage/`).
- **Folder download**: a whole folder (owner's own, or a shared one) as a `.zip` — the one read
  path where the API server actually streams file bytes itself, rather than redirecting to
  CloudFront (`directoryService.buildDirectoryZip`, reused by both `/directory/:id/download` and
  the public `/s/:token/download`).
- **Sharing**: read-only link sharing for a file or folder (with drill-down); `/share` manages
  links (auth required), `/s` resolves them — the one fully public, unauthenticated data
  endpoint in the API (`src/services/share.service.js`).
- **Caching**: cache-aside for user profile and directory listings, fail-open on Redis
  errors (`src/services/cache.service.js`).
- **Background jobs**: BullMQ queues for S3 cleanup, email sending, and nightly
  directory-size reconciliation (`src/queues/`). Run via `npm run worker`.
- **Observability**: pino structured logs with request/trace correlation, Prometheus
  metrics at `/metrics`, OpenTelemetry tracing (opt-in via `OTEL_EXPORTER_OTLP_ENDPOINT`),
  `/healthz` + `/readyz`.

## Setup

```bash
npm install
cp .env.example .env   # fill in secrets, including a MongoDB Atlas DB_URL
npm run dev:all         # starts Redis (Docker), runs migrations, then API + worker together
```

`dev:all` is the fast day-to-day loop — one command, hot reload on both the API and the worker,
no Docker rebuild. See **[docs/local-dev-troubleshooting.md](./docs/local-dev-troubleshooting.md)**
for what it does under the hood, how to run the pieces separately instead, and a full
error-message-to-fix table.

MongoDB must run as a replica set - `register`/Google-login use a transaction. A MongoDB Atlas
cluster (the default `DB_URL` in `.env.example`) already satisfies this out of the box.

## Full stack (API + worker + Redis + Prometheus + Grafana + Jaeger)

MongoDB is not containerized - `DB_URL` in `.env` points at your MongoDB Atlas cluster.

```bash
npm run docker:up      # first run / after code changes - rebuilds the images
npm run docker:start   # subsequent runs - skips the rebuild, starts in ~2s
npm run docker:logs    # tail app + worker
npm run docker:down    # stop everything
```

- API: http://localhost:4000
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (anonymous viewer access)
- Jaeger UI: http://localhost:16686

See **[docs/installation.md](./docs/installation.md)** for the full walkthrough (env setup, startup order, verification checklist), **[docs/frontend-integration-guide.md](./docs/frontend-integration-guide.md)** if you're building a frontend against this API from scratch, or **[docs/ec2-deployment.md](./docs/ec2-deployment.md)** to deploy this to a real EC2 instance with nginx, TLS, and CI/CD.

## Scripts

| Script                                                         | Purpose                                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run dev:all`                                            | Redis (Docker) + migrations + API + worker, all in one command, hot reload on both processes |
| `npm run dev`                                                | API with hot reload (on its own)                                                             |
| `npm run worker:dev`                                         | Background worker with hot reload (on its own)                                               |
| `npm run migrate:up` / `migrate:down` / `migrate:status` | MongoDB index migrations (migrate-mongo)                                                     |
| `npm run format`                                             | Prettier                                                                                     |

## Security notes

- Every secret/identifier is env-driven (`src/config/env.js`) - nothing hardcoded.
- CSRF: signed double-submit cookie, enforced on cookie-authenticated mutating routes
  only (Bearer-token requests are exempt, since they carry no ambient cookie).
- Rate limiting, Helmet, Mongo sanitization, and HPP are applied globally in `app.js`.

## Flow Diagrams

Click a section to expand. Full prose + a one-page timeouts/expiry cheat-sheet:
[docs/flow-diagrams.md](./docs/flow-diagrams.md). Polished standalone version (same diagrams,
sidebar navigation): [Artifact ↗](https://claude.ai/code/artifact/d2fad691-e000-4b18-9463-b81fb05db9f9).
Client-side counterpart — bootstrap, Redux/RTK Query, auth, routing, upload — in
[../frontend/README.md#flow-diagrams](../frontend/README.md#flow-diagrams).

<details>
<summary><strong>1. System overview</strong></summary>

The API process only ever *enqueues* background work — it never sends an email, deletes an S3
object, or recomputes directory sizes itself. That happens in `worker.js`, a second process
reading the same Redis queues.

```mermaid
flowchart LR
    Browser["Browser"]

    subgraph API_Process["API process (server.js)"]
        API["Express app"]
    end

    subgraph Worker_Process["Worker process (worker.js) — separate"]
        Worker["BullMQ consumers"]
    end

    Browser -->|HTTPS, cookies| API
    API --> Mongo[("MongoDB Atlas")]
    API --> Redis[("Redis")]
    API -->|presigned PUT URL, HEAD checks| S3[("S3 bucket")]
    Browser -->|direct upload| S3
    Browser -->|signed GET, 302 redirect| CF["CloudFront"]
    CF --> S3
    API -->|enqueue jobs| Redis
    Redis -->|jobs consumed| Worker
    Worker --> Mongo
    Worker --> S3
    Worker -->|send email| Resend["Resend API"]
```

</details>

<details>
<summary><strong>2. Request lifecycle</strong></summary>

Every request, in order, per `app.js`. Webhooks split off *before* JSON parsing specifically so
Razorpay's signature check gets the exact raw bytes.

```mermaid
flowchart TD
    Req(["Incoming request"]) --> RC["requestContext — assigns req.id"]
    RC --> Log["httpLogger — access log"]
    Log --> Met["metrics timer starts"]
    Met --> Helmet["helmet security headers"]
    Helmet --> CORS["CORS origin check"]
    CORS --> Cookie["cookie-parser"]
    Cookie --> WH{"path starts with\n/webhooks ?"}
    WH -->|yes| Raw["capture raw body\n(for signature verify)"] --> WHC["webhook controller"]
    WH -->|no| JSON["express.json / urlencoded\n(1mb cap)"]
    JSON --> San["mongo-sanitize"]
    San --> HPP["hpp guard"]
    HPP --> RL["global rate limiter (300/15m)"]
    RL --> Route["route-specific middleware\nrequireAuth / verifyCsrf / validate"]
    Route --> Ctrl["controller"]
    Ctrl --> Res(["JSON response"])
    Ctrl -.throws.-> Err["central error handler"]
    Err --> Res
```

</details>

<details>
<summary><strong>3. Auth — registration (OTP → verification token → account)</strong></summary>

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
<summary><strong>3b. Auth — login</strong></summary>

```mermaid
sequenceDiagram
    participant U as Browser
    participant API as Express API
    participant Mongo

    U->>API: POST /auth/login {email, password}
    API->>Mongo: findByEmailWithPassword
    alt account locked
        API-->>U: 403 Account locked (30m)
    else wrong password
        API->>Mongo: incrementLoginAttempts
        API->>Mongo: lockAccount if attempts >= 5
        API-->>U: 401 Invalid credentials
    else correct password
        API->>Mongo: resetLoginAttempts
        API->>Mongo: create RefreshToken doc
        API-->>U: 200 Set-Cookie accessToken + refreshToken + csrfToken
    end
```

</details>

<details>
<summary><strong>4. Auth — every subsequent request (requireAuth)</strong></summary>

```mermaid
sequenceDiagram
    participant U as Browser
    participant API as requireAuth middleware
    participant Redis
    participant Mongo

    U->>API: any /directory, /file, /users... request (Cookie: accessToken)
    API->>API: verify JWT signature + expiry
    par independent lookups
        API->>Redis: GET auth:blacklist:sha256(token)
    and
        API->>Mongo: findById(decoded.sub)
    end
    alt token blacklisted (logged out)
        API-->>U: 401 Session has been logged out
    else user deleted, or tokensValidAfter greater than token.iat
        API-->>U: 401 Session has been revoked
    else all clear
        API->>API: attach req.user, continue
    end
```

</details>

<details>
<summary><strong>4b. Auth — refresh rotation (with reuse/theft detection)</strong></summary>

A 3-second window is what separates a benign concurrent-request race from genuine token theft —
`REFRESH_RACE_GRACE_MS`.

```mermaid
sequenceDiagram
    participant U as Browser
    participant API as Express API
    participant Mongo

    U->>API: POST /auth/refresh (Cookie: refreshToken, path-scoped)
    API->>API: verify refresh JWT
    API->>Mongo: findById(tokenId)
    API->>API: sha256(incoming) vs. stored hash

    alt hash matches
        API->>Mongo: compare-and-swap: rotate hash
        alt won the CAS
            API-->>U: 200 new Set-Cookie (all three, rotated)
        else lost the CAS (concurrent refresh)
            API-->>U: 409 please retry
        end
    else hash mismatch, rotated less than 3s ago
        API-->>U: 409 please retry (benign race)
    else hash mismatch, older than 3s
        API->>Mongo: delete ALL refresh tokens for user
        API->>Mongo: bump tokensValidAfter (kills live access tokens too)
        API-->>U: 401 reuse detected — full logout
    end
```

</details>

<details>
<summary><strong>5. Directory flow</strong></summary>

S3 objects are deleted *asynchronously* via the `s3-cleanup` queue — the directory disappears
from the API instantly, the underlying objects shortly after.

```mermaid
flowchart TD
    subgraph GET["GET /directory/:id?"]
        G1{"Redis dir_listing\ncache hit? (45s TTL)"}
        G1 -->|yes| G2["return cached listing"]
        G1 -->|no| G3["query Mongo: dir + files\n+ children + ancestors"]
        G3 --> G4["write to Redis, 45s TTL"]
        G4 --> G5["return fresh listing"]
    end

    subgraph CREATE["POST /directory/:parentId?"]
        C1{"caller owns\nparent dir?"}
        C1 -->|no| C2["404"]
        C1 -->|yes| C3["insert Directory doc\n(name via dirname header)"]
        C3 --> C4["invalidate cache: parent listing"]
    end

    subgraph DELETE["DELETE /directory/:id"]
        D1{"is caller's\nroot dir?"}
        D1 -->|yes| D2["400 cannot delete root"]
        D1 -->|no| D3["recursively collect every\ndescendant file + dir"]
        D3 --> D4["parallel: enqueue S3 cleanup +\ndelete File docs + delete Directory docs"]
        D4 --> D5["decrement size up ancestor chain"]
        D5 --> D6["invalidate cache: every touched ancestor"]
    end
```

</details>

<details>
<summary><strong>5b. Directory download — streaming a zip of the whole subtree</strong></summary>

The one download path where the API server actually reads file bytes — every other download is
a CloudFront redirect. Files are fetched from S3 one at a time, not all at once.

```mermaid
flowchart TD
    Req(["GET /directory/download or /directory/:id/download"]) --> Own{"caller owns\nthis directory?"}
    Own -->|no| E1["404"]
    Own -->|yes| Walk["recursively collect every file\n(name + path) in the subtree"]
    Walk --> Empty{"zero files\nanywhere?"}
    Empty -->|yes| E2["400 folder is empty"]
    Empty -->|no| Limits{"over 2000 files\nor 2 GB total?"}
    Limits -->|yes| E3["400 too many files / too large"]
    Limits -->|no| Stream["start zip stream (archiver),\nrespond immediately"]
    Stream --> Loop["fetch each file from S3 and\nappend to the archive, one at a time"]
    Loop --> Done["finalize archive\n(browser receives it as it streams)"]
```

</details>

<details>
<summary><strong>6. File upload — two-phase commit</strong></summary>

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
<summary><strong>7. File download — signed URL generation</strong></summary>

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
<summary><strong>7b. Sharing — create a link, then an anonymous visitor resolves and downloads it</strong></summary>

Read-only link sharing for a file or a folder (with drill-down). `/share` (create/list/revoke)
requires the normal session; `/s` (resolve/download) requires nothing at all — the one public
data-fetching surface in the API.

```mermaid
sequenceDiagram
    participant O as Owner (Browser)
    participant API as Express API
    participant Mongo
    participant V as Visitor (anonymous, no cookies)
    participant CF as CloudFront

    O->>API: POST /share {resourceType, resourceId} (Cookie: accessToken)
    API->>API: verify ownership + root-directory guard
    API->>Mongo: findActiveForResource (idempotent lookup)
    alt already shared
        API-->>O: 201 existing {token, url}
    else new share
        API->>Mongo: insert Share {token: random 256-bit, resourceType, resourceId, ownerId}
        API-->>O: 201 {token, url}
    end

    Note over O,V: owner sends the url to anyone, no account required to open it

    V->>API: GET /s/:token   (no cookies, no CSRF)
    API->>Mongo: findByToken
    alt missing or revoked
        API-->>V: 404 generic "link invalid" message
    else live
        API->>Mongo: file metadata, or directory listing +\nboundary-checked ancestors (see 7c)
        API-->>V: 200 { file } or { directory, files, directories, ancestors }
    end

    V->>API: GET /s/:token/file/:fileId?action=download
    API->>API: boundary check — fileId is the shared file itself,\nor inside the shared folder's subtree (see 7c)
    API->>API: sign CloudFront URL — same signer as an owner's own download
    API-->>V: 302 redirect
    V->>CF: GET signed URL
    CF-->>V: file bytes
```

Revoking takes effect on the very next `GET /s/:token` — no cache in front of this lookup.

</details>

<details>
<summary><strong>7c. Sharing — the folder-boundary security check</strong></summary>

A visitor can browse anywhere inside a shared folder, and nowhere else. Applied identically to
`?dirId=` on resolution and to `:fileId` on download.

```mermaid
flowchart TD
    Req(["visitor supplies a dirId (or a file's parentDirId)\nwithin a directory share"]) --> Eq{"target === share root?"}
    Eq -->|yes| Allow["allowed — it's the share root itself"]
    Eq -->|no| Chain["walk real parentDirId links in Mongo:\nfindAncestorChain(target)"]
    Chain --> In{"share root appears\nin that chain?"}
    In -->|yes| Allow2["allowed — target is a genuine descendant"]
    In -->|no| Deny["404 — same generic message as a\nmissing or revoked token"]
```

</details>

<details>
<summary><strong>8. Caching — where it comes in</strong></summary>

Two caches: `user_profile` (`user:profile:<userId>`, 300s TTL, populated by `GET /users/me`) and
`dir_listing` (`dir:listing:<userId>:<dirId>`, 45s TTL, populated by `GET /directory/:id?`). Any
Redis error, on either side, is logged and swallowed — an outage degrades to "always hit Mongo,"
never a 500.

```mermaid
flowchart TD
    Call["cacheService.getOrSet(name, key, ttl, fetcher)"] --> Get["Redis GET key"]
    Get -->|error| Miss["treat as miss\n(fail-open, log warning)"]
    Get -->|hit| Hit["JSON.parse, cache_hit++, return"]
    Get -->|miss| Miss
    Miss --> Fetch["await fetcher() — hits Mongo"]
    Fetch --> Set["Redis SET key EX ttl"]
    Set -->|error| Warn["log warning, continue anyway"]
    Set -->|ok| Return
    Warn --> Return["return the fetched value"]
```

</details>

<details>
<summary><strong>9. Background queues</strong></summary>

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

Full timeouts/expiry cheat-sheet (access token, refresh token, OTP, signed URLs, caches, rate
limits — everything above, in one table): [docs/flow-diagrams.md#10-timeouts--expiry-cheat-sheet](./docs/flow-diagrams.md#10-timeouts--expiry-cheat-sheet).
