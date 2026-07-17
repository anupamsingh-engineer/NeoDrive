import { motion } from "framer-motion";
import { Folder, Download, Pencil, Trash2 } from "lucide-react";
import { Table, FileTypeIcon } from "../../../../components/ui";
import { formatBytes } from "../../../../utils/utils";
import { staggerContainer, listItem } from "../../../../motion";
import { isPreviewable, isVideo } from "../utils";
import { getFileDownloadHref } from "../../../../store/api/features/fileApi";

const actionButtonClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink";

const FileList = ({ items, onOpenDirectory, onPreviewFile, onPreviewVideo, onRename, onDelete }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
    <Table>
      <Table.Head>
        <Table.HeaderCell>Name</Table.HeaderCell>
        <Table.HeaderCell className="w-28">Size</Table.HeaderCell>
        <Table.HeaderCell className="w-44">Modified</Table.HeaderCell>
        <Table.HeaderCell className="w-28 text-right">Actions</Table.HeaderCell>
      </Table.Head>
      <motion.tbody {...staggerContainer(0.03)} className="divide-y divide-border">
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
            <motion.tr layout variants={listItem} key={item.key} className="transition-colors hover:bg-surface/60">
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={handleClick}
                  disabled={!clickable}
                  className="flex items-center gap-2.5 text-left text-sm text-ink disabled:cursor-default"
                >
                  <motion.span layoutId={`icon-${item.key}`} className="flex h-5 w-5 items-center justify-center">
                    {isDir ? (
                      <Folder className="h-5 w-5 text-brand" aria-hidden="true" />
                    ) : (
                      <FileTypeIcon extension={item.extension} className="h-5 w-5 text-ink-faint" />
                    )}
                  </motion.span>
                  <span className={clickable ? "hover:underline" : ""}>{item.name}</span>
                  {item.isUploading && <span className="text-xs text-ink-faint">(processing…)</span>}
                </button>
              </td>
              <td className="px-4 py-3 text-sm text-ink-soft">{isDir ? "—" : formatBytes(item.size)}</td>
              <td className="px-4 py-3 text-sm text-ink-soft">{new Date(item.updatedAt).toLocaleString()}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  {item.itemType === "file" && (
                    <a
                      href={getFileDownloadHref(item.id, "download")}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Download"
                      title="Download"
                      className={actionButtonClass}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button type="button" aria-label="Rename" title="Rename" onClick={() => onRename(item)} className={actionButtonClass}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete"
                    title="Delete"
                    onClick={() => onDelete(item)}
                    className={`${actionButtonClass} hover:bg-danger-tint hover:text-danger`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </motion.tr>
          );
        })}
      </motion.tbody>
    </Table>
  </motion.div>
);

export default FileList;
