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

  // The Resend SDK resolves to { data, error } instead of throwing on API errors - without
  // checking `error` explicitly, a rejected send (bad domain, invalid key, etc.) would
  // silently fall through as if it succeeded.
  const { error } = await resend.emails.send({
    from: env.resend.fromAddress,
    to: email,
    subject: "NeoDrive OTP",
    html,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
  logger.info({ email }, "OTP email sent");
}

export async function sendPasswordResetEmail(email, resetToken) {
  // Must exactly match the frontend's reset-password route (pages/public/ResetPassword reads
  // the token via useSearchParams().get("token")) - see frontend/docs/routing-and-pages.md.
  const resetUrl = `${env.frontend.url}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;

  const html = `
    <div style="font-family:sans-serif;">
      <h2>Reset your password</h2>
      <p>Click the button below to reset your password (valid for ${env.jwt.passwordResetExpiry}):</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#5a55f0;color:#ffffff;text-decoration:none;border-radius:6px;">
          Reset Password
        </a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: env.resend.fromAddress,
    to: email,
    subject: "NeoDrive Password Reset",
    html,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
  logger.info({ email }, "Password reset email sent");
}
