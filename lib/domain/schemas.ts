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

export const orderRequestSchema = z.object({
  customerName: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  dueAt: z.string().datetime({ offset: true }),
  originalRequest: z.string().min(1),
});

export const planActionSchema = z.object({
  tool: toolNameSchema,
  kind: z.enum(["read", "mutation"]),
  label: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()),
  status: z.enum(["proposed", "completed", "blocked"]),
});

export const operationPlanSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["awaiting_approval", "approved", "rejected"]),
  request: orderRequestSchema,
  actions: z.array(planActionSchema).min(1),
  totalCents: z.number().int().nonnegative(),
});

export const approvedPlanSchema = operationPlanSchema.extend({
  status: z.literal("approved"),
});

export const executionEventSchema = z.object({
  tool: toolNameSchema,
  status: z.enum(["running", "completed", "blocked", "failed"]),
  message: z.string().min(1),
  occurredAt: z.string().datetime({ offset: true }),
});

export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type OrderRequest = z.infer<typeof orderRequestSchema>;
export type OperationPlan = z.infer<typeof operationPlanSchema>;
export type ApprovedPlan = z.infer<typeof approvedPlanSchema>;
export type ExecutionEvent = z.infer<typeof executionEventSchema>;
export type ToolName = z.infer<typeof toolNameSchema>;
