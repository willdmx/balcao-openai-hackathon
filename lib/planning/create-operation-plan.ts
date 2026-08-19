import "server-only";

import { buildOperationPlan } from "@/lib/planning/build-operation-plan";
import { getAIPlanner } from "@/lib/planning/planner-factory";
import type { PlanApiResponse } from "@/lib/planning/schemas";

function getSaoPauloDateTime() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "full",
    timeStyle: "long",
  }).format(new Date());
}

export async function createOperationPlan(
  naturalLanguageRequest: string,
): Promise<PlanApiResponse> {
  const planner = getAIPlanner();
  const intent = await planner.interpret(naturalLanguageRequest, {
    currentDateTime: getSaoPauloDateTime(),
  });

  return buildOperationPlan(intent);
}
