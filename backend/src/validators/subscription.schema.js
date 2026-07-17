import { z } from "zod";

export const createSubscriptionSchema = z.object({
  planId: z.string().min(1, "planId is required"),
});
