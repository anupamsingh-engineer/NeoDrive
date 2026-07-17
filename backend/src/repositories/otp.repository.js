import OTP from "../models/otp.model.js";

export async function upsertOtp(email, otp) {
  return OTP.findOneAndUpdate(
    { email },
    { otp, createdAt: new Date(), attemptCount: 0 },
    { upsert: true, new: true }
  );
}

export async function findByEmail(email) {
  return OTP.findOne({ email });
}

export async function findByEmailAndOtp(email, otp) {
  return OTP.findOne({ email, otp });
}

export async function incrementAttempt(email) {
  return OTP.findOneAndUpdate({ email }, { $inc: { attemptCount: 1 } }, { new: true });
}

export async function deleteByEmail(email) {
  return OTP.deleteOne({ email });
}
