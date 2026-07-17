import { z } from "zod";

export const renameDirectorySchema = z.object({
  newDirName: z.string().min(1, "Directory name is required").max(255),
});
