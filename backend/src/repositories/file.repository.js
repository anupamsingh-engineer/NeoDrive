import File from "../models/file.model.js";

export async function findById(id) {
  return File.findById(id).lean();
}

export async function findByIdDocument(id) {
  return File.findById(id);
}

export async function findByIdForUser(id, userId) {
  return File.findOne({ _id: id, userId }).lean();
}

export async function findByIdForUserDocument(id, userId) {
  return File.findOne({ _id: id, userId });
}

export async function findByParentDir(parentDirId) {
  return File.find({ parentDirId }).lean();
}

export async function findExtensionsByParentDir(parentDirId) {
  return File.find({ parentDirId }).select("extension").lean();
}

export async function insertOne(data) {
  return File.create(data);
}

export async function updateName(id, userId, name) {
  return File.findOneAndUpdate({ _id: id, userId }, { name }, { new: true }).lean();
}

export async function deleteById(id) {
  return File.findByIdAndDelete(id);
}

export async function deleteManyByIds(ids) {
  return File.deleteMany({ _id: { $in: ids } });
}

export async function markUploadComplete(id) {
  return File.findByIdAndUpdate(id, { isUploading: false }).lean();
}

export async function aggregateSizeByParentDir() {
  return File.aggregate([
    { $match: { isUploading: false } },
    { $group: { _id: "$parentDirId", total: { $sum: "$size" } } },
  ]);
}
