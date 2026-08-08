import pinoHttp from "pino-http";
import logger from "../config/logger.js";

export const httpLoggerMiddleware = pinoHttp({
  logger,
  genReqId: (req) => req.id,
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  autoLogging: {
    ignore: (req) => req.url === "/healthz" || req.url === "/readyz",
  },
  serializers: {
    // req.body is populated by the time this runs - pino-http defers serialization until the
    // response actually finishes (well after express.json() has parsed it), even though this
    // middleware itself is registered ahead of the body parser in app.js. Sensitive fields
    // (password, otp, tokens, ...) are stripped via logger.js's `redact` config, not here - this
    // stays a plain passthrough so a new sensitive field only needs updating in one place.
    req: (req) => ({ method: req.method, url: req.url, body: req.body }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
