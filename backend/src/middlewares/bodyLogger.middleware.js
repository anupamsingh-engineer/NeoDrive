import logger from "../config/logger.js";

// Deliberately a plain, direct log call rather than piggybacking on httpLoggerMiddleware's
// pino-http "request completed" line: pino-http builds its per-request child logger (and
// serializes `req`) at the point it's mounted in app.js - ahead of express.json() there, for
// unrelated reasons (it needs to run before CORS/webhooks) - so req.body would still be
// undefined at that point no matter what serializer is configured. Mounting this middleware
// after express.json()/urlencoded() instead guarantees req.body is already parsed. Sensitive
// fields are stripped via logger.js's `redact` config, not here.
export function bodyLoggerMiddleware(req, res, next) {
  if (req.body && Object.keys(req.body).length > 0) {
    logger.info({ body: req.body }, "request body");
  }
  next();
}
