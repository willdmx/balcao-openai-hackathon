import { z } from "zod";

import {
  executionEventSchema,
  operationPlanSchema,
} from "@/lib/domain/schemas";

export const executeRequestSchema = z
  .object({
    plan: operationPlanSchema,
  })
  .strict();

export const executionResultSchema = z
  .object({
    operationId: z.string().uuid(),
    status: z.literal("completed"),
    orderId: z.string().min(1),
    paymentId: z.string().min(1),
    total: z.number().nonnegative(),
    previousStock: z.number().int().nonnegative(),
    currentStock: z.number().int().nonnegative(),
    events: z.array(executionEventSchema).length(4),
    mutationsExecuted: z.literal(true),
  })
  .strict();

export type ExecuteRequest = z.infer<typeof executeRequestSchema>;
export type ExecutionResult = z.infer<typeof executionResultSchema>;
