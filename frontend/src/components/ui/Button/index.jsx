import { motion } from "framer-motion";
import Spinner from "../Spinner";

const VARIANTS = {
  primary: "bg-brand text-white hover:bg-brand-hover active:bg-brand-active disabled:bg-brand/50",
  secondary:
    "bg-canvas text-ink border border-border hover:border-border-strong hover:bg-surface disabled:opacity-50",
  ghost: "bg-transparent text-ink hover:bg-surface disabled:opacity-50",
  danger: "bg-danger text-white hover:bg-danger/90 active:bg-danger disabled:bg-danger/50",
};

const SIZES = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-sm",
  md: "h-10 px-4 text-sm gap-2 rounded-sm",
  lg: "h-12 px-5 text-base gap-2 rounded-md",
};

const Button = ({
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  disabled = false,
  icon: Icon,
  iconPosition = "left",
  className = "",
  children,
  type = "button",
  ...rest
}) => {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      type={type}
      disabled={isDisabled}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`inline-flex items-center justify-center font-medium transition-colors duration-150 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === "lg" ? "md" : "sm"} />
      ) : (
        <>
          {Icon && iconPosition === "left" && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
          {children}
          {Icon && iconPosition === "right" && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
        </>
      )}
    </motion.button>
  );
};

export default Button;
