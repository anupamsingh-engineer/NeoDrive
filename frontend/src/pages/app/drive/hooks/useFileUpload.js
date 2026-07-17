import { useCallback, useState } from "react";
import {
  useUploadInitiateMutation,
  useUploadCompleteMutation,
} from "../../../../store/api/features/fileApi";
import { toast } from "../../../../components/ui";

let nextUploadId = 0;

// Extracts the exact initiate -> XHR PUT (progress) -> complete flow, fed by both a native
// file input and drag/drop events since both only ever hand over raw File objects.
const useFileUpload = (parentDirId) => {
  const [uploadInitiate] = useUploadInitiateMutation();
  const [uploadComplete] = useUploadCompleteMutation();
  const [queue, setQueue] = useState([]);

  const updateItem = useCallback((id, patch) => {
    setQueue((q) => q.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const dismissItem = useCallback((id) => {
    setQueue((q) => q.filter((item) => item.id !== id));
  }, []);

  const uploadFile = useCallback(
    async (file) => {
      const id = ++nextUploadId;
      setQueue((q) => [...q, { id, name: file.name, progress: 0, status: "uploading" }]);

      try {
        const { data } = await uploadInitiate({
          parentDirId,
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }).unwrap();
        const { uploadSignedUrl, fileId } = data;

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadSignedUrl);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) updateItem(id, { progress: (e.loaded / e.total) * 100 });
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error("Upload to storage failed"));
          xhr.onerror = () => reject(new Error("Upload to storage failed"));
          xhr.send(file);
        });

        await uploadComplete({ fileId }).unwrap();
        updateItem(id, { status: "done", progress: 100 });
        toast.success(`${file.name} uploaded`);
        setTimeout(() => dismissItem(id), 2500);
      } catch (err) {
        updateItem(id, { status: "error" });
        toast.error(err?.data?.message || err?.message || "Upload failed");
      }
    },
    [parentDirId, uploadInitiate, uploadComplete, updateItem, dismissItem],
  );

  const uploadFiles = useCallback(
    (fileList) => {
      Array.from(fileList).forEach((file) => uploadFile(file));
    },
    [uploadFile],
  );

  return { queue, uploadFiles, dismissItem };
};

export default useFileUpload;
