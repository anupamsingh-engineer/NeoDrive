import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { toast, subscribeToasts, getToasts } from "./toastStore";
import { toastVariant } from "../../../motion";

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const ACCENTS = {
  success: "text-success",
  error: "text-danger",
  warning: "text-warning",
  info: "text-brand",
};

const Toaster = () => {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[1000] flex w-full max-w-sm flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICONS[t.type] ?? Info;
          return (
            <motion.div
              key={t.id}
              layout
              variants={toastVariant}
              initial="initial"
              animate="animate"
              exit="exit"
              className="pointer-events-auto flex items-start gap-3 rounded-md border border-border bg-canvas p-3.5 shadow-float"
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ACCENTS[t.type] ?? ""}`} aria-hidden="true" />
              <p className="flex-1 text-sm leading-snug text-ink">{t.message}</p>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => toast.dismiss(t.id)}
                className="shrink-0 rounded p-0.5 text-ink-faint transition-colors hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default Toaster;
