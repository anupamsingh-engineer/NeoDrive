import { Worker } from "bullmq";
import { getQueueConnection } from "./connection.js";
import * as emailService from "../services/email.service.js";
import logger from "../config/logger.js";

export const emailWorker = new Worker(
  "email",
  async (job) => {
    if (job.name === "send-otp") {
      await emailService.sendOtpEmail(job.data.email, job.data.otp);
    } else if (job.name === "send-password-reset") {
      await emailService.sendPasswordResetEmail(job.data.email, job.data.resetToken);
    }
  },
  { connection: getQueueConnection(), concurrency: 10 }
);

emailWorker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id, jobName: job?.name }, "email job failed");
});
