import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Folder, Download, Link2Off } from "lucide-react";
import { useGetShareViewQuery, getShareFileHref, getShareDirectoryZipHref } from "../../../store/api/features/shareApi";
import { Spinner, EmptyState, Breadcrumbs, Table, FileTypeIcon, Button } from "../../../components/ui";
import { formatBytes } from "../../../utils/utils";
import { isPreviewable, isVideo } from "../../app/drive/utils";
import FilePreviewLightbox from "../../app/drive/components/FilePreviewLightbox";
import VideoPreviewModal from "../../app/drive/components/VideoPreviewModal";

// Public, chromeless page - reachable by anyone with a share link, logged in or not (see
// PublicRoutes.jsx, registered as a sibling outside PublicLayout). Query-string based
// navigation (?dirId=) mirrors the backend's own contract, unlike DrivePage's path-param style.
const ShareView = () => {
  const { token } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const dirId = searchParams.get("dirId") || undefined;

  const { data, isLoading, isError } = useGetShareViewQuery({ token, dirId });
  const [previewFile, setPreviewFile] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);

  const view = data?.data;

  const handleNavigate = (id) => {
    if (id === null) setSearchParams({});
    else setSearchParams({ dirId: id });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" className="text-brand" />
      </div>
    );
  }

  if (isError || !view) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          icon={Link2Off}
          title="This link is invalid or has been turned off"
          description="Ask the person who shared it with you for a new link."
        />
      </div>
    );
  }

  if (view.resourceType === "file") {
    const { file } = view;
    const previewable = isPreviewable(file.extension);
    const previewableVideo = isVideo(file.extension);

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
        <div className="flex flex-col items-center gap-3">
          <FileTypeIcon extension={file.extension} className="h-16 w-16 text-ink-faint" />
          <p className="text-lg font-medium text-ink">{file.name}</p>
          <p className="text-sm text-ink-soft">{formatBytes(file.size)}</p>
        </div>
        <div className="flex gap-2">
          {(previewable || previewableVideo) && (
            <Button variant="secondary" onClick={() => (previewable ? setPreviewFile(file) : setPreviewVideo(file))}>
              Preview
            </Button>
          )}
          <a href={getShareFileHref(token, file.id, "download")} target="_blank" rel="noreferrer">
            <Button icon={Download}>Download</Button>
          </a>
        </div>

        <FilePreviewLightbox
          file={previewFile}
          src={previewFile ? getShareFileHref(token, previewFile.id) : undefined}
          downloadHref={previewFile ? getShareFileHref(token, previewFile.id, "download") : undefined}
          onClose={() => setPreviewFile(null)}
        />
        <VideoPreviewModal
          file={previewVideo}
          src={previewVideo ? getShareFileHref(token, previewVideo.id) : undefined}
          onClose={() => setPreviewVideo(null)}
        />
      </div>
    );
  }

  // Directory share: breadcrumbs are the share-scoped ancestors the backend already cut at the
  // share root, plus the current folder itself when we're not sitting at the root.
  const trail = dirId ? [...(view.ancestors || []), { id: view.directory.id, name: view.directory.name }] : [];
  const rows = [
    ...view.directories.map((d) => ({ ...d, key: `dir-${d.id}`, itemType: "directory" })),
    ...view.files.map((f) => ({ ...f, key: `file-${f.id}`, itemType: "file" })),
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-5 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink-soft">Shared folder</p>
          <h1 className="text-xl font-semibold text-ink">{view.directory.name}</h1>
        </div>
        <Button
          variant="secondary"
          icon={Download}
          onClick={() => window.open(getShareDirectoryZipHref(token, dirId), "_blank", "noopener,noreferrer")}
        >
          Download as zip
        </Button>
      </div>

      <Breadcrumbs items={trail} onNavigate={handleNavigate} />

      {rows.length === 0 ? (
        <EmptyState icon={Folder} title="This folder is empty" />
      ) : (
        <Table>
          <Table.Head>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell className="w-28">Size</Table.HeaderCell>
            <Table.HeaderCell className="w-16 text-right">Actions</Table.HeaderCell>
          </Table.Head>
          <Table.Body>
            {rows.map((item) => {
              const isDir = item.itemType === "directory";
              const previewable = !isDir && isPreviewable(item.extension);
              const previewableVideo = !isDir && isVideo(item.extension);
              const clickable = isDir || previewable || previewableVideo;

              const handleClick = () => {
                if (isDir) handleNavigate(item.id);
                else if (previewable) setPreviewFile(item);
                else if (previewableVideo) setPreviewVideo(item);
              };

              return (
                <Table.Row key={item.key}>
                  <Table.Cell>
                    <button
                      type="button"
                      onClick={handleClick}
                      disabled={!clickable}
                      className="flex items-center gap-2.5 text-left text-sm text-ink disabled:cursor-default"
                    >
                      {isDir ? (
                        <Folder className="h-5 w-5 text-brand" aria-hidden="true" />
                      ) : (
                        <FileTypeIcon extension={item.extension} className="h-5 w-5 text-ink-faint" />
                      )}
                      <span className={clickable ? "hover:underline" : ""}>{item.name}</span>
                    </button>
                  </Table.Cell>
                  <Table.Cell className="text-ink-soft">{isDir ? "—" : formatBytes(item.size)}</Table.Cell>
                  <Table.Cell className="text-right">
                    <a
                      href={
                        isDir
                          ? getShareDirectoryZipHref(token, item.id)
                          : getShareFileHref(token, item.id, "download")
                      }
                      target="_blank"
                      rel="noreferrer"
                      aria-label={isDir ? "Download folder as zip" : "Download"}
                      title={isDir ? "Download folder as zip" : "Download"}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      )}

      <FilePreviewLightbox
        file={previewFile}
        src={previewFile ? getShareFileHref(token, previewFile.id) : undefined}
        downloadHref={previewFile ? getShareFileHref(token, previewFile.id, "download") : undefined}
        onClose={() => setPreviewFile(null)}
      />
      <VideoPreviewModal
        file={previewVideo}
        src={previewVideo ? getShareFileHref(token, previewVideo.id) : undefined}
        onClose={() => setPreviewVideo(null)}
      />
    </div>
  );
};

export default ShareView;
