import express from "express";
import * as fileController from "../controllers/file.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.middleware.js";
import { uploadLimiter } from "../middlewares/rateLimit.middleware.js";
import {
  uploadInitiateSchema,
  uploadCompleteSchema,
  renameFileSchema,
} from "../validators/file.schema.js";

const router = express.Router();

router.param("id", validateObjectId);

router.post("/upload/initiate", uploadLimiter, validate(uploadInitiateSchema), fileController.uploadInitiate);
router.post("/upload/complete", validate(uploadCompleteSchema), fileController.uploadComplete);

router.get("/:id", fileController.getFile);
router.patch("/:id", validate(renameFileSchema), fileController.renameFile);
router.delete("/:id", fileController.deleteFile);

export default router;
