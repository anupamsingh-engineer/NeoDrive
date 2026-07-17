import { z } from "zod";
import { Types } from "mongoose";

const objectIdSchema = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid ID",
});

export const uploadInitiateSchema = z.object({
  parentDirId: objectIdSchema.optional(),
  name: z.string().min(1).max(255).optional(),
  size: z.number().positive("File size must be greater than 0"),
  contentType: z.string().min(1, "contentType is required"),
});

export const uploadCompleteSchema = z.object({
  fileId: objectIdSchema,
});

export const renameFileSchema = z.object({
  newFilename: z.string().min(1, "File name is required").max(255),
});
