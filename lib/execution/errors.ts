export type OperationExecutionErrorCode =
  | "INVALID_PLAN"
  | "INSUFFICIENT_INVENTORY"
  | "IDEMPOTENCY_CONFLICT"
  | "EXECUTION_FAILED";

export class OperationExecutionError extends Error {
  constructor(
    public readonly code: OperationExecutionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OperationExecutionError";
  }
}
