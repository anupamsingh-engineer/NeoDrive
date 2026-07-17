import express from "express";
import * as directoryController from "../controllers/directory.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.middleware.js";
import { renameDirectorySchema } from "../validators/directory.schema.js";

const router = express.Router();

router.param("parentDirId", validateObjectId);
router.param("id", validateObjectId);

router.get("/:id?", directoryController.getDirectory);
router.post("/:parentDirId?", directoryController.createDirectory);
router.patch("/:id", validate(renameDirectorySchema), directoryController.renameDirectory);
router.delete("/:id", directoryController.deleteDirectory);

export default router;
