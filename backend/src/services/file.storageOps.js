// Thin seam between domain services and S3 cleanup: deletes are enqueued onto the
// s3-cleanup BullMQ queue so directory/file delete requests don't wait on S3 latency/retries.
import { enqueueS3Delete, enqueueS3BatchDelete } from "../queues/s3Cleanup.queue.js";

// Shared S3 object-key format (file id + extension), used wherever a file/directory service
// needs to build the key for an existing file - upload, download, or delete.
export function objectKey(id, extension) {
  return `${id}${extension}`;
}

export async function scheduleS3Cleanup(keys) {
  await enqueueS3BatchDelete(keys);
}

export async function scheduleS3Delete(key) {
  await enqueueS3Delete(key);
}
