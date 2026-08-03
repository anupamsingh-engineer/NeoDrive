import { asyncHandler } from "../errors/asyncHandler.js";
import * as shareService from "../services/share.service.js";
import logger from "../config/logger.js";

export const getShareView = asyncHandler(async (req, res) => {
  const data = await shareService.resolvePublicShare(req.params.token, { dirId: req.query.dirId });
  res.status(200).json({ success: true, data });
});

export const downloadSharedFile = asyncHandler(async (req, res) => {
  const url = await shareService.getSharedFileDownloadUrl(req.params.token, req.params.fileId, req.query.action);
  res.redirect(url);
});

// Not a JSON response - streams a zip archive directly, same shape as directoryController's own
// downloadDirectory. Only valid for a directory share (see getSharedDirectoryZip).
export const downloadSharedDirectory = asyncHandler(async (req, res) => {
  const { stream, filename } = await shareService.getSharedDirectoryZip(req.params.token, req.query.dirId);

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);

  stream.on("error", (err) => {
    logger.error({ err, token: req.params.token }, "Shared folder zip download failed mid-stream");
    res.destroy(err);
  });

  stream.pipe(res);
});
