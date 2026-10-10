export const ErrorCode = {
  InvalidCredentials: 10001,
  Unauthorized: 10002,
  Forbidden: 10003,
  ValidationFailed: 20001,
  NotFound: 20004,
  Internal: 90001,
  InsufficientPoints: 30001,
  Conflict: 30002,
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];
