import assert from "node:assert/strict";
import test from "node:test";

import { buildOperationPlan } from "@/lib/planning/build-operation-plan";

const requestedDelivery = "2026-08-20T14:00:00-03:00";

test("monta plano de 20 kits com estoque disponível e total 700", () => {
  const result = buildOperationPlan({
    customer: "Ana",
    product: "Kit Festa",
    quantity: 20,
    unitPrice: 35,
    requestedDelivery,
    requestedActions: ["create_order", "reserve_inventory"],
  });

  assert.equal(result.plan.customer, "Ana");
  assert.equal(result.plan.product, "Kit Festa");
  assert.equal(result.plan.quantity, 20);
  assert.equal(result.plan.unitPrice, 35);
  assert.equal(result.plan.availableQuantity, 50);
  assert.equal(result.plan.inventoryAvailable, true);
  assert.equal(result.plan.total, 700);
  assert.equal(result.mutationsExecuted, false);
});

test("monta plano de 200 kits como bloqueado sem alterar o estoque", () => {
  const result = buildOperationPlan({
    customer: "Ana",
    product: "Kit Festa",
    quantity: 200,
    unitPrice: 35,
    requestedDelivery,
    requestedActions: [],
  });

  assert.equal(result.plan.availableQuantity, 50);
  assert.equal(result.plan.inventoryAvailable, false);
  assert.equal(result.plan.total, 7000);
  assert.ok(
    result.plan.proposedActions.every((action) => action.status === "blocked"),
  );
  assert.equal(result.mutationsExecuted, false);
});
