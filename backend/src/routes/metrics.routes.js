import express from "express";
import { asyncHandler } from "../errors/asyncHandler.js";
import { ApiError } from "../errors/ApiError.js";
import env from "../config/env.js";
import register from "../config/metrics.js";

const router = express.Router();

function requireMetricsToken(req, res, next) {
  if (!env.observability.metricsToken) return next();
  if (req.headers["x-metrics-token"] === env.observability.metricsToken) return next();
  next(ApiError.forbidden("Not authorized to access metrics"));
}

router.get(
  "/metrics",
  requireMetricsToken,
  asyncHandler(async (req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  })
);

export default router;
