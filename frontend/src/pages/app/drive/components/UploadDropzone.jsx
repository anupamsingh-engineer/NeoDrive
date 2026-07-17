import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { UploadCloud } from "lucide-react";

// Wraps the drive content area, showing a drop overlay while files are dragged over it. The
// depth counter avoids the overlay flickering as the drag crosses child element boundaries.
const UploadDropzone = ({ onFiles, children }) => {
  const [dragging, setDragging] = useState(false);
  const [, setDepth] = useState(0);

  const handleDragEnter = (e) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      setDepth((d) => d + 1);
      setDragging(true);
    }
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDepth((d) => {
      const next = d - 1;
      if (next <= 0) setDragging(false);
      return Math.max(0, next);
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    setDepth(0);
    if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
  };

  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-brand bg-brand-tint/90"
          >
            <UploadCloud className="h-8 w-8 text-brand" aria-hidden="true" />
            <p className="text-sm font-medium text-brand">Drop files to upload</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UploadDropzone;
