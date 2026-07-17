import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const Dropdown = ({ trigger, items = [], align = "right" }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -2 }}
            transition={{ duration: 0.15 }}
            style={{ transformOrigin: align === "right" ? "top right" : "top left" }}
            className={`absolute top-full z-50 mt-2 min-w-[180px] rounded-md border border-border bg-canvas p-1 shadow-float ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {items.map((item, i) =>
              item.divider ? (
                <div key={`divider-${i}`} className="my-1 h-px bg-border" />
              ) : (
                <button
                  key={item.key ?? item.label}
                  type="button"
                  onClick={() => {
                    item.onClick?.();
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-surface ${
                    item.danger ? "text-danger" : "text-ink"
                  }`}
                >
                  {item.icon && <item.icon className="h-4 w-4" aria-hidden="true" />}
                  {item.label}
                </button>
              ),
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dropdown;
