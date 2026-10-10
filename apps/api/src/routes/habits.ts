import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { ErrorCode } from "../lib/errors";
import { fail, ok } from "../lib/response";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

const createHabitSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  targetCount: z.number().int().min(1).max(999).default(1),
});

const updateHabitSchema = createHabitSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  includeArchived: z.coerce.boolean().default(false),
  sort: z
    .enum(["createdAt_desc", "createdAt_asc", "name_asc", "name_desc"])
    .default("createdAt_desc"),
});

export const habitsRouter = Router();

habitsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      fail(res, ErrorCode.ValidationFailed, "invalid query", 400, parsed.error.flatten());
      return;
    }

    const { page, pageSize, includeArchived, sort } = parsed.data;
    const where = { userId, ...(includeArchived ? {} : { isArchived: false }) } as const;

    const orderBy =
      sort === "createdAt_asc"
        ? ({ createdAt: "asc" } as const)
        : sort === "name_asc"
          ? ({ name: "asc" } as const)
          : sort === "name_desc"
            ? ({ name: "desc" } as const)
            : ({ createdAt: "desc" } as const);

    const [total, items] = await prisma.$transaction([
      prisma.habit.count({ where }),
      prisma.habit.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          description: true,
          frequency: true,
          targetCount: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    ok(res, { page, pageSize, total, items });
  }),
);

habitsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const parsed = createHabitSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, ErrorCode.ValidationFailed, "invalid body", 400, parsed.error.flatten());
      return;
    }

    const habit = await prisma.habit.create({
      data: { userId, ...parsed.data },
      select: {
        id: true,
        name: true,
        description: true,
        frequency: true,
        targetCount: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    ok(res, habit);
  }),
);

habitsRouter.get(
  "/:habitId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const habitId = req.params.habitId;

    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId },
      select: {
        id: true,
        name: true,
        description: true,
        frequency: true,
        targetCount: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!habit) {
      fail(res, ErrorCode.NotFound, "habit not found", 404);
      return;
    }

    ok(res, habit);
  }),
);

habitsRouter.put(
  "/:habitId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const habitId = req.params.habitId;
    const parsed = updateHabitSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, ErrorCode.ValidationFailed, "invalid body", 400, parsed.error.flatten());
      return;
    }

    const existing = await prisma.habit.findFirst({ where: { id: habitId, userId } });
    if (!existing) {
      fail(res, ErrorCode.NotFound, "habit not found", 404);
      return;
    }

    const habit = await prisma.habit.update({
      where: { id: habitId },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        description: true,
        frequency: true,
        targetCount: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    ok(res, habit);
  }),
);

habitsRouter.delete(
  "/:habitId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req as AuthedRequest).userId;
    const habitId = req.params.habitId;

    const existing = await prisma.habit.findFirst({ where: { id: habitId, userId } });
    if (!existing) {
      fail(res, ErrorCode.NotFound, "habit not found", 404);
      return;
    }

    const habit = await prisma.habit.update({
      where: { id: habitId },
      data: { isArchived: true },
      select: {
        id: true,
        name: true,
        description: true,
        frequency: true,
        targetCount: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    ok(res, habit);
  }),
);
