import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { ProgressBar } from "../../../../components/ui";

const UploadProgressTray = ({ items, onDismiss }) => {
  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 w-80 overflow-hidden rounded-lg border border-border bg-canvas shadow-float">
      <div className="border-b border-border px-4 py-2.5 text-sm font-medium text-ink">
        Uploads ({items.length})
      </div>
      <div className="max-h-72 overflow-y-auto">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b border-border px-4 py-3 last:border-b-0"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="truncate text-sm text-ink">{item.name}</span>
                <span className="ml-auto shrink-0">
                  {item.status === "done" && <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />}
                  {item.status === "error" && <AlertCircle className="h-4 w-4 text-danger" aria-hidden="true" />}
                  {item.status === "uploading" && (
                    <button
                      type="button"
                      onClick={() => onDismiss(item.id)}
                      aria-label="Dismiss"
                      className="text-ink-faint transition-colors hover:text-ink"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              </div>
              {item.status === "uploading" && <ProgressBar percent={item.progress} />}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default UploadProgressTray;
