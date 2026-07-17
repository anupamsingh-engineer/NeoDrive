import crypto from "node:crypto";
import { trace } from "@opentelemetry/api";
import { runWithContext } from "../config/requestContext.js";

export function requestContextMiddleware(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader("X-Request-ID", requestId);
  trace.getActiveSpan()?.setAttribute("request.id", requestId);
  runWithContext({ requestId }, next);
}
