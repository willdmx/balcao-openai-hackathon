import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { z } from "zod";

import {
  buildInterpretationPrompt,
  interpretedRequestSchema,
  type AIPlanner,
  type AIPlannerContext,
  type InterpretedRequest,
} from "@/lib/planning/ai-planner";
import {
  AIPlannerAuthenticationError,
  AIPlannerConfigurationError,
  AIPlannerExecutionError,
  AIPlannerTimeoutError,
  PlanningResponseError,
} from "@/lib/planning/errors";

const DEFAULT_CODEX_TIMEOUT_MS = 45_000;
const MAX_PROCESS_OUTPUT_BYTES = 1_000_000;

export const interpretedRequestJsonSchema = {
  type: "object",
  properties: {
    customer: { type: "string", minLength: 1, maxLength: 200 },
    product: { type: "string", minLength: 1, maxLength: 200 },
    quantity: { type: "integer", minimum: 1 },
    unitPrice: { type: "number", minimum: 0 },
    requestedDelivery: { type: "string" },
    requestedActions: {
      type: "array",
      items: {
        type: "string",
        enum: ["create_order", "reserve_inventory", "create_payment"],
      },
      maxItems: 3,
    },
  },
  required: [
    "customer",
    "product",
    "quantity",
    "unitPrice",
    "requestedDelivery",
    "requestedActions",
  ],
  additionalProperties: false,
} as const;

const codexEventSchema = z
  .object({
    type: z.string(),
    thread_id: z.string().optional(),
    item: z
      .object({
        type: z.string(),
        text: z.string().optional(),
      })
      .passthrough()
      .optional(),
    error: z.object({ message: z.string() }).optional(),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative(),
        cached_input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const forbiddenItemTypes = new Set([
  "command_execution",
  "file_change",
  "mcp_tool_call",
  "web_search",
]);

type CodexProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

function createCodexEnvironment(): NodeJS.ProcessEnv {
  const allowedVariables = [
    "APPDATA",
    "CODEX_HOME",
    "COMSPEC",
    "HOME",
    "HOMEDRIVE",
    "HOMEPATH",
    "LOCALAPPDATA",
    "PATH",
    "Path",
    "PATHEXT",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "WINDIR",
  ] as const;
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV,
    NO_COLOR: "1",
  };

  for (const variable of allowedVariables) {
    const value = process.env[variable];
    if (value) environment[variable] = value;
  }

  return environment;
}

function getCodexTimeout() {
  const configured = process.env.BALCAO_CODEX_TIMEOUT_MS?.trim();

  if (!configured) {
    return DEFAULT_CODEX_TIMEOUT_MS;
  }

  const parsed = z.coerce.number().int().min(5_000).max(120_000).safeParse(
    configured,
  );

  if (!parsed.success) {
    throw new AIPlannerConfigurationError(
      "BALCAO_CODEX_TIMEOUT_MS deve estar entre 5000 e 120000.",
    );
  }

  return parsed.data;
}

function resolveCodexExecutable() {
  const configuredPath = process.env.BALCAO_CODEX_PATH?.trim();

  if (configuredPath) {
    return configuredPath;
  }

  const localRuntime = path.join(
    process.cwd(),
    ".balcao-runtime",
    process.platform === "win32" ? "codex.exe" : "codex",
  );

  if (existsSync(localRuntime)) {
    return localRuntime;
  }

  return process.platform === "win32" ? "codex.exe" : "codex";
}

function runCodexProcess(
  executable: string,
  args: string[],
  prompt: string,
  workingDirectory: string,
  timeoutMs: number,
): Promise<CodexProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: workingDirectory,
      env: createCodexEnvironment(),
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let outputTooLarge = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdin.on("error", () => {
      // O processo pode encerrar antes de consumir o stdin (por exemplo, sem login).
    });
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout) > MAX_PROCESS_OUTPUT_BYTES) {
        outputTooLarge = true;
        child.kill();
      }
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      if (Buffer.byteLength(stderr) > MAX_PROCESS_OUTPUT_BYTES) {
        outputTooLarge = true;
        child.kill();
      }
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);

      if (timedOut) {
        reject(new AIPlannerTimeoutError());
        return;
      }

      if (outputTooLarge) {
        reject(
          new AIPlannerExecutionError(
            "O Codex excedeu o limite seguro de saída.",
          ),
        );
        return;
      }

      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });

    child.stdin.end(prompt, "utf8");
  });
}

