import pino from "pino";
import { trace } from "@opentelemetry/api";
import env from "./env.js";
import { getRequestId, getUserId } from "./requestContext.js";

const logger = pino({
  level: env.observability.logLevel,
  base: { service: env.observability.otelServiceName },
  // req.body is logged for debugging (see httpLogger.middleware.js) - these fields carry raw
  // credentials/secrets and must never reach disk even if a new sensitive field gets added to a
  // request schema without anyone remembering to update this list, so keep it generous.
  redact: {
    paths: [
      "req.body.password",
      "req.body.otp",
      "req.body.token",
      "req.body.verificationToken",
      "req.body.idToken",
      "req.body.refreshToken",
      "req.body.accessToken",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
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
