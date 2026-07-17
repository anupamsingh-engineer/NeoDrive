import express from "express";
import * as authController from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { verifyCsrf } from "../middlewares/csrf.middleware.js";
import { authLimiter } from "../middlewares/rateLimit.middleware.js";
import {
  sendOtpSchema,
  verifyOtpSchema,
  registerSchema,
  loginSchema,
  googleLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.schema.js";

const router = express.Router();

router.post("/send-otp", authLimiter, validate(sendOtpSchema), authController.sendOtp);
router.post("/verify-otp", authLimiter, validate(verifyOtpSchema), authController.verifyOtp);
router.post("/register", authLimiter, validate(registerSchema), authController.register);
router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post("/google", authLimiter, validate(googleLoginSchema), authController.loginWithGoogle);
router.post("/refresh", authLimiter, authController.refresh);
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), authController.resetPassword);

router.post("/logout", requireAuth, verifyCsrf, authController.logout);
router.post("/logout-all", requireAuth, verifyCsrf, authController.logoutAll);

export default router;