function parseCodexOutput(stdout: string): InterpretedRequest {
  let finalResponse: string | undefined;
  let threadId: string | undefined;
  let usage:
    | { input_tokens: number; cached_input_tokens: number; output_tokens: number }
    | undefined;

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;

    let rawEvent: unknown;

    try {
      rawEvent = JSON.parse(line);
    } catch {
      throw new PlanningResponseError("O Codex retornou JSONL inválido.");
    }

    const event = codexEventSchema.parse(rawEvent);

    if (event.type === "thread.started") threadId = event.thread_id;

    if (event.item && forbiddenItemTypes.has(event.item.type)) {
      throw new AIPlannerExecutionError(
        `O Codex tentou usar uma capacidade não permitida: ${event.item.type}.`,
      );
    }

    if (
      event.type === "item.completed" &&
      event.item?.type === "agent_message" &&
      event.item.text
    ) {
      finalResponse = event.item.text;
    }

    if (event.type === "turn.failed") {
      throw new AIPlannerExecutionError(
        event.error?.message || "O turno do Codex falhou.",
      );
    }

    if (event.type === "turn.completed" && event.usage) usage = event.usage;
  }

  if (!finalResponse) {
    throw new PlanningResponseError(
      "O Codex não retornou uma interpretação estruturada.",
    );
  }

  let rawIntent: unknown;

  try {
    rawIntent = JSON.parse(finalResponse);
  } catch {
    throw new PlanningResponseError(
      "A resposta final do Codex não contém JSON válido.",
    );
  }

  const intent = interpretedRequestSchema.parse(rawIntent);

  console.info("Codex local planning completed", { threadId, usage });

  return intent;
}

export class CodexLocalPlanner implements AIPlanner {
  async interpret(
    naturalLanguageRequest: string,
    context: AIPlannerContext,
  ): Promise<InterpretedRequest> {
    const temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), "balcao-codex-"),
    );
    const schemaPath = path.join(temporaryDirectory, "intent-schema.json");

    try {
      await writeFile(
        schemaPath,
        JSON.stringify(interpretedRequestJsonSchema),
        "utf8",
      );

      const executable = resolveCodexExecutable();
      const args = [
        "exec",
        "--ephemeral",
        "--json",
        "--sandbox",
        "read-only",
        "-C",
        temporaryDirectory,
        "--skip-git-repo-check",
        "--ignore-user-config",
        "--output-schema",
        schemaPath,
        "--config",
        'approval_policy="never"',
        "--config",
        'model_reasoning_effort="low"',
        "--config",
        'web_search="disabled"',
        "-",
      ];
      let processResult: CodexProcessResult;

      try {
        processResult = await runCodexProcess(
          executable,
          args,
          buildInterpretationPrompt(naturalLanguageRequest, context),
          temporaryDirectory,
          getCodexTimeout(),
        );
      } catch (error) {
        if (
          error instanceof AIPlannerTimeoutError ||
          error instanceof AIPlannerExecutionError
        ) {
          throw error;
        }

        throw new AIPlannerConfigurationError(
          "Codex local indisponível. Execute npm run codex:setup e reinicie o servidor.",
        );
      }

      if (processResult.exitCode !== 0) {
        const normalizedError = processResult.stderr.toLocaleLowerCase("en-US");

        if (
          normalizedError.includes("not logged in") ||
          normalizedError.includes("login required") ||
          normalizedError.includes("authentication")
        ) {
          throw new AIPlannerAuthenticationError();
        }

        throw new AIPlannerExecutionError(
          "O Codex não conseguiu interpretar a solicitação.",
        );
      }

      return parseCodexOutput(processResult.stdout);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}
