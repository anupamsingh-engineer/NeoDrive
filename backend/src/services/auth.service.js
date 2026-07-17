import mongoose, { Types } from "mongoose";
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import logger from "../config/logger.js";
import { ApiError } from "../errors/ApiError.js";
import { TOKEN_PURPOSE } from "../config/constants.js";
import * as userRepository from "../repositories/user.repository.js";
import * as directoryRepository from "../repositories/directory.repository.js";
import * as refreshTokenRepository from "../repositories/refreshToken.repository.js";
import * as otpService from "./otp.service.js";
import { enqueuePasswordResetEmail } from "../queues/email.queue.js";
import { verifyGoogleIdToken } from "./googleAuth.service.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signPurposeToken,
  verifyPurposeToken,
  blacklistAccessToken,
} from "./token.service.js";
import { sha256 } from "../utils/hash.js";
import {
  authLoginAttemptsTotal,
  authRefreshReuseDetectedTotal,
} from "../config/metrics.js";

// Used for brand-new sessions only (register/login/google) - refresh() rotates an existing
// session's token atomically instead, see below.
async function issueNewSession(user, { userAgent, ip } = {}) {
  const activeSessions = await refreshTokenRepository.countActiveForUser(user._id);
  if (activeSessions >= env.auth.maxSessionsPerUser) {
    const oldest = await refreshTokenRepository.findOldestForUser(user._id);
    if (oldest) await refreshTokenRepository.deleteById(oldest._id);
  }

  const expiresAt = new Date(Date.now() + env.jwt.refreshExpiryMs);
  const tokenDoc = await refreshTokenRepository.create({
    userId: user._id,
    tokenHash: "pending",
    expiresAt,
    userAgent,
    ip,
  });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user._id, tokenDoc._id);
  await refreshTokenRepository.updateHash(tokenDoc._id, { tokenHash: sha256(refreshToken), expiresAt });

  return { accessToken, refreshToken };
}

