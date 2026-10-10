import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { computeHabitProgress, type ProgressGranularity } from "../lib/habitProgress";
import { ErrorCode } from "../lib/errors";
import { dateToLocalDate, localDateSchema, localDateToDate } from "../lib/localDate";
import { addDaysUtc, previousMonthStartByCountUtc, startOfMonthUtc, startOfWeekUtc } from "../lib/period";
import { fail, ok } from "../lib/response";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

function queryString(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

const habitQuerySchema = z.object({
  habitId: z.string().min(1),
  from: localDateSchema.optional(),
  to: localDateSchema.optional(),
  granularity: z.enum(["AUTO", "DAILY", "WEEKLY", "MONTHLY"]).optional(),
});

function buildSuggestions(args: {
  frequency: ProgressGranularity;
  targetCount: number;
  totalPeriods: number;
  achievedPeriods: number;
  completionRate: number;
  streak: number;
  hasAnyRecord: boolean;
}) {
  const { frequency, targetCount, totalPeriods, achievedPeriods, completionRate, streak, hasAnyRecord } = args;

  const suggestions: string[] = [];

  if (!hasAnyRecord) {
    suggestions.push("No record yet: Start by completing one check-in today and establish the minimum sustainable habit.");
    suggestions.push("It is recommended to set fixed time reminders (such as after getting up in the morning or before going to bed) to reduce forgetting.");
    return suggestions;
  }

  if (totalPeriods >= 7 && completionRate < 0.3) {
    suggestions.push(`The completion rate is relatively low（${Math.round(completionRate * 100)}%）：It is suggested to set the goal from ${targetCount} First, lower to a level that is easier to achieve and pursue stability.`);
  } else if (totalPeriods >= 7 && completionRate < 0.7) {
    suggestions.push(`The completion rate is moderate（${Math.round(completionRate * 100)}%）：It is recommended to fix the execution time and place the check-in entrance on the home page for easy access.`);
  } else if (totalPeriods >= 7 && completionRate >= 0.8) {
    suggestions.push(`The completion rate is very high（${Math.round(completionRate * 100)}%）：You can try to take the target from ${targetCount} This time it was upgraded to${targetCount + 1} Second, gradually increase the intensity.`);
  }

  if (streak === 0 && achievedPeriods > 0) {
    suggestions.push("The winning streak has been interrupted: Start anew today and strive to achieve two consecutive cycles first.");
  }

  if (streak >= 7) {
    suggestions.push(`Has achieved consecutive victories ${streak} One cycle: You can redeem a badge/avatar to reward yourself and keep your motivation going.`);
  }

  if (frequency === "WEEKLY") {
    suggestions.push("It is recommended to schedule a fixed time period in advance (such as Monday/Wednesday/Friday) every week to reduce the cost of making last-minute decisions.");
  } else if (frequency === "MONTHLY") {
    suggestions.push("Monthly habit suggestions are broken down into weekly small goals and reviewed once in the middle of the month to avoid excessive pressure at the end of the month.");
  } else {
    suggestions.push("It is recommended to bind daily habits to goals and scenarios (for example, placing drinking water beside the workstation) to increase the trigger probability.");
  }

  return suggestions.slice(0, 6);
}

export const analyticsRouter = Router();

analyticsRouter.get(
  "/habit",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const habitId = queryString(req.query.habitId) ?? "";
    const from = queryString(req.query.from);
    const to = queryString(req.query.to);
    const granularity = queryString(req.query.granularity);

    const parsed = habitQuerySchema.safeParse({ habitId, from, to, granularity });
    if (!parsed.success) {
      fail(res, ErrorCode.ValidationFailed, "invalid query", 400, parsed.error.flatten());
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

    const usedGranularity: ProgressGranularity =
      parsed.data.granularity && parsed.data.granularity !== "AUTO"
        ? parsed.data.granularity
        : habit.frequency;

    const toLocal = parsed.data.to ?? dateToLocalDate(new Date());
    const toUtc = localDateToDate(toLocal);

    const fromUtc =
      parsed.data.from
        ? localDateToDate(parsed.data.from)
        : usedGranularity === "DAILY"
          ? addDaysUtc(toUtc, -29)
          : usedGranularity === "WEEKLY"
            ? addDaysUtc(startOfWeekUtc(toUtc), -(12 - 1) * 7)
            : previousMonthStartByCountUtc(startOfMonthUtc(toUtc), 11);

    const items = await computeHabitProgress({
      prisma,
      userId,
      habitId: habit.id,
      fromUtc,
      toUtc,
      granularity: usedGranularity,
      targetCount: habit.targetCount,
    });

    const totalPeriods = items.length;
    const achievedPeriods = items.filter((it) => it.achieved).length;
    const completionRate = totalPeriods === 0 ? 0 : achievedPeriods / totalPeriods;

    let streak = 0;
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (!items[i].achieved) break;
      streak += 1;
    }

    const hasAnyRecord = items.some((it) => it.count > 0);
    const suggestions = buildSuggestions({
      frequency: usedGranularity,
      targetCount: habit.targetCount,
      totalPeriods,
      achievedPeriods,
      completionRate,
      streak,
      hasAnyRecord,
    });

    ok(res, {
      habitId: habit.id,
      granularity: usedGranularity,
      from: dateToLocalDate(fromUtc),
      to: toLocal,
      targetCount: habit.targetCount,
      stats: {
        totalPeriods,
        achievedPeriods,
        completionRate,
        streak,
      },
      items,
      suggestions,
    });
  }),
);

