import type { FunctionTool } from "openai/resources/responses/responses";

import { approvedPlanSchema, type OperationPlan } from "@/lib/domain/schemas";
import {
  checkInventoryArgumentsSchema,
  createOrderArgumentsSchema,
  createPaymentArgumentsSchema,
  reserveInventoryArgumentsSchema,
} from "@/lib/tools/contracts";

const checkInventoryTool = {
  type: "function",
  name: "check_inventory",
  description:
    "Verifica o estoque disponível sem alterar nenhum dado. Se faltar estoque, retorna status insufficient e o déficit.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      productName: { type: "string", description: "Nome do produto" },
      quantity: { type: "integer", minimum: 1, description: "Quantidade solicitada" },
    },
    required: ["productName", "quantity"],
    additionalProperties: false,
  },
} satisfies FunctionTool;

const createOrderTool = {
  type: "function",
  name: "create_order",
  description: "Cria um pedido aprovado e retorna seu identificador.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      customerName: { type: "string" },
      productName: { type: "string" },
      quantity: { type: "integer", minimum: 1 },
      unitPriceCents: { type: "integer", minimum: 0 },
      dueAt: { type: "string", format: "date-time" },
    },
    required: [
      "customerName",
      "productName",
      "quantity",
      "unitPriceCents",
      "dueAt",
    ],
    additionalProperties: false,
  },
} satisfies FunctionTool;

const reserveInventoryTool = {
  type: "function",
  name: "reserve_inventory",
  description:
    "Reserva estoque para um pedido aprovado. Nunca permite saldo negativo e retorna insufficient se o saldo mudou.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      orderId: { type: "string" },
      productName: { type: "string" },
      quantity: { type: "integer", minimum: 1 },
    },
    required: ["orderId", "productName", "quantity"],
    additionalProperties: false,
  },
} satisfies FunctionTool;

const createPaymentTool = {
  type: "function",
  name: "create_payment",
  description: "Registra uma cobrança pendente para um pedido aprovado.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      orderId: { type: "string" },
      customerName: { type: "string" },
      amountCents: { type: "integer", minimum: 0 },
      dueAt: { type: "string", format: "date-time" },
    },
    required: ["orderId", "customerName", "amountCents", "dueAt"],
    additionalProperties: false,
  },
} satisfies FunctionTool;

export const toolContracts = {
  check_inventory: {
    definition: checkInventoryTool,
    argumentsSchema: checkInventoryArgumentsSchema,
    mutatesState: false,
  },
  create_order: {
    definition: createOrderTool,
    argumentsSchema: createOrderArgumentsSchema,
    mutatesState: true,
  },
  reserve_inventory: {
    definition: reserveInventoryTool,
    argumentsSchema: reserveInventoryArgumentsSchema,
    mutatesState: true,
  },
  create_payment: {
    definition: createPaymentTool,
    argumentsSchema: createPaymentArgumentsSchema,
    mutatesState: true,
  },
} as const;

// O planejador recebe apenas a tool de leitura. Isso impede mutações por construção.
export const planningToolDefinitions: FunctionTool[] = [checkInventoryTool];

const mutationToolDefinitions: FunctionTool[] = [
  createOrderTool,
  reserveInventoryTool,
  createPaymentTool,
];

// A execução só recebe tools de mutação depois que o plano passa pelo guard.
export function getExecutionToolsForApprovedPlan(
  plan: OperationPlan,
): FunctionTool[] {
  approvedPlanSchema.parse(plan);
  return mutationToolDefinitions;
}
