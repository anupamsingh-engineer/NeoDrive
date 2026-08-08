# Observability

Code: `src/config/logger.js`, `src/config/requestContext.js`,
`src/middlewares/requestContext.middleware.js`, `src/middlewares/httpLogger.middleware.js`,
`src/middlewares/bodyLogger.middleware.js`, `src/middlewares/metrics.middleware.js`,
`src/middlewares/errorHandler.middleware.js`, `src/utils/sensitiveFields.js`,
`src/config/metrics.js`, `src/routes/metrics.routes.js`, `src/routes/health.routes.js`,
`instrumentation.js`.

## Logging (pino)

Structured JSON logs (pretty-printed with `pino-pretty` outside production). Level via
`LOG_LEVEL` (default `debug` in dev, `info` in prod).

Every log line is automatically enriched with `requestId`, `userId` (once known), and
`traceId`/`spanId` (once OpenTelemetry is active) via pino's `mixin()` hook, without those values
being threaded manually through every function call:

- `requestContextMiddleware` (first middleware in `app.js`) opens a Node `AsyncLocalStorage`
  context per request (`src/config/requestContext.js`), seeded with a `requestId` — either the
  incoming `x-request-id` header or a fresh UUID, echoed back as the `X-Request-ID` response
  header.
- `requireAuth` calls `setUserId(user._id)` once it resolves the caller, so every subsequent log
  line in that request — including ones several service calls deep — carries `userId` without
  any code explicitly passing it.
- `httpLoggerMiddleware` (pino-http) logs one line per request: method/url and status code, log
  level bumped to `warn` for 4xx and `error` for 5xx/thrown errors. `/healthz` and `/readyz` are
  excluded from this access log entirely — they'd otherwise dominate log volume from load
  balancer/orchestrator polling.
- `bodyLoggerMiddleware` (mounted after `express.json()`/`express.urlencoded()` in `app.js` —
  deliberately *not* part of `httpLoggerMiddleware`'s serializer, since pino-http binds `req` at
  the point it's mounted, ahead of body parsing, so `req.body` would always be `undefined` there)
  logs a separate `"request body"` line whenever a request has a non-empty body, and attaches the
  same (redacted) body as the `http.request.body` attribute on the active OTel span (see
  Tracing below). Non-empty bodies only — nothing logged for GET/DELETE-style requests.

**Redaction:** `logger.js`'s pino `redact` config and `bodyLoggerMiddleware`'s span attribute both
derive their field list from the single source of truth in `src/utils/sensitiveFields.js`
(`SENSITIVE_BODY_FIELDS` — `password`, `otp`, `token`, `verificationToken`, `idToken`,
`refreshToken`, `accessToken`). Add a new sensitive field there, not in either individual call
site, so the log and the span can't drift out of sync. Redacted fields render as `"[Redacted]"`.

Container log files are capped (`docker-compose.yml`, `x-logging` anchor — `json-file` driver,
10MB × 5 files per service) so logs can't silently fill disk on a small box; this does mean a
container's log history doesn't survive being recreated (`docker compose up --build`), only
restarted.

## Metrics (Prometheus)

`GET /metrics` — Prometheus text-exposition format, `prom-client`'s default Node process metrics
plus these custom ones (`src/config/metrics.js`):

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `http_request_duration_seconds` | Histogram | `method, route, status_code` | Request latency |
| `http_requests_total` | Counter | `method, route, status_code` | Request count |
| `auth_login_attempts_total` | Counter | `method (password\|google), result (success\|failure\|locked)` | Login outcomes |
| `auth_refresh_reuse_detected_total` | Counter | — | Refresh-token theft detections (see [security.md](./security.md)) |
| `file_upload_initiated_total` / `_completed_total` | Counter | — | Upload funnel |
| `file_upload_failed_total` | Counter | `reason (verification_failed\|size_mismatch)` | Failed `upload/complete` calls |
| `file_upload_duration_seconds` | Histogram | — | initiate → complete elapsed time |
| `s3_operation_errors_total` | Counter | `operation` | S3 SDK call failures |
| `queue_depth` | Gauge | `queue` | Waiting+delayed BullMQ jobs, polled every 15s |
| `razorpay_webhook_events_total` | Counter | `event, status` | Webhook processing outcomes |
| `cache_hit_total` / `cache_miss_total` | Counter | `cache` | Redis cache-aside effectiveness (see [caching.md](./caching.md)) |
| `storage_bytes_used` | Gauge | `plan` | Set by the nightly size-reconcile job |

Access is optionally gated: if `METRICS_TOKEN` is set, the endpoint requires either a matching
`x-metrics-token` header or an `Authorization: Bearer <token>` header (`403` otherwise); if unset,
the endpoint is open. Prometheus scrape configs can't send arbitrary custom headers, only the
standard `Authorization` one, so the bundled Prometheus container authenticates via
`authorization.credentials_file` in `docker/prometheus/prometheus.yml`, reading the token from
`docker/prometheus/metrics_token` (gitignored - copy `metrics_token.example` and paste in the same
value as `METRICS_TOKEN`). Leave it empty if `METRICS_TOKEN` is unset.

## Tracing (OpenTelemetry)

Opt-in — only starts if `OTEL_EXPORTER_OTLP_ENDPOINT` is set (`instrumentation.js`, loaded via
`node --import ./instrumentation.js` ahead of `server.js`/`worker.js`, so instrumentation patches
are in place before any traced module is `require`/`import`ed). Auto-instruments the usual
Node ecosystem (HTTP, Express, Mongoose, ioredis, etc.) via
`@opentelemetry/auto-instrumentations-node`, exports OTLP/HTTP to `${endpoint}/v1/traces`, service
name from `OTEL_SERVICE_NAME` (default `neodrive-backend`). In the Docker Compose stack this
points at the bundled Jaeger container; view traces at `http://localhost:16686` locally, or
`https://traces.neodrive.anupamsingh.xyz` in production (see
[ec2-deployment.md](./ec2-deployment.md) step 11 — nginx `auth_basic`-gated, since Jaeger has no
login of its own).

**What auto-instrumentation gives you for free:** a root span per incoming HTTP request, plus a
child span for every outgoing `mongodb`/`ioredis` call made while handling it (same `traceId`,
new `spanId`, nested under whatever span was active when the call happened) — this is the
waterfall Jaeger's UI renders, with zero manual span-creation code anywhere in this codebase.

**What auto-instrumentation does *not* give you for free**, and this repo adds explicitly:
- **Exception details.** By default, a `5xx` span only gets `error=true` and `http.status_code` —
  the actual JS error is never attached. `errorHandlerMiddleware`'s `recordSpanException()`
  (`errorHandler.middleware.js`) calls `span.recordException(err)` on the active span for every
  real `5xx` (not 4xx — see the `expose`/`ApiError` branches above it), so the message/stack show
  up under that span's **Logs** tab in Jaeger. Errors thrown *before* any span exists yet (e.g. a
  `body-parser` JSON syntax error, which happens ahead of routing) won't have this — logs are the
  only place those show up.
