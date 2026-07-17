import { asyncHandler } from "../errors/asyncHandler.js";
import * as directoryService from "../services/directory.service.js";

export const getDirectory = asyncHandler(async (req, res) => {
  const data = await directoryService.getDirectory(req.user._id, req.params.id, req.user.rootDirId);
  res.status(200).json({ success: true, data });
});

export const createDirectory = asyncHandler(async (req, res) => {
  const dirname = req.headers.dirname || "New Folder";
  const { message } = await directoryService.createDirectory(
    req.user._id,
    req.params.parentDirId,
    req.user.rootDirId,
    dirname
  );
  res.status(201).json({ success: true, message });
});

export const renameDirectory = asyncHandler(async (req, res) => {
  const { message } = await directoryService.renameDirectory(req.user._id, req.params.id, req.body.newDirName);
  res.status(200).json({ success: true, message });
});

export const deleteDirectory = asyncHandler(async (req, res) => {
  const { message } = await directoryService.deleteDirectory(req.user._id, req.params.id, req.user.rootDirId);
  res.status(200).json({ success: true, message });
});
