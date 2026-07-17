import { Worker } from "bullmq";
import { getQueueConnection } from "./connection.js";
import * as s3Storage from "../services/storage/s3.storage.js";
import logger from "../config/logger.js";

export const s3CleanupWorker = new Worker(
  "s3-cleanup",
  async (job) => {
    if (job.name === "delete-single") {
      await s3Storage.deleteFile(job.data.key);
    } else if (job.name === "delete-batch") {
      await s3Storage.deleteFiles(job.data.keys);
    }
  },
  { connection: getQueueConnection(), concurrency: 5 }
);

s3CleanupWorker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id, jobName: job?.name }, "s3-cleanup job failed");
});
