import { Router } from "express";

import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { ErrorCode } from "../lib/errors";
import { fail, ok } from "../lib/response";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

export const meRouter = Router();

meRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, avatarKey: true, points: true, createdAt: true },
    });

    if (!user) {
      fail(res, ErrorCode.NotFound, "user not found", 404);
      return;
    }

    ok(res, user);
  }),
);

meRouter.post(
  "/avatar",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const assetKey = typeof req.body?.assetKey === "string" ? req.body.assetKey : "";
    if (!assetKey) {
      fail(res, ErrorCode.ValidationFailed, "missing assetKey");
      return;
    }

    const asset = await prisma.asset.findUnique({ where: { assetKey } });
    if (!asset || asset.type !== "AVATAR") {
      fail(res, ErrorCode.NotFound, "avatar not found", 404);
      return;
    }

    if (asset.costPoints > 0) {
      const owned = await prisma.userAsset.findFirst({ where: { userId, assetId: asset.id } });
      if (!owned) {
        fail(res, ErrorCode.Forbidden, "avatar not owned", 403);
        return;
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarKey: asset.assetKey },
      select: { id: true, displayName: true, avatarKey: true, points: true },
    });
    ok(res, user);
  }),
);

