import RefreshToken from "../models/refreshToken.model.js";

export async function create({ userId, tokenHash, expiresAt, userAgent, ip }) {
  return RefreshToken.create({ userId, tokenHash, expiresAt, userAgent, ip });
}

export async function findById(id) {
  return RefreshToken.findById(id);
}

export async function deleteById(id) {
  return RefreshToken.findByIdAndDelete(id);
}

export async function updateHash(id, { tokenHash, expiresAt }) {
  return RefreshToken.findByIdAndUpdate(id, { tokenHash, expiresAt }, { new: true });
}

// Atomic compare-and-swap: only rotates if `currentHash` still matches what's stored, so two
// concurrent refresh calls for the same token can't both "win" and silently clobber each
// other's hash (which would make the loser's new token look like a replay on its next use).
export async function rotateIfMatches(id, currentHash, { tokenHash, expiresAt }) {
  return RefreshToken.findOneAndUpdate(
    { _id: id, tokenHash: currentHash },
    { tokenHash, expiresAt },
    { new: true }
  );
}

export async function deleteAllForUser(userId) {
  return RefreshToken.deleteMany({ userId });
}

export async function countActiveForUser(userId) {
  return RefreshToken.countDocuments({ userId });
}

export async function findOldestForUser(userId) {
  return RefreshToken.findOne({ userId }).sort({ createdAt: 1 });
}

export async function distinctUserIdsWithActiveSessions() {
  return RefreshToken.distinct("userId");
}
