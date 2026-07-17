import Razorpay from "razorpay";
import env from "../config/env.js";
import logger from "../config/logger.js";
import { ApiError } from "../errors/ApiError.js";
import { PLAN_STORAGE_QUOTA_BYTES, SUBSCRIPTION_PLANS } from "../config/constants.js";
import * as subscriptionRepository from "../repositories/subscription.repository.js";
import * as userRepository from "../repositories/user.repository.js";
import * as webhookLogRepository from "../repositories/webhookLog.repository.js";
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

export function getPlans() {
  return SUBSCRIPTION_PLANS;
}

export async function createSubscription(userId, planId) {
  const newSubscription = await getRzpInstance().subscriptions.create({
    plan_id: planId,
    total_count: 100,
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

// Razorpay's subscription.entity.status values don't match our Subscription model's enum
// 1:1 ("cancelled" vs "canceled", and "halted"/"completed"/"authenticated"/"expired" aren't
// in it at all) - map them onto the closest equivalent so a status update never throws a
// Mongoose validation error partway through processing a webhook.
const RAZORPAY_SUBSCRIPTION_STATUS_MAP = {
  created: "created",
  authenticated: "created",
  active: "active",
  pending: "past_due",
  halted: "paused",
  cancelled: "canceled",
  completed: "canceled",
  expired: "canceled",
};

// The only subscription events that actually change what the user owns - every other
// subscription.* event (authenticated, pending, updated, paused, resumed, ...) just updates
// the Subscription document's status field above, no quota change.
const GRANTS_PLAN_QUOTA = new Set(["subscription.activated", "subscription.charged"]);
const REVOKES_PLAN_QUOTA = new Set(["subscription.cancelled", "subscription.completed", "subscription.halted"]);

async function downgradeToFreeTier(userId) {
  await userRepository.updateMaxStorageBytes(userId, env.storage.defaultMaxStorageBytes);
  await userService.invalidateProfileCache(userId);
}

async function handleSubscriptionEvent(event, payload) {
  const rzpSubscription = payload?.subscription?.entity;
  if (!rzpSubscription) return { status: "ignored" };

  const razorpaySubscriptionId = rzpSubscription.id;
  const subscription = await subscriptionRepository.findByRazorpayId(razorpaySubscriptionId);
  if (!subscription) {
    logger.warn({ event, razorpaySubscriptionId }, "Webhook for unknown subscription");
    return { status: "ignored", razorpaySubscriptionId };
  }

  const mappedStatus = RAZORPAY_SUBSCRIPTION_STATUS_MAP[rzpSubscription.status];
  if (mappedStatus) await subscriptionRepository.updateStatus(razorpaySubscriptionId, mappedStatus);

  const userId = subscription.userId;

  if (GRANTS_PLAN_QUOTA.has(event)) {
    const quota = PLAN_STORAGE_QUOTA_BYTES[rzpSubscription.plan_id];
    if (!quota) {
      logger.error({ event, planId: rzpSubscription.plan_id, razorpaySubscriptionId }, "Unknown plan_id on webhook");
      return { status: "error", userId, razorpaySubscriptionId, error: `Unknown plan_id: ${rzpSubscription.plan_id}` };
    }
    await userRepository.updateMaxStorageBytes(userId, quota);
    await userService.invalidateProfileCache(userId);
    logger.info({ event, userId, planId: rzpSubscription.plan_id }, "Storage quota applied from subscription webhook");
    return { status: "processed", userId, razorpaySubscriptionId };
  }

  if (REVOKES_PLAN_QUOTA.has(event)) {
    await downgradeToFreeTier(userId);
    logger.info({ event, userId }, "Subscription ended - storage downgraded to free tier");
    return { status: "processed", userId, razorpaySubscriptionId };
  }

  return { status: "processed", userId, razorpaySubscriptionId };
}

// Razorpay copies a subscription's `notes` onto each payment it auto-charges for that
// subscription, so notes.userId (set in createSubscription above) survives onto refund
// payloads too - that's the only link back to our user, since refunds are addressed by
// paymentId, not subscriptionId.
async function handleRefundEvent(payload) {
  const paymentEntity = payload?.payment?.entity;
  const refundEntity = payload?.refund?.entity;
  const razorpayPaymentId = paymentEntity?.id || refundEntity?.payment_id || null;
  const userId = paymentEntity?.notes?.userId || null;

  if (!userId) {
    logger.warn({ razorpayPaymentId }, "Refund webhook - could not resolve user from payment notes");
    return { status: "ignored", razorpayPaymentId };
  }

  await downgradeToFreeTier(userId);
  logger.info({ userId, razorpayPaymentId }, "Refund processed - storage downgraded to free tier");
  return { status: "processed", userId, razorpayPaymentId };
}

// Payment lifecycle events (authorized/captured/failed) don't need their own quota action:
// a captured charge is already reflected by the paired subscription.charged event, and a
// failure is only consequential once Razorpay gives up retrying (subscription.halted) -
// still logged below so the raw event isn't lost.
function handlePaymentEvent(payload) {
  return { status: "ignored", razorpayPaymentId: payload?.payment?.entity?.id || null };
}

export async function handleWebhookEvent(event, payload) {
  let outcome;
  try {
    if (event.startsWith("subscription.")) {
      outcome = await handleSubscriptionEvent(event, payload);
    } else if (event === "refund.created" || event === "refund.processed") {
      outcome = await handleRefundEvent(payload);
    } else if (event.startsWith("payment.")) {
      outcome = handlePaymentEvent(payload);
    } else {
      outcome = { status: "ignored" };
    }
  } catch (err) {
    logger.error({ err, event }, "Error processing webhook event");
    outcome = { status: "error", error: err.message };
  }

  razorpayWebhookEventsTotal.inc({ event, status: outcome.status });

  // Fail-open: a logging failure here must never turn an already-processed webhook into a
  // 500, which would make Razorpay retry an event whose actual side effects already landed.
  try {
    await webhookLogRepository.create({
      event,
      payload,
      status: outcome.status,
      userId: outcome.userId || null,
      razorpaySubscriptionId: outcome.razorpaySubscriptionId || null,
      razorpayPaymentId: outcome.razorpayPaymentId || null,
      error: outcome.error || null,
    });
  } catch (err) {
    logger.error({ err, event }, "Failed to persist webhook log");
  }
}
