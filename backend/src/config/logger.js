import pino from "pino";
import { trace } from "@opentelemetry/api";
import env from "./env.js";
import { getRequestId, getUserId } from "./requestContext.js";
import { SENSITIVE_BODY_FIELDS } from "../utils/sensitiveFields.js";

const logger = pino({
  level: env.observability.logLevel,
  base: { service: env.observability.otelServiceName },
  // req.body is logged for debugging (see bodyLogger.middleware.js) - built from the same
  // SENSITIVE_BODY_FIELDS list bodyLoggerMiddleware uses for the Jaeger span attribute, so the
  // two can't silently drift apart when a new sensitive field is added later.
  redact: {
    paths: SENSITIVE_BODY_FIELDS.map((field) => `body.${field}`),
    censor: "[Redacted]",
  },
  transport: env.isProduction
    ? undefined
    : { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } },
  mixin() {
    const requestId = getRequestId();
    const userId = getUserId();
    // Lets a log line be jumped to its trace in Jaeger, and vice versa, when tracing is enabled.
    const spanContext = trace.getActiveSpan()?.spanContext();
    return {
      ...(requestId && { requestId }),
      ...(userId && { userId }),
      ...(spanContext && { traceId: spanContext.traceId, spanId: spanContext.spanId }),
    };
  },
});

export default logger;
