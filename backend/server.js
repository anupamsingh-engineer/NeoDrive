import app from "./app.js";
import env from "./src/config/env.js";
import logger from "./src/config/logger.js";
import { connectDB, disconnectDB } from "./src/config/db.js";
import redisClient from "./src/config/redis.js";
import { initQueueProducers, closeQueueProducers } from "./src/queues/index.js";
import * as dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

await connectDB();
await initQueueProducers();

const server = app.listen(env.port, () => {
  logger.info(`Server listening on port ${env.port}`);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down gracefully`);

  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close(async () => {
    try {
      await closeQueueProducers();
      await disconnectDB();
      redisClient.disconnect();
      logger.info("Shutdown complete");
      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (err) => {
  logger.error({ err }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  process.exit(1);
});
