import Share from "../models/share.model.js";

export async function insertOne({ token, resourceType, resourceId, ownerId }) {
  return Share.create({ token, resourceType, resourceId, ownerId });
}

export async function findByToken(token) {
  return Share.findOne({ token }).lean();
}

export async function findActiveForResource(resourceType, resourceId, ownerId) {
  return Share.findOne({ resourceType, resourceId, ownerId }).lean();
}

export async function findByIdForOwner(id, ownerId) {
  return Share.findOne({ _id: id, ownerId }).lean();
}

export async function deleteById(id) {
  return Share.findByIdAndDelete(id);
}

export async function listByOwner(ownerId) {
  return Share.find({ ownerId }).sort({ createdAt: -1 }).lean();
}

// Cascade-delete hook: removes any shares pointing at files/directories that are being
// hard-deleted, so a link never survives its underlying resource.
export async function deleteManyByResourceIds({ fileIds = [], dirIds = [] }) {
  if (!fileIds.length && !dirIds.length) return;
  await Share.deleteMany({
    $or: [
      { resourceType: "File", resourceId: { $in: fileIds } },
      { resourceType: "Directory", resourceId: { $in: dirIds } },
    ],
  });
}
