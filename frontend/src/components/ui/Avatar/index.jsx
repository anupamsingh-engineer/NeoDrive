import { useState } from "react";

const SIZES = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
};

const initialsOf = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

const Avatar = ({ src, name, size = "md", className = "" }) => {
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-tint font-semibold text-brand ${SIZES[size]} ${className}`}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={name ?? "Avatar"}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
};

export default Avatar;
