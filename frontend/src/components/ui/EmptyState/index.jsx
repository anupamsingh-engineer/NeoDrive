const EmptyState = ({ icon: Icon, title, description, action, className = "" }) => (
  <div className={`flex flex-col items-center justify-center gap-3 py-16 text-center ${className}`}>
    {Icon && (
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
        <Icon className="h-6 w-6 text-ink-faint" aria-hidden="true" />
      </div>
    )}
    {title && <p className="text-sm font-medium text-ink">{title}</p>}
    {description && <p className="max-w-xs text-sm text-ink-soft">{description}</p>}
    {action && <div className="mt-1">{action}</div>}
  </div>
);

export default EmptyState;
