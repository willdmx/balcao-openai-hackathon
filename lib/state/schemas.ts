import { z } from "zod";

export const orderRecordSchema = z.object({
  id: z.string().min(1),
  customerName: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  dueAt: z.string().datetime({ offset: true }),
  status: z.enum(["created", "inventory_reserved", "payment_pending"]),
  reservationId: z.string().min(1).nullable(),
  paymentId: z.string().min(1).nullable(),
  createdAt: z.string().datetime({ offset: true }),
});

export const reservationRecordSchema = z.object({
  id: z.string().min(1),
  orderId: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().int().positive(),
  remainingQuantity: z.number().int().nonnegative(),
  createdAt: z.string().datetime({ offset: true }),
});

export const paymentRecordSchema = z.object({
  id: z.string().min(1),
  orderId: z.string().min(1),
  customerName: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  dueAt: z.string().datetime({ offset: true }),
  status: z.literal("pending"),
  createdAt: z.string().datetime({ offset: true }),
});

export type OrderRecord = z.infer<typeof orderRecordSchema>;
export type ReservationRecord = z.infer<typeof reservationRecordSchema>;
export type PaymentRecord = z.infer<typeof paymentRecordSchema>;
