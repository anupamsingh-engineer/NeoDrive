import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Crown } from "lucide-react";
import { useCreateSubscriptionMutation } from "../../../store/api/features/subscriptionApi";
import { useGetCurrentUserQuery } from "../../../store/api/features/userApi";
import { Button, Card, Badge, toast } from "../../../components/ui";
import { staggerContainer, listItem } from "../../../motion";

const TIB = 1024 ** 4;

// Real plan IDs from backend/src/config/constants.js — keep in sync if plans change there.
const PLAN_TIERS = [
  {
    label: "2 TB",
    bytes: 2 * TIB,
    planId: "plan_TEPIgVM0I0kq8o",
    features: ["2 TB storage", "Unlimited uploads", "Email support"],
  },
  {
    label: "5 TB",
    bytes: 5 * TIB,
    planId: "plan_TEPK72pd3uwy74",
    features: ["5 TB storage", "Unlimited uploads", "Priority support"],
    popular: true,
  },
  {
    label: "10 TB",
    bytes: 10 * TIB,
    planId: "plan_TEPL1YABpKuviH",
    features: ["10 TB storage", "Unlimited uploads", "Priority support"],
  },
];

const RAZORPAY_KEY_ID = "rzp_test_TEPFKSsYkRQS2R";

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(script);
  });
}

const SubscriptionsPage = () => {
  const [createSubscription] = useCreateSubscriptionMutation();
  const { data: userData } = useGetCurrentUserQuery();
  const user = userData?.data;
  const [loadingPlanId, setLoadingPlanId] = useState(null);

  const handleSubscribe = async (planId) => {
    setLoadingPlanId(planId);
    try {
      const { data } = await createSubscription({ planId }).unwrap();
      await loadRazorpayScript();

      const checkout = new window.Razorpay({
        key: RAZORPAY_KEY_ID,
        subscription_id: data.subscriptionId,
        name: "Storage App",
        description: "Storage plan upgrade",
        handler: () => toast.success("Payment complete — your plan will update shortly."),
        modal: { ondismiss: () => setLoadingPlanId(null) },
      });
      checkout.open();
    } catch (err) {
      toast.error(err?.data?.message || err?.message || "Failed to start subscription");
    } finally {
      setLoadingPlanId(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-ink">Upgrade Storage</h1>
      <p className="mb-4 text-sm text-ink-soft">
        Storage updates once payment is confirmed — this can take a moment after checkout.
      </p>

      <motion.div {...staggerContainer(0.06)} className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {PLAN_TIERS.map((tier) => {
          const isCurrent = user?.maxStorageInBytes === tier.bytes;
          return (
            <motion.div key={tier.planId} variants={listItem}>
              <Card
                hoverable
                className={`relative flex h-full flex-col ${tier.popular ? "border-brand" : ""}`}
              >
                {tier.popular && (
                  <Badge variant="brand" className="absolute -top-3 left-5">
                    Popular
                  </Badge>
                )}
                <Crown className="mb-3 h-6 w-6 text-brand" aria-hidden="true" />
                <p className="text-2xl font-semibold text-ink">{tier.label}</p>
                <ul className="my-4 flex flex-1 flex-col gap-2">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-ink-soft">
                      <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Badge variant="success" className="w-full justify-center py-2">
                    Current Plan
                  </Badge>
                ) : (
                  <Button
                    variant={tier.popular ? "primary" : "secondary"}
                    block
                    loading={loadingPlanId === tier.planId}
                    onClick={() => handleSubscribe(tier.planId)}
                  >
                    Subscribe
                  </Button>
                )}
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default SubscriptionsPage;