async function createUserWithRootDirectory({ name, email, password, picture }) {
  const rootDirId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    await directoryRepository.insertRoot({
      _id: rootDirId,
      name: `root-${email}`,
      userId,
      session,
    });
    const user = await userRepository.createUser({
      _id: userId,
      name,
      email,
      password,
      picture,
      rootDirId,
      session,
    });
    await session.commitTransaction();
    return user;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function register({ name, email, password, otp }, requestMeta) {
  await otpService.consumeOtp(email, otp);

  const existing = await userRepository.findByEmail(email);
  if (existing) throw ApiError.conflict("This email already exists");

  const user = await createUserWithRootDirectory({ name, email, password });
  const tokens = await issueNewSession(user, requestMeta);

  return { user: user.toSafeJSON(), ...tokens };
}

export async function login({ email, password }, requestMeta) {
  const user = await userRepository.findByEmailWithPassword(email);

  if (!user || user.deleted) {
    authLoginAttemptsTotal.inc({ method: "password", result: "failure" });
    throw ApiError.unauthorized("Invalid credentials");
  }

  if (user.isLocked) {
    authLoginAttemptsTotal.inc({ method: "password", result: "locked" });
    throw ApiError.forbidden("Account locked due to too many failed attempts, try again later");
  }

  if (!user.password) {
    throw ApiError.badRequest("This account uses Google sign-in, please continue with Google");
  }

  const isValid = await user.comparePassword(password);
  if (!isValid) {
    const updated = await userRepository.incrementLoginAttempts(user._id);
    if (updated.loginAttempts >= env.auth.maxLoginAttempts) {
      await userRepository.lockAccount(user._id, new Date(Date.now() + env.auth.lockDurationMs));
    }
    authLoginAttemptsTotal.inc({ method: "password", result: "failure" });
    throw ApiError.unauthorized("Invalid credentials");
  }

  await userRepository.resetLoginAttempts(user._id);
  authLoginAttemptsTotal.inc({ method: "password", result: "success" });

  const tokens = await issueNewSession(user, requestMeta);
  return { user: user.toSafeJSON(), ...tokens };
}

export async function loginWithGoogle(idToken, requestMeta) {
  const payload = await verifyGoogleIdToken(idToken);
  const { name, email, picture } = payload;

  const existing = await userRepository.findByEmail(email);

  if (existing) {
    if (existing.deleted) {
      authLoginAttemptsTotal.inc({ method: "google", result: "failure" });
      throw ApiError.forbidden("Your account has been deleted. Contact app owner to recover.");
    }

    if (!existing.picture?.includes("googleusercontent.com")) {
      await userRepository.updatePicture(existing._id, picture);
    }

    authLoginAttemptsTotal.inc({ method: "google", result: "success" });
    const userDoc = await userRepository.findByIdDocument(existing._id);
    const tokens = await issueNewSession(userDoc, requestMeta);
    return { user: userDoc.toSafeJSON(), isNewUser: false, ...tokens };
  }

  const user = await createUserWithRootDirectory({ name, email, picture });
  authLoginAttemptsTotal.inc({ method: "google", result: "success" });
  const tokens = await issueNewSession(user, requestMeta);
  return { user: user.toSafeJSON(), isNewUser: true, ...tokens };
}

// Two concurrent refresh calls for the same not-yet-rotated token would otherwise both pass
// the hash check and race to overwrite the same document - whichever write lands second wins,
// and the other request's returned token now has a hash that will never match again, making a
// completely benign race indistinguishable from theft. This window covers that: a mismatch
// against a hash that moved only moments ago is treated as "please retry", not "revoke everything".
const REFRESH_RACE_GRACE_MS = 3000;

export async function refresh(refreshTokenRaw, requestMeta) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshTokenRaw);
  } catch {
    throw ApiError.unauthorized("Invalid or expired session, please log in again");
  }

  const tokenDoc = await refreshTokenRepository.findById(decoded.tokenId);

  if (!tokenDoc || tokenDoc.userId.toString() !== decoded.sub) {
    throw ApiError.unauthorized("Invalid or expired session, please log in again");
  }

  const incomingHash = sha256(refreshTokenRaw);
  if (incomingHash !== tokenDoc.tokenHash) {
    const rotatedMomentsAgo = Date.now() - tokenDoc.updatedAt.getTime() < REFRESH_RACE_GRACE_MS;
    if (rotatedMomentsAgo) {
      throw ApiError.conflict("Token already refreshed, please retry");
    }
    // Reuse of an already-rotated refresh token: treat as theft, nuke every session.
    logger.warn({ userId: decoded.sub }, "Refresh token reuse detected - revoking all sessions");
    authRefreshReuseDetectedTotal.inc();
    await refreshTokenRepository.deleteAllForUser(decoded.sub);
    await userRepository.bumpTokensValidAfter(decoded.sub);
    throw ApiError.unauthorized("Session invalid, please log in again");
  }

  const user = await userRepository.findByIdDocument(decoded.sub);
  if (!user || user.deleted) throw ApiError.unauthorized("Account no longer exists");

  const expiresAt = new Date(Date.now() + env.jwt.refreshExpiryMs);
  const accessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user._id, tokenDoc._id);

  const rotated = await refreshTokenRepository.rotateIfMatches(tokenDoc._id, tokenDoc.tokenHash, {
    tokenHash: sha256(newRefreshToken),
    expiresAt,
  });

  if (!rotated) {
    // Lost the atomic compare-and-swap to a concurrent refresh call reading the same hash.
    throw ApiError.conflict("Token already refreshed, please retry");
  }

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout({ accessToken, refreshTokenRaw }) {
  if (accessToken) {
    const decoded = jwt.decode(accessToken);
    if (decoded?.exp) await blacklistAccessToken(accessToken, decoded.exp);
  }

  if (refreshTokenRaw) {
    try {
      const decoded = verifyRefreshToken(refreshTokenRaw);
      await refreshTokenRepository.deleteById(decoded.tokenId);
    } catch {
      // already invalid/expired, nothing to clean up
    }
  }
}

export async function logoutAll(userId) {
  await refreshTokenRepository.deleteAllForUser(userId);
  await userRepository.bumpTokensValidAfter(userId);
}

export async function forgotPassword(email) {
  const user = await userRepository.findByEmail(email);

  if (user && !user.deleted) {
    const resetToken = signPurposeToken(user._id, TOKEN_PURPOSE.PASSWORD_RESET, env.jwt.passwordResetExpiry);
    await enqueuePasswordResetEmail(email, resetToken).catch((err) => {
      logger.error({ err, email }, "Failed to enqueue password reset email");
    });
  }

  // Always report success so this endpoint can't be used to enumerate registered emails.
  return { message: "If an account with that email exists, a reset link has been sent." };
}

export async function resetPassword(token, newPassword) {
  let decoded;
  try {
    decoded = verifyPurposeToken(token, TOKEN_PURPOSE.PASSWORD_RESET);
  } catch {
    throw ApiError.badRequest("Invalid or expired reset token");
  }

  const user = await userRepository.findByIdDocument(decoded.sub);
  if (!user || user.deleted) throw ApiError.badRequest("Invalid or expired reset token");

  user.password = newPassword;
  await user.save();

  await refreshTokenRepository.deleteAllForUser(user._id);
  await userRepository.bumpTokensValidAfter(user._id);

  return { message: "Password has been reset, please log in again" };
}
