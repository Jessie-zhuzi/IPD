export type ApiSuccess<T> = { code: 0; message: string; data: T };
export type ApiFailure = { code: number; message: string; data: unknown };
export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export class ApiError extends Error {
  readonly code: number;
  readonly data: unknown;

  constructor(code: number, message: string, data: unknown) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

