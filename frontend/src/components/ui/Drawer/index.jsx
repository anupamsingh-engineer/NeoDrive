import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { backdrop, drawerPanel } from "../../../motion";

const Drawer = ({ open, onClose, title, children, width = 280 }) => {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[900]">
          <motion.div
            variants={backdrop}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 bg-ink/40"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            variants={drawerPanel}
            initial="initial"
            animate="animate"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            style={{ width }}
            className="absolute left-0 top-0 flex h-full flex-col border-r border-border bg-canvas shadow-float"
          >
            {title && (
              <div className="flex items-center justify-between border-b border-border px-4 py-4">
                <h2 className="text-sm font-semibold text-ink">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded p-1 text-ink-faint transition-colors hover:bg-surface hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default Drawer;
