// TEMPORARY - added only to demonstrate OpenTelemetry/Jaeger capturing an in-handler exception
// (as opposed to a body-parser-level crash, which auto-instrumentation doesn't record the same
// way). Remove this file and its mount in routes/index.js once you're done testing.
import express from "express";
import { asyncHandler } from "../errors/asyncHandler.js";

const router = express.Router();

router.get(
  "/debug/simulate-error",
  asyncHandler(async () => {
    throw new Error("Simulated in-handler error for Jaeger demo");
  })
);

export default router;
