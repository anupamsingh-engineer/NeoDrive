# Storage App Backend (v2)

Production-grade rebuild of the storage app API: file/folder storage backed by S3 +
CloudFront, MongoDB, Redis, BullMQ background jobs, and a full observability stack
(structured logs, Prometheus metrics, OpenTelemetry tracing).

## Architecture

Layered, capstone-style: `routes -> controllers -> services -> repositories -> models`.
Repositories are the only layer that touches Mongoose; services are plain exported
functions (no classes, no DI container - imports are the wiring).

- **Auth**: dual JWT (access + refresh) with rotation-and-reuse-detection, Redis-backed
  access-token blacklist, RBAC, account lockout, purpose-scoped tokens for password
  reset. See `src/services/auth.service.js` and `src/services/token.service.js`.
- **Storage**: S3 presigned uploads + CloudFront signed downloads (`src/services/storage/`).
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
cp .env.example .env   # fill in secrets
npm run migrate:up     # create indexes
npm run dev             # API on :4000
npm run worker:dev      # background job worker (separate process)
```

MongoDB must run as a replica set - `register`/Google-login use a transaction. A MongoDB Atlas
cluster (the default `DB_URL` in `.env.example`) already satisfies this out of the box. If you
point `DB_URL` at a self-hosted Mongo instead and hit
`Transaction numbers are only allowed on a replica set member or mongos` or `ReplicaSetNoPrimary`,
see **[LOCAL_DEV_TROUBLESHOOTING.md](./LOCAL_DEV_TROUBLESHOOTING.md)** for the exact commands.

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

See **[INSTALLATION.md](./INSTALLATION.md)** for the full walkthrough (env setup, startup order, verification checklist).

## Scripts

| Script                                                         | Purpose                                  |
| -------------------------------------------------------------- | ---------------------------------------- |
| `npm run dev`                                                | API with hot reload                      |
| `npm run worker:dev`                                         | Background worker with hot reload        |
| `npm run migrate:up` / `migrate:down` / `migrate:status` | MongoDB index migrations (migrate-mongo) |
| `npm run format`                                             | Prettier                                 |

## Security notes

- Every secret/identifier is env-driven (`src/config/env.js`) - nothing hardcoded.
- CSRF: signed double-submit cookie, enforced on cookie-authenticated mutating routes
  only (Bearer-token requests are exempt, since they carry no ambient cookie).
- Rate limiting, Helmet, Mongo sanitization, and HPP are applied globally in `app.js`.
