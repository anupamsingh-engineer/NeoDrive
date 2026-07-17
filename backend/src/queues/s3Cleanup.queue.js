import { Queue } from "bullmq";
import { getQueueConnection } from "./connection.js";

export const s3CleanupQueue = new Queue("s3-cleanup", { connection: getQueueConnection() });

const jobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

export async function enqueueS3Delete(key) {
  await s3CleanupQueue.add("delete-single", { key }, jobOptions);
}

export async function enqueueS3BatchDelete(keys) {
  if (!keys.length) return;
  await s3CleanupQueue.add("delete-batch", { keys }, jobOptions);
}
