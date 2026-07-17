import Razorpay from "razorpay";
import env from "../config/env.js";
import logger from "../config/logger.js";
import { ApiError } from "../errors/ApiError.js";
import { PLAN_STORAGE_QUOTA_BYTES } from "../config/constants.js";
import * as subscriptionRepository from "../repositories/subscription.repository.js";
import * as userRepository from "../repositories/user.repository.js";
import * as userService from "./user.service.js";
import { razorpayWebhookEventsTotal } from "../config/metrics.js";

// Lazily constructed: instantiating Razorpay throws immediately if key_id is missing, which
// would otherwise crash module load (and therefore the whole app) in envs without Razorpay
// configured (local dev, tests) even though only the payments routes need it.
let rzpInstance;
function getRzpInstance() {
  if (!rzpInstance) {
    rzpInstance = new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
  }
  return rzpInstance;
}

export async function createSubscription(userId, planId) {
  const newSubscription = await getRzpInstance().subscriptions.create({
    plan_id: planId,
    total_count: 120,
    notes: { userId: userId.toString() },
  });

  await subscriptionRepository.create({
    razorpaySubscriptionId: newSubscription.id,
    userId,
  });

  return { subscriptionId: newSubscription.id };
}

export function verifyWebhookSignature(rawBody, signature) {
  return Razorpay.validateWebhookSignature(rawBody, signature, env.razorpay.webhookSecret);
}

export async function handleWebhookEvent(event, payload) {
  if (event !== "subscription.activated") {
    razorpayWebhookEventsTotal.inc({ event, status: "ignored" });
    return;
  }

  const rzpSubscription = payload.subscription.entity;
  const planId = rzpSubscription.plan_id;
  const quota = PLAN_STORAGE_QUOTA_BYTES[planId];

  const subscription = await subscriptionRepository.findByRazorpayId(rzpSubscription.id);
  if (!subscription || !quota) {
    logger.error({ planId, subscriptionId: rzpSubscription.id }, "Unknown plan or subscription on webhook");
    razorpayWebhookEventsTotal.inc({ event, status: "error" });
    return;
  }

  await subscriptionRepository.updateStatus(rzpSubscription.id, rzpSubscription.status);
  await userRepository.updateMaxStorageBytes(subscription.userId, quota);
  await userService.invalidateProfileCache(subscription.userId);

  razorpayWebhookEventsTotal.inc({ event, status: "processed" });
  logger.info({ userId: subscription.userId, planId }, "Subscription activated");
}
