import { motion } from "framer-motion";

const colorFor = (percent) => {
  if (percent >= 95) return "bg-danger";
  if (percent >= 80) return "bg-warning";
  return "bg-brand";
};

const ProgressBar = ({ percent = 0, className = "" }) => {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-2 w-full overflow-hidden rounded-full bg-surface-strong ${className}`}
    >
      <motion.div
        className={`h-full rounded-full ${colorFor(clamped)}`}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
};

export default ProgressBar;
