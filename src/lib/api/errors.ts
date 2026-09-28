/**
 * Loi nghiep vu co the tra ve client voi HTTP status tuong ung.
 */
export class ServiceError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status = 400, code = "SERVICE_ERROR", details?: unknown) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}
