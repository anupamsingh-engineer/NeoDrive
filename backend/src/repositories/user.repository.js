import User from "../models/user.model.js";

export async function findByEmail(email) {
  return User.findOne({ email }).lean();
}

export async function findByEmailWithPassword(email) {
  return User.findOne({ email }).select("+password");
}

export async function findById(id) {
  return User.findById(id).lean();
}

export async function findByIdDocument(id) {
  return User.findById(id);
}

export async function createUser({ _id, name, email, password, picture, rootDirId, session }) {
  const [user] = await User.create([{ _id, name, email, password, picture, rootDirId }], {
    session,
  });
  return user;
}

export async function findAllActive({ skip, limit } = {}) {
  return User.find({ deleted: false }).select("name email").skip(skip).limit(limit).lean();
}

export async function countActive() {
  return User.countDocuments({ deleted: false });
}

export async function updateProfile(id, updates) {
  return User.findByIdAndUpdate(id, updates, { new: true }).lean();
}

export async function updatePicture(id, picture) {
  return User.findByIdAndUpdate(id, { picture }).lean();
}

export async function updatePassword(id, password) {
  const user = await User.findById(id);
  user.password = password;
  await user.save();
  return user;
}

export async function updateMaxStorageBytes(id, maxStorageInBytes) {
  return User.findByIdAndUpdate(id, { maxStorageInBytes }).lean();
}

export async function incrementLoginAttempts(id) {
  return User.findByIdAndUpdate(id, { $inc: { loginAttempts: 1 } }, { new: true }).lean();
}

export async function lockAccount(id, lockUntil) {
  return User.findByIdAndUpdate(id, { lockUntil, loginAttempts: 0 }).lean();
}

export async function resetLoginAttempts(id) {
  return User.findByIdAndUpdate(id, { loginAttempts: 0, lockUntil: null }).lean();
}

export async function bumpTokensValidAfter(id, when = new Date()) {
  return User.findByIdAndUpdate(id, { tokensValidAfter: when }).lean();
}

export async function softDelete(id) {
  return User.findByIdAndUpdate(id, { deleted: true }).lean();
}