- **Request payload.** `bodyLoggerMiddleware` attaches the redacted body as `http.request.body` on
  the *root* span (see Logging above) — visible under that span's **Tags**, capped at 2000
  characters (`MAX_SPAN_BODY_LENGTH`) so a large payload can't bloat a trace.

**Searching by ID:** paste any `traceId` into Jaeger's top-right "Lookup by Trace ID" box to jump
straight to that trace, skipping the Service/Tags/Lookback filters — useful once you already have
an ID from a log line (see "Tracing a request end-to-end" below).

## Request lifecycle — how logs, traces, and metrics combine

### The three IDs, and exactly where each is born

| ID | Created by | When | Lives in |
|---|---|---|---|
| `traceId` | OpenTelemetry's HTTP auto-instrumentation | The instant the request hits the Node process, before any of this app's own middleware runs | Every span for this request, and every log line via `mixin()` |
| `spanId` | OpenTelemetry, fresh one per operation | One for the whole HTTP request (root span), plus a new one for every DB/Redis call an instrumented library makes | Each individual span |
| `requestId` | This app's own code — `requestContext.middleware.js` | First line of the middleware chain (`app.js:22`) | `AsyncLocalStorage`, echoed as the `X-Request-ID` response header |

`traceId`/`spanId` are OpenTelemetry's concept, for connecting spans into a trace. `requestId` is
this app's own, for connecting log lines to a client-visible header. They travel together only
because `logger.js`'s `mixin()` reads both and stamps them onto every log line.

### The request's journey, step by step

1. **Node process starts** — `node --import ./instrumentation.js server.js`. The `--import` flag
   matters: it loads OpenTelemetry's instrumentation *before* any other module, so when
   `mongodb`/`ioredis`/`http`/`express` get `import`ed afterward, OTel has already patched them to
   auto-create spans.
