import { z } from "zod";

import type { AIPlanner } from "@/lib/planning/ai-planner";
import { CodexLocalPlanner } from "@/lib/planning/codex-local-planner";
import { AIPlannerConfigurationError } from "@/lib/planning/errors";
import { OpenAIResponsesPlanner } from "@/lib/planning/openai-responses-planner";

const providerSchema = z.enum(["codex", "openai"]);

export function getAIPlanner(): AIPlanner {
  const providerResult = providerSchema.safeParse(
    process.env.BALCAO_AI_PROVIDER?.trim() || "codex",
  );

  if (!providerResult.success) {
    throw new AIPlannerConfigurationError(
      "BALCAO_AI_PROVIDER deve ser codex ou openai.",
    );
  }

  return providerResult.data === "codex"
    ? new CodexLocalPlanner()
    : new OpenAIResponsesPlanner();
}
