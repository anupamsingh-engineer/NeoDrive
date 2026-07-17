import { Queue } from "bullmq";
import { getQueueConnection } from "./connection.js";

export const directorySizeReconcileQueue = new Queue("directory-size-reconcile", {
  connection: getQueueConnection(),
});

const NIGHTLY_JOB_ID = "nightly-reconcile";

export async function scheduleNightlyReconcile() {
  await directorySizeReconcileQueue.add(
    "reconcile",
    {},
    {
      jobId: NIGHTLY_JOB_ID,
      repeat: { pattern: "0 2 * * *" }, // 02:00 daily
      removeOnComplete: 10,
      removeOnFail: 10,
    }
  );
}
