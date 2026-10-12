import "server-only";
import { cache } from "react";
import { db } from "./db";
import { holidayRefusal } from "./holidays";
import { closedDays } from "./lesson-changes";

/** The centre's holidays as ISO days ("2026-11-10"), loaded once per request; billing and the course plan need them. */
export const holidayDays = cache(async (): Promise<string[]> =>
  (await db.holiday.findMany({ select: { date: true } })).map((h) => h.date.toISOString().slice(0, 10)),
);

/** Throws when `date` is a holiday — every way of marking attendance or grades calls this (screens and MCP tools). */
export async function assertNotHoliday(date: Date) {
  const refusal = holidayRefusal(date, await holidayDays());
  if (refusal) throw new Error(refusal);
}

/**
 * Each group's closed days (ISO): the centre's holidays plus that group's cancelled lessons ("Darsni qoldirish").
 * Loaded once per request; billing, teacher pay and the course plan use it the way they use holidays.
 */
export const closedDaysOf = cache(async (): Promise<(groupId: number) => string[]> => {
  const [holidays, cancels] = await Promise.all([
    holidayDays(),
    db.lessonChange.findMany({ where: { kind: "CANCEL" }, select: { groupId: true, date: true } }),
  ]);
  const byGroup = new Map<number, Date[]>();
  for (const c of cancels) byGroup.set(c.groupId, [...(byGroup.get(c.groupId) ?? []), c.date]);
  const cached = new Map<number, string[]>();
  return (groupId) => {
    if (!cached.has(groupId)) cached.set(groupId, closedDays(holidays, byGroup.get(groupId) ?? []));
    return cached.get(groupId)!;
  };
});
