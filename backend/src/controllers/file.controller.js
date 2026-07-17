import { asyncHandler } from "../errors/asyncHandler.js";
import * as fileService from "../services/file.service.js";

export const getFile = asyncHandler(async (req, res) => {
  const url = await fileService.getFileDownloadUrl(req.user._id, req.params.id, req.query.action);
  res.redirect(url);
});

export const renameFile = asyncHandler(async (req, res) => {
  const { message } = await fileService.renameFile(req.user._id, req.params.id, req.body.newFilename);
  res.status(200).json({ success: true, message });
});

export const deleteFile = asyncHandler(async (req, res) => {
  const { message } = await fileService.deleteFile(req.user._id, req.params.id);
  res.status(200).json({ success: true, message });
});

export const uploadInitiate = asyncHandler(async (req, res) => {
  const data = await fileService.uploadInitiate(req.user._id, req.user.rootDirId, req.body);
  res.status(201).json({ success: true, data });
});

export const uploadComplete = asyncHandler(async (req, res) => {
  const data = await fileService.uploadComplete(req.user._id, req.body.fileId);
  res.status(200).json({ success: true, data });
});
