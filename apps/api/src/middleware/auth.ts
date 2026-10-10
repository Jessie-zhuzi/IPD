import type { NextFunction, Request, Response } from "express";

import { ErrorCode } from "../lib/errors";
import { fail } from "../lib/response";
import { verifyToken } from "../lib/auth";

export type AuthedRequest = Request & { userId: string };

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    fail(res, ErrorCode.Unauthorized, "missing token", 401);
    return;
  }

  try {
    const payload = verifyToken(match[1]);
    (req as AuthedRequest).userId = payload.userId;
    next();
  } catch {
    fail(res, ErrorCode.Unauthorized, "invalid token", 401);
  }
}
