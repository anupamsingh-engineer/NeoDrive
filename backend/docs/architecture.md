# Architecture & Patterns

## Layering

```
routes/  →  controllers/  →  services/  →  repositories/  →  models/
```

- **`routes/*.routes.js`** — wires an HTTP method + path to a controller function, and lists the
  middleware chain for that route (`requireAuth`, `verifyCsrf`, rate limiter, `validate(schema)`,
  `validateObjectId`). This is the only place that should know about HTTP verbs/paths.
- **`controllers/*.controller.js`** — thin. Pulls values off `req` (body/params/query/user),
  calls exactly one service function, and shapes the HTTP response (status code + envelope). No
  business logic, no direct model/repository access.
- **`services/*.service.js`** — where the actual behavior lives: validation beyond shape
  (ownership checks, quota checks), orchestrating multiple repositories, calling out to
  queues/cache/external APIs, and throwing `ApiError` for anything the client did wrong. Exported
  as plain functions (no classes, no DI container — ES module imports are the wiring).
- **`repositories/*.repository.js`** — the *only* layer that imports a Mongoose model and calls
  `.find`/`.findOne`/`.updateOne`/etc. Every read that doesn't need to call `.save()` later
  returns `.lean()` (plain JS object, not a hydrated document) for speed; reads that need
  document methods (`.save()`, virtuals, `.comparePassword()`) return the hydrated document
  instead — see e.g. `user.repository.js`'s `findById` (lean) vs `findByIdDocument` (hydrated).
- **`models/*.model.js`** — Mongoose schemas only. No business logic beyond schema-level concerns
  (password hashing in a `pre("save")` hook, a `comparePassword` method, a `toSafeJSON` method
  that strips sensitive/internal fields before a user object goes over the wire).

Controllers never call repositories directly, and services never touch `req`/`res`. Following
that boundary is what makes each layer testable/mockable independently and keeps HTTP concerns
out of business logic.

## Request lifecycle

```
app.js (helmet, CORS, cookies, body parsing, mongo-sanitize, hpp, global rate limit)
  └─ src/routes/index.js
       ├─ /auth/*            (public + a couple of requireAuth+verifyCsrf routes)
       ├─ /users/*            requireAuth (+ RBAC on admin routes)
       ├─ requireAuth + verifyCsrf, then:
       │    ├─ /directory/*
       │    ├─ /file/*
       │    └─ /subscriptions/*
       └─ (mounted separately in app.js, ahead of the JSON body parser) /webhooks/razorpay
```

Every request passes through, in order: request-context (assigns `req.id`, opens an
`AsyncLocalStorage` context — see [observability.md](./observability.md)) → HTTP access log →
metrics timer → helmet → CORS → cookie parsing → (webhooks split off here, before JSON parsing) →
JSON/urlencoded body parsing (1mb cap) → mongo-sanitize → HPP guard → global rate limiter → the
matched route's own middleware chain → controller → `errorHandlerMiddleware` if anything threw.

See `app.js` for the exact order — it matters (e.g. webhooks must be mounted before
`express.json()` so they can capture the raw request bytes for signature verification; see
[subscriptions-billing.md](./subscriptions-billing.md)).

## Cross-cutting patterns

These show up in more than one feature; each is explained in depth in its own doc, but here's
the map:

| Pattern                                                                                                                                                                       | Used by                                             | Deep dive                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| **Repository pattern** (only repositories touch Mongoose)                                                                                                               | every feature                                       | this doc                                                 |
| **`asyncHandler` wrapper** — every controller/middleware that can `await` is wrapped so a thrown/rejected error reaches `next()` instead of crashing the process | every route                                         | [error-handling.md](./error-handling.md)                  |
| **`ApiError` + one central error handler**                                                                                                                            | every feature                                       | [error-handling.md](./error-handling.md)                  |
| **Cache-aside with fail-open Redis**                                                                                                                                    | user profile, directory listings                    | [caching.md](./caching.md)                                |
| **Atomic compare-and-increment quota reservation** (no read-then-write race)                                                                                            | file upload, directory delete                       | [files.md](./files.md), [directories.md](./directories.md) |
| **Two-phase commit** (reserve → external side effect → confirm, with rollback on failure)                                                                             | file upload (`uploadInitiate`/`uploadComplete`) | [files.md](./files.md)                                    |
| **Refresh-token rotation with compare-and-swap + reuse detection**                                                                                                      | auth sessions                                       | [authentication.md](./authentication.md)                  |
| **Mongoose transactions** for the one place two collections must be created atomically (user + their root directory)                                                    | register, Google sign-up                            | [authentication.md](./authentication.md)                  |
| **Signed double-submit CSRF cookie**                                                                                                                                    | all cookie-authenticated mutations                  | [security.md](./security.md)                              |
| **BullMQ producer/consumer split** (API process only enqueues; a separate `worker.js` process consumes)                                                               | email, S3 cleanup, nightly reconciliation           | [background-jobs.md](./background-jobs.md)                |
| **Direct-to-storage uploads** (client PUTs straight to S3 via a presigned URL; the API server never sees file bytes)                                                    | file upload                                         | [files.md](./files.md)                                    |
| **Soft delete** (`deleted: true` flag, not a real document removal)                                                                                                   | users                                               | [users.md](./users.md)                                    |
| **Storage provider interface** (`storage.interface.js` documents the contract; `s3.storage.js` + `cloudfront.storage.js` implement it)                            | files                                               | [files.md](./files.md)                                    |

## Folder map

```
backend/
├── app.js                 Express app: middleware pipeline, route mounting (no server.listen)
├── server.js               Entry point: connects Mongo/Redis, starts the HTTP server, graceful shutdown
├── instrumentation.js      OpenTelemetry SDK bootstrap (--import'd before server.js/worker.js)
├── migrate-mongo-config.cjs + migrations/   Index migrations (migrate-mongo)
├── docker-compose.yml       app + worker + migrate + redis + prometheus + grafana + jaeger (Mongo is Atlas, external)
└── src/
    ├── config/              env loading/validation, logger, redis client, mongo connection, prom-client registry, constants
    ├── routes/               HTTP method+path+middleware wiring only
    ├── controllers/          req/res shaping only
    ├── services/              business logic
    │   └── storage/           S3 (upload/delete/head) + CloudFront (signed download URLs)
    ├── repositories/          the only Mongoose call sites
    ├── models/                Mongoose schemas
    ├── validators/            zod request schemas
    ├── middlewares/           auth, csrf, rbac, rate limiting, validation, error handling, logging, metrics
    ├── queues/                BullMQ queue producers (*.queue.js) and consumers (*.worker.js)
    ├── errors/                ApiError, asyncHandler
    ├── utils/                 cookies, sha256 hashing helper
    └── worker.js              Entry point for the background-job process (separate from server.js)
```

## Why a separate worker process

`server.js` (the API) only ever *enqueues* jobs (`initQueueProducers` in `src/queues/index.js`
just schedules the nightly reconcile cron and starts a metrics poller — it never processes a
job). `src/worker.js` is a second Node entry point that starts the three BullMQ `Worker`
instances that actually run job handlers. They share the same codebase/image but run as separate
containers/processes (`npm run dev` vs `npm run worker:dev`; `app`/`worker` services in
`docker-compose.yml`) so a slow email provider or a large batch S3 delete can never block the
request-serving process. Details: [background-jobs.md](./background-jobs.md).
