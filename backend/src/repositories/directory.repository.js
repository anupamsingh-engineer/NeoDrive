import Directory from "../models/directory.model.js";

export async function findById(id) {
  return Directory.findById(id).lean();
}

export async function findByIdForUser(id, userId) {
  return Directory.findOne({ _id: id, userId }).lean();
}

export async function findChildDirectories(parentDirId) {
  return Directory.find({ parentDirId }).lean();
}

export async function findChildDirectoryIds(parentDirId) {
  return Directory.find({ parentDirId }).select("_id").lean();
}

export async function insertOne({ name, parentDirId, userId, session }) {
  const [dir] = await Directory.create([{ name, parentDirId, userId }], { session });
  return dir;
}

export async function insertRoot({ _id, name, userId, session }) {
  const [dir] = await Directory.create([{ _id, name, parentDirId: null, userId }], { session });
  return dir;
}

export async function updateName(id, userId, name) {
  return Directory.findOneAndUpdate({ _id: id, userId }, { name }, { new: true }).lean();
}

export async function deleteManyByIds(ids) {
  return Directory.deleteMany({ _id: { $in: ids } });
}

// Walks the parentDirId chain applying deltaSize; returns the list of ancestor ids touched
// (used by the caller to invalidate their listing cache entries). `stopAtId`, when given,
// stops the walk without incrementing that node - used when the caller has already handled
// that node separately (see reserveRootSize below).
export async function incrementSizeUpChain(startParentId, deltaSize, { stopAtId } = {}) {
  const touchedIds = [];
  let parentId = startParentId;

  while (parentId) {
    if (stopAtId && parentId.toString() === stopAtId.toString()) break;
    const dir = await Directory.findByIdAndUpdate(
      parentId,
      { $inc: { size: deltaSize } },
      { new: true }
    ).lean();
    if (!dir) break;
    touchedIds.push(dir._id.toString());
    parentId = dir.parentDirId;
  }

  return touchedIds;
}

// Atomic compare-and-increment: only applies `delta` if the resulting size would stay within
// `maxStorageInBytes`. This is the single point where storage quota is actually enforced -
// doing it as one atomic Mongo update (rather than a separate read-then-check-then-write)
// closes the race where two concurrent uploads could otherwise both pass a plain read check
// and jointly overshoot the quota.
export async function reserveRootSize(rootDirId, delta, maxStorageInBytes) {
  return Directory.findOneAndUpdate(
    { _id: rootDirId, size: { $lte: maxStorageInBytes - delta } },
    { $inc: { size: delta } },
    { new: true }
  ).lean();
}

export async function findAllUnderUser(userId) {
  return Directory.find({ userId }).lean();
}

export async function findAll() {
  return Directory.find({}).select("_id parentDirId size userId").lean();
}

export async function bulkSetSizes(updates) {
  if (!updates.length) return;
  await Directory.bulkWrite(
    updates.map(({ _id, size }) => ({
      updateOne: { filter: { _id }, update: { $set: { size } } },
    }))
  );
}
