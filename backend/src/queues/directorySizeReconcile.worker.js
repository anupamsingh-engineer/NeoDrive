import { Worker } from "bullmq";
import { getQueueConnection } from "./connection.js";
import * as directoryRepository from "../repositories/directory.repository.js";
import * as fileRepository from "../repositories/file.repository.js";
import { invalidateDirectoryListings } from "../services/cache.service.js";
import logger from "../config/logger.js";
import { storageBytesUsed } from "../config/metrics.js";

// Recomputes every directory's size bottom-up from actual file sizes, correcting any drift
// left behind by the incremental updateDirectoriesSize walk (e.g. from a crashed request
// between a file write and its ancestor-size update). Safe to re-run; only writes deltas.
async function reconcileAllDirectorySizes() {
  const [directories, fileTotals] = await Promise.all([
    directoryRepository.findAll(),
    fileRepository.aggregateSizeByParentDir(),
  ]);

  const dirById = new Map(directories.map((dir) => [String(dir._id), dir]));
  const fileTotalByDir = new Map(fileTotals.map((f) => [String(f._id), f.total]));
  const childrenByParent = new Map();

  for (const dir of directories) {
    const parentKey = dir.parentDirId ? String(dir.parentDirId) : "root";
    if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, []);
    childrenByParent.get(parentKey).push(String(dir._id));
  }

  const computedSizes = new Map();

  function computeSize(dirId) {
    if (computedSizes.has(dirId)) return computedSizes.get(dirId);
    const ownFiles = fileTotalByDir.get(dirId) || 0;
    const children = childrenByParent.get(dirId) || [];
    const total = ownFiles + children.reduce((sum, childId) => sum + computeSize(childId), 0);
    computedSizes.set(dirId, total);
    return total;
  }

  for (const dir of directories) computeSize(String(dir._id));

  const updates = directories
    .map((dir) => ({ _id: dir._id, userId: dir.userId, size: computedSizes.get(String(dir._id)) ?? 0 }))
    .filter((update) => update.size !== dirById.get(String(update._id)).size);

  if (updates.length) {
    await directoryRepository.bulkSetSizes(updates);
    // Corrected sizes must be reflected immediately, not after the listing cache's normal TTL -
    // otherwise the whole point of drift-correction is silently defeated for up to that TTL.
    await Promise.all(
      updates.map((update) => invalidateDirectoryListings(update.userId, update._id.toString()))
    );
  }

  const totalUsedBytes = (childrenByParent.get("root") || []).reduce(
    (sum, rootDirId) => sum + (computedSizes.get(rootDirId) || 0),
    0
  );
  storageBytesUsed.set({ plan: "all" }, totalUsedBytes);

  logger.info(
    { totalDirectories: directories.length, correctedCount: updates.length, totalUsedBytes },
    "Directory size reconciliation complete"
  );

  return { totalDirectories: directories.length, correctedCount: updates.length };
}

export const directorySizeReconcileWorker = new Worker(
  "directory-size-reconcile",
  async () => reconcileAllDirectorySizes(),
  { connection: getQueueConnection(), concurrency: 1 }
);

directorySizeReconcileWorker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "directory-size-reconcile job failed");
});
