import { ZipArchive } from "archiver";
import { ApiError } from "../errors/ApiError.js";
import * as directoryRepository from "../repositories/directory.repository.js";
import * as fileRepository from "../repositories/file.repository.js";
import * as shareRepository from "../repositories/share.repository.js";
import * as storageService from "./file.storageOps.js";
import { objectKey } from "./file.storageOps.js";
import * as s3Storage from "./storage/s3.storage.js";
import * as cacheService from "./cache.service.js";
import { directoryListingCacheKey, invalidateDirectoryListings, DIR_LISTING_CACHE_TTL_SECONDS } from "./cache.service.js";
import logger from "../config/logger.js";

// Keeps a single zip request bounded - this is the one read path in the app where the API
// server actually touches file bytes (every other download is a CloudFront redirect, see
// files.md), so an unbounded folder could tie up a request for a very long time or exhaust
// memory/bandwidth. Chosen generously for a personal-drive-scale folder, not a hard product limit.
const MAX_ZIP_FILES = 2000;
const MAX_ZIP_TOTAL_BYTES = 2 * 1024 ** 3; // 2 GB

export async function getDirectory(userId, dirId, rootDirId) {
  const id = dirId || rootDirId.toString();

  return cacheService.getOrSet("dir_listing", directoryListingCacheKey(userId, id), DIR_LISTING_CACHE_TTL_SECONDS, async () => {
    const directoryData = await directoryRepository.findByIdForUser(id, userId);
    if (!directoryData) {
      throw ApiError.notFound("Directory not found or you do not have access to it!");
    }

    const [files, directories, ancestors] = await Promise.all([
      fileRepository.findByParentDir(directoryData._id),
      directoryRepository.findChildDirectories(id),
      directoryRepository.findAncestorChain(id),
    ]);

    return {
      ...directoryData,
      id: directoryData._id,
      files: files.map((file) => ({ ...file, id: file._id })),
      directories: directories.map((dir) => ({ ...dir, id: dir._id })),
      ancestors,
    };
  });
}

export async function createDirectory(userId, parentDirId, rootDirId, dirname) {
  const parentId = parentDirId || rootDirId.toString();

  // Ownership check here fixes a v1 gap where any authenticated user could create a
  // directory inside another user's tree by guessing a parentDirId.
  const parentDir = await directoryRepository.findByIdForUser(parentId, userId);
  if (!parentDir) throw ApiError.notFound("Parent Directory Does not exist!");

  await directoryRepository.insertOne({ name: dirname || "New Folder", parentDirId: parentId, userId });
  await invalidateDirectoryListings(userId, parentId);

  return { message: "Directory Created!" };
}

export async function renameDirectory(userId, id, newDirName) {
  const updated = await directoryRepository.updateName(id, userId, newDirName);
  if (!updated) throw ApiError.notFound("Directory not found!");

  await invalidateDirectoryListings(userId, id, updated.parentDirId);
  return { message: "Directory Renamed!" };
}

async function collectDirectoryContents(id) {
  let files = await fileRepository.findExtensionsByParentDir(id);
  let directories = await directoryRepository.findChildDirectoryIds(id);

  for (const { _id } of directories) {
    const nested = await collectDirectoryContents(_id);
    files = [...files, ...nested.files];
    directories = [...directories, ...nested.directories];
  }

  return { files, directories };
}

// Same recursive-per-directory-query shape as collectDirectoryContents above, but walks full
// docs (not just id/extension) since a zip entry needs the file's display name and the
// subfolder names that make up its path inside the archive - the S3 key (fileId + extension)
// has neither.
async function collectFilesForZip(dirId, pathPrefix = "") {
  const [files, directories] = await Promise.all([
    fileRepository.findByParentDir(dirId),
    directoryRepository.findChildDirectories(dirId),
  ]);

  let entries = files
    .filter((file) => !file.isUploading)
    .map((file) => ({
      key: objectKey(file._id, file.extension),
      zipPath: `${pathPrefix}${file.name}`,
      size: file.size,
    }));

  for (const dir of directories) {
    const nested = await collectFilesForZip(dir._id, `${pathPrefix}${dir.name}/`);
    entries = [...entries, ...nested];
  }

  return entries;
}

// Returns a zip archive stream (a Node.js Readable) plus the filename to serve it as - the
// caller (the controller) owns setting response headers and piping it, since services don't
// touch req/res directly anywhere else in this codebase either.
export async function prepareDirectoryZip(userId, id, rootDirId) {
  const dirId = id || rootDirId.toString();

  const directoryData = await directoryRepository.findByIdForUser(dirId, userId);
  if (!directoryData) throw ApiError.notFound("Directory not found!");

  const entries = await collectFilesForZip(dirId);
  if (entries.length === 0) throw ApiError.badRequest("This folder is empty");
  if (entries.length > MAX_ZIP_FILES) {
    throw ApiError.badRequest(`This folder has too many files to download as a zip (limit: ${MAX_ZIP_FILES})`);
  }

  const totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
  if (totalBytes > MAX_ZIP_TOTAL_BYTES) {
    const limitGb = (MAX_ZIP_TOTAL_BYTES / 1024 ** 3).toFixed(0);
    throw ApiError.badRequest(`This folder is too large to download as a zip (limit: ${limitGb} GB)`);
  }

  const archive = new ZipArchive({ zlib: { level: 6 } });

  // Fetched and appended one at a time, in order - archiver processes entries sequentially
  // regardless, and this keeps at most one S3 read stream open at a time rather than racing
  // to open hundreds of them up front. Runs concurrently with the controller piping `archive`
  // to the response; archiver buffers internally so starting this just before the pipe is
  // attached is safe.
  (async () => {
    try {
      for (const entry of entries) {
        const fileStream = await s3Storage.getFileStream(entry.key);
        archive.append(fileStream, { name: entry.zipPath });
      }
      await archive.finalize();
    } catch (err) {
      logger.error({ err, userId, dirId }, "Folder zip stream failed mid-build");
      archive.destroy(err);
    }
  })();

  return { stream: archive, filename: `${directoryData.name}.zip` };
}

export async function deleteDirectory(userId, id, rootDirId) {
  if (id === rootDirId.toString()) {
    throw ApiError.badRequest("Cannot delete your root directory");
  }

  const directoryData = await directoryRepository.findByIdForUser(id, userId);
  if (!directoryData) throw ApiError.notFound("Directory not found!");

  const { files, directories } = await collectDirectoryContents(id);
  const keys = files.map(({ _id, extension }) => ({ Key: objectKey(_id, extension) }));
  // Includes `id` itself, not just descendants - the directory being deleted could be directly
  // shared, not just an ancestor of a shared item.
  const allDeletedDirIds = [...directories.map(({ _id }) => _id), id];

  await Promise.all([
    storageService.scheduleS3Cleanup(keys),
    fileRepository.deleteManyByIds(files.map(({ _id }) => _id)),
    directoryRepository.deleteManyByIds(allDeletedDirIds),
    shareRepository.deleteManyByResourceIds({
      fileIds: files.map(({ _id }) => _id),
      dirIds: allDeletedDirIds,
    }),
  ]);

  const touchedIds = await directoryRepository.incrementSizeUpChain(
    directoryData.parentDirId,
    -directoryData.size
  );

  await invalidateDirectoryListings(userId, id, directoryData.parentDirId, ...touchedIds);

  return { message: "Files deleted successfully" };
}
