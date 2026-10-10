import type { Prisma, PrismaClient } from "@prisma/client";

import { dateToLocalDate } from "./localDate";
import { addDaysUtc, previousMonthStartByCountUtc, previousMonthStartUtc, startOfWeekUtc } from "./period";

export const POINT_RULES = {
  baseAchievePoints: 20,
  streakBonusPerPeriod: 5,
  maxLookbackDays: 365,
  maxLookbackWeeks: 52,
  maxLookbackMonths: 24,
} as const;

export type HabitFrequencyValue = "DAILY" | "WEEKLY" | "MONTHLY";

export function makePeriodKey(habitId: string, frequency: HabitFrequencyValue, periodStartLocalDate: string) {
  return `achieve:${habitId}:${frequency}:${periodStartLocalDate}`;
}

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function computeStreakBeforePeriod(args: {
  prisma: DbClient;
  userId: string;
  habitId: string;
  frequency: HabitFrequencyValue;
  targetCount: number;
  periodStartUtc: Date;
}) {
  const { prisma, userId, habitId, frequency, targetCount, periodStartUtc } = args;

  if (frequency === "DAILY") {
    const latest = addDaysUtc(periodStartUtc, -1);
    const earliest = addDaysUtc(periodStartUtc, -POINT_RULES.maxLookbackDays);

    const rows = await prisma.habitCheckin.findMany({
      where: { habitId, userId, localDate: { gte: earliest, lte: latest } },
      select: { localDate: true, count: true },
    });

    const dayCount = new Map<string, number>();
    for (const r of rows) dayCount.set(dateToLocalDate(r.localDate), r.count);

    let streak = 0;
    for (let d = latest; d >= earliest; d = addDaysUtc(d, -1)) {
      const key = dateToLocalDate(d);
      const count = dayCount.get(key) ?? 0;
      if (count >= targetCount) streak += 1;
      else break;
    }
    return streak;
  }

  if (frequency === "WEEKLY") {
    const latestWeekStart = addDaysUtc(periodStartUtc, -7);
    const earliestWeekStart = addDaysUtc(periodStartUtc, -POINT_RULES.maxLookbackWeeks * 7);
    const latestDate = addDaysUtc(periodStartUtc, -1);

    const rows = await prisma.habitCheckin.findMany({
      where: { habitId, userId, localDate: { gte: earliestWeekStart, lte: latestDate } },
      select: { localDate: true, count: true },
    });

    const weekSum = new Map<string, number>();
    for (const r of rows) {
      const ws = dateToLocalDate(startOfWeekUtc(r.localDate));
      weekSum.set(ws, (weekSum.get(ws) ?? 0) + r.count);
    }

    let streak = 0;
    for (let ws = latestWeekStart; ws >= earliestWeekStart; ws = addDaysUtc(ws, -7)) {
      const key = dateToLocalDate(ws);
      const sum = weekSum.get(key) ?? 0;
      if (sum >= targetCount) streak += 1;
      else break;
    }
    return streak;
  }

  const latestMonthStart = previousMonthStartUtc(periodStartUtc);
  const earliestMonthStart = previousMonthStartByCountUtc(periodStartUtc, POINT_RULES.maxLookbackMonths);
  const latestDate = addDaysUtc(periodStartUtc, -1);

  const rows = await prisma.habitCheckin.findMany({
    where: { habitId, userId, localDate: { gte: earliestMonthStart, lte: latestDate } },
    select: { localDate: true, count: true },
  });

  const monthSum = new Map<string, number>();
  for (const r of rows) {
    const ms = dateToLocalDate(new Date(Date.UTC(r.localDate.getUTCFullYear(), r.localDate.getUTCMonth(), 1)));
    monthSum.set(ms, (monthSum.get(ms) ?? 0) + r.count);
  }

  let streak = 0;
  for (let ms = latestMonthStart; ms >= earliestMonthStart; ms = previousMonthStartUtc(ms)) {
    const key = dateToLocalDate(ms);
    const sum = monthSum.get(key) ?? 0;
    if (sum >= targetCount) streak += 1;
    else break;
  }
  return streak;
}
