/**
 * Storage backend contract implemented by s3.storage.js (uploads/object ops) and
 * cloudfront.storage.js (signed download URLs). Kept as a documented interface rather
 * than a swappable-provider abstraction since this app has one storage backend today -
 * but any future provider (e.g. GCS) should implement the same shape:
 *
 * createUploadSignedUrl({ key, contentType }) => Promise<string>
 * getFileMetadata(key) => Promise<{ ContentLength, ContentType, ... }>
 * deleteFile(key) => Promise<void>
 * deleteFiles(keys: { Key: string }[]) => Promise<void>
 * createGetSignedUrl({ key, download, filename }) => string
 */
