import { asyncHandler } from "../errors/asyncHandler.js";
import * as shareService from "../services/share.service.js";

export const getShareView = asyncHandler(async (req, res) => {
  const data = await shareService.resolvePublicShare(req.params.token, { dirId: req.query.dirId });
  res.status(200).json({ success: true, data });
});

export const downloadSharedFile = asyncHandler(async (req, res) => {
  const url = await shareService.getSharedFileDownloadUrl(req.params.token, req.params.fileId, req.query.action);
  res.redirect(url);
});
