import { asyncHandler } from "../errors/asyncHandler.js";
import * as subscriptionService from "../services/subscription.service.js";

export const getPlans = asyncHandler(async (req, res) => {
  res.json({ success: true, data: subscriptionService.getPlans() });
});

export const createSubscription = asyncHandler(async (req, res) => {
  const data = await subscriptionService.createSubscription(req.user._id, req.body.planId);
  res.status(201).json({ success: true, data });
});
