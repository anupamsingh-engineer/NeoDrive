import { ChevronLeft, ChevronRight } from "lucide-react";

const Pagination = ({ current, pageSize, total, onChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-between gap-4 px-1 py-3">
      <p className="text-xs text-ink-faint">
        Page {current} of {totalPages} · {total} total
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={current <= 1}
          onClick={() => onChange(current - 1)}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-border text-ink-soft transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`h-8 min-w-8 rounded-sm px-2 text-sm transition-colors ${
              p === current ? "bg-brand text-white" : "text-ink-soft hover:bg-surface"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          disabled={current >= totalPages}
          onClick={() => onChange(current + 1)}
          aria-label="Next page"
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-border text-ink-soft transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
