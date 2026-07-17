import { s3CleanupQueue } from "./s3Cleanup.queue.js";
import { emailQueue } from "./email.queue.js";
import { directorySizeReconcileQueue, scheduleNightlyReconcile } from "./directorySizeReconcile.queue.js";
import { queueDepth } from "../config/metrics.js";
import logger from "../config/logger.js";

export const queues = [s3CleanupQueue, emailQueue, directorySizeReconcileQueue];

let depthPollingTimer;

export async function initQueueProducers() {
  await scheduleNightlyReconcile();
  startQueueDepthPolling();
}

export function startQueueDepthPolling(intervalMs = 15000) {
  depthPollingTimer = setInterval(async () => {
    for (const queue of queues) {
      try {
        const counts = await queue.getJobCounts("waiting", "delayed");
        queueDepth.set({ queue: queue.name }, (counts.waiting || 0) + (counts.delayed || 0));
      } catch (err) {
        logger.warn({ err, queue: queue.name }, "Failed to poll queue depth");
      }
    }
  }, intervalMs);
  depthPollingTimer.unref();
}

export async function closeQueueProducers() {
  clearInterval(depthPollingTimer);
  await Promise.all(queues.map((queue) => queue.close()));
}
