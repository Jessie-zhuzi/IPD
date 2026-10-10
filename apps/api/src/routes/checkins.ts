import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../lib/appError";
import { ErrorCode } from "../lib/errors";
import { POINT_RULES, computeStreakBeforePeriod, makePeriodKey } from "../lib/gamification";
import { computeHabitProgress, type ProgressGranularity } from "../lib/habitProgress";
import { dateToLocalDate, localDateSchema, localDateToDate } from "../lib/localDate";
import { addDaysUtc, endOfMonthUtc, startOfMonthUtc, startOfWeekUtc } from "../lib/period";
import { fail, ok } from "../lib/response";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

const habitIdSchema = z.string().min(1);

function queryString(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

const listQuerySchema = z.object({
  habitId: habitIdSchema,
  from: localDateSchema,
  to: localDateSchema,
});

const setBodySchema = z.object({
  habitId: habitIdSchema,
  localDate: localDateSchema,
  count: z.number().int().min(0).max(999),
});

const progressQuerySchema = z.object({
  habitId: habitIdSchema,
  from: localDateSchema,
  to: localDateSchema,
  granularity: z.enum(["AUTO", "DAILY", "WEEKLY", "MONTHLY"]).optional(),
});

export const checkinsRouter = Router();

checkinsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const habitId = queryString(req.query.habitId) ?? "";
    const from = queryString(req.query.from) ?? "";
    const to = queryString(req.query.to) ?? "";

    const parsed = listQuerySchema.safeParse({ habitId, from, to });
    if (!parsed.success) {
      fail(res, ErrorCode.ValidationFailed, "invalid query", 400, parsed.error.flatten());
      return;
    }

    if (parsed.data.from > parsed.data.to) {
      fail(res, ErrorCode.ValidationFailed, "from must be <= to", 400);
      return;
    }

    const habit = await prisma.habit.findFirst({
      where: { id: parsed.data.habitId, userId },
      select: { id: true },
    });
    if (!habit) {
      fail(res, ErrorCode.NotFound, "habit not found", 404);
      return;
    }

    const fromDate = localDateToDate(parsed.data.from);
    const toDate = localDateToDate(parsed.data.to);

    const items = await prisma.habitCheckin.findMany({
      where: {
        habitId: parsed.data.habitId,
        userId,
        localDate: { gte: fromDate, lte: toDate },
      },
      orderBy: { localDate: "asc" },
      select: { localDate: true, count: true },
    });

    ok(res, {
      habitId: parsed.data.habitId,
      from: parsed.data.from,
      to: parsed.data.to,
      items: items.map((it) => ({ localDate: dateToLocalDate(it.localDate), count: it.count })),
    });
  }),
);

