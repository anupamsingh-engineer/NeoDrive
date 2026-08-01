import express from "express";
import healthRoutes from "./health.routes.js";
import metricsRoutes from "./metrics.routes.js";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import directoryRoutes from "./directory.routes.js";
import fileRoutes from "./file.routes.js";
import subscriptionRoutes from "./subscription.routes.js";
import shareRoutes from "./share.routes.js";
import publicShareRoutes from "./publicShare.routes.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { verifyCsrf } from "../middlewares/csrf.middleware.js";

// Note: webhook routes are mounted separately in app.js, ahead of the global JSON body
// parser, so they can capture the raw request body for Razorpay signature verification.
const router = express.Router();

router.use(healthRoutes);
router.use(metricsRoutes);

router.use("/auth", authRoutes);
router.use(userRoutes);

// Fully public - no requireAuth. Anyone with a share link can view/download without logging in.
router.use("/s", publicShareRoutes);

router.use("/directory", requireAuth, verifyCsrf, directoryRoutes);
router.use("/file", requireAuth, verifyCsrf, fileRoutes);
router.use("/subscriptions", requireAuth, verifyCsrf, subscriptionRoutes);
router.use("/share", requireAuth, verifyCsrf, shareRoutes);

export default router;
