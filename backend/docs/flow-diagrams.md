# Flow Diagrams

Visual reference for how a request actually moves through this backend — end to end, from the
middleware pipeline through auth, directories, files, signed URLs, caching, and the background
queues. This doc is diagram-first; for full payloads and edge cases, follow the links out to the
relevant deep-dive doc. A rendered, navigable version of this same content is also published as
an Artifact.

Every diagram here was checked directly against the source it describes:
`app.js`, `src/middlewares/auth.middleware.js`, `src/services/auth.service.js`,
`src/services/directory.service.js` (incl. `prepareDirectoryZip`), `src/services/file.service.js`,
`src/services/share.service.js`, `src/services/storage/{s3,cloudfront}.storage.js`,
`src/services/cache.service.js`, `src/queues/*`.

---

## 1. System overview

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

The API process only ever **enqueues** background work — it never sends an email, deletes an S3
object, or recomputes directory sizes itself. That all happens in `worker.js`, a second Node
process reading the same Redis queues. See [background-jobs.md](./background-jobs.md).

---

## 2. Request lifecycle (every request, in order)

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

Webhooks are split off **before** JSON parsing specifically so Razorpay's signature check gets
the exact raw bytes — see [subscriptions-billing.md](./subscriptions-billing.md).

---

## 3. Auth — registration (OTP → verification token → account)

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

