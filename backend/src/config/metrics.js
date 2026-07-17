import client from "prom-client";

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export const authLoginAttemptsTotal = new client.Counter({
  name: "auth_login_attempts_total",
  help: "Login attempts by method and result",
  labelNames: ["method", "result"],
  registers: [register],
});

export const authRefreshReuseDetectedTotal = new client.Counter({
  name: "auth_refresh_reuse_detected_total",
  help: "Refresh token reuse (theft) detections",
  registers: [register],
});

export const fileUploadInitiatedTotal = new client.Counter({
  name: "file_upload_initiated_total",
  help: "File uploads initiated",
  registers: [register],
});

export const fileUploadCompletedTotal = new client.Counter({
  name: "file_upload_completed_total",
  help: "File uploads completed successfully",
  registers: [register],
});

export const fileUploadFailedTotal = new client.Counter({
  name: "file_upload_failed_total",
  help: "File uploads that failed verification",
  labelNames: ["reason"],
  registers: [register],
});

export const fileUploadDuration = new client.Histogram({
  name: "file_upload_duration_seconds",
  help: "Time between upload initiate and upload complete",
  buckets: [1, 5, 15, 30, 60, 120, 300],
  registers: [register],
});

export const storageBytesUsed = new client.Gauge({
  name: "storage_bytes_used",
  help: "Bytes used per user root directory",
  labelNames: ["plan"],
  registers: [register],
});

export const s3OperationErrorsTotal = new client.Counter({
  name: "s3_operation_errors_total",
  help: "S3/CloudFront operation errors",
  labelNames: ["operation"],
  registers: [register],
});

export const queueDepth = new client.Gauge({
  name: "queue_depth",
  help: "BullMQ queue depth (waiting jobs)",
  labelNames: ["queue"],
  registers: [register],
});

export const razorpayWebhookEventsTotal = new client.Counter({
  name: "razorpay_webhook_events_total",
  help: "Razorpay webhook events received",
  labelNames: ["event", "status"],
  registers: [register],
});

export const cacheHitTotal = new client.Counter({
  name: "cache_hit_total",
  help: "Cache hits",
  labelNames: ["cache"],
  registers: [register],
});

export const cacheMissTotal = new client.Counter({
  name: "cache_miss_total",
  help: "Cache misses",
  labelNames: ["cache"],
  registers: [register],
});

export default register;
