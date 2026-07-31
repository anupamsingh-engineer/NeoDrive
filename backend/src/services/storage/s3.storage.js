import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
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
