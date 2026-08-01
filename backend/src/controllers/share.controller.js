import { asyncHandler } from "../errors/asyncHandler.js";
import * as shareService from "../services/share.service.js";

export const createShare = asyncHandler(async (req, res) => {
  const data = await shareService.createShare(req.user._id, req.user.rootDirId, req.body);
  res.status(201).json({ success: true, data });
});

export const listShares = asyncHandler(async (req, res) => {
  const data = await shareService.listMyShares(req.user._id);
  res.status(200).json({ success: true, data });
});

export const revokeShare = asyncHandler(async (req, res) => {
  const { message } = await shareService.revokeShare(req.user._id, req.params.id);
  res.status(200).json({ success: true, message });
});
