# Storage App Backend — Documentation

Deep-dive reference for every feature in this API: what each endpoint does, the exact request
and response payloads, and the patterns the codebase leans on repeatedly (repository layer,
cache-aside, quota reservation, two-phase upload, webhook handling, background jobs). Written to
be read top to bottom once, then used as a lookup afterwards.

If you just want a flat list of every route with its method/path/auth requirement, go straight to
**[api-reference.md](./api-reference.md)**. Everything else here is the "why" and "how" behind
that list.

## Reading order

| Doc | What's in it |
|---|---|
| [architecture.md](./architecture.md) | Layering (`routes → controllers → services → repositories → models`), request lifecycle, folder map, cross-cutting patterns used everywhere |
| [flow-diagrams.md](./flow-diagrams.md) | Visual reference: sequence/flow diagrams for auth, directories, file upload/download, signed URLs, caching, and queues, plus a full timeouts/expiry cheat-sheet |
| [authentication.md](./authentication.md) | OTP signup (verification-token pattern), register, login, Google sign-in, refresh/rotation, logout, password reset — full payloads |
| [users.md](./users.md) | Current-user profile, admin user listing, forced logout, soft delete, RBAC roles |
| [directories.md](./directories.md) | Folder tree, breadcrumb ancestors, create/rename/delete, recursive delete, size accounting |
| [files.md](./files.md) | Two-phase S3 upload (initiate → direct-to-S3 PUT → complete), CloudFront signed downloads, rename/delete |
| [subscriptions-billing.md](./subscriptions-billing.md) | Plan catalog, Razorpay subscription creation, the `/webhooks/razorpay` event handler, quota grants |
| [background-jobs.md](./background-jobs.md) | The three BullMQ queues (`email`, `s3-cleanup`, `directory-size-reconcile`) and the separate worker process |
| [caching.md](./caching.md) | Redis cache-aside helper, the two caches in use, invalidation rules |
| [security.md](./security.md) | Auth model (cookie + Bearer), CSRF double-submit, rate limiting, RBAC, lockout, refresh-token reuse detection |
| [observability.md](./observability.md) | Structured logs, Prometheus metrics, OpenTelemetry tracing, health/readiness checks |
| [error-handling.md](./error-handling.md) | `ApiError`, the error JSON envelope, every status code the API can return and why |
| [api-reference.md](./api-reference.md) | Flat table: every route, its auth/CSRF/rate-limit requirements, and links back to the relevant deep dive |
| [installation.md](./installation.md) | Full Docker Compose walkthrough — env setup, startup order, verification checklist |
| [local-dev-troubleshooting.md](./local-dev-troubleshooting.md) | Running natively on the host (hot reload) instead of full Docker, plus a table of every setup error and its fix |
| [frontend-integration-guide.md](./frontend-integration-guide.md) | Building a frontend against this API from scratch: system map, auth/session model, every endpoint, recommended build order |
| [ec2-deployment.md](./ec2-deployment.md) | Production deployment: EC2 + Docker + nginx + Let's Encrypt (certbot) + GitHub Actions CI/CD |

## Conventions used across every endpoint

**Base URL.** No `/api` prefix — routes are mounted at the app root (see `app.js` /
`src/routes/index.js`). Locally that's `http://localhost:4000`.

**Success envelope.**
```json
{ "success": true, "data": { /* endpoint-specific */ } }
```
Some endpoints return `message` instead of (or alongside) `data` — see each doc for the exact
shape. Endpoints with nothing to return (`logout`, `delete`) respond `204 No Content` with an
empty body.

**Error envelope.**
```json
{ "success": false, "message": "Human-readable message", "details": { /* optional, e.g. zod field errors */ } }
```
See [error-handling.md](./error-handling.md) for the full status-code catalog.

**Auth.** Access/refresh tokens are HttpOnly cookies by default (`accessToken`, `refreshToken`,
plus a readable `csrfToken`); an `Authorization: Bearer <accessToken>` header also works and is
exempt from CSRF (no ambient cookie for an attacker to ride). See
[authentication.md](./authentication.md) and [security.md](./security.md).

**CSRF.** Required as an `x-csrf-token` header (mirroring the `csrfToken` cookie) on every
cookie-authenticated, non-GET request under `/directory`, `/file`, `/subscriptions`, and the
auth-session-mutating routes (`/auth/logout`, `/auth/logout-all`). Bearer-token requests skip it.

**Validation.** Request bodies/queries are validated with [zod](https://zod.dev) schemas
(`src/validators/*.schema.js`); a failed validation returns `400` with `details.fieldErrors`
keyed by field name.

**IDs.** All Mongo ObjectIds in URL params are checked with `validateObjectId` before the handler
runs — an invalid ID shape is a `400`, not a `404`.

## Where this maps in the code

```
src/routes/*        → HTTP method + path + middleware wiring (auth, CSRF, validation, rate limit)
src/controllers/*    → req/res only — pulls values off req, calls one service function, shapes the response
src/services/*       → business logic, orchestrates repositories/queues/cache, throws ApiError
src/repositories/*   → the only layer that touches Mongoose models directly
src/models/*         → Mongoose schemas
src/validators/*     → zod request schemas
src/queues/*         → BullMQ producers (src/queues/*.queue.js) and consumers (src/queues/*.worker.js)
src/middlewares/*    → auth, CSRF, RBAC, rate limiting, validation, error handling, observability
```

See [architecture.md](./architecture.md) for the full picture and the patterns that recur across
these layers.
