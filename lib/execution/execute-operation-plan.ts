import { operationPlanSchema, type OperationPlan } from "@/lib/domain/schemas";
import { OperationExecutionError } from "@/lib/execution/errors";
import {
  executionResultSchema,
  type ExecutionResult,
} from "@/lib/execution/schemas";
import { checkInventory } from "@/lib/inventory/check-inventory";
import {
  cloneLocalStore,
  commitLocalStore,
  localStore,
  type LocalStore,
} from "@/lib/state/local-store";
import {
  createExecutionTools,
  ToolExecutionError,
} from "@/lib/tools/executors";

const expectedActionTools = [
  "create_order",
  "reserve_inventory",
  "create_payment",
] as const;

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function createPlanFingerprint(plan: OperationPlan) {
  return JSON.stringify(plan);
}

function validatePlanForExecution(plan: OperationPlan) {
  const unitPriceCents = Math.round(plan.unitPrice * 100);
  const normalizedUnitPrice = unitPriceCents / 100;
  const expectedTotal = roundCurrency(
    (plan.quantity * unitPriceCents) / 100,
  );
  const actionTools = new Set(plan.proposedActions.map((action) => action.tool));

  if (
    plan.unitPrice !== normalizedUnitPrice ||
    plan.total !== expectedTotal ||
    actionTools.size !== expectedActionTools.length ||
    expectedActionTools.some((tool) => !actionTools.has(tool))
  ) {
    throw new OperationExecutionError(
      "INVALID_PLAN",
      "O plano não corresponde aos valores e ações esperados pelo servidor.",
    );
  }

  return { unitPriceCents, expectedTotal };
}

export function executeOperationPlan(
  input: OperationPlan,
  store: LocalStore = localStore,
): ExecutionResult {
  const plan = operationPlanSchema.parse(input);
  const fingerprint = createPlanFingerprint(plan);
  const previousExecution = store.executions.get(plan.operationId);

  if (previousExecution) {
    if (previousExecution.fingerprint !== fingerprint) {
      throw new OperationExecutionError(
        "IDEMPOTENCY_CONFLICT",
        "O operationId já foi usado com outro plano.",
      );
    }

    return executionResultSchema.parse(previousExecution.result);
  }

  const { unitPriceCents, expectedTotal } = validatePlanForExecution(plan);
  const inventoryBefore = checkInventory(
    { product: plan.product, quantity: plan.quantity },
    store,
  );

  if (!plan.inventoryAvailable || !inventoryBefore.available) {
    throw new OperationExecutionError(
      "INSUFFICIENT_INVENTORY",
      "Execução bloqueada — estoque insuficiente.",
    );
  }

  if (plan.proposedActions.some((action) => action.status !== "pending_approval")) {
    throw new OperationExecutionError(
      "INVALID_PLAN",
      "O plano não está liberado para execução.",
    );
  }

  const draftStore = cloneLocalStore(store);
  const tools = createExecutionTools(draftStore);

  try {
    const order = tools.create_order({
      idempotencyKey: plan.operationId,
      customerName: plan.customer,
      productName: inventoryBefore.product,
      quantity: plan.quantity,
      unitPriceCents,
      dueAt: plan.requestedDelivery,
    });
    const reservation = tools.reserve_inventory({
      idempotencyKey: plan.operationId,
      orderId: order.orderId,
      productName: inventoryBefore.product,
      quantity: plan.quantity,
    });

    if (reservation.status === "insufficient") {
      throw new OperationExecutionError(
        "INSUFFICIENT_INVENTORY",
        "Execução bloqueada — estoque insuficiente.",
      );
    }

    const payment = tools.create_payment({
      idempotencyKey: plan.operationId,
      orderId: order.orderId,
      customerName: plan.customer,
      amountCents: order.totalCents,
      dueAt: plan.requestedDelivery,
    });
    const occurredAt = new Date().toISOString();
    const result = executionResultSchema.parse({
      operationId: plan.operationId,
      status: "completed",
      orderId: order.orderId,
      paymentId: payment.paymentId,
      total: expectedTotal,
      previousStock: inventoryBefore.availableQuantity,
      currentStock: reservation.remainingQuantity,
      events: [
        {
          tool: "check_inventory",
          status: "completed",
          message: "Estoque validado",
          occurredAt,
        },
        {
          tool: "create_order",
          status: "completed",
          message: "Pedido criado",
          occurredAt,
        },
        {
          tool: "reserve_inventory",
          status: "completed",
          message: "Estoque reservado",
          occurredAt,
        },
        {
          tool: "create_payment",
          status: "completed",
          message: "Cobrança registrada",
          occurredAt,
        },
      ],
      mutationsExecuted: true,
    });

    draftStore.executions.set(plan.operationId, { fingerprint, result });
    commitLocalStore(store, draftStore);

    return result;
  } catch (error) {
    if (error instanceof OperationExecutionError) throw error;

    if (error instanceof ToolExecutionError) {
      throw new OperationExecutionError(
        error.code === "IDEMPOTENCY_CONFLICT"
          ? "IDEMPOTENCY_CONFLICT"
          : "EXECUTION_FAILED",
        "A operação não pôde ser concluída de forma atômica.",
      );
    }

    throw error;
  }
}
