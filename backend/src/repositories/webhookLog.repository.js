import WebhookLog from "../models/webhookLog.model.js";

export async function create(entry) {
  return WebhookLog.create(entry);
}
