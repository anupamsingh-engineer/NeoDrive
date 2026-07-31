# Storage App Backend (v2)

Production-grade rebuild of the storage app API: file/folder storage backed by S3 +
CloudFront, MongoDB, Redis, BullMQ background jobs, and a full observability stack
(structured logs, Prometheus metrics, OpenTelemetry tracing).

**Looking for API request/response payloads, or a deep dive into how a specific feature works?**
See **[docs/](./docs/index.md)** — one doc per feature (auth, users, directories, files,
subscriptions/webhooks, background jobs, caching, security, observability, error handling) plus a
flat [API reference](./docs/api-reference.md) of every route.

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

| Script                                                         | Purpose                                  |
| -------------------------------------------------------------- | ---------------------------------------- |
| `npm run dev:all`                                            | Redis (Docker) + migrations + API + worker, all in one command, hot reload on both processes |
| `npm run dev`                                                | API with hot reload (on its own)         |
| `npm run worker:dev`                                         | Background worker with hot reload (on its own) |
| `npm run migrate:up` / `migrate:down` / `migrate:status` | MongoDB index migrations (migrate-mongo) |
| `npm run format`                                             | Prettier                                 |

## Security notes

- Every secret/identifier is env-driven (`src/config/env.js`) - nothing hardcoded.
- CSRF: signed double-submit cookie, enforced on cookie-authenticated mutating routes
  only (Bearer-token requests are exempt, since they carry no ambient cookie).
- Rate limiting, Helmet, Mongo sanitization, and HPP are applied globally in `app.js`.
