import assert from "node:assert/strict";

import { buildOperationPlan } from "@/lib/planning/build-operation-plan";
import { CodexLocalPlanner } from "@/lib/planning/codex-local-planner";

const cases = [
  {
    label: "A",
    request:
      "A Ana pediu 20 kits festa para amanhã às 14h. Cada kit custa R$35. Reserve o estoque e prepare o pedido.",
  },
  {
    label: "B",
    request:
      "A Ana pediu 200 kits festa para amanhã às 14h. Cada kit custa R$35.",
  },
] as const;

async function main() {
  const currentDateTime = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "full",
    timeStyle: "long",
  }).format(new Date());
  const planner = new CodexLocalPlanner();
  const results = [];

  for (const benchmarkCase of cases) {
    for (let run = 1; run <= 2; run += 1) {
      const startedAt = performance.now();
      const intent = await planner.interpret(benchmarkCase.request, {
        currentDateTime,
      });
      const response = buildOperationPlan(intent);
      const durationMs = Math.round(performance.now() - startedAt);

      results.push({
        label: benchmarkCase.label,
        run,
        durationMs,
        intent,
        plan: response.plan,
      });

      console.log(
        `[${benchmarkCase.label}#${run}] ${durationMs} ms | quantity=${response.plan.quantity} | available=${response.plan.inventoryAvailable}`,
      );
    }
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
  assert.equal(results[1].plan.quantity, 20);
  assert.equal(results[1].plan.availableQuantity, 50);
  assert.equal(results[1].plan.inventoryAvailable, true);
  assert.equal(results[2].plan.quantity, 200);
  assert.equal(results[2].plan.availableQuantity, 50);
  assert.equal(results[2].plan.inventoryAvailable, false);
  assert.equal(results[3].plan.quantity, 200);
  assert.equal(results[3].plan.availableQuantity, 50);
  assert.equal(results[3].plan.inventoryAvailable, false);
}

void main();
