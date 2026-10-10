import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../lib/appError";
import { ErrorCode } from "../lib/errors";
import { dateToLocalDate } from "../lib/localDate";
import { fail, ok } from "../lib/response";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

const createGroupSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  joinType: z.enum(["PUBLIC", "INVITE"]).default("PUBLIC"),
});

const listGroupsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const joinGroupSchema = z.object({
  groupId: z.string().min(1).optional(),
  inviteCode: z.string().min(1).optional(),
});

function makeInviteCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function parseStreakFromMeta(meta: unknown) {
  if (!meta || typeof meta !== "object") return 0;
  const value = (meta as Record<string, unknown>).streak;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseFrequencyFromMeta(meta: unknown) {
  if (!meta || typeof meta !== "object") return "";
  const value = (meta as Record<string, unknown>).frequency;
  return typeof value === "string" ? value : "";
}

function parsePeriodStartFromMeta(meta: unknown) {
  if (!meta || typeof meta !== "object") return "";
  const value = (meta as Record<string, unknown>).periodStart;
  return typeof value === "string" ? value : "";
}

function safeJsonParse(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export const groupsRouter = Router();

groupsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const parsed = listGroupsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, ErrorCode.ValidationFailed, "invalid query", 400, parsed.error.flatten());
      return;
    }

    const { page, pageSize } = parsed.data;

    const [total, memberships] = await prisma.$transaction([
      prisma.groupMember.count({ where: { userId } }),
      prisma.groupMember.findMany({
        where: { userId },
        orderBy: { joinedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          group: {
            select: { id: true, name: true, description: true, joinType: true, inviteCode: true, ownerUserId: true },
          },
        },
      }),
    ]);

    ok(res, {
      page,
      pageSize,
      total,
      items: memberships.map((m) => ({
        group: m.group,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    });
  }),
);

groupsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const parsed = createGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, ErrorCode.ValidationFailed, "invalid body", 400, parsed.error.flatten());
      return;
    }

    const { name, description, joinType } = parsed.data;

    try {
      const group = await prisma.$transaction(async (tx) => {
        let inviteCode: string | null = null;
        if (joinType === "INVITE") {
          // retry on unique conflict
          for (let i = 0; i < 5; i += 1) {
            inviteCode = makeInviteCode(6);
            try {
              const created = await tx.group.create({
                data: { ownerUserId: userId, name, description, joinType, inviteCode },
                select: { id: true, name: true, description: true, joinType: true, inviteCode: true, ownerUserId: true },
              });
              await tx.groupMember.create({ data: { groupId: created.id, userId, role: "OWNER" } });
              return created;
            } catch (err) {
              if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
              throw err;
            }
          }
          throw new AppError(ErrorCode.Internal, "failed to generate inviteCode", 500);
        }

        const created = await tx.group.create({
          data: { ownerUserId: userId, name, description, joinType },
          select: { id: true, name: true, description: true, joinType: true, inviteCode: true, ownerUserId: true },
        });
        await tx.groupMember.create({ data: { groupId: created.id, userId, role: "OWNER" } });
        return created;
      });

      ok(res, group);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        fail(res, ErrorCode.Conflict, "inviteCode conflict", 409);
        return;
      }
      throw err;
    }
  }),
);

groupsRouter.post(
  "/join",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const parsed = joinGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, ErrorCode.ValidationFailed, "invalid body", 400, parsed.error.flatten());
      return;
    }

    const { groupId, inviteCode } = parsed.data;
    if (!groupId && !inviteCode) {
      fail(res, ErrorCode.ValidationFailed, "groupId or inviteCode required", 400);
      return;
    }

    const group = inviteCode
      ? await prisma.group.findUnique({
          where: { inviteCode },
          select: { id: true, name: true, description: true, joinType: true, inviteCode: true, ownerUserId: true },
        })
      : await prisma.group.findUnique({
          where: { id: groupId! },
          select: { id: true, name: true, description: true, joinType: true, inviteCode: true, ownerUserId: true },
        });

    if (!group) {
      fail(res, ErrorCode.NotFound, "group not found", 404);
      return;
    }
    if (group.joinType === "INVITE" && !inviteCode) {
      fail(res, ErrorCode.Forbidden, "inviteCode required", 403);
      return;
    }

    try {
      await prisma.groupMember.create({ data: { groupId: group.id, userId, role: "MEMBER" } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // already joined
      } else {
        throw err;
      }
    }

    ok(res, group);
  }),
);

