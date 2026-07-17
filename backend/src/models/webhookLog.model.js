import { model, Schema } from "mongoose";

const webhookLogSchema = new Schema(
  {
    event: { type: String, required: true },
    status: { type: String, enum: ["processed", "ignored", "error"], required: true },
    // Full Razorpay webhook payload (payload.subscription/payment/refund.entity, etc.) - kept
    // as-is for audit/debugging rather than picking fields, since Razorpay's shape varies by event.
    payload: { type: Schema.Types.Mixed, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    razorpaySubscriptionId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

webhookLogSchema.index({ userId: 1 });
webhookLogSchema.index({ createdAt: -1 });

const WebhookLog = model("WebhookLog", webhookLogSchema);

export default WebhookLog;
