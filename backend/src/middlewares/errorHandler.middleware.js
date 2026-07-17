import { ApiError } from "../errors/ApiError.js";
import logger from "../config/logger.js";
import env from "../config/env.js";

export function errorHandlerMiddleware(err, req, res, next) {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) logger.error({ err }, err.message);
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

  logger.error({ err }, "Unhandled error");
  return res.status(500).json({
    success: false,
    message: env.isProduction ? "Something went wrong" : err.message,
  });
}
