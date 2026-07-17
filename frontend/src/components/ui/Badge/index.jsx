const VARIANTS = {
  neutral: "bg-surface-strong text-ink-soft",
  brand: "bg-brand-tint text-brand",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
};

const Badge = ({ children, variant = "neutral", className = "" }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANTS[variant]} ${className}`}
  >
    {children}
  </span>
);

export default Badge;
