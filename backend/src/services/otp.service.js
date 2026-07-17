import crypto from "node:crypto";
import env from "../config/env.js";
import { ApiError } from "../errors/ApiError.js";
import * as otpRepository from "../repositories/otp.repository.js";
import { enqueueOtpEmail } from "../queues/email.queue.js";
import * as cacheService from "./cache.service.js";

function cooldownKey(email) {
  return `otp:cooldown:${email}`;
}

function generateOtp() {
  // crypto.randomInt avoids modulo bias that Math.random()-based generation has.
  return crypto.randomInt(100000, 1000000).toString();
}

export async function requestOtp(email) {
  const canSend = await cacheService.setNX(cooldownKey(email), "1", env.otp.resendCooldownSeconds);
  if (!canSend) {
    throw new ApiError(429, "Please wait before requesting another OTP");
  }

  const otp = generateOtp();
  console.log("🚀 ~ requestOtp ~ otp:", otp)
  await otpRepository.upsertOtp(email, otp);
  await enqueueOtpEmail(email, otp);

  return { message: `OTP sent successfully to ${email}` };
}

export async function verifyOtpOnly(email, otp) {
  const record = await otpRepository.findByEmail(email);
  if (!record) throw ApiError.badRequest("Invalid or expired OTP");

  if (record.attemptCount >= env.otp.maxVerifyAttempts) {
    await otpRepository.deleteByEmail(email);
    throw ApiError.badRequest("Too many attempts, please request a new OTP");
  }

  if (record.otp !== otp) {
    await otpRepository.incrementAttempt(email);
    throw ApiError.badRequest("Invalid or expired OTP");
  }

  return true;
}

// Validates AND consumes the OTP (used by register, which must not allow OTP re-use).
export async function consumeOtp(email, otp) {
  await verifyOtpOnly(email, otp);
  await otpRepository.deleteByEmail(email);
}
