import { trace } from "@opentelemetry/api";
import logger from "../config/logger.js";
import { redactSensitiveFields } from "../utils/sensitiveFields.js";

// Deliberately a plain, direct log call rather than piggybacking on httpLoggerMiddleware's
// pino-http "request completed" line: pino-http builds its per-request child logger (and
// serializes `req`) at the point it's mounted in app.js - ahead of express.json() there, for
// unrelated reasons (it needs to run before CORS/webhooks) - so req.body would still be
// undefined at that point no matter what serializer is configured. Mounting this middleware
// after express.json()/urlencoded() instead guarantees req.body is already parsed. Sensitive
// fields are stripped via logger.js's `redact` config for the log line, and via
// redactSensitiveFields() below for the span attribute - unlike pino, OTel spans have no
// built-in redaction mechanism of their own.
const MAX_SPAN_BODY_LENGTH = 2000; // a span attribute isn't meant to hold a large payload

export function bodyLoggerMiddleware(req, res, next) {
  if (req.body && Object.keys(req.body).length > 0) {
    logger.info({ body: req.body }, "request body");

    const span = trace.getActiveSpan();
    if (span) {
      let json = JSON.stringify(redactSensitiveFields(req.body));
      if (json.length > MAX_SPAN_BODY_LENGTH) {
        json = `${json.slice(0, MAX_SPAN_BODY_LENGTH)}...[truncated]`;
      }
      span.setAttribute("http.request.body", json);
    }
  }
  next();
}
