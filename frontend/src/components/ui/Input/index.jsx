import { forwardRef, useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";

const Input = forwardRef(
  (
    {
      label,
      error,
      prefixIcon: PrefixIcon,
      type = "text",
      className = "",
      id,
      ...rest
    },
    ref,
  ) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const [visible, setVisible] = useState(false);
    const isPassword = type === "password";
    const resolvedType = isPassword ? (visible ? "text" : "password") : type;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {PrefixIcon && (
            <PrefixIcon className="pointer-events-none absolute left-3 h-4 w-4 text-ink-faint" aria-hidden="true" />
          )}
          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            aria-invalid={!!error}
            className={`h-11 w-full rounded-sm border bg-canvas text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand-tint ${
              error ? "border-danger focus:border-danger focus:ring-danger-tint" : "border-border"
            } ${PrefixIcon ? "pl-10" : "pl-3.5"} ${isPassword ? "pr-10" : "pr-3.5"} ${className}`}
            {...rest}
          />
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Hide password" : "Show password"}
              className="absolute right-3 text-ink-faint transition-colors hover:text-ink-soft"
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden text-xs text-danger"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

Input.displayName = "Input";

export default Input;
