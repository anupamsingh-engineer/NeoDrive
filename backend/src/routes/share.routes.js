import express from "express";
import * as shareController from "../controllers/share.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.middleware.js";
import { shareCreateLimiter } from "../middlewares/rateLimit.middleware.js";
import { createShareSchema } from "../validators/share.schema.js";

const router = express.Router();

router.param("id", validateObjectId);

router.post("/", shareCreateLimiter, validate(createShareSchema), shareController.createShare);
router.get("/", shareController.listShares);
router.delete("/:id", shareController.revokeShare);

export default router;
