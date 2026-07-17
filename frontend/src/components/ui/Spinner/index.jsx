const SIZES = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
};

const Spinner = ({ size = "md", className = "" }) => (
  <svg
    className={`animate-spin ${SIZES[size] ?? SIZES.md} ${className}`}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
    <path
      className="opacity-90"
      fill="currentColor"
      d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2Z"
    />
  </svg>
);

export default Spinner;
