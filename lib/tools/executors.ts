import { randomUUID } from "node:crypto";

import { normalizeProductName } from "@/lib/inventory/normalize-product-name";
import {
  findInventoryItem,
  localStore,
  type LocalStore,
} from "@/lib/state/local-store";
import {
  orderRecordSchema,
  paymentRecordSchema,
  reservationRecordSchema,
} from "@/lib/state/schemas";
import {
  createOrderArgumentsSchema,
  createOrderResultSchema,
  createPaymentArgumentsSchema,
  createPaymentResultSchema,
  reserveInventoryArgumentsSchema,
  reserveInventoryResultSchema,
  type CreateOrderArguments,
  type CreateOrderResult,
  type CreatePaymentArguments,
  type CreatePaymentResult,
  type ReserveInventoryArguments,
  type ReserveInventoryResult,
} from "@/lib/tools/contracts";

export type ToolExecutionErrorCode =
  | "IDEMPOTENCY_CONFLICT"
  | "ORDER_NOT_FOUND"
  | "PRODUCT_NOT_FOUND"
  | "ORDER_DATA_MISMATCH"
  | "ORDER_ALREADY_RESERVED"
  | "ORDER_NOT_RESERVED"
  | "PAYMENT_ALREADY_CREATED";

export class ToolExecutionError extends Error {
  constructor(
    public readonly code: ToolExecutionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ToolExecutionError";
  }
}

type IdempotentArguments = { idempotencyKey: string };

function runIdempotently<TArguments extends IdempotentArguments, TResult>(
  store: LocalStore,
  toolName: "create_order" | "reserve_inventory" | "create_payment",
  input: TArguments,
  operation: () => TResult,
): TResult {
  const recordKey = `${toolName}:${input.idempotencyKey}`;
  const fingerprint = JSON.stringify(input);
  const previous = store.idempotency.get(recordKey);

  if (previous) {
    if (previous.fingerprint !== fingerprint) {
      throw new ToolExecutionError(
        "IDEMPOTENCY_CONFLICT",
        `A chave de idempotência já foi usada com outros argumentos em ${toolName}.`,
      );
    }

    return previous.result as TResult;
  }

  const result = operation();
  store.idempotency.set(recordKey, { fingerprint, result });
  return result;
}

function createId(prefix: "ord" | "res" | "pay") {
  return `${prefix}_${randomUUID()}`;
}

export function createExecutionTools(store: LocalStore = localStore) {
  function createOrder(input: CreateOrderArguments): CreateOrderResult {
    const args = createOrderArgumentsSchema.parse(input);

    return runIdempotently(store, "create_order", args, () => {
      const item = findInventoryItem(store, args.productName);

      if (!item) {
        throw new ToolExecutionError(
          "PRODUCT_NOT_FOUND",
          `Produto não encontrado: ${args.productName}.`,
        );
      }

      const order = orderRecordSchema.parse({
        id: createId("ord"),
        customerName: args.customerName,
        productName: item.name,
        quantity: args.quantity,
        unitPriceCents: args.unitPriceCents,
        totalCents: args.quantity * args.unitPriceCents,
        dueAt: args.dueAt,
        status: "created",
        reservationId: null,
        paymentId: null,
        createdAt: new Date().toISOString(),
      });

      store.orders.set(order.id, order);

      return createOrderResultSchema.parse({
        orderId: order.id,
        status: "created",
        totalCents: order.totalCents,
      });
    });
  }

  function reserveInventory(
    input: ReserveInventoryArguments,
  ): ReserveInventoryResult {
    const args = reserveInventoryArgumentsSchema.parse(input);

    return runIdempotently(store, "reserve_inventory", args, () => {
      const order = store.orders.get(args.orderId);

      if (!order) {
        throw new ToolExecutionError(
          "ORDER_NOT_FOUND",
          `Pedido não encontrado: ${args.orderId}.`,
        );
      }

      if (
        normalizeProductName(order.productName) !==
          normalizeProductName(args.productName) ||
        order.quantity !== args.quantity
      ) {
        throw new ToolExecutionError(
          "ORDER_DATA_MISMATCH",
          "Produto ou quantidade não correspondem ao pedido.",
        );
      }

      if (order.reservationId) {
        throw new ToolExecutionError(
          "ORDER_ALREADY_RESERVED",
          `O pedido ${order.id} já possui uma reserva.`,
        );
      }

      const item = findInventoryItem(store, args.productName);

      if (!item) {
        throw new ToolExecutionError(
          "PRODUCT_NOT_FOUND",
          `Produto não encontrado: ${args.productName}.`,
        );
      }

      if (item.availableQuantity < args.quantity) {
        return reserveInventoryResultSchema.parse({
          status: "insufficient",
          availableQuantity: item.availableQuantity,
          shortfall: args.quantity - item.availableQuantity,
        });
      }

      const remainingQuantity = item.availableQuantity - args.quantity;
      const reservation = reservationRecordSchema.parse({
        id: createId("res"),
        orderId: order.id,
        productName: item.name,
        quantity: args.quantity,
        remainingQuantity,
        createdAt: new Date().toISOString(),
      });
      const updatedOrder = orderRecordSchema.parse({
        ...order,
        status: "inventory_reserved",
        reservationId: reservation.id,
      });

      store.inventory.set(item.id, {
        ...item,
        availableQuantity: remainingQuantity,
      });
      store.reservations.set(reservation.id, reservation);
      store.orders.set(order.id, updatedOrder);

      return reserveInventoryResultSchema.parse({
        status: "reserved",
        reservationId: reservation.id,
        remainingQuantity,
      });
    });
  }

  function createPayment(
    input: CreatePaymentArguments,
  ): CreatePaymentResult {
    const args = createPaymentArgumentsSchema.parse(input);

    return runIdempotently(store, "create_payment", args, () => {
      const order = store.orders.get(args.orderId);

      if (!order) {
        throw new ToolExecutionError(
          "ORDER_NOT_FOUND",
          `Pedido não encontrado: ${args.orderId}.`,
        );
      }

      if (!order.reservationId) {
        throw new ToolExecutionError(
          "ORDER_NOT_RESERVED",
          `O pedido ${order.id} ainda não possui reserva de estoque.`,
        );
      }

      if (order.paymentId) {
        throw new ToolExecutionError(
          "PAYMENT_ALREADY_CREATED",
          `O pedido ${order.id} já possui uma cobrança.`,
        );
      }

      if (
        order.customerName !== args.customerName ||
        order.totalCents !== args.amountCents
      ) {
        throw new ToolExecutionError(
          "ORDER_DATA_MISMATCH",
          "Cliente ou valor da cobrança não correspondem ao pedido.",
        );
      }

      const payment = paymentRecordSchema.parse({
        id: createId("pay"),
        orderId: order.id,
        customerName: args.customerName,
        amountCents: args.amountCents,
        dueAt: args.dueAt,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      const updatedOrder = orderRecordSchema.parse({
        ...order,
        status: "payment_pending",
        paymentId: payment.id,
      });

      store.payments.set(payment.id, payment);
      store.orders.set(order.id, updatedOrder);

      return createPaymentResultSchema.parse({
        paymentId: payment.id,
        status: "pending",
        amountCents: payment.amountCents,
      });
    });
  }

  return {
    create_order: createOrder,
    reserve_inventory: reserveInventory,
    create_payment: createPayment,
  };
}

export const executionToolExecutors = createExecutionTools();
