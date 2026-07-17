const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse rounded-sm bg-surface-strong ${className}`} aria-hidden="true" />
);

export default Skeleton;
