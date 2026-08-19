import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  buildInterpretationPrompt,
  interpretedRequestSchema,
  type AIPlanner,
  type AIPlannerContext,
  type InterpretedRequest,
} from "@/lib/planning/ai-planner";
import {
  AIPlannerConfigurationError,
  AIPlannerExecutionError,
  PlanningResponseError,
} from "@/lib/planning/errors";

export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";

export class OpenAIResponsesPlanner implements AIPlanner {
  async interpret(
    naturalLanguageRequest: string,
    context: AIPlannerContext,
  ): Promise<InterpretedRequest> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      throw new AIPlannerConfigurationError(
        "O provider openai exige OPENAI_API_KEY. Use BALCAO_AI_PROVIDER=codex para o modo local.",
      );
    }

    const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
    const openai = new OpenAI({ apiKey });

    try {
      const response = await openai.responses.parse({
        model,
        store: false,
        instructions:
          "Retorne somente a intenção comercial estruturada. Não execute ações nem altere estado.",
        input: buildInterpretationPrompt(naturalLanguageRequest, context),
        text: {
          format: zodTextFormat(
            interpretedRequestSchema,
            "interpreted_request",
          ),
        },
      });

      if (!response.output_parsed) {
        throw new PlanningResponseError(
          "A OpenAI não retornou uma interpretação estruturada válida.",
        );
      }

      return interpretedRequestSchema.parse(response.output_parsed);
    } catch (error) {
      if (error instanceof PlanningResponseError) throw error;

      if (error instanceof OpenAI.APIError) {
        throw new AIPlannerExecutionError(
          "A OpenAI não conseguiu interpretar a solicitação.",
        );
      }

      throw error;
    }
  }
}
