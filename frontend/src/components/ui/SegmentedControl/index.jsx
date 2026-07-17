import { motion } from "framer-motion";

const SegmentedControl = ({ options, value, onChange, className = "" }) => (
  <div className={`inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-1 ${className}`}>
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            active ? "text-white" : "text-ink-soft hover:text-ink"
          }`}
        >
          {active && (
            <motion.span
              layoutId="segment-indicator"
              className="absolute inset-0 rounded-full bg-brand"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          {option.icon && <option.icon className="relative z-10 h-4 w-4" aria-hidden="true" />}
          {option.label && <span className="relative z-10">{option.label}</span>}
        </button>
      );
    })}
  </div>
);

export default SegmentedControl;
