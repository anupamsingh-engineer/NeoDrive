import { createQueueConnection } from "../config/redis.js";

// BullMQ Queue/Worker instances each need their own ioredis connection (blocking commands
// used by workers can't share a connection with request-path Redis usage).
export function getQueueConnection() {
  return createQueueConnection();
}
