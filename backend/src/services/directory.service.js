import { ApiError } from "../errors/ApiError.js";
import * as directoryRepository from "../repositories/directory.repository.js";
import * as fileRepository from "../repositories/file.repository.js";
import * as storageService from "./file.storageOps.js";
import { objectKey } from "./file.storageOps.js";
import * as cacheService from "./cache.service.js";
import { directoryListingCacheKey, invalidateDirectoryListings, DIR_LISTING_CACHE_TTL_SECONDS } from "./cache.service.js";

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

export async function deleteDirectory(userId, id, rootDirId) {
  if (id === rootDirId.toString()) {
    throw ApiError.badRequest("Cannot delete your root directory");
  }

  const directoryData = await directoryRepository.findByIdForUser(id, userId);
  if (!directoryData) throw ApiError.notFound("Directory not found!");

  const { files, directories } = await collectDirectoryContents(id);
  const keys = files.map(({ _id, extension }) => ({ Key: objectKey(_id, extension) }));

  await Promise.all([
    storageService.scheduleS3Cleanup(keys),
    fileRepository.deleteManyByIds(files.map(({ _id }) => _id)),
    directoryRepository.deleteManyByIds([...directories.map(({ _id }) => _id), id]),
  ]);

  const touchedIds = await directoryRepository.incrementSizeUpChain(
    directoryData.parentDirId,
    -directoryData.size
  );

  await invalidateDirectoryListings(userId, id, directoryData.parentDirId, ...touchedIds);

  return { message: "Files deleted successfully" };
}
