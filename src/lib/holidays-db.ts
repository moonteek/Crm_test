import "server-only";
import { cache } from "react";
import { db } from "./db";
import { holidayRefusal } from "./holidays";

/** The centre's holidays as ISO days ("2026-11-10"), loaded once per request; billing and the course plan need them. */
export const holidayDays = cache(async (): Promise<string[]> =>
  (await db.holiday.findMany({ select: { date: true } })).map((h) => h.date.toISOString().slice(0, 10)),
);

/** Throws when `date` is a holiday — every way of marking attendance or grades calls this (screens and MCP tools). */
export async function assertNotHoliday(date: Date) {
  const refusal = holidayRefusal(date, await holidayDays());
  if (refusal) throw new Error(refusal);
}
