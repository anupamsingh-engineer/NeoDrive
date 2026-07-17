import express from "express";
import { asyncHandler } from "../errors/asyncHandler.js";
import { isDBConnected } from "../config/db.js";
import { isRedisConnected } from "../config/redis.js";

const router = express.Router();

router.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

router.get(
  "/readyz",
  asyncHandler(async (req, res) => {
    const dbOk = isDBConnected();
    const redisOk = await isRedisConnected();

    if (!dbOk || !redisOk) {
      return res.status(503).json({ status: "not_ready", db: dbOk, redis: redisOk });
    }

    res.status(200).json({ status: "ready", db: dbOk, redis: redisOk });
  })
);

export default router;
