import pino from "pino";
import { trace } from "@opentelemetry/api";
import env from "./env.js";
import { getRequestId, getUserId } from "./requestContext.js";

const logger = pino({
  level: env.observability.logLevel,
  base: { service: env.observability.otelServiceName },
  // req.body is logged for debugging (see bodyLogger.middleware.js) - these fields carry raw
  // credentials/secrets and must never reach disk even if a new sensitive field gets added to a
  // request schema without anyone remembering to update this list, so keep it generous.
  redact: {
    paths: [
      "body.password",
      "body.otp",
      "body.token",
      "body.verificationToken",
      "body.idToken",
      "body.refreshToken",
      "body.accessToken",
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
