import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Download } from "lucide-react";
import { backdrop } from "../../../../motion";

const FilePreviewLightbox = ({ file, src, downloadHref, onClose }) => {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    setZoomed(false);
    if (!file) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [file, onClose]);

  return createPortal(
    <AnimatePresence>
      {file && (
        <motion.div
          variants={backdrop}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-0 z-[950] flex flex-col bg-ink/90"
          onClick={onClose}
        >
          <div className="flex items-center justify-between px-5 py-4" onClick={(e) => e.stopPropagation()}>
            <p className="truncate text-sm text-white/90">{file.name}</p>
            <div className="flex items-center gap-1">
              <a
                href={downloadHref}
                target="_blank"
                rel="noreferrer"
                aria-label="Download"
                className="rounded p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Download className="h-5 w-5" />
              </a>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto p-6">
            <motion.img
              src={src}
              alt={file.name}
              onClick={(e) => {
                e.stopPropagation();
                setZoomed((z) => !z);
              }}
              animate={{ scale: zoomed ? 1.8 : 1 }}
              transition={{ duration: 0.2 }}
              className="max-h-full max-w-full cursor-zoom-in rounded-sm object-contain shadow-float"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default FilePreviewLightbox;
