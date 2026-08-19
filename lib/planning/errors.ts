export class AIPlannerConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIPlannerConfigurationError";
  }
}

export class AIPlannerAuthenticationError extends Error {
  constructor() {
    super(
      "Codex não autenticado. Execute npm run codex:login, conclua o login com sua conta ChatGPT e tente novamente.",
    );
    this.name = "AIPlannerAuthenticationError";
  }
}

export class AIPlannerTimeoutError extends Error {
  constructor() {
    super("O Codex excedeu o tempo limite do planejamento. Tente novamente.");
    this.name = "AIPlannerTimeoutError";
  }
}

export class AIPlannerExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIPlannerExecutionError";
  }
}

export class PlanningResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanningResponseError";
  }
}
