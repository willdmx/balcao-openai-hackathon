import { z } from "zod";

export const toolNameSchema = z.enum([
  "check_inventory",
  "create_order",
  "reserve_inventory",
  "create_payment",
]);

export const inventoryItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  availableQuantity: z.number().int().nonnegative(),
  unitPriceCents: z.number().int().nonnegative(),
});

export const proposedActionSchema = z.object({
  tool: z.enum(["create_order", "reserve_inventory", "create_payment"]),
  description: z.string().min(1),
  status: z.enum(["pending_approval", "blocked"]),
});

export const operationPlanSchema = z.object({
  operationId: z.string().uuid(),
  customer: z.string().min(1),
  product: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  total: z.number().nonnegative(),
  requestedDelivery: z.string().datetime({ offset: true }),
  inventoryAvailable: z.boolean(),
  availableQuantity: z.number().int().nonnegative(),
  proposedActions: z.array(proposedActionSchema).length(3),
  approvalStatus: z.literal("awaiting_approval"),
  mutationsExecuted: z.literal(false),
});

export const approvedPlanSchema = operationPlanSchema.extend({
  approvalStatus: z.literal("approved"),
});

export const executionEventSchema = z.object({
  tool: toolNameSchema,
  status: z.enum(["running", "completed", "blocked", "failed"]),
  message: z.string().min(1),
  occurredAt: z.string().datetime({ offset: true }),
});

export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type ProposedAction = z.infer<typeof proposedActionSchema>;
export type OperationPlan = z.infer<typeof operationPlanSchema>;
export type ApprovedPlan = z.infer<typeof approvedPlanSchema>;
export type ExecutionEvent = z.infer<typeof executionEventSchema>;
export type ToolName = z.infer<typeof toolNameSchema>;
