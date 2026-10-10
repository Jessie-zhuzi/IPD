import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { signToken } from "../lib/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { ErrorCode } from "../lib/errors";
import { fail, ok } from "../lib/response";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1).max(50),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, ErrorCode.ValidationFailed, "invalid body", 400, parsed.error.flatten());
      return;
    }

    const { email, password, displayName } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const user = await prisma.user.create({
        data: { email, passwordHash, displayName, avatarKey: "avatar_default" },
        select: { id: true, email: true, displayName: true, avatarKey: true, points: true },
      });

      const token = signToken({ userId: user.id });
      ok(res, { token, user });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        fail(res, ErrorCode.Conflict, "email already exists", 409);
        return;
      }
      throw err;
    }
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, ErrorCode.ValidationFailed, "invalid body", 400, parsed.error.flatten());
      return;
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, displayName: true, avatarKey: true, points: true, passwordHash: true },
    });

    if (!user) {
      fail(res, ErrorCode.InvalidCredentials, "invalid credentials", 401);
      return;
    }

    const okPassword = await bcrypt.compare(password, user.passwordHash);
    if (!okPassword) {
      fail(res, ErrorCode.InvalidCredentials, "invalid credentials", 401);
      return;
    }

    const token = signToken({ userId: user.id });
    ok(res, {
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarKey: user.avatarKey,
        points: user.points,
      },
    });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (_req, res) => {
    ok(res, { ok: true });
  }),
);
