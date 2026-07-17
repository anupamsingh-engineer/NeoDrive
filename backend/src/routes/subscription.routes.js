import express from "express";
import * as subscriptionController from "../controllers/subscription.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createSubscriptionSchema } from "../validators/subscription.schema.js";

const router = express.Router();

router.post("/", validate(createSubscriptionSchema), subscriptionController.createSubscription);

export default router;
