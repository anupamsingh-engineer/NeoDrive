import { ApiError } from "../errors/ApiError.js";
import { asyncHandler } from "../errors/asyncHandler.js";
import { verifyAccessToken, isAccessTokenBlacklisted } from "../services/token.service.js";
import * as userRepository from "../repositories/user.repository.js";
import { COOKIE_NAMES } from "../config/constants.js";
import { setUserId } from "../config/requestContext.js";

function extractToken(req) {
  if (req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN]) return req.cookies[COOKIE_NAMES.ACCESS_TOKEN];
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return null;
}

export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized("Not logged in");

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized("Invalid or expired session");
  }

  // Independent lookups (blacklist only needs the token, user lookup only needs the sub claim).
  const [isBlacklisted, user] = await Promise.all([
    isAccessTokenBlacklisted(token),
    userRepository.findById(decoded.sub),
  ]);

  if (isBlacklisted) {
    throw ApiError.unauthorized("Session has been logged out");
  }

  if (!user || user.deleted) {
    throw ApiError.unauthorized("Account no longer exists");
  }

  if (user.tokensValidAfter && decoded.iat * 1000 < new Date(user.tokensValidAfter).getTime()) {
    throw ApiError.unauthorized("Session has been revoked, please log in again");
  }

  req.user = {
    _id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    rootDirId: user.rootDirId,
    maxStorageInBytes: user.maxStorageInBytes,
  };
  req.authToken = token;
  setUserId(user._id.toString());

  next();
});
