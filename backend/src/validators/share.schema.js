import { z } from "zod";
import { Types } from "mongoose";

const objectIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid ID",
});

export const createShareSchema = z.object({
  resourceType: z.enum(["file", "directory"]),
  resourceId: objectIdSchema,
});

export const shareViewQuerySchema = z.object({
  dirId: objectIdSchema.optional(),
});

export const shareDownloadQuerySchema = z.object({
  action: z.string().optional(),
});
