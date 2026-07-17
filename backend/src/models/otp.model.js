import { model, Schema } from "mongoose";
import env from "../config/env.js";

const otpSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  otp: { type: String, required: true },
  attemptCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: env.otp.ttlSeconds },
});

const OTP = model("OTP", otpSchema);

export default OTP;
