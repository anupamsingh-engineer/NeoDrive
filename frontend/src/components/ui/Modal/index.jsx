import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { backdrop, modalPanel } from "../../../motion";

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const Modal = ({ open, onClose, title, children, footer, size = "md" }) => {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const raf = requestAnimationFrame(() => {
      const focusable = panelRef.current?.querySelector(FOCUSABLE_SELECTOR);
      (focusable ?? panelRef.current)?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      cancelAnimationFrame(raf);
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center p-4">
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
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            variants={modalPanel}
            initial="initial"
            animate="animate"
            exit="exit"
            className={`relative z-10 w-full rounded-lg border border-border bg-canvas p-6 shadow-float outline-none ${SIZES[size]}`}
          >
            {title && (
              <div className="mb-4 flex items-start justify-between gap-4">
                <h2 className="text-lg font-semibold text-ink">{title}</h2>
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
            <div>{children}</div>
            {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default Modal;
