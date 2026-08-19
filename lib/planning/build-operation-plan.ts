import {
  operationPlanSchema,
  type OperationPlan,
} from "@/lib/domain/schemas";
import { checkInventory } from "@/lib/inventory/check-inventory";
import type { InterpretedRequest } from "@/lib/planning/ai-planner";
import {
  planApiResponseSchema,
  type PlanApiResponse,
} from "@/lib/planning/schemas";

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function buildOperationPlan(
  intent: InterpretedRequest,
): PlanApiResponse {
  const inventoryArguments = {
    product: intent.product,
    quantity: intent.quantity,
  };
  const inventoryResult = checkInventory(inventoryArguments);
  const actionStatus: OperationPlan["proposedActions"][number]["status"] =
    inventoryResult.available ? "pending_approval" : "blocked";
  const total = roundCurrency(
    inventoryResult.requestedQuantity * intent.unitPrice,
  );

  const plan = operationPlanSchema.parse({
    customer: intent.customer,
    product: inventoryResult.product,
    quantity: inventoryResult.requestedQuantity,
    unitPrice: intent.unitPrice,
    total,
    requestedDelivery: intent.requestedDelivery,
    inventoryAvailable: inventoryResult.available,
    availableQuantity: inventoryResult.availableQuantity,
    proposedActions: [
      {
        tool: "create_order",
        description: `Criar o pedido de ${inventoryResult.requestedQuantity} ${inventoryResult.product} para ${intent.customer}.`,
        status: actionStatus,
      },
      {
        tool: "reserve_inventory",
        description: `Reservar ${inventoryResult.requestedQuantity} unidades no estoque após aprovação.`,
        status: actionStatus,
      },
      {
        tool: "create_payment",
        description: `Registrar cobrança de R$ ${total.toFixed(2)} vinculada ao pedido.`,
        status: actionStatus,
      },
    ],
    approvalStatus: "awaiting_approval",
    mutationsExecuted: false,
  });

  return planApiResponseSchema.parse({
    plan,
    toolCalls: [
      {
        name: "check_inventory",
        arguments: inventoryArguments,
        result: inventoryResult,
      },
    ],
    mutationsExecuted: false,
  });
}
