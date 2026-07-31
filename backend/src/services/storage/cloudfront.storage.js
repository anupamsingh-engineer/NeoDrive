import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import env from "../../config/env.js";

export function createGetSignedUrl({ key, download = false, filename }) {
  const dateLessThan = new Date(Date.now() + env.cloudfront.signedUrlExpirySeconds * 1000).toISOString(); // Convert to ISO string for CloudFront
  const disposition = `${download ? "attachment" : "inline"}; filename=${encodeURIComponent(filename)}`; // Ensure filename is URL-encoded to handle special characters
  const url = `${env.cloudfront.domain}/${key}?response-content-disposition=${encodeURIComponent(disposition)}`; // Append the content disposition as a query parameter to the URL

  return getSignedUrl({
    url,
    keyPairId: env.cloudfront.keyPairId,
    dateLessThan,
    privateKey: env.cloudfront.privateKey,
  });
}
