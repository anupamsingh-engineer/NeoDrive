import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";

const VARIANTS = {
  success: { icon: CheckCircle2, className: "border-success/30 bg-success-tint text-success" },
  error: { icon: XCircle, className: "border-danger/30 bg-danger-tint text-danger" },
  warning: { icon: AlertTriangle, className: "border-warning/30 bg-warning-tint text-warning" },
  info: { icon: Info, className: "border-brand/30 bg-brand-tint text-brand" },
};

const InlineAlert = ({ type = "info", title, description, className = "" }) => {
  const { icon: Icon, className: variantClass } = VARIANTS[type] ?? VARIANTS.info;
  const visible = Boolean(title || description);

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0, marginBottom: 0 }}
          animate={{ height: "auto", opacity: 1, marginBottom: 16 }}
          exit={{ height: 0, opacity: 0, marginBottom: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className={`flex items-start gap-2.5 rounded-sm border p-3 text-sm ${variantClass} ${className}`}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              {title && <p className="font-medium">{title}</p>}
              {description && <p className={title ? "mt-0.5 opacity-90" : ""}>{description}</p>}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InlineAlert;