2. **Request arrives** → nginx (host) → `app` container `127.0.0.1:4000`. OTel's HTTP
   instrumentation wraps this at the lowest level and opens the **root span** — this is where
   `traceId` is generated (or continued, if a caller passed trace-context headers, which nothing
   does in this setup since it isn't calling other traced services).
3. **The `app.js` middleware chain runs**, in this order:
   - `requestContextMiddleware` (`app.js:22`) — generates `requestId` (or reuses the
     `x-request-id` header), opens `AsyncLocalStorage`, stores it. Echoes `X-Request-ID` back.
   - `httpLoggerMiddleware` (pino-http) — sets up the "request completed" log line that fires when
     the response ends.
   - `metricsMiddleware` — starts a timer; on response finish, increments
     `http_requests_total`/`http_request_duration_seconds`.
   - `helmet`, `cors`, `cookieParser` — security/parsing, not observability-relevant.
   - `express.json()` — parses the body.
   - `bodyLoggerMiddleware` (`app.js:48`) — logs the redacted body via pino, and calls
     `trace.getActiveSpan().setAttribute("http.request.body", ...)` — at this point in the chain,
     the "active span" is still the root span, since no DB/Redis calls have happened yet.
   - `globalLimiter` — an `ioredis` call under the hood (the `EVALSHA` span visible in Jaeger) —
     OTel's `ioredis` instrumentation auto-creates a **child span**, nested under the root span,
     same `traceId`, new `spanId`.
   - **The route handler runs** — every `mongodb`/`ioredis` call inside a controller/service (e.g.
     `mongodb.find` on `users`) auto-creates another child span the same way. This is *why* the
     Jaeger waterfall shows DB calls without any tracing code written by hand — it's the
     driver-level instrumentation doing it.
4. **Every `logger.*()` call, anywhere, during all of this** — `mixin()` (`logger.js:27-39`) runs
   and reads: `requestId` from `AsyncLocalStorage`, `userId` if `requireAuth` already resolved it,
   and `traceId`/`spanId` from `trace.getActiveSpan()?.spanContext()` — whatever span happens to
   be active at that exact moment the log call fires. This is why a log line mid-request can show
   a *child* span's ID, while the "request completed" line at the end shows the root span's ID
   again.
5. **If something throws** — `errorHandlerMiddleware` catches it. For a real `5xx`:
   `recordSpanException(err)` (`errorHandler.middleware.js:9-14`) calls `span.recordException(err)`
   — attaching the message/stack as a **span event** on the active span — then
   `logger.error({err}, ...)` logs the same thing to stdout, both carrying the same `traceId`.
6. **Response sent** — client gets `X-Request-ID` back (not `traceId` — that stays server-side
   only).

### Where each piece actually ends up

- **Logs** → stdout → Docker's `json-file` driver (capped at 50MB/container, see the log-rotation
  note above) → `docker compose logs`
- **Spans** → batched by the OTel SDK → exported over OTLP/HTTP to `http://jaeger:4318` (hardcoded
  in `docker-compose.yml`'s `environment:` block) → stored/rendered by the `jaeger` container
- **Metrics** → accumulate in-process → exposed at `GET /metrics` → scraped every 15s by
  `prometheus` (`prometheus.yml`) → queried by Grafana's dashboard panels

Three completely separate pipelines, correlated only by the IDs riding along with each one — there
is no shared datastore between them.

### Tracing any request, combining all of it

1. **Grafana** (`metric.neodrive.anupamsingh.xyz`) → notice a `5xx`/latency spike → know roughly
   *when* and *which route*.
2. **Jaeger** (`traces.neodrive.anupamsingh.xyz`) → Search → `error=true` in that window → click
   the trace → the root span's **Tags** has `http.request.body`, status, and target; the
   **waterfall** shows every DB/Redis child span with timing; if it's a real exception, the
   failing span's **Logs** tab has the message/stack directly.
3. **Logs** (`docker compose logs app worker | grep <traceId>`) — only needed if Jaeger didn't
   capture enough (e.g. a pre-routing crash like a `body-parser` JSON error, which happens before
   any span exists) — the full log line, guaranteed to have the real error, every time.

Every layer shares the same `traceId` — that's the thread connecting all three systems back to one
real request.

## Health vs. readiness

| Endpoint | Checks | Use for |
|---|---|---|
| `GET /healthz` | Nothing beyond "the process is running" — always `200` | Liveness probe |
| `GET /readyz` | Actual Mongo (`mongoose.connection.readyState === 1`) and Redis (`PING`) connectivity — `200` only if both are up, `503` otherwise, body reports which one failed | Readiness probe / load-balancer target health |

```json
// GET /readyz, degraded
{ "status": "not_ready", "db": true, "redis": false }
```

Both are excluded from the HTTP access log (see above), but **not** from rate limiting — they
still count against `globalLimiter` like any other route.
