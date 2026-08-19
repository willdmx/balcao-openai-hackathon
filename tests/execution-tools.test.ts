import assert from "node:assert/strict";
import test from "node:test";

import { checkInventory } from "@/lib/inventory/check-inventory";
import { createLocalStore } from "@/lib/state/local-store";
import { createExecutionTools } from "@/lib/tools/executors";

const dueAt = "2026-08-20T14:00:00-03:00";

function createOrderFixture(quantity = 20) {
  const store = createLocalStore();
  const tools = createExecutionTools(store);
  const order = tools.create_order({
    idempotencyKey: `order-${quantity}`,
    customerName: "Ana",
    productName: "Kit Festa",
    quantity,
    unitPriceCents: 3500,
    dueAt,
  });

  return { store, tools, order };
}

test("create_order persiste um pedido único e é idempotente", () => {
  const store = createLocalStore();
  const tools = createExecutionTools(store);
  const input = {
    idempotencyKey: "order-demo",
    customerName: "Ana",
    productName: "Kit Festa",
    quantity: 20,
    unitPriceCents: 3500,
    dueAt,
  };

  const first = tools.create_order(input);
  const replay = tools.create_order(input);

  assert.equal(first.status, "created");
  assert.equal(first.totalCents, 70000);
  assert.equal(replay.orderId, first.orderId);
  assert.equal(store.orders.size, 1);
  assert.equal(store.orders.get(first.orderId)?.customerName, "Ana");

  const second = tools.create_order({
    ...input,
    idempotencyKey: "order-demo-2",
  });
  assert.notEqual(second.orderId, first.orderId);
  assert.equal(store.orders.size, 2);
});

test("reserve_inventory reduz o saldo de 50 para 30 uma única vez", () => {
  const { store, tools, order } = createOrderFixture();
  const input = {
    idempotencyKey: "reservation-demo",
    orderId: order.orderId,
    productName: "Kit Festa",
    quantity: 20,
  };

  const first = tools.reserve_inventory(input);
  const replay = tools.reserve_inventory(input);

  assert.equal(first.status, "reserved");
  assert.deepEqual(replay, first);
  assert.equal(store.reservations.size, 1);
  assert.equal(
    checkInventory({ product: "Kit Festa", quantity: 1 }, store)
      .availableQuantity,
    30,
  );
});

test("create_payment persiste uma cobrança vinculada ao pedido e é idempotente", () => {
  const { store, tools, order } = createOrderFixture();
  tools.reserve_inventory({
    idempotencyKey: "reservation-for-payment",
    orderId: order.orderId,
    productName: "Kit Festa",
    quantity: 20,
  });
  const input = {
    idempotencyKey: "payment-demo",
    orderId: order.orderId,
    customerName: "Ana",
    amountCents: 70000,
    dueAt,
  };

  const first = tools.create_payment(input);
  const replay = tools.create_payment(input);

  assert.equal(first.status, "pending");
  assert.equal(replay.paymentId, first.paymentId);
  assert.equal(store.payments.size, 1);
  assert.equal(store.payments.get(first.paymentId)?.orderId, order.orderId);
  assert.equal(store.orders.get(order.orderId)?.paymentId, first.paymentId);
});

test("reserve_inventory recusa quantidade acima do saldo sem alterar o estoque", () => {
  const { store, tools, order } = createOrderFixture(200);
  const result = tools.reserve_inventory({
    idempotencyKey: "reservation-insufficient",
    orderId: order.orderId,
    productName: "Kit Festa",
    quantity: 200,
  });

  assert.deepEqual(result, {
    status: "insufficient",
    availableQuantity: 50,
    shortfall: 150,
  });
  assert.equal(store.reservations.size, 0);
  assert.equal(
    checkInventory({ product: "Kit Festa", quantity: 1 }, store)
      .availableQuantity,
    50,
  );
});

test("uma chave de idempotência não pode ser reutilizada com outros argumentos", () => {
  const store = createLocalStore();
  const tools = createExecutionTools(store);
  const baseInput = {
    idempotencyKey: "order-conflict",
    customerName: "Ana",
    productName: "Kit Festa",
    quantity: 20,
    unitPriceCents: 3500,
    dueAt,
  };

  tools.create_order(baseInput);

  assert.throws(
    () => tools.create_order({ ...baseInput, quantity: 21 }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "IDEMPOTENCY_CONFLICT",
  );
  assert.equal(store.orders.size, 1);
});
