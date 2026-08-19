import { ZodError } from "zod";

import { createOperationPlan } from "@/lib/planning/create-operation-plan";
import {
  AIPlannerAuthenticationError,
  AIPlannerConfigurationError,
  AIPlannerExecutionError,
  AIPlannerTimeoutError,
  PlanningResponseError,
} from "@/lib/planning/errors";
import { planRequestSchema } from "@/lib/planning/schemas";

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
      "Envie um JSON válido com o campo request.",
      400,
    );
  }

  const requestResult = planRequestSchema.safeParse(body);

  if (!requestResult.success) {
    return errorResponse(
      "INVALID_REQUEST",
      "A solicitação deve conter entre 10 e 2.000 caracteres.",
      400,
    );
  }

  try {
    const result = await createOperationPlan(requestResult.data.request);
    return Response.json(result);
  } catch (error) {
    if (error instanceof AIPlannerConfigurationError) {
      return errorResponse("AI_PROVIDER_NOT_CONFIGURED", error.message, 503);
    }

    if (error instanceof AIPlannerAuthenticationError) {
      return errorResponse("CODEX_NOT_AUTHENTICATED", error.message, 503);
    }

    if (error instanceof AIPlannerTimeoutError) {
      return errorResponse("AI_PLANNER_TIMEOUT", error.message, 504);
    }

    if (error instanceof ZodError || error instanceof PlanningResponseError) {
      return errorResponse(
        "INVALID_MODEL_RESPONSE",
        "A IA não conseguiu produzir uma interpretação válida. Revise a solicitação e tente novamente.",
        502,
      );
    }

    if (error instanceof AIPlannerExecutionError) {
      return errorResponse(
        "AI_PLANNER_FAILED",
        "O Codex local não conseguiu interpretar a solicitação. Tente novamente.",
        502,
      );
    }

    console.error("Unexpected planning error", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Ocorreu um erro inesperado durante o planejamento.",
      500,
    );
  }
}
