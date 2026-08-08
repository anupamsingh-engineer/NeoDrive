import { trace, SpanStatusCode } from "@opentelemetry/api";
import { ApiError } from "../errors/ApiError.js";
import logger from "../config/logger.js";
import env from "../config/env.js";

// Auto-instrumentation sets `error=true`/`http.status_code` on the span for a 5xx response, but
// never attaches the actual JS error - without this, Jaeger only ever tells you THAT a request
// failed, never WHY, and every message/stack trace lookup has to fall back to the logs.
function recordSpanException(err) {
  const span = trace.getActiveSpan();
  if (!span) return;
  span.recordException(err);
  span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
}

export function errorHandlerMiddleware(err, req, res, next) {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      recordSpanException(err);
      logger.error({ err }, err.message);
    }
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  if (err.name === "MulterError") {
    return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({ success: false, message: `${field} already exists` });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({ success: false, message: "Invalid input", details: err.errors });
  }

  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }

  // body-parser (and other http-errors-based middleware) sets `expose: true` specifically to
  // mark a message as safe to show clients, alongside a real 4xx statusCode - e.g. malformed
  // JSON in a request body is the client's mistake, not a server bug, so it shouldn't be forced
  // to 500 / logged as "Unhandled error" the way an actual crash is.
  if (err.expose && err.statusCode >= 400 && err.statusCode < 500) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }

  recordSpanException(err);
  logger.error({ err }, "Unhandled error");
  return res.status(500).json({
    success: false,
    message: env.isProduction ? "Something went wrong" : err.message,
  });
}
