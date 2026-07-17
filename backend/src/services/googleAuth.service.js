import { OAuth2Client } from "google-auth-library";
import env from "../config/env.js";

const client = new OAuth2Client({ clientId: env.google.clientId });

export async function verifyGoogleIdToken(idToken) {
  const loginTicket = await client.verifyIdToken({ idToken, audience: env.google.clientId });
  return loginTicket.getPayload();
}
