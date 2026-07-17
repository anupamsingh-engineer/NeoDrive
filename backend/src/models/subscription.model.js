import { model, Schema } from "mongoose";

const subscriptionSchema = new Schema(
  {
    razorpaySubscriptionId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["created", "active", "pending", "past_due", "paused", "canceled", "in_grace"],
      default: "created",
    },
  },
  { timestamps: true }
);

subscriptionSchema.index({ userId: 1 });

const Subscription = model("Subscription", subscriptionSchema);

export default Subscription;
