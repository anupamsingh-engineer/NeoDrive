import { ApiError } from "../errors/ApiError.js";
import * as userRepository from "../repositories/user.repository.js";
import * as directoryRepository from "../repositories/directory.repository.js";
import * as refreshTokenRepository from "../repositories/refreshToken.repository.js";
import * as cacheService from "./cache.service.js";

const PROFILE_CACHE_TTL_SECONDS = 300;

function profileCacheKey(userId) {
  return `user:profile:${userId}`;
}

export async function invalidateProfileCache(userId) {
  await cacheService.invalidate(profileCacheKey(userId));
}

export async function getCurrentUser(userId) {
  const user = await cacheService.getOrSet(
    "user_profile",
    profileCacheKey(userId),
    PROFILE_CACHE_TTL_SECONDS,
    () => userRepository.findById(userId)
  );

  if (!user) throw ApiError.notFound("User not found");

  const rootDir = await directoryRepository.findById(user.rootDirId);

  return {
    name: user.name,
    email: user.email,
    picture: user.picture,
    role: user.role,
    maxStorageInBytes: user.maxStorageInBytes,
    usedStorageInBytes: rootDir?.size ?? 0,
  };
}

export async function getAllUsers({ page, limit }) {
  const skip = (page - 1) * limit;

  const [users, total, activeUserIds] = await Promise.all([
    userRepository.findAllActive({ skip, limit }),
    userRepository.countActive(),
    refreshTokenRepository.distinctUserIdsWithActiveSessions(),
  ]);

  const activeSet = new Set(activeUserIds.map((id) => id.toString()));

  return {
    users: users.map((user) => ({
      id: user._id,
      name: user.name,
      email: user.email,
      isLoggedIn: activeSet.has(user._id.toString()),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function logoutUserById(targetUserId) {
  await refreshTokenRepository.deleteAllForUser(targetUserId);
  await userRepository.bumpTokensValidAfter(targetUserId);
}

export async function deleteUser(targetUserId, requestingUserId) {
  if (targetUserId.toString() === requestingUserId.toString()) {
    throw ApiError.forbidden("You can not delete yourself.");
  }

  await refreshTokenRepository.deleteAllForUser(targetUserId);
  await userRepository.bumpTokensValidAfter(targetUserId);
  await userRepository.softDelete(targetUserId);
  await invalidateProfileCache(targetUserId);
}
