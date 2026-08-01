import { motion } from "framer-motion";
import { Folder, Download, Share2, Pencil, Trash2, PlayCircle } from "lucide-react";
import { FileTypeIcon } from "../../../../components/ui";
import { staggerContainer, listItem } from "../../../../motion";
import { isPreviewable, isVideo } from "../utils";
import { getFileDownloadHref } from "../../../../store/api/features/fileApi";

const FileGrid = ({ items, onOpenDirectory, onPreviewFile, onPreviewVideo, onRename, onDelete, onShare }) => (
  <motion.div {...staggerContainer(0.02)} className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
    {items.map((item) => {
      const isDir = item.itemType === "directory";
      const previewable = !isDir && isPreviewable(item.extension) && !item.isUploading;
      const previewableVideo = !isDir && isVideo(item.extension) && !item.isUploading;
      const clickable = isDir || previewable || previewableVideo;

      const handleClick = () => {
        if (isDir) onOpenDirectory(item.id, item.name);
        else if (previewable) onPreviewFile(item);
        else if (previewableVideo) onPreviewVideo(item);
      };

      return (
        <motion.div
          layout
          variants={listItem}
          key={item.key}
          className="group overflow-hidden rounded-md border border-border bg-canvas transition-colors hover:border-border-strong"
        >
          <button
            type="button"
            onClick={handleClick}
            disabled={!clickable}
            className="flex h-24 w-full items-center justify-center overflow-hidden bg-surface disabled:cursor-default"
          >
            <motion.span layoutId={`icon-${item.key}`} className="flex h-full w-full items-center justify-center">
              {isDir ? (
                <Folder className="h-9 w-9 text-brand" aria-hidden="true" />
              ) : previewable ? (
                <img src={getFileDownloadHref(item.id)} alt="" className="h-full w-full object-cover" />
              ) : previewableVideo ? (
                <PlayCircle className="h-9 w-9 text-ink-faint" aria-hidden="true" />
              ) : (
                <FileTypeIcon extension={item.extension} className="h-9 w-9 text-ink-faint" />
              )}
            </motion.span>
          </button>
          <div className="flex items-center gap-1.5 px-2.5 py-2">
            <p className="flex-1 truncate text-xs text-ink" title={item.name}>
              {item.name}
            </p>
            <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {item.itemType === "file" && (
                <a
                  href={getFileDownloadHref(item.id, "download")}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Download"
                  className="rounded p-1 text-ink-faint transition-colors hover:bg-surface hover:text-ink"
                >
                  <Download className="h-3 w-3" />
                </a>
              )}
              <button
                type="button"
                aria-label="Share"
                onClick={() => onShare(item)}
                className="rounded p-1 text-ink-faint transition-colors hover:bg-surface hover:text-ink"
              >
                <Share2 className="h-3 w-3" />
              </button>
              <button
                type="button"
                aria-label="Rename"
                onClick={() => onRename(item)}
                className="rounded p-1 text-ink-faint transition-colors hover:bg-surface hover:text-ink"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                type="button"
                aria-label="Delete"
                onClick={() => onDelete(item)}
                className="rounded p-1 text-ink-faint transition-colors hover:bg-danger-tint hover:text-danger"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        </motion.div>
      );
    })}
  </motion.div>
);

export default FileGrid;
