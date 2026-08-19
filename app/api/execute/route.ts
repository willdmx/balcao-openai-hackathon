import { ZodError } from "zod";

import { OperationExecutionError } from "@/lib/execution/errors";
import { executeOperationPlan } from "@/lib/execution/execute-operation-plan";
import { executeRequestSchema } from "@/lib/execution/schemas";

export const runtime = "nodejs";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "INVALID_JSON",
      "Envie um JSON válido com o plano aprovado.",
      400,
    );
  }

  const requestResult = executeRequestSchema.safeParse(body);

  if (!requestResult.success) {
    return errorResponse(
      "INVALID_EXECUTION_REQUEST",
      "O plano enviado para execução é inválido.",
      400,
    );
  }

  try {
    return Response.json(executeOperationPlan(requestResult.data.plan));
  } catch (error) {
    if (error instanceof OperationExecutionError) {
      if (error.code === "INSUFFICIENT_INVENTORY") {
        return errorResponse(error.code, error.message, 409);
      }

      if (error.code === "IDEMPOTENCY_CONFLICT") {
        return errorResponse(
          error.code,
          "Esta operação já foi executada com outro plano.",
          409,
        );
      }

      if (error.code === "INVALID_PLAN") {
        return errorResponse(error.code, "O plano aprovado é inválido.", 400);
      }

      return errorResponse(
        error.code,
        "A execução não pôde ser concluída. Nenhuma alteração foi aplicada.",
        500,
      );
    }

    if (error instanceof ZodError) {
      return errorResponse(
        "INVALID_PLAN",
        "O plano aprovado é inválido.",
        400,
      );
    }

    console.error("Unexpected execution error", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Ocorreu um erro inesperado. Nenhuma alteração foi aplicada.",
      500,
    );
  }
}
