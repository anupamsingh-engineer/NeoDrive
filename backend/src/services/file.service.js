import path from "node:path";
import { lookup } from "mime-types";
import { ApiError } from "../errors/ApiError.js";
import logger from "../config/logger.js";
import * as fileRepository from "../repositories/file.repository.js";
import * as directoryRepository from "../repositories/directory.repository.js";
import * as userRepository from "../repositories/user.repository.js";
import * as shareRepository from "../repositories/share.repository.js";
import * as storageOps from "./file.storageOps.js";
import { objectKey } from "./file.storageOps.js";
import * as s3Storage from "./storage/s3.storage.js";
import * as cloudfrontStorage from "./storage/cloudfront.storage.js";
import { invalidateDirectoryListings } from "./cache.service.js";
import {
  fileUploadInitiatedTotal,
  fileUploadCompletedTotal,
  fileUploadFailedTotal,
  fileUploadDuration,
} from "../config/metrics.js";

const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".sh", ".msi", ".dll", ".scr", ".com", ".ps1", ".vbs", ".jar",
]);

export async function getFileDownloadUrl(userId, id, action) {
  const fileData = await fileRepository.findByIdForUser(id, userId);
  if (!fileData) throw ApiError.notFound("File not found!");

  const key = objectKey(id, fileData.extension);
  return cloudfrontStorage.createGetSignedUrl({
    key,
    download: action === "download",
    filename: fileData.name,
  });
}

export async function renameFile(userId, id, newFilename) {
  const updated = await fileRepository.updateName(id, userId, newFilename);
  if (!updated) throw ApiError.notFound("File not found!");

  await invalidateDirectoryListings(userId, updated.parentDirId);
  return { message: "Renamed" };
}

export async function deleteFile(userId, id) {
  const file = await fileRepository.findByIdForUser(id, userId);
  if (!file) throw ApiError.notFound("File not found!");

  await fileRepository.deleteById(id);
  await shareRepository.deleteManyByResourceIds({ fileIds: [id] });
  // Size is reserved at uploadInitiate time (see below), not at uploadComplete, so it must be
  // released here regardless of the file's isUploading status - it was already counted either way.
  const touchedIds = await directoryRepository.incrementSizeUpChain(file.parentDirId, -file.size);
  await storageOps.scheduleS3Delete(objectKey(file._id, file.extension));
  await invalidateDirectoryListings(userId, file.parentDirId, ...touchedIds);

  return { message: "File Deleted Successfully" };
}

export async function uploadInitiate(userId, rootDirId, { parentDirId, name, size, contentType }) {
  const parentId = parentDirId || rootDirId.toString();

  const [parentDirData, user] = await Promise.all([
    directoryRepository.findByIdForUser(parentId, userId),
    userRepository.findById(userId),
  ]);
  if (!parentDirData) throw ApiError.notFound("Parent directory not found!");

  const filename = name || "untitled";
  const extension = path.extname(filename).toLowerCase();

  if (BLOCKED_EXTENSIONS.has(extension)) {
    throw ApiError.badRequest(`File type "${extension}" is not allowed`);
  }

  const expectedType = lookup(extension);
  if (expectedType && contentType && expectedType !== contentType) {
    logger.warn({ userId, filename, contentType, expectedType }, "Upload contentType/extension mismatch");
  }

  // Quota is reserved atomically on the root directory right now, rather than checked via a
  // separate read-then-compare - otherwise two concurrent uploadInitiate calls could both read
  // the same not-yet-updated rootDir.size, both pass the check, and jointly exceed the quota
  // once both uploads complete.
  const updatedRoot = await directoryRepository.reserveRootSize(rootDirId, size, user.maxStorageInBytes);
  if (!updatedRoot) {
    throw ApiError.insufficientStorage("Not enough storage.");
  }

  // Reserve the same bytes on every intermediate ancestor between the target folder and root
  // (root itself was just handled atomically above, so the walk stops there).
  const touchedIds = await directoryRepository.incrementSizeUpChain(parentDirData._id, size, {
    stopAtId: rootDirId,
  });

  let insertedFile;
  try {
    insertedFile = await fileRepository.insertOne({
      extension,
      name: filename,
      size,
      parentDirId: parentDirData._id,
      userId,
      isUploading: true,
    });

    const uploadSignedUrl = await s3Storage.createUploadSignedUrl({
      key: objectKey(insertedFile._id, extension),
      contentType,
    });

    await invalidateDirectoryListings(userId, parentDirData._id.toString(), rootDirId.toString(), ...touchedIds);
    fileUploadInitiatedTotal.inc();

    return { uploadSignedUrl, fileId: insertedFile._id };
  } catch (err) {
    // Roll back the whole reservation (root + intermediate ancestors) on ANY failure past
    // this point - including the S3 presigned-URL call, not just the DB insert - since the
    // reservation is now made up front and nothing else will ever release it otherwise.
    if (insertedFile) await fileRepository.deleteById(insertedFile._id);
    await directoryRepository.incrementSizeUpChain(parentDirData._id, -size);
    throw err;
  }
}

async function releaseReservation(userId, file, reason) {
  await file.deleteOne();
  // The S3 object may or may not exist depending on how far the client got (verification_failed
  // vs size_mismatch) - schedule the delete unconditionally, a delete on a missing key is a no-op.
  await storageOps.scheduleS3Delete(objectKey(file._id, file.extension));
  const touchedIds = await directoryRepository.incrementSizeUpChain(file.parentDirId, -file.size);
  await invalidateDirectoryListings(userId, file.parentDirId.toString(), ...touchedIds);
  fileUploadFailedTotal.inc({ reason });
}

export async function uploadComplete(userId, fileId) {
  const file = await fileRepository.findByIdDocument(fileId);
  if (!file || file.userId.toString() !== userId.toString()) {
    throw ApiError.notFound("File not found in our records");
  }

  let fileMetadata;
  try {
    fileMetadata = await s3Storage.getFileMetadata(objectKey(file._id, file.extension));
  } catch (err) {
    await releaseReservation(userId, file, "verification_failed");
    throw ApiError.notFound("File could not be uploaded properly.");
  }

  if (fileMetadata.ContentLength !== file.size) {
    await releaseReservation(userId, file, "size_mismatch");
    throw ApiError.badRequest("File size does not match.");
  }

  // Size was already reserved at uploadInitiate time - nothing left to increment here.
  file.isUploading = false;
  await file.save();

  await invalidateDirectoryListings(userId, file.parentDirId.toString());

  fileUploadCompletedTotal.inc();
  fileUploadDuration.observe((Date.now() - file.createdAt.getTime()) / 1000);
  return { message: "Upload completed" };
}
