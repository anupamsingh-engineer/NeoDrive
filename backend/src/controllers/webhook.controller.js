import logger from "../config/logger.js";
import { ApiError } from "../errors/ApiError.js";
import { asyncHandler } from "../errors/asyncHandler.js";
import * as subscriptionService from "../services/subscription.service.js";

export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];

  if (!signature || !req.rawBody) {
    throw ApiError.forbidden("Invalid webhook signature");
  }

  const isValid = subscriptionService.verifyWebhookSignature(req.rawBody, signature);
  if (!isValid) {
    logger.warn("Razorpay webhook signature verification failed");
    throw ApiError.forbidden("Invalid webhook signature");
  }

  await subscriptionService.handleWebhookEvent(req.body.event, req.body.payload);
  res.status(200).json({ success: true });
});
