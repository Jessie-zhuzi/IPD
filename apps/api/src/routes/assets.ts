import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { ErrorCode } from "../lib/errors";
import { fail, ok } from "../lib/response";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

const listQuerySchema = z.object({
  type: z.enum(["AVATAR", "BADGE"]).optional(),
});

export const assetsRouter = Router();

assetsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, ErrorCode.ValidationFailed, "invalid query", 400, parsed.error.flatten());
      return;
    }

    const assets = await prisma.asset.findMany({
      where: parsed.data.type ? { type: parsed.data.type } : {},
      orderBy: [{ type: "asc" }, { costPoints: "asc" }, { createdAt: "asc" }],
      include: {
        userAssets: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    ok(res, {
      items: assets.map((a) => ({
        assetKey: a.assetKey,
        type: a.type,
        name: a.name,
        costPoints: a.costPoints,
        owned: a.costPoints <= 0 ? true : a.userAssets.length > 0,
      })),
    });
  }),
);

assetsRouter.get(
  "/owned",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, ErrorCode.ValidationFailed, "invalid query", 400, parsed.error.flatten());
      return;
    }

    const owned = await prisma.userAsset.findMany({
      where: { userId, ...(parsed.data.type ? { asset: { type: parsed.data.type } } : {}) },
      orderBy: { createdAt: "desc" },
      include: { asset: true },
    });

    ok(res, {
      items: owned.map((ua) => ({
        assetKey: ua.asset.assetKey,
        type: ua.asset.type,
        name: ua.asset.name,
        costPoints: ua.asset.costPoints,
        ownedAt: ua.createdAt,
      })),
    });
  }),
);

