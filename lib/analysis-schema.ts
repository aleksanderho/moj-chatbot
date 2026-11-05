import { z } from "zod";

export const analysisSchema = z.strictObject({
  category: z.enum(["sales", "support", "billing", "unknown"]),
  priority: z.enum(["normal", "high"]),
  draft: z.string(),
  needs_review: z.boolean(),
});

export type Analysis = z.infer<typeof analysisSchema>;
