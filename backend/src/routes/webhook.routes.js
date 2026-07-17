import express from "express";
import * as webhookController from "../controllers/webhook.controller.js";

const router = express.Router();

// Razorpay signs the exact raw request bytes, so this route captures the raw body itself
// rather than relying on the app-wide JSON parser + JSON.stringify(req.body) round-trip,
// which is not guaranteed to reproduce the original byte-for-byte payload.
router.post(
  "/razorpay",
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  }),
  webhookController.handleRazorpayWebhook
);

export default router;