groupsRouter.post(
  "/:groupId/leave",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const groupId = req.params.groupId;

    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { role: true },
    });
    if (!member) {
      fail(res, ErrorCode.NotFound, "membership not found", 404);
      return;
    }

    if (member.role === "OWNER") {
      const others = await prisma.groupMember.count({ where: { groupId, NOT: { userId } } });
      if (others > 0) {
        fail(res, ErrorCode.Conflict, "owner cannot leave while other members exist", 409);
        return;
      }
      await prisma.group.delete({ where: { id: groupId } });
      ok(res, { ok: true });
      return;
    }

    await prisma.groupMember.delete({ where: { groupId_userId: { groupId, userId } } });
    ok(res, { ok: true });
  }),
);

groupsRouter.get(
  "/:groupId/members",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const groupId = req.params.groupId;

    const isMember = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (!isMember) {
      fail(res, ErrorCode.Forbidden, "not a group member", 403);
      return;
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      include: {
        user: { select: { id: true, displayName: true, avatarKey: true, points: true } },
      },
    });

    ok(res, {
      items: members.map((m) => ({
        userId: m.user.id,
        displayName: m.user.displayName,
        avatarKey: m.user.avatarKey,
        points: m.user.points,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    });
  }),
);

groupsRouter.get(
  "/:groupId/leaderboard",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const groupId = req.params.groupId;

    const isMember = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (!isMember) {
      fail(res, ErrorCode.Forbidden, "not a group member", 403);
      return;
    }

    const query = z
      .object({
        sort: z.enum(["points_desc", "streak_desc"]).default("points_desc"),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .safeParse(req.query);

    if (!query.success) {
      fail(res, ErrorCode.ValidationFailed, "invalid query", 400, query.error.flatten());
      return;
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { id: true, displayName: true, avatarKey: true, points: true } } },
    });

    const userIds = members.map((m) => m.user.id);
    const ledgers = await prisma.pointsLedger.findMany({
      where: { userId: { in: userIds }, reason: "ACHIEVE" },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { userId: true, metaJson: true },
    });

    const bestStreakByUser = new Map<string, number>();
    const today = dateToLocalDate(new Date());
    const todayAchievedByUser = new Map<string, boolean>();

    for (const row of ledgers) {
      const meta = safeJsonParse(row.metaJson);
      const streak = parseStreakFromMeta(meta);
      const prevBest = bestStreakByUser.get(row.userId) ?? 0;
      if (streak > prevBest) bestStreakByUser.set(row.userId, streak);

      const freq = parseFrequencyFromMeta(meta);
      const periodStart = parsePeriodStartFromMeta(meta);
      if (freq === "DAILY" && periodStart === today) todayAchievedByUser.set(row.userId, true);
    }

    const sorted = members
      .map((m) => ({
        userId: m.user.id,
        displayName: m.user.displayName,
        avatarKey: m.user.avatarKey,
        points: m.user.points,
        bestStreak: bestStreakByUser.get(m.user.id) ?? 0,
        todayAchieved: todayAchievedByUser.get(m.user.id) ?? false,
      }))
      .sort((a, b) =>
        query.data.sort === "streak_desc"
          ? b.bestStreak - a.bestStreak || b.points - a.points || a.displayName.localeCompare(b.displayName)
          : b.points - a.points || b.bestStreak - a.bestStreak || a.displayName.localeCompare(b.displayName),
      );

    const total = sorted.length;
    const start = (query.data.page - 1) * query.data.pageSize;
    const end = start + query.data.pageSize;

    ok(res, { page: query.data.page, pageSize: query.data.pageSize, total, items: sorted.slice(start, end) });
  }),
);
