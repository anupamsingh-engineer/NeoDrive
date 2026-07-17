import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Crown } from "lucide-react";
import { Button, Card, Badge } from "../../../../components/ui";
import { staggerContainer, listItem } from "../../../../motion";

const TIERS = [
  { label: "2 TB", blurb: "For personal libraries and everyday backups." },
  { label: "5 TB", blurb: "For growing collections and shared projects.", popular: true },
  { label: "10 TB", blurb: "For power users with serious storage needs." },
];

const PricingTeaser = () => {
  const navigate = useNavigate();

  return (
    <section className="mx-auto w-full max-w-page px-6 py-20">
      <div className="mx-auto mb-12 max-w-xl text-center">
        <h2 className="text-3xl font-semibold text-ink">Storage that grows with you</h2>
        <p className="mt-3 text-ink-soft">Start free, then upgrade whenever you need more room.</p>
      </div>

      <motion.div {...staggerContainer(0.08)} className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {TIERS.map((tier) => (
          <motion.div key={tier.label} variants={listItem}>
            <Card hoverable className={`relative flex h-full flex-col items-center gap-2 text-center ${tier.popular ? "border-brand" : ""}`}>
              {tier.popular && (
                <Badge variant="brand" className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Popular
                </Badge>
              )}
              <Crown className="h-6 w-6 text-brand" aria-hidden="true" />
              <p className="text-2xl font-semibold text-ink">{tier.label}</p>
              <p className="text-sm text-ink-soft">{tier.blurb}</p>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="mt-8 text-center">
        <Button variant="primary" size="lg" onClick={() => navigate("/auth/register")}>
          Choose your plan
        </Button>
      </div>
    </section>
  );
};

export default PricingTeaser;
