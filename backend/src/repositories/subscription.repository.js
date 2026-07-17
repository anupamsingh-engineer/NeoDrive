import Subscription from "../models/subscription.model.js";

export async function create({ razorpaySubscriptionId, userId }) {
  return Subscription.create({ razorpaySubscriptionId, userId });
}

export async function findByRazorpayId(razorpaySubscriptionId) {
  return Subscription.findOne({ razorpaySubscriptionId });
}

export async function updateStatus(razorpaySubscriptionId, status) {
  return Subscription.findOneAndUpdate({ razorpaySubscriptionId }, { status }, { new: true });
}