checkinsRouter.put(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const parsed = setBodySchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, ErrorCode.ValidationFailed, "invalid body", 400, parsed.error.flatten());
      return;
    }

    const { habitId, localDate, count } = parsed.data;

    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId },
      select: { id: true, frequency: true, targetCount: true, isArchived: true },
    });
    if (!habit) {
      fail(res, ErrorCode.NotFound, "habit not found", 404);
      return;
    }
    if (habit.isArchived) {
      fail(res, ErrorCode.Conflict, "habit archived", 409);
      return;
    }

    const date = localDateToDate(localDate);
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.habitCheckin.findUnique({
        where: { habitId_localDate: { habitId, localDate: date } },
        select: { count: true },
      });
      const oldCount = existing?.count ?? 0;

      let periodStartUtc = date;
      let periodEndUtc = date;
      let oldTotal = oldCount;
      let newTotal = count;

      if (habit.frequency === "WEEKLY") {
        periodStartUtc = startOfWeekUtc(date);
        periodEndUtc = addDaysUtc(periodStartUtc, 6);
        const aggregate = await tx.habitCheckin.aggregate({
          where: { habitId, userId, localDate: { gte: periodStartUtc, lte: periodEndUtc } },
          _sum: { count: true },
        });
        oldTotal = aggregate._sum.count ?? 0;
        newTotal = oldTotal - oldCount + count;
      } else if (habit.frequency === "MONTHLY") {
        periodStartUtc = startOfMonthUtc(date);
        periodEndUtc = endOfMonthUtc(date);
        const aggregate = await tx.habitCheckin.aggregate({
          where: { habitId, userId, localDate: { gte: periodStartUtc, lte: periodEndUtc } },
          _sum: { count: true },
        });
        oldTotal = aggregate._sum.count ?? 0;
        newTotal = oldTotal - oldCount + count;
      }

      const oldAchieved = oldTotal >= habit.targetCount;
      const newAchieved = newTotal >= habit.targetCount;

      const periodStartLocal = dateToLocalDate(periodStartUtc);
      const periodEndLocal = dateToLocalDate(periodEndUtc);
      const periodKey = makePeriodKey(habitId, habit.frequency, periodStartLocal);

      if (oldAchieved && !newAchieved) {
        const lastAchieve = await tx.pointsLedger.findFirst({
          where: {
            userId,
            reason: "ACHIEVE",
            OR: [{ dedupeKey: periodKey }, { metaJson: { contains: periodKey } }],
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, delta: true, dedupeKey: true },
        });
        const revertPoints = lastAchieve && lastAchieve.delta > 0 ? lastAchieve.delta : 0;

        if (revertPoints > 0) {
          const updated = await tx.user.updateMany({
            where: { id: userId, points: { gte: revertPoints } },
            data: { points: { decrement: revertPoints } },
          });
          if (updated.count === 0) {
            throw new AppError(ErrorCode.InsufficientPoints, "insufficient points", 409, {
              required: revertPoints,
            });
          }

          await tx.pointsLedger.create({
            data: {
              userId,
              delta: -revertPoints,
              reason: "UNACHIEVE",
              metaJson: JSON.stringify({
                periodKey,
                habitId,
                frequency: habit.frequency,
                periodStart: periodStartLocal,
                periodEnd: periodEndLocal,
              }),
            },
          });

          if (lastAchieve?.dedupeKey === periodKey) {
            await tx.pointsLedger.update({ where: { id: lastAchieve.id }, data: { dedupeKey: null } });
          }
        }
      }

      if (count === 0) {
        await tx.habitCheckin.deleteMany({ where: { habitId, localDate: date, userId } });
      } else {
        await tx.habitCheckin.upsert({
          where: { habitId_localDate: { habitId, localDate: date } },
          update: { count },
          create: { habitId, userId, localDate: date, count },
        });
      }

      if (!oldAchieved && newAchieved) {
        const streakBefore = await computeStreakBeforePeriod({
          prisma: tx,
          userId,
          habitId,
          frequency: habit.frequency,
          targetCount: habit.targetCount,
          periodStartUtc,
        });
        const streak = streakBefore + 1;
        const awardedPoints = POINT_RULES.baseAchievePoints + streak * POINT_RULES.streakBonusPerPeriod;

        try {
          await tx.pointsLedger.create({
            data: {
              userId,
              delta: awardedPoints,
              reason: "ACHIEVE",
              dedupeKey: periodKey,
              metaJson: JSON.stringify({
                periodKey,
                habitId,
                frequency: habit.frequency,
                periodStart: periodStartLocal,
                periodEnd: periodEndLocal,
                streak,
              }),
            },
          });

          await tx.user.update({ where: { id: userId }, data: { points: { increment: awardedPoints } } });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            // already awarded for this period
          } else {
            throw err;
          }
        }
      }

      const user = await tx.user.findUnique({ where: { id: userId }, select: { points: true } });
      return {
        habitId,
        localDate,
        count,
        achieved: newAchieved,
        period: { start: periodStartLocal, end: periodEndLocal, frequency: habit.frequency },
        points: user?.points ?? 0,
      };
    });

    ok(res, result);
  }),
);

checkinsRouter.get(
  "/progress",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const habitId = queryString(req.query.habitId) ?? "";
    const from = queryString(req.query.from) ?? "";
    const to = queryString(req.query.to) ?? "";
    const granularity = queryString(req.query.granularity) ?? undefined;

    const parsed = progressQuerySchema.safeParse({ habitId, from, to, granularity });
    if (!parsed.success) {
      fail(res, ErrorCode.ValidationFailed, "invalid query", 400, parsed.error.flatten());
      return;
    }
    if (parsed.data.from > parsed.data.to) {
      fail(res, ErrorCode.ValidationFailed, "from must be <= to", 400);
      return;
    }

    const habit = await prisma.habit.findFirst({
      where: { id: parsed.data.habitId, userId },
      select: { id: true, frequency: true, targetCount: true },
    });
    if (!habit) {
      fail(res, ErrorCode.NotFound, "habit not found", 404);
      return;
    }

    const fromDate = localDateToDate(parsed.data.from);
    const toDate = localDateToDate(parsed.data.to);

      const usedGranularity: ProgressGranularity =
        parsed.data.granularity && parsed.data.granularity !== "AUTO"
          ? parsed.data.granularity
          : habit.frequency;

      const items = await computeHabitProgress({
        prisma,
        userId,
        habitId: habit.id,
        fromUtc: fromDate,
        toUtc: toDate,
        granularity: usedGranularity,
        targetCount: habit.targetCount,
      });

      ok(res, {
        habitId: habit.id,
        from: parsed.data.from,
      to: parsed.data.to,
      granularity: usedGranularity,
      targetCount: habit.targetCount,
      items,
    });
  }),
);
