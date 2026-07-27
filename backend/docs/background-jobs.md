# Background Jobs (BullMQ)

Code: `src/queues/*.queue.js` (producers), `src/queues/*.worker.js` (consumers),
`src/queues/connection.js`, `src/queues/index.js`, `src/worker.js`.

Not an HTTP feature — no routes here — but every feature above enqueues work onto one of these
three queues, so this is where that work actually executes.

## Why a separate process

`server.js` (the API) only **produces** jobs. `src/worker.js` is a second entry point
(`npm run worker` / `worker:dev`, the `worker` service in `docker-compose.yml`) that starts the
three `Worker` instances which actually **consume** them. Same codebase/image, different running
process — so a slow email provider or a large batch S3 delete never blocks request handling. Both
processes connect to the same Redis instance; BullMQ uses it as the job store/broker. Each
`Queue`/`Worker` gets its own ioredis connection (`createQueueConnection()` in
`src/config/redis.js`) — BullMQ's blocking commands can't share a connection with normal
request-path Redis usage.

If you run `npm run dev` without also running `npm run worker:dev`, jobs will queue up in Redis
but never execute — OTP/password-reset emails won't send and deleted files' S3 objects won't be
cleaned up, even though the API endpoints that enqueue them will still return success.

## `email` queue

| | |
|---|---|
| Producer | `src/queues/email.queue.js` |
| Consumer | `src/queues/email.worker.js` → `src/services/email.service.js` (Resend) |
| Concurrency | 10 |
| Retries | 3 attempts, exponential backoff (3s base) |
| Job names | `send-otp` `{ email, otp }` · `send-password-reset` `{ email, resetToken }` |

Enqueued by `otpService.requestOtp` (`/auth/send-otp`) and `authService.forgotPassword`
(`/auth/forgot-password`). See [authentication.md](./authentication.md).

## `s3-cleanup` queue

| | |
|---|---|
| Producer | `src/services/file.storageOps.js` → `src/queues/s3Cleanup.queue.js` |
| Consumer | `src/queues/s3Cleanup.worker.js` → `src/services/storage/s3.storage.js` |
| Concurrency | 5 |
| Retries | 3 attempts, exponential backoff (2s base) |
| Job names | `delete-single` `{ key }` · `delete-batch` `{ keys: [{ Key }] }` |

Enqueued whenever a file or a directory (recursively, batched) is deleted — see
[files.md](./files.md) and [directories.md](./directories.md). The Mongo record is gone by the
time the API responds; the underlying S3 object is removed shortly after, asynchronously. If you
delete a file and immediately check the S3 bucket, the object may still briefly be there.

## `directory-size-reconcile` queue

| | |
|---|---|
| Producer | `src/queues/directorySizeReconcile.queue.js`, scheduled once at API boot (`initQueueProducers`) |
| Consumer | `src/queues/directorySizeReconcile.worker.js` |
| Concurrency | 1 |
| Schedule | repeatable job, cron `0 2 * * *` (02:00 daily), fixed `jobId: "nightly-reconcile"` so re-scheduling it on every app restart doesn't create duplicates |

**What it does**: directory `size` is normally maintained incrementally (every upload/delete
`$inc`s the affected ancestor chain — see [directories.md](./directories.md)). That's fast but
can drift if a request crashes between updating a file and finishing its ancestor-chain walk.
This job recomputes every directory's size **bottom-up from actual file sizes** (only counting
files where `isUploading: false`), compares against the stored value, and bulk-writes only the
directories that actually changed — then immediately busts the listing cache for each of those
(so a corrected size doesn't wait out the normal 45s cache TTL) and publishes the
`storage_bytes_used` gauge metric. Safe to run repeatedly; a no-drift run writes nothing.

## Job options, generally

All three queues set `removeOnComplete`/`removeOnFail` (keeps Redis from accumulating a job
history forever) and retry with exponential backoff rather than failing permanently on the first
error — a transient Resend/S3 blip resolves itself without any manual intervention. A job that
exhausts all retries logs an error (`logger.error({ err, jobId, jobName }, "<queue> job failed")`)
but does not page/alert anything by itself — see [observability.md](./observability.md) for the
`queue_depth` gauge, which is the metric to alert on if jobs are piling up faster than they're
processed.
