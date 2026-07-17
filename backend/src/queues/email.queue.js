import { Queue } from "bullmq";
import { getQueueConnection } from "./connection.js";

export const emailQueue = new Queue("email", { connection: getQueueConnection() });

const jobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 3000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

export async function enqueueOtpEmail(email, otp) {
  await emailQueue.add("send-otp", { email, otp }, jobOptions);
}

export async function enqueuePasswordResetEmail(email, resetToken) {
  await emailQueue.add("send-password-reset", { email, resetToken }, jobOptions);
}