The verification token exists specifically so a page reload between steps 2 and 3 doesn't force
the user through a brand new OTP email — see
[authentication.md](./authentication.md#post-authverify-otp).

## 3b. Auth — login

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

---

## 4. Auth — every subsequent request (`requireAuth`)

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
    else user deleted, or tokensValidAfter > token.iat
        API-->>U: 401 Session has been revoked
    else all clear
        API->>API: attach req.user, continue
    end
```

## 4b. Auth — refresh rotation (with reuse/theft detection)

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
    else hash mismatch, rotated < 3s ago
        API-->>U: 409 please retry (benign race)
    else hash mismatch, older than 3s
        API->>Mongo: delete ALL refresh tokens for user
        API->>Mongo: bump tokensValidAfter (kills live access tokens too)
        API-->>U: 401 reuse detected — full logout
    end
```

Full detail on why a 3-second window separates a benign race from theft:
[authentication.md](./authentication.md#post-authrefresh).

---

## 5. Directory flow

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

S3 objects are deleted **asynchronously** via the `s3-cleanup` queue — the directory disappears
from the API instantly, the underlying objects shortly after. See
[directories.md](./directories.md).

---

## 5b. Directory download — streaming a zip of the whole subtree

The one download path in the app where the API server actually reads file bytes — every other
download is a CloudFront redirect (see 7, 7b below).

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

Files are fetched from S3 **sequentially**, not all at once — keeps at most one S3 read stream
open at a time rather than racing to open hundreds. Rate-limited tighter than other downloads
(`directoryDownloadLimiter`, 10/min/user) for the same reason. See
[directories.md](./directories.md#get-directorydownload-and-get-directoryiddownload).

---

## 6. File upload — two-phase commit

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

Quota is reserved at **initiate**, not at **complete** — an abandoned upload (never completed)
still counts against quota until explicitly deleted. See
[files.md](./files.md#post-fileuploadinitiate).

---

## 7. File download — signed URL generation

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

The API never streams file bytes — it only ever hands out a time-limited pointer. `action`
controls whether the browser renders it inline or forces a download; nothing else about the URL
changes. See [files.md](./files.md#get-fileidactiondownload).

---

## 7b. Sharing — create a link, then an anonymous visitor resolves and downloads it

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

Revoking (`DELETE /share/:id`) takes effect on the very next `GET /s/:token` — there's no cache in
front of this lookup, deliberately (see [caching.md](./caching.md) and
[sharing.md](./sharing.md#caching)). See [sharing.md](./sharing.md) for the full endpoint
reference.

---

## 7c. Sharing — the folder-boundary security check

The one property a folder share depends on: a visitor can browse anywhere *inside* the shared
folder, and nowhere else. Applied identically to `?dirId=` on `GET /s/:token` and to `:fileId` on
the download endpoint (via the file's `parentDirId`):

```mermaid
flowchart TD
    Req(["visitor supplies a dirId (or a file's parentDirId)\nwithin a directory share"]) --> Eq{"target === share root?"}
    Eq -->|yes| Allow["allowed — it's the share root itself"]
    Eq -->|no| Chain["walk real parentDirId links in Mongo:\nfindAncestorChain(target)"]
    Chain --> In{"share root appears\nin that chain?"}
    In -->|yes| Allow2["allowed — target is a genuine descendant"]
    In -->|no| Deny["404 — same generic message as a\nmissing or revoked token"]
```

Because the chain is walked from real `parentDirId` links stored in Mongo — never trusted from
anything the client sends — there is no `dirId`/`fileId` a visitor can construct that passes this
check without the resource actually living inside the shared folder. See
[sharing.md](./sharing.md#the-security-boundary-check).

---

## 8. Caching — where it comes in

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

**The two caches in use:**

| Cache | Key | TTL | Populated by |
|---|---|---|---|
| `user_profile` | `user:profile:<userId>` | 300s | `GET /users/me` |
| `dir_listing` | `dir:listing:<userId>:<dirId>` | 45s | `GET /directory/:id?` |

**What invalidates them:** every directory/file create, rename, or delete calls
`invalidateDirectoryListings` for every ancestor whose `size` it touched — not just the target —
since a listing embeds its own directory's `size`. The nightly reconciliation job does the same
for anything it corrects. `user_profile` is only busted on user delete or a subscription webhook
quota change. Any Redis error, on either the read or write side, is logged and swallowed — a
Redis outage degrades the app to "always hit Mongo," never a 500. See
[caching.md](./caching.md).

---

## 9. Background queues

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

If the worker process isn't running, jobs pile up in Redis and nothing happens — OTP/reset emails
never send, deleted files' S3 objects never get cleaned up — even though the API endpoints that
enqueued them already returned success. See [background-jobs.md](./background-jobs.md).

---

## 10. Timeouts & expiry — cheat sheet

| What | Value | Source |
|---|---|---|
| Access token | 15m | `ACCESS_TOKEN_EXPIRY` |
| Refresh token | 30d | `REFRESH_TOKEN_EXPIRY` |
| Refresh rotation race grace window | 3s | `REFRESH_RACE_GRACE_MS` (hardcoded) |
| OTP validity | 10m (Mongo TTL index) | `OTP_TTL_SECONDS` |
| OTP resend cooldown | 60s | `OTP_RESEND_COOLDOWN_SECONDS` |
| OTP max verify attempts | 5 | `OTP_MAX_VERIFY_ATTEMPTS` |
| Email-verification token | 30m | `EMAIL_VERIFICATION_TOKEN_EXPIRY` |
| Password-reset token | 15m | `PASSWORD_RESET_TOKEN_EXPIRY` |
| Account lockout | 30m, after 5 failed attempts | `LOCK_DURATION_MS` / `MAX_LOGIN_ATTEMPTS` |
| Max concurrent sessions/user | 5 (oldest evicted) | `MAX_SESSIONS_PER_USER` |
| S3 upload presigned URL | 5m | hardcoded, `s3.storage.js` |
| CloudFront download signed URL | 1h | `CLOUDFRONT_URL_EXPIRY_SECONDS` |
| `user_profile` cache | 5m | `PROFILE_CACHE_TTL_SECONDS` |
| `dir_listing` cache | 45s | `DIR_LISTING_CACHE_TTL_SECONDS` |
| Access-token blacklist entry | = token's remaining life at logout | `token.service.js` |
| Global rate limit | 300 / 15m per IP | `globalLimiter` |
| Auth rate limit (OTP/login/register/...) | 10 / 15m per `ip:email` | `authLimiter` |
| Refresh rate limit | 120 / 15m per IP | `refreshLimiter` |
| Upload rate limit | 60 / min per user | `uploadLimiter` |
| Directory zip download rate limit | 10 / min per user | `directoryDownloadLimiter` |
| Directory zip download limits | 2000 files, 2 GB total | hardcoded, `directory.service.js` |
| Share-create rate limit | 20 / min per user | `shareCreateLimiter` |
| Share-resolve rate limit (public `/s/*`) | 300 / 15m per IP | `shareResolveLimiter` |
| Share link lifetime | none — revoke-only, no expiry (v1) | [sharing.md](./sharing.md) |
| Share download signed URL | 5 min (shorter than the owner default above on purpose) | `shareSignedUrlExpirySeconds` / `SHARE_DOWNLOAD_URL_EXPIRY_SECONDS` — see [sharing.md](./sharing.md#revocation-vs-an-already-issued-download-link) for why revoke can't retroactively kill an already-issued one |
| Nightly size reconciliation | 02:00 daily | cron `0 2 * * *` |

See [security.md](./security.md) for the reasoning behind each auth-related number.
