# Observability

Code: `src/config/logger.js`, `src/config/requestContext.js`,
`src/middlewares/requestContext.middleware.js`, `src/middlewares/httpLogger.middleware.js`,
`src/middlewares/metrics.middleware.js`, `src/config/metrics.js`, `src/routes/metrics.routes.js`,
`src/routes/health.routes.js`, `instrumentation.js`.

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

Access is optionally gated: if `METRICS_TOKEN` is set, the endpoint requires a matching
`x-metrics-token` header (`403` otherwise); if unset, the endpoint is open. Prometheus's own
scrape config (`docker/prometheus/prometheus.yml`) would need that header configured if you turn
this on.

## Tracing (OpenTelemetry)

Opt-in — only starts if `OTEL_EXPORTER_OTLP_ENDPOINT` is set (`instrumentation.js`, loaded via
`node --import ./instrumentation.js` ahead of `server.js`/`worker.js`, so instrumentation patches
are in place before any traced module is `require`/`import`ed). Auto-instruments the usual
Node ecosystem (HTTP, Express, Mongoose, ioredis, etc.) via
`@opentelemetry/auto-instrumentations-node`, exports OTLP/HTTP to `${endpoint}/v1/traces`, service
name from `OTEL_SERVICE_NAME` (default `storage-app-backend`). In the Docker Compose stack this
points at the bundled Jaeger container; view traces at `http://localhost:16686`.

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
