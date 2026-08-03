import { asyncHandler } from "../errors/asyncHandler.js";
import * as directoryService from "../services/directory.service.js";
import logger from "../config/logger.js";

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

// Not a JSON response - streams a zip archive directly. This is the one route in the app where
// a service hands the controller a stream instead of data to shape into an envelope.
export const downloadDirectory = asyncHandler(async (req, res) => {
  const { stream, filename } = await directoryService.prepareDirectoryZip(
    req.user._id,
    req.params.id,
    req.user.rootDirId
  );

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);

  // A stream error here happens mid-response, after headers (and possibly bytes) are already
  // sent - there's no clean way back to a JSON error envelope at that point, so this is the one
  // place in the app that reaches for the response directly instead of throwing an ApiError.
  stream.on("error", (err) => {
    logger.error({ err, dirId: req.params.id }, "Folder zip download failed mid-stream");
    res.destroy(err);
  });

  stream.pipe(res);
});
