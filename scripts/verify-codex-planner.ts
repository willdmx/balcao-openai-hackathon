import assert from "node:assert/strict";

import { buildOperationPlan } from "@/lib/planning/build-operation-plan";
import { CodexLocalPlanner } from "@/lib/planning/codex-local-planner";

const requests = [
  "A Ana pediu 20 kits festa para amanhã às 14h. Cada kit custa R$35. Reserve o estoque e prepare o pedido.",
  "A Ana pediu 200 kits festa para amanhã às 14h. Cada kit custa R$35.",
] as const;

async function main() {
  const currentDateTime = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "full",
    timeStyle: "long",
  }).format(new Date());
  const planner = new CodexLocalPlanner();
  const results = [];

  for (const request of requests) {
    const intent = await planner.interpret(request, { currentDateTime });
    const response = buildOperationPlan(intent);

    results.push({ intent, plan: response.plan });
  }

  assert.deepEqual(
    {
      customer: results[0].plan.customer,
      product: results[0].plan.product,
      quantity: results[0].plan.quantity,
      unitPrice: results[0].plan.unitPrice,
      availableQuantity: results[0].plan.availableQuantity,
      inventoryAvailable: results[0].plan.inventoryAvailable,
      total: results[0].plan.total,
    },
    {
      customer: "Ana",
      product: "Kit Festa",
      quantity: 20,
      unitPrice: 35,
      availableQuantity: 50,
      inventoryAvailable: true,
      total: 700,
    },
  );
  assert.equal(results[1].plan.quantity, 200);
  assert.equal(results[1].plan.availableQuantity, 50);
  assert.equal(results[1].plan.inventoryAvailable, false);

  console.log(JSON.stringify(results, null, 2));
}

void main();
