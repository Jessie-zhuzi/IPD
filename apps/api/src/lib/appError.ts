import type { ErrorCodeValue } from "./errors";

export class AppError extends Error {
  readonly code: ErrorCodeValue;
  readonly httpStatus: number;
  readonly data: unknown;

  constructor(code: ErrorCodeValue, message: string, httpStatus = 400, data: unknown = null) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.data = data;
  }
}

