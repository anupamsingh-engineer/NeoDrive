import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import env from "../../config/env.js";
import logger from "../../config/logger.js";
import { s3OperationErrorsTotal } from "../../config/metrics.js";

const s3Client = new S3Client({
  region: env.aws.region,
  credentials: {
    accessKeyId: env.aws.accessKeyId,
    secretAccessKey: env.aws.secretAccessKey,
  },
});

const UPLOAD_URL_EXPIRY_SECONDS = 300; // 5 minutes

export async function createUploadSignedUrl({ key, contentType }) {
  try {
    const command = new PutObjectCommand({
      Bucket: env.aws.bucket,
      Key: key,
      ContentType: contentType,
    });
    return await getSignedUrl(s3Client, command, {
      expiresIn: UPLOAD_URL_EXPIRY_SECONDS,
      signableHeaders: new Set(["content-type"]),
    });
  } catch (err) {
    s3OperationErrorsTotal.inc({ operation: "createUploadSignedUrl" });
    logger.error({ err, key }, "Failed to create S3 upload signed URL");
    throw err;
  }
}

export async function getFileMetadata(key) {
  try {
    const command = new HeadObjectCommand({ Bucket: env.aws.bucket, Key: key });
    return await s3Client.send(command);
  } catch (err) {
    s3OperationErrorsTotal.inc({ operation: "getFileMetadata" });
    throw err;
  }
}

// Returns a Node.js Readable of the object's bytes - used only for folder-zip downloads, where
// the server has to actually read file contents to compress them (every other read path in this
// app is a redirect to a CloudFront signed URL, never bytes through this server - see files.md).
export async function getFileStream(key) {
  try {
    const command = new GetObjectCommand({ Bucket: env.aws.bucket, Key: key });
    const { Body } = await s3Client.send(command);
    return Body;
  } catch (err) {
    s3OperationErrorsTotal.inc({ operation: "getFileStream" });
    logger.error({ err, key }, "Failed to open S3 object read stream");
    throw err;
  }
}

export async function deleteFile(key) {
  try {
    const command = new DeleteObjectCommand({ Bucket: env.aws.bucket, Key: key });
    return await s3Client.send(command);
  } catch (err) {
    s3OperationErrorsTotal.inc({ operation: "deleteFile" });
    logger.error({ err, key }, "Failed to delete S3 object");
    throw err;
  }
}

export async function deleteFiles(keys) {
  if (!keys.length) return;
  try {
    const command = new DeleteObjectsCommand({
      Bucket: env.aws.bucket,
      Delete: { Objects: keys, Quiet: false },
    });
    return await s3Client.send(command);
  } catch (err) {
    s3OperationErrorsTotal.inc({ operation: "deleteFiles" });
    logger.error({ err, count: keys.length }, "Failed to batch delete S3 objects");
    throw err;
  }
}
