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

One request, start to finish, across all three systems:

1. `node --import ./instrumentation.js server.js` — OTel instrumentation patches `http`/
   `mongodb`/`ioredis` etc. before anything else loads.
2. Request hits the process — OTel's HTTP instrumentation opens the **root span**, generating
   `traceId`.
3. `app.js` middleware chain: `requestContextMiddleware` mints `requestId` (`AsyncLocalStorage`) →
   `httpLoggerMiddleware`/`metricsMiddleware` arm their end-of-request hooks → body gets parsed →
   `bodyLoggerMiddleware` logs the redacted body and tags it onto the root span → your route
   handler runs, and every DB/Redis call it makes opens a **child span** automatically.
4. Every `logger.*()` call anywhere in this chain gets `requestId`/`userId`/`traceId`/`spanId`
   auto-stamped by `mixin()` (`logger.js`) — reading whatever span is active *at that instant*,
   which may be the root span or a child span depending on where in the code the log call sits.
5. On error: `recordSpanException()` attaches the exception to the active span; `logger.error()`
   logs the same error to stdout — both carrying the same `traceId`.
6. Response goes out with `X-Request-ID` (not `traceId` — that stays server-side, findable via
   the log line for the same `requestId` if you ever need it from a client-facing bug report).
7. Independently: completed spans batch-export over OTLP to `jaeger:4318`; log lines go to stdout
   (captured by Docker, capped per the log-rotation note above); `metricsMiddleware` and friends
   increment in-process counters that `prometheus` scrapes from `/metrics` every 15s.

Three separate pipelines (logs / traces / metrics), correlated only by the IDs riding along with
each one — there is no shared datastore between them.

### Tracing a request end-to-end

1. **Grafana** (`metric.neodrive.anupamsingh.xyz`) — notice a `5xx`/latency signal, narrow down
   roughly when and which route.
2. **Jaeger** (`traces.neodrive.anupamsingh.xyz`) — Search → `error=true` → match the time window
   → click the trace. Root span's **Tags** has the request payload and outcome; the **waterfall**
   shows every DB/Redis step with timing; a failing span's **Logs** has the exception, if one
   exists past this point in the request.
3. **Logs** (`docker compose logs app worker | grep <traceId>`) — the reliable fallback for
   anything Jaeger didn't capture (pre-routing crashes), or the starting point if you already have
   an ID from somewhere else (a `requestId` from a user's bug report → find it in logs →
   read off the `traceId` on that same line → paste into Jaeger's Trace ID search).

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
