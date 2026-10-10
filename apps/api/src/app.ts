import cors from "cors";
import express from "express";

import { AppError } from "./lib/appError";
import { ErrorCode } from "./lib/errors";
import { fail, ok } from "./lib/response";
import { analyticsRouter } from "./routes/analytics";
import { assetsRouter } from "./routes/assets";
import { authRouter } from "./routes/auth";
import { checkinsRouter } from "./routes/checkins";
import { gamificationRouter } from "./routes/gamification";
import { groupsRouter } from "./routes/groups";
import { habitsRouter } from "./routes/habits";
import { meRouter } from "./routes/me";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    ok(res, { ok: true });
  });

  app.get("/", (_req, res) => {
    ok(res, { name: "HabitHive API" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/me", meRouter);
  app.use("/api/habits", habitsRouter);
  app.use("/api/checkins", checkinsRouter);
  app.use("/api/gamification", gamificationRouter);
  app.use("/api/assets", assetsRouter);
  app.use("/api/groups", groupsRouter);
  app.use("/api/analytics", analyticsRouter);

  app.use((_req, res) => {
    fail(res, ErrorCode.NotFound, "not found", 404);
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof AppError) {
      fail(res, err.code, err.message, err.httpStatus, err.data);
      return;
    }
    console.error(err);
    fail(res, ErrorCode.Internal, "internal error", 500);
  });

  return app;
}
