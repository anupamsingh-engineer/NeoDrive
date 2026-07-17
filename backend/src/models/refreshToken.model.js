import { model, Schema } from "mongoose";

// One document per issued refresh token (i.e. per device/session).
// Only the SHA-256 hash of the raw token is ever persisted, never the token itself.
// `timestamps: true` gives us `updatedAt`, which the rotation race-window check in
// auth.service.js relies on to tell "just rotated by a concurrent request" apart from
// "replay of a genuinely stale token".
const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = model("RefreshToken", refreshTokenSchema);

export default RefreshToken;
