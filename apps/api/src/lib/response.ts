import type { Response } from "express";

import type { ErrorCodeValue } from "./errors";

export function ok<T>(res: Response, data: T, message = "ok") {
  res.json({ code: 0, message, data });
}

export function fail(
  res: Response,
  code: ErrorCodeValue,
  message: string,
  httpStatus = 400,
  data: unknown = null,
) {
  res.status(httpStatus).json({ code, message, data });
}

