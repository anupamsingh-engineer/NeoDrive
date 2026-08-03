import express from "express";
import * as directoryController from "../controllers/directory.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.middleware.js";
import { directoryDownloadLimiter } from "../middlewares/rateLimit.middleware.js";
import { renameDirectorySchema } from "../validators/directory.schema.js";

const router = express.Router();

router.param("parentDirId", validateObjectId);
router.param("id", validateObjectId);

// Must be registered before "/:id?" below - Express matches in registration order, and
// "/directory/download" is a single segment just like "/:id?", so if "/:id?" came first it would
// swallow "download" as if it were an id (and 400 on validateObjectId). "/:id/download" has no
// such ambiguity (two segments vs. one), but is kept alongside for readability.
router.get("/download", directoryDownloadLimiter, directoryController.downloadDirectory);
router.get("/:id/download", directoryDownloadLimiter, directoryController.downloadDirectory);

router.get("/:id?", directoryController.getDirectory);
router.post("/:parentDirId?", directoryController.createDirectory);
router.patch("/:id", validate(renameDirectorySchema), directoryController.renameDirectory);
router.delete("/:id", directoryController.deleteDirectory);

export default router;
