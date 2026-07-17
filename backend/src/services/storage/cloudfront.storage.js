import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import env from "../../config/env.js";

export function createGetSignedUrl({ key, download = false, filename }) {
  const dateLessThan = new Date(Date.now() + env.cloudfront.signedUrlExpirySeconds * 1000).toISOString();
  const disposition = `${download ? "attachment" : "inline"}; filename=${encodeURIComponent(filename)}`;
  const url = `${env.cloudfront.domain}/${key}?response-content-disposition=${encodeURIComponent(disposition)}`;

  return getSignedUrl({
    url,
    keyPairId: env.cloudfront.keyPairId,
    dateLessThan,
    privateKey: env.cloudfront.privateKey,
  });
}
