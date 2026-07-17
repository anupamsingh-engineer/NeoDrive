import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import logger from "../config/logger.js";
import redisClient from "../config/redis.js";
import { sha256 } from "../utils/hash.js";

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, username: user.name, roles: [user.role] },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiry }
  );
}

export function verifyAccessToken(token) {
  const decoded = jwt.verify(token, env.jwt.accessSecret);
  if (decoded.purpose) {
    throw new jwt.JsonWebTokenError("Token is not a valid access token");
  }
  return decoded;
}

export function signRefreshToken(userId, tokenId) {
  // jti guarantees a unique signed string per rotation even when tokenId is reused across
  // rotations and two rotations land in the same iat second - otherwise HMAC signing is
  // deterministic and would produce byte-identical tokens, breaking reuse detection.
  return jwt.sign(
    { sub: userId.toString(), tokenId: tokenId.toString(), jti: crypto.randomUUID() },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiry }
  );
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

export function signPurposeToken(userId, purpose, expiresIn) {
  return jwt.sign({ sub: userId.toString(), purpose }, env.jwt.accessSecret, { expiresIn });
}

export function verifyPurposeToken(token, expectedPurpose) {
  const decoded = jwt.verify(token, env.jwt.accessSecret);
  if (decoded.purpose !== expectedPurpose) {
    throw new jwt.JsonWebTokenError("Token purpose mismatch");
  }
  return decoded;
}

function blacklistKey(token) {
  return `auth:blacklist:${sha256(token)}`;
}

export async function blacklistAccessToken(token, decodedExp) {
  const ttlSeconds = decodedExp - Math.floor(Date.now() / 1000);
  if (ttlSeconds <= 0) return;
  try {
    await redisClient.set(blacklistKey(token), "1", "EX", ttlSeconds);
  } catch (err) {
    logger.warn({ err }, "Failed to blacklist access token, Redis unavailable");
  }
}

export async function isAccessTokenBlacklisted(token) {
  try {
    const value = await redisClient.get(blacklistKey(token));
    return value === "1";
  } catch (err) {
    logger.warn({ err }, "Blacklist check failed, Redis unavailable - failing open");
    return false;
  }
}
