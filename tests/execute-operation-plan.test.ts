import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { operationPlanSchema } from "@/lib/domain/schemas";
import { OperationExecutionError } from "@/lib/execution/errors";
import { executeOperationPlan } from "@/lib/execution/execute-operation-plan";
import { checkInventory } from "@/lib/inventory/check-inventory";
import { createLocalStore } from "@/lib/state/local-store";

const requestedDelivery = "2026-08-20T14:00:00-03:00";

function createPlan(quantity: number, operationId = randomUUID()) {
  const inventoryAvailable = quantity <= 50;
  const actionStatus = inventoryAvailable ? "pending_approval" : "blocked";

  return operationPlanSchema.parse({
    operationId,
    customer: "Ana",
    product: "Kit Festa",
    quantity,
    unitPrice: 35,
    total: quantity * 35,
    requestedDelivery,
    inventoryAvailable,
    availableQuantity: 50,
    proposedActions: [
      {
        tool: "create_order",
        description: "Criar pedido.",
        status: actionStatus,
      },
      {
        tool: "reserve_inventory",
        description: "Reservar estoque.",
        status: actionStatus,
      },
      {
        tool: "create_payment",
        description: "Registrar cobrança.",
        status: actionStatus,
      },
    ],
    approvalStatus: "awaiting_approval",
    mutationsExecuted: false,
  });
}

test("executa pedido, reserva e cobrança atomicamente", () => {
  const store = createLocalStore();
  const result = executeOperationPlan(createPlan(20), store);

  assert.equal(result.status, "completed");
  assert.equal(result.previousStock, 50);
  assert.equal(result.currentStock, 30);
  assert.equal(result.total, 700);
  assert.equal(store.orders.size, 1);
  assert.equal(store.reservations.size, 1);
  assert.equal(store.payments.size, 1);
  assert.equal(store.executions.size, 1);
  assert.equal(store.orders.get(result.orderId)?.totalCents, 70000);
  assert.equal(store.payments.get(result.paymentId)?.orderId, result.orderId);
});

test("repete a mesma execução sem duplicar mutações", () => {
  const store = createLocalStore();
  const plan = createPlan(20);
  const first = executeOperationPlan(plan, store);
  const replay = executeOperationPlan(plan, store);

  assert.deepEqual(replay, first);
  assert.equal(store.orders.size, 1);
  assert.equal(store.reservations.size, 1);
  assert.equal(store.payments.size, 1);
  assert.equal(store.executions.size, 1);
  assert.equal(
    checkInventory({ product: "Kit Festa", quantity: 1 }, store)
      .availableQuantity,
    30,
  );
});

test("bloqueia estoque insuficiente sem qualquer mutação", () => {
  const store = createLocalStore();

  assert.throws(
    () => executeOperationPlan(createPlan(200), store),
    (error: unknown) =>
      error instanceof OperationExecutionError &&
      error.code === "INSUFFICIENT_INVENTORY",
  );
  assert.equal(store.orders.size, 0);
  assert.equal(store.reservations.size, 0);
  assert.equal(store.payments.size, 0);
  assert.equal(store.executions.size, 0);
  assert.equal(
    checkInventory({ product: "Kit Festa", quantity: 1 }, store)
      .availableQuantity,
    50,
  );
});

test("rejeita total adulterado antes de aplicar qualquer mutação", () => {
  const store = createLocalStore();
  const plan = { ...createPlan(20), total: 1 };

  assert.throws(
    () => executeOperationPlan(plan, store),
    (error: unknown) =>
      error instanceof OperationExecutionError &&
      error.code === "INVALID_PLAN",
  );
  assert.equal(store.orders.size, 0);
  assert.equal(store.reservations.size, 0);
  assert.equal(store.payments.size, 0);
  assert.equal(
    checkInventory({ product: "Kit Festa", quantity: 1 }, store)
      .availableQuantity,
    50,
  );
});
