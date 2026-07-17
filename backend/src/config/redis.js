import Redis from "ioredis";
import env from "./env.js";
import logger from "./logger.js";

export const redisClient = new Redis(env.redis.url, {
  maxRetriesPerRequest: null,
  lazyConnect: false,
});

redisClient.on("error", (err) => logger.error({ err }, "Redis client error"));
redisClient.on("connect", () => logger.info("Redis connected"));
redisClient.on("close", () => logger.warn("Redis connection closed"));

// BullMQ requires its own connection object (no shared blocking connections across queues/workers).
export function createQueueConnection() {
  return new Redis(env.redis.url, { maxRetriesPerRequest: null });
}

export async function isRedisConnected() {
  try {
    const pong = await redisClient.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

export default redisClient;
