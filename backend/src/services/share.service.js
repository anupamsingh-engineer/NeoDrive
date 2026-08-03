import crypto from "node:crypto";
import env from "../config/env.js";
import { ApiError } from "../errors/ApiError.js";
import * as shareRepository from "../repositories/share.repository.js";
import * as fileRepository from "../repositories/file.repository.js";
import * as directoryRepository from "../repositories/directory.repository.js";
import * as cloudfrontStorage from "./storage/cloudfront.storage.js";
import { objectKey } from "./file.storageOps.js";

const RESOURCE_TYPE_MODEL = { file: "File", directory: "Directory" };

// Generic message for every "this link doesn't work" case (missing, revoked, or pointing at a
// deleted resource) - deliberately doesn't distinguish why, so a visitor probing tokens can't
// use the response to confirm a token was ever valid.
const LINK_INVALID_MESSAGE = "This link is invalid or has been revoked";

function toShareResponse(share) {
  return {
    id: share._id,
    token: share.token,
    url: `${env.frontend.url}/s/${share.token}`,
    resourceType: share.resourceType === "File" ? "file" : "directory",
    resourceId: share.resourceId,
    createdAt: share.createdAt,
  };
}

export async function createShare(ownerId, rootDirId, { resourceType, resourceId }) {
  const dbResourceType = RESOURCE_TYPE_MODEL[resourceType];

  // Mirrors deleteDirectory's root guard: one accidental share shouldn't expose the whole
  // account's contents.
  if (dbResourceType === "Directory" && resourceId === rootDirId.toString()) {
    throw ApiError.badRequest("Cannot share your root directory");
  }

  const owned =
    dbResourceType === "File"
      ? await fileRepository.findByIdForUser(resourceId, ownerId)
      : await directoryRepository.findByIdForUser(resourceId, ownerId);
  if (!owned) throw ApiError.notFound(dbResourceType === "File" ? "File not found!" : "Directory not found!");

  // Idempotent: re-opening the Share modal for the same resource returns the existing link
  // instead of minting a new one and orphaning the old one every time.
  const existing = await shareRepository.findActiveForResource(dbResourceType, resourceId, ownerId);
  if (existing) return toShareResponse(existing);

  const token = crypto.randomBytes(32).toString("base64url");
  const share = await shareRepository.insertOne({ token, resourceType: dbResourceType, resourceId, ownerId });
  return toShareResponse(share);
}

export async function listMyShares(ownerId) {
  const shares = await shareRepository.listByOwner(ownerId);

  // The Share doc only stores resourceId - look up the current name/extension for display.
  // Cascade-delete (see file/directory deleteFile/deleteDirectory) means a share should never
  // outlive its resource, so a missing lookup here would indicate that invariant broke rather
  // than an expected case - resourceName/resourceExtension come back null rather than throwing.
  const resources = await Promise.all(
    shares.map((share) =>
      share.resourceType === "File"
        ? fileRepository.findById(share.resourceId)
        : directoryRepository.findById(share.resourceId)
    )
  );

  return shares.map((share, i) => ({
    ...toShareResponse(share),
    resourceName: resources[i]?.name ?? null,
    resourceExtension: share.resourceType === "File" ? (resources[i]?.extension ?? null) : undefined,
  }));
}

export async function revokeShare(ownerId, shareId) {
  const share = await shareRepository.findByIdForOwner(shareId, ownerId);
  if (!share) throw ApiError.notFound("Share not found!");

  await shareRepository.deleteById(shareId);
  return { message: "Share revoked" };
}

export async function resolvePublicShare(token, { dirId } = {}) {
  const share = await shareRepository.findByToken(token);
  if (!share) throw ApiError.notFound(LINK_INVALID_MESSAGE);

  if (share.resourceType === "File") {
    const file = await fileRepository.findById(share.resourceId);
    if (!file) throw ApiError.notFound(LINK_INVALID_MESSAGE);

    return {
      resourceType: "file",
      file: { id: file._id, name: file.name, size: file.size, extension: file.extension },
    };
  }

  const shareRootId = share.resourceId.toString();
  const targetDirId = dirId || shareRootId;

  // Boundary check: a visitor may only navigate to the shared folder itself or one of its
  // real descendants - never to an arbitrary dirId elsewhere in the owner's drive.
  if (targetDirId !== shareRootId) {
    const ancestorsOfTarget = await directoryRepository.findAncestorChain(targetDirId);
    const withinShare = ancestorsOfTarget.some((a) => a.id.toString() === shareRootId);
    if (!withinShare) throw ApiError.notFound(LINK_INVALID_MESSAGE);
  }

  const targetDir = await directoryRepository.findById(targetDirId);
  if (!targetDir) throw ApiError.notFound(LINK_INVALID_MESSAGE);

  const [files, directories, fullAncestors] = await Promise.all([
    fileRepository.findByParentDir(targetDir._id),
    directoryRepository.findChildDirectories(targetDir._id),
    directoryRepository.findAncestorChain(targetDir._id),
  ]);

  // Breadcrumbs are cut at the share root - the owner's real path above the shared folder
  // must never be exposed to a visitor.
  const shareRootIndex = fullAncestors.findIndex((a) => a.id.toString() === shareRootId);
  const ancestors = shareRootIndex === -1 ? [] : fullAncestors.slice(shareRootIndex + 1);

  return {
    resourceType: "directory",
    shareRootId: share.resourceId,
    directory: { id: targetDir._id, name: targetDir.name },
    files: files.map((f) => ({ id: f._id, name: f.name, size: f.size, extension: f.extension })),
    directories: directories.map((d) => ({ id: d._id, name: d.name })),
    ancestors,
  };
}

export async function getSharedFileDownloadUrl(token, fileId, action) {
  const share = await shareRepository.findByToken(token);
  if (!share) throw ApiError.notFound(LINK_INVALID_MESSAGE);

  const file = await fileRepository.findById(fileId);
  if (!file) throw ApiError.notFound(LINK_INVALID_MESSAGE);

  if (share.resourceType === "File") {
    if (share.resourceId.toString() !== fileId) {
      throw ApiError.notFound(LINK_INVALID_MESSAGE);
    }
  } else {
    const shareRootId = share.resourceId.toString();
    const isDirectChild = file.parentDirId.toString() === shareRootId;
    const isNestedChild =
      !isDirectChild &&
      (await directoryRepository.findAncestorChain(file.parentDirId)).some((a) => a.id.toString() === shareRootId);
    if (!isDirectChild && !isNestedChild) {
      throw ApiError.notFound(LINK_INVALID_MESSAGE);
    }
  }

  const key = objectKey(file._id, file.extension);
  return cloudfrontStorage.createGetSignedUrl({
    key,
    download: action === "download",
    filename: file.name,
    // Shorter than the owner's own download expiry - see env.js's shareSignedUrlExpirySeconds
    // comment for why this can't be fully closed by revoking the share alone.
    expirySeconds: env.cloudfront.shareSignedUrlExpirySeconds,
  });
}
