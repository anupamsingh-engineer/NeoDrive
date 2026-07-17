import { ChevronRight, Home } from "lucide-react";
import { motion } from "framer-motion";

const Breadcrumbs = ({ items = [], onNavigate }) => (
  <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm">
    <button
      type="button"
      onClick={() => onNavigate?.(null)}
      aria-label="Go to root folder"
      className="flex items-center gap-1 rounded px-1.5 py-1 text-ink-soft transition-colors hover:bg-surface hover:text-ink"
    >
      <Home className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
    {items.map((item, i) => {
      const isLast = i === items.length - 1;
      return (
        <motion.div layout key={item.id} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 text-ink-faint" aria-hidden="true" />
          <button
            type="button"
            disabled={isLast}
            onClick={() => onNavigate?.(item.id)}
            className={`rounded px-1.5 py-1 transition-colors ${
              isLast ? "font-medium text-ink" : "text-ink-soft hover:bg-surface hover:text-ink"
            }`}
          >
            {item.name}
          </button>
        </motion.div>
      );
    })}
  </nav>
);

export default Breadcrumbs;
