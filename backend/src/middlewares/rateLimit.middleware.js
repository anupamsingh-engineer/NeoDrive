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
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("auth"),
  keyGenerator: (req) => `${req.ip}:${req.body?.email || ""}`,
  handler,
});

// Separate from authLimiter: refresh has no email in its body (so it'd otherwise collapse
// into one shared per-IP bucket with every other credential-less auth request) and is called
// automatically and often - on every 401, on a polling interval, and twice per mount under
// React StrictMode in dev - so it needs a much higher budget than the brute-force-login limit.
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("refresh"),
  keyGenerator: (req) => req.ip,
  handler,
});
// 60 requests per minute per user for file uploads, which is a reasonable limit for most users while still preventing abuse.
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("upload"),
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  handler,
});

// Per-user, for creating share links - mirrors uploadLimiter's shape.
export const shareCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("shareCreate"),
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  handler,
});

// Per-IP: the public share-resolution/download endpoints are unauthenticated, so token
// guessing/scraping risk is bounded by IP rather than by user (mirrors refreshLimiter's shape).
export const shareResolveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("shareResolve"),
  keyGenerator: (req) => req.ip,
  handler,
});

// Per-user, low budget: unlike every other download in this app, a folder zip actually reads
// file bytes through this server (see directory.service.js's prepareDirectoryZip), so it's the
// one download path that can meaningfully load the API process itself if hammered.
export const directoryDownloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("directoryDownload"),
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  handler,
});

// Per-IP and tighter than directoryDownloadLimiter above: this is the same server-load concern
// (zip-building reads real file bytes through this process) but on the fully public /s/* surface,
// where there's no authenticated user id to key on - only an IP, a weaker identity signal more
// easily shared across legitimate visitors (NAT, corporate proxies), so the budget is kept small.
export const shareDirectoryDownloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("shareDirDownload"),
  keyGenerator: (req) => req.ip,
  handler,
});
