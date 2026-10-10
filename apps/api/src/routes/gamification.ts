import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../lib/appError";
import { ErrorCode } from "../lib/errors";
import { POINT_RULES } from "../lib/gamification";
import { fail, ok } from "../lib/response";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const redeemSchema = z.object({
  assetKey: z.string().min(1).max(100),
});

function parseMeta(metaJson: string | null) {
  if (!metaJson) return null;
  try {
    return JSON.parse(metaJson) as unknown;
  } catch {
    return metaJson;
  }
}

export const gamificationRouter = Router();

gamificationRouter.get(
  "/rules",
  requireAuth,
  asyncHandler(async (_req, res) => {
    ok(res, POINT_RULES);
  }),
);

gamificationRouter.get(
  "/ledger",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, ErrorCode.ValidationFailed, "invalid query", 400, parsed.error.flatten());
      return;
    }

    const { page, pageSize } = parsed.data;
    const where = { userId } as const;

    const [total, rows] = await prisma.$transaction([
      prisma.pointsLedger.count({ where }),
      prisma.pointsLedger.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, delta: true, reason: true, metaJson: true, createdAt: true },
      }),
    ]);

    ok(res, {
      page,
      pageSize,
      total,
      items: rows.map((row) => ({
        id: row.id,
        delta: row.delta,
        reason: row.reason,
        meta: parseMeta(row.metaJson),
        createdAt: row.createdAt,
      })),
    });
  }),
);

gamificationRouter.post(
  "/redeem",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const parsed = redeemSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, ErrorCode.ValidationFailed, "invalid body", 400, parsed.error.flatten());
      return;
    }

    const asset = await prisma.asset.findUnique({
      where: { assetKey: parsed.data.assetKey },
      select: { id: true, assetKey: true, type: true, name: true, costPoints: true },
    });
    if (!asset) {
      fail(res, ErrorCode.NotFound, "asset not found", 404);
      return;
    }
    if (asset.costPoints <= 0) {
      fail(res, ErrorCode.ValidationFailed, "asset is not redeemable", 400);
      return;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const owned = await tx.userAsset.findFirst({
          where: { userId, assetId: asset.id },
          select: { id: true },
        });
        if (owned) {
          throw new AppError(ErrorCode.Conflict, "asset already owned", 409);
        }

        const updated = await tx.user.updateMany({
          where: { id: userId, points: { gte: asset.costPoints } },
          data: { points: { decrement: asset.costPoints } },
        });
        if (updated.count === 0) {
          throw new AppError(ErrorCode.InsufficientPoints, "insufficient points", 409, { required: asset.costPoints });
        }

        await tx.userAsset.create({ data: { userId, assetId: asset.id } });
        await tx.pointsLedger.create({
          data: {
            userId,
            delta: -asset.costPoints,
            reason: "REDEEM",
            metaJson: JSON.stringify({ assetKey: asset.assetKey, assetId: asset.id, assetType: asset.type }),
          },
        });

        const user = await tx.user.findUnique({ where: { id: userId }, select: { points: true } });
        return { points: user?.points ?? 0 };
      });

      ok(res, { ...result, asset });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new AppError(ErrorCode.Conflict, "asset already owned", 409);
      }
      throw err;
    }
  }),
);

