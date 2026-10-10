import type { Prisma, PrismaClient } from "@prisma/client";

import { dateToLocalDate } from "./localDate";
import { addDaysUtc, endOfMonthUtc, startOfMonthUtc, startOfWeekUtc } from "./period";

export type ProgressGranularity = "DAILY" | "WEEKLY" | "MONTHLY";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type ProgressItem = {
  periodStart: string;
  periodEnd: string;
  count: number;
  targetCount: number;
  achieved: boolean;
};

export async function computeHabitProgress(args: {
  prisma: DbClient;
  userId: string;
  habitId: string;
  fromUtc: Date;
  toUtc: Date;
  granularity: ProgressGranularity;
  targetCount: number;
}): Promise<ProgressItem[]> {
  const { prisma, userId, habitId, fromUtc, toUtc, granularity, targetCount } = args;

  const checkins = await prisma.habitCheckin.findMany({
    where: { habitId, userId, localDate: { gte: fromUtc, lte: toUtc } },
    select: { localDate: true, count: true },
    orderBy: { localDate: "asc" },
  });

  const dayCount = new Map<string, number>();
  for (const c of checkins) {
    dayCount.set(dateToLocalDate(c.localDate), c.count);
  }

  const items: ProgressItem[] = [];

  if (granularity === "DAILY") {
    for (let d = fromUtc; d <= toUtc; d = addDaysUtc(d, 1)) {
      const key = dateToLocalDate(d);
      const count = dayCount.get(key) ?? 0;
      items.push({
        periodStart: key,
        periodEnd: key,
        count,
        targetCount,
        achieved: count >= targetCount,
      });
    }
    return items;
  }

  if (granularity === "WEEKLY") {
    const weekCount = new Map<string, number>();
    for (const c of checkins) {
      const ws = dateToLocalDate(startOfWeekUtc(c.localDate));
      weekCount.set(ws, (weekCount.get(ws) ?? 0) + c.count);
    }

    for (let ws = startOfWeekUtc(fromUtc); ws <= toUtc; ws = addDaysUtc(ws, 7)) {
      const start = dateToLocalDate(ws);
      const end = dateToLocalDate(addDaysUtc(ws, 6));
      const count = weekCount.get(start) ?? 0;
      items.push({
        periodStart: start,
        periodEnd: end,
        count,
        targetCount,
        achieved: count >= targetCount,
      });
    }
    return items;
  }

  const monthCount = new Map<string, number>();
  for (const c of checkins) {
    const ms = dateToLocalDate(startOfMonthUtc(c.localDate));
    monthCount.set(ms, (monthCount.get(ms) ?? 0) + c.count);
  }

  for (let ms = startOfMonthUtc(fromUtc); ms <= toUtc; ms = startOfMonthUtc(addDaysUtc(endOfMonthUtc(ms), 1))) {
    const start = dateToLocalDate(ms);
    const end = dateToLocalDate(endOfMonthUtc(ms));
    const count = monthCount.get(start) ?? 0;
    items.push({
      periodStart: start,
      periodEnd: end,
      count,
      targetCount,
      achieved: count >= targetCount,
    });
  }
  return items;
}

