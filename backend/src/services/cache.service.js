import redisClient from "../config/redis.js";
import logger from "../config/logger.js";
import { cacheHitTotal, cacheMissTotal } from "../config/metrics.js";

// Cache-aside with fail-open semantics: any Redis error is logged and treated as a miss,
// so a Redis outage degrades to "always hit the DB" rather than breaking reads.
export async function getOrSet(cacheName, key, ttlSeconds, fetcher) {
  try {
    const cached = await redisClient.get(key);
    if (cached !== null) {
      cacheHitTotal.inc({ cache: cacheName });
      return JSON.parse(cached);
    }
  } catch (err) {
    logger.warn({ err, key }, "Cache read failed, falling through to source");
  }

  cacheMissTotal.inc({ cache: cacheName });
  const value = await fetcher();

  try {
    if (value !== undefined && value !== null) {
      await redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
    }
  } catch (err) {
    logger.warn({ err, key }, "Cache write failed");
  }

  return value;
}

export async function invalidate(...keys) {
  if (!keys.length) return;
  try {
    await redisClient.del(...keys);
  } catch (err) {
    logger.warn({ err, keys }, "Cache invalidation failed");
  }
}

export const DIR_LISTING_CACHE_TTL_SECONDS = 45;

// Single source of truth for the directory-listing cache key format, shared by
// directory.service.js, file.service.js, and the size-reconciliation worker so the three
// write paths that touch directory sizes can't drift out of sync with each other.
export function directoryListingCacheKey(userId, dirId) {
  return `dir:listing:${userId}:${dirId}`;
}

export async function invalidateDirectoryListings(userId, ...dirIds) {
  const keys = dirIds.filter(Boolean).map((id) => directoryListingCacheKey(userId, id));
  await invalidate(...keys);
}

export async function get(key) {
  try {
    return await redisClient.get(key);
  } catch (err) {
    logger.warn({ err, key }, "Cache read failed");
    return null;
  }
}

export async function set(key, value, ttlSeconds) {
  try {
    await redisClient.set(key, value, "EX", ttlSeconds);
  } catch (err) {
    logger.warn({ err, key }, "Cache write failed");
  }
}

export async function setNX(key, value, ttlSeconds) {
  try {
    const result = await redisClient.set(key, value, "EX", ttlSeconds, "NX");
    return result === "OK";
  } catch (err) {
    logger.warn({ err, key }, "Cache setNX failed, allowing operation through");
    return true;
  }
}
