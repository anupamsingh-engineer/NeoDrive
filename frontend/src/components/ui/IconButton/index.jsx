import { motion } from "framer-motion";
import Spinner from "../Spinner";

const VARIANTS = {
  ghost: "bg-transparent text-ink-soft hover:bg-surface hover:text-ink",
  secondary: "bg-canvas text-ink-soft border border-border hover:border-border-strong hover:text-ink",
  danger: "bg-transparent text-ink-soft hover:bg-danger-tint hover:text-danger",
};

const SIZES = {
  sm: "h-7 w-7 rounded-sm [&_svg]:h-3.5 [&_svg]:w-3.5",
  md: "h-9 w-9 rounded-sm [&_svg]:h-4 [&_svg]:w-4",
};

const IconButton = ({
  icon: Icon,
  label,
  variant = "ghost",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  ...rest
}) => (
  <motion.button
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled || loading}
    whileTap={disabled || loading ? undefined : { scale: 0.93 }}
    transition={{ type: "spring", stiffness: 500, damping: 30 }}
    className={`inline-flex shrink-0 items-center justify-center transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    {...rest}
  >
    {loading ? <Spinner size="sm" /> : <Icon aria-hidden="true" />}
  </motion.button>
);

export default IconButton;
