import { z } from "zod";

export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "localDate must be YYYY-MM-DD");

export function localDateToDate(localDate: string) {
  const [y, m, d] = localDate.split("-").map((v) => Number(v));
  return new Date(Date.UTC(y, m - 1, d));
}

export function dateToLocalDate(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
