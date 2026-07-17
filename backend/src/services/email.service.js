import { Resend } from "resend";
import env from "../config/env.js";
import logger from "../config/logger.js";

const resend = new Resend(env.resend.apiKey);

export async function sendOtpEmail(email, otp) {
  const html = `
    <div style="font-family:sans-serif;">
      <h2>Your OTP is: ${otp}</h2>
      <p>This OTP is valid for ${Math.floor(env.otp.ttlSeconds / 60)} minutes.</p>
    </div>
  `;

  await resend.emails.send({
    from: env.resend.fromAddress,
    to: email,
    subject: "Storage App OTP",
    html,
  });
  logger.info({ email }, "OTP email sent");
}

export async function sendPasswordResetEmail(email, resetToken) {
  const html = `
    <div style="font-family:sans-serif;">
      <h2>Reset your password</h2>
      <p>Use this token to reset your password (valid for ${env.jwt.passwordResetExpiry}):</p>
      <code>${resetToken}</code>
    </div>
  `;

  await resend.emails.send({
    from: env.resend.fromAddress,
    to: email,
    subject: "Storage App Password Reset",
    html,
  });
  logger.info({ email }, "Password reset email sent");
}
