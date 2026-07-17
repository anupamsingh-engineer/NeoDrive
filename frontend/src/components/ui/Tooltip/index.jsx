import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const Tooltip = ({ content, children, side = "top" }) => {
  const [open, setOpen] = useState(false);

  const positionClass =
    side === "top"
      ? "bottom-full left-1/2 mb-2 -translate-x-1/2"
      : side === "bottom"
        ? "top-full left-1/2 mt-2 -translate-x-1/2"
        : side === "left"
          ? "right-full top-1/2 mr-2 -translate-y-1/2"
          : "left-full top-1/2 ml-2 -translate-y-1/2";

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && content && (
          <motion.span
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.12 }}
            role="tooltip"
            className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-sm bg-ink px-2 py-1 text-xs text-white ${positionClass}`}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
};

export default Tooltip;
