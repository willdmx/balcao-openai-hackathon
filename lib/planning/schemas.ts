import { z } from "zod";

import { operationPlanSchema } from "@/lib/domain/schemas";
import {
  checkInventoryArgumentsSchema,
  checkInventoryResultSchema,
} from "@/lib/tools/contracts";

export const planRequestSchema = z.object({
  request: z.string().trim().min(10).max(2000),
});

export const planningToolCallSchema = z.object({
  name: z.literal("check_inventory"),
  arguments: checkInventoryArgumentsSchema,
  result: checkInventoryResultSchema,
});

export const planApiResponseSchema = z.object({
  plan: operationPlanSchema,
  toolCalls: z.array(planningToolCallSchema).length(1),
  mutationsExecuted: z.literal(false),
});

export type PlanRequest = z.infer<typeof planRequestSchema>;
export type PlanningToolCall = z.infer<typeof planningToolCallSchema>;
export type PlanApiResponse = z.infer<typeof planApiResponseSchema>;
