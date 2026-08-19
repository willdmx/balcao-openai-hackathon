import { z } from "zod";

export const checkInventoryArgumentsSchema = z.object({
  product: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const checkInventoryResultSchema = z.object({
  product: z.string().min(1),
  requestedQuantity: z.number().int().positive(),
  availableQuantity: z.number().int().nonnegative(),
  available: z.boolean(),
});

export const createOrderArgumentsSchema = z.object({
  idempotencyKey: z.string().min(1).max(200),
  customerName: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  dueAt: z.string().datetime({ offset: true }),
});

export const createOrderResultSchema = z.object({
  orderId: z.string().min(1),
  status: z.literal("created"),
  totalCents: z.number().int().nonnegative(),
});

export const reserveInventoryArgumentsSchema = z.object({
  idempotencyKey: z.string().min(1).max(200),
  orderId: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const reserveInventoryResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("reserved"),
    reservationId: z.string().min(1),
    remainingQuantity: z.number().int().nonnegative(),
  }),
  z.object({
    status: z.literal("insufficient"),
    availableQuantity: z.number().int().nonnegative(),
    shortfall: z.number().int().positive(),
  }),
]);

export const createPaymentArgumentsSchema = z.object({
  idempotencyKey: z.string().min(1).max(200),
  orderId: z.string().min(1),
  customerName: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  dueAt: z.string().datetime({ offset: true }),
});

export const createPaymentResultSchema = z.object({
  paymentId: z.string().min(1),
  status: z.literal("pending"),
  amountCents: z.number().int().nonnegative(),
});

export type CheckInventoryArguments = z.infer<
  typeof checkInventoryArgumentsSchema
>;
export type CheckInventoryResult = z.infer<typeof checkInventoryResultSchema>;
export type CreateOrderArguments = z.infer<typeof createOrderArgumentsSchema>;
export type CreateOrderResult = z.infer<typeof createOrderResultSchema>;
export type ReserveInventoryArguments = z.infer<
  typeof reserveInventoryArgumentsSchema
>;
export type ReserveInventoryResult = z.infer<
  typeof reserveInventoryResultSchema
>;
export type CreatePaymentArguments = z.infer<
  typeof createPaymentArgumentsSchema
>;
export type CreatePaymentResult = z.infer<typeof createPaymentResultSchema>;
