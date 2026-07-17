import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Crown } from "lucide-react";
import { useCreateSubscriptionMutation, useGetPlansQuery } from "../../../store/api/features/subscriptionApi";
import { useGetCurrentUserQuery } from "../../../store/api/features/userApi";
import { Button, Card, Badge, Skeleton, InlineAlert, toast } from "../../../components/ui";
import { staggerContainer, listItem } from "../../../motion";

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
  const { data: plansData, isLoading: plansLoading, error: plansError } = useGetPlansQuery();
  const plans = plansData?.data || [];
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

      {plansError && (
        <InlineAlert type="error" title="Couldn't load plans" description="Please refresh the page to try again." />
      )}

      {plansLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80 w-full" />
          ))}
        </div>
      ) : (
        <motion.div {...staggerContainer(0.06)} className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = user?.maxStorageInBytes === plan.storageQuotaBytes;
            return (
              <motion.div key={plan.planId} variants={listItem}>
                <Card
                  hoverable
                  className={`relative flex h-full flex-col ${plan.popular ? "border-brand" : ""}`}
                >
                  {plan.popular && (
                    <Badge variant="brand" className="absolute -top-3 left-5">
                      Popular
                    </Badge>
                  )}
                  <Crown className="mb-3 h-6 w-6 text-brand" aria-hidden="true" />
                  <p className="text-2xl font-semibold text-ink">{plan.name}</p>
                  <p className="text-sm text-ink-soft">{plan.description}</p>
                  <p className="mt-3 text-lg font-semibold text-ink">
                    ₹{plan.amount.toLocaleString("en-IN")}
                    <span className="text-sm font-normal text-ink-soft"> / {plan.billingCycle}</span>
                  </p>
                  <ul className="my-4 flex flex-1 flex-col gap-2">
                    {plan.features.map((feature) => (
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
                      variant={plan.popular ? "primary" : "secondary"}
                      block
                      loading={loadingPlanId === plan.planId}
                      onClick={() => handleSubscribe(plan.planId)}
                    >
                      Subscribe
                    </Button>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
};

export default SubscriptionsPage;
