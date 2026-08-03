import express from "express";
import * as publicShareController from "../controllers/publicShare.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.middleware.js";
import { shareResolveLimiter, shareDirectoryDownloadLimiter } from "../middlewares/rateLimit.middleware.js";
import { shareViewQuerySchema, shareDownloadQuerySchema } from "../validators/share.schema.js";

const router = express.Router();

router.param("fileId", validateObjectId);

router.get("/:token", shareResolveLimiter, validate(shareViewQuerySchema, "query"), publicShareController.getShareView);
router.get(
  "/:token/download",
  shareDirectoryDownloadLimiter,
  validate(shareViewQuerySchema, "query"),
  publicShareController.downloadSharedDirectory
);
router.get(
  "/:token/file/:fileId",
  shareResolveLimiter,
  validate(shareDownloadQuerySchema, "query"),
  publicShareController.downloadSharedFile
);

export default router;
