import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redisClient from "../config/redis.js";
import { ApiError } from "../errors/ApiError.js";

function makeStore(prefix) {
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (...args) => redisClient.call(...args),
  });
}

function handler(req, res, next) {
  next(new ApiError(429, "Too many requests, please try again later"));
}

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("global"),
  handler,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("auth"),
  keyGenerator: (req) => `${req.ip}:${req.body?.email || ""}`,
  handler,
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("upload"),
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  handler,
});
