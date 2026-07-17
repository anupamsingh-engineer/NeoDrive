import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { LayoutGroup, AnimatePresence } from "framer-motion";
import {
  useGetDirectoryQuery,
  useCreateDirectoryMutation,
  useRenameDirectoryMutation,
  useDeleteDirectoryMutation,
} from "../../../store/api/features/directoryApi";
import {
  useRenameFileMutation,
  useDeleteFileMutation,
  getFileDownloadHref,
} from "../../../store/api/features/fileApi";
import { Spinner, EmptyState, ConfirmDialog, Breadcrumbs, toast } from "../../../components/ui";
import { FolderOpen } from "lucide-react";
import Toolbar from "./components/Toolbar";
import FileList from "./components/FileList";
import FileGrid from "./components/FileGrid";
import UploadDropzone from "./components/UploadDropzone";
import UploadProgressTray from "./components/UploadProgressTray";
import NewFolderModal from "./components/NewFolderModal";
import RenameModal from "./components/RenameModal";
import FilePreviewLightbox from "./components/FilePreviewLightbox";
import VideoPreviewModal from "./components/VideoPreviewModal";
import useDriveViewMode from "./hooks/useDriveViewMode";
import useFileUpload from "./hooks/useFileUpload";

const DrivePage = () => {
  const { dirId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useGetDirectoryQuery(dirId);
  const [createDirectory, { isLoading: isCreatingFolder }] = useCreateDirectoryMutation();
  const [renameDirectory, { isLoading: isRenamingDir }] = useRenameDirectoryMutation();
  const [deleteDirectory] = useDeleteDirectoryMutation();
  const [renameFile, { isLoading: isRenamingFile }] = useRenameFileMutation();
  const [deleteFile] = useDeleteFileMutation();

  const [viewMode, setViewMode] = useDriveViewMode();
  const { queue, uploadFiles, dismissItem } = useFileUpload(dirId);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renaming, setRenaming] = useState(null); // { type, id, name }
  const [deleting, setDeleting] = useState(null); // { type, id, name }
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);

  const directory = data?.data;

  // Breadcrumb trail comes straight from the API's ancestor chain (root-first) plus the
  // current directory itself - always correct on back/forward, refresh, and deep links,
  // since nothing is reconstructed or persisted client-side.
  const trail = dirId && directory ? [...(directory.ancestors || []), { id: directory.id, name: directory.name }] : [];

  const handleOpenDirectory = (id) => {
    navigate(`/app/drive/${id}`);
  };

  const handleBreadcrumbNavigate = (id) => {
    if (id === null) {
      navigate("/app/drive");
      return;
    }
    navigate(`/app/drive/${id}`);
  };

  const handleCreateFolder = async (name) => {
    try {
      await createDirectory({ parentDirId: dirId, dirname: name }).unwrap();
      toast.success("Folder created");
      setNewFolderOpen(false);
    } catch (err) {
      toast.error(err?.data?.message || "Failed to create folder");
    }
  };

  const handleRename = async (newName) => {
    try {
      if (renaming.type === "directory") {
        await renameDirectory({ dirId: renaming.id, newDirName: newName }).unwrap();
      } else {
        await renameFile({ fileId: renaming.id, newFilename: newName }).unwrap();
      }
      toast.success("Renamed");
      setRenaming(null);
    } catch (err) {
      toast.error(err?.data?.message || "Rename failed");
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (deleting.type === "directory") {
        await deleteDirectory(deleting.id).unwrap();
      } else {
        await deleteFile(deleting.id).unwrap();
      }
      toast.success(`"${deleting.name}" deleted`);
      setDeleting(null);
    } catch (err) {
      toast.error(err?.data?.message || "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Spinner size="lg" className="text-brand" />
      </div>
    );
  }

  if (!directory) {
    return <EmptyState icon={FolderOpen} title="Directory not found" />;
  }

  const rows = [
    ...directory.directories.map((d) => ({ ...d, key: `dir-${d.id}`, itemType: "directory" })),
    ...directory.files.map((f) => ({ ...f, key: `file-${f.id}`, itemType: "file" })),
  ];

  const sharedListProps = {
    items: rows,
    onOpenDirectory: handleOpenDirectory,
    onPreviewFile: setPreviewFile,
    onPreviewVideo: setPreviewVideo,
    onRename: (item) => setRenaming({ type: item.itemType, id: item.id, name: item.name }),
    onDelete: (item) => setDeleting({ type: item.itemType, id: item.id, name: item.name }),
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <Breadcrumbs items={trail} onNavigate={handleBreadcrumbNavigate} />

      <Toolbar viewMode={viewMode} onViewModeChange={setViewMode} onNewFolder={() => setNewFolderOpen(true)} onUploadFiles={uploadFiles} />

      <UploadDropzone onFiles={uploadFiles}>
        {rows.length === 0 ? (
          <EmptyState icon={FolderOpen} title="This folder is empty" description="Upload a file or create a folder to get started." />
        ) : (
          <LayoutGroup>
            <AnimatePresence mode="wait" initial={false}>
              {viewMode === "list" ? (
                <FileList key="list" {...sharedListProps} />
              ) : (
                <FileGrid key="grid" {...sharedListProps} />
              )}
            </AnimatePresence>
          </LayoutGroup>
        )}
      </UploadDropzone>

      <UploadProgressTray items={queue} onDismiss={dismissItem} />

      <NewFolderModal open={newFolderOpen} onClose={() => setNewFolderOpen(false)} onCreate={handleCreateFolder} loading={isCreatingFolder} />

      <RenameModal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        initialName={renaming?.name}
        onRename={handleRename}
        loading={renaming?.type === "directory" ? isRenamingDir : isRenamingFile}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleConfirmDelete}
        title={`Delete "${deleting?.name}"?`}
        description={deleting?.type === "directory" ? "This deletes everything inside it too." : undefined}
        confirmText="Delete"
        danger
        loading={isDeleting}
      />

      <FilePreviewLightbox
        file={previewFile}
        src={previewFile ? getFileDownloadHref(previewFile.id) : undefined}
        downloadHref={previewFile ? getFileDownloadHref(previewFile.id, "download") : undefined}
        onClose={() => setPreviewFile(null)}
      />

      <VideoPreviewModal
        file={previewVideo}
        src={previewVideo ? getFileDownloadHref(previewVideo.id) : undefined}
        onClose={() => setPreviewVideo(null)}
      />
    </div>
  );
};

export default DrivePage;
