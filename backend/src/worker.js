import logger from "./config/logger.js";
import { connectDB, disconnectDB } from "./config/db.js";
import redisClient from "./config/redis.js";
import { s3CleanupWorker } from "./queues/s3Cleanup.worker.js";
import { emailWorker } from "./queues/email.worker.js";
import { directorySizeReconcileWorker } from "./queues/directorySizeReconcile.worker.js";

await connectDB();

const workers = [s3CleanupWorker, emailWorker, directorySizeReconcileWorker];
logger.info({ workerCount: workers.length }, "Worker process started");

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down worker gracefully`);

  const forceExitTimer = setTimeout(() => process.exit(1), 10_000);
  forceExitTimer.unref();

  await Promise.all(workers.map((worker) => worker.close()));
  await disconnectDB();
  redisClient.disconnect();
  clearTimeout(forceExitTimer);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (err) => {
  logger.error({ err }, "Unhandled promise rejection in worker");
});
