import { weekdaysOf } from "./group-days";

// A group's lesson schedule over time. `Group.days / time / endTime` hold the newest schedule (it may start in the
// future); GroupSchedule rows say from which day each schedule applied. A group never changed has no rows and uses
// its own fields throughout. Every lesson-date calculation goes through here, so a change from a date never rewrites
// the lessons, charges and salaries before it.

export type ScheduleRow = { from: Date; days: string; time: string; endTime: string | null };
export type Schedule = { days: string; time: string; endTime: string | null };
/** `schedules` is required on purpose: a query that forgot to load them is a type error, not a silent fallback. */
export type Scheduled = Schedule & { schedules: ScheduleRow[] };
/** What lesson dates need: the days and when they changed (billing, curriculum, the grid). */
export type DaysScheduled = { days: string; schedules: { from: Date; days: string }[] };

/** The row in force on `day`: the latest one from on or before it, else the oldest; null only with no rows. */
export function rowOn<R extends { from: Date }>(rows: R[], day: Date): R | null {
  let best: R | null = null;
  let first: R | null = null;
  for (const r of rows) {
    if (r.from.getTime() <= day.getTime() && (!best || r.from > best.from)) best = r;
    if (!first || r.from < first.from) first = r;
  }
  // before the first change (only days before the group's start): the oldest schedule — the group's own fields are
  // the newest one and must never reach back
  return best ?? first;
}

const own = (g: Schedule): Schedule => ({ days: g.days, time: g.time, endTime: g.endTime });
const pick = (r: ScheduleRow): Schedule => ({ days: r.days, time: r.time, endTime: r.endTime });

/** The schedule that applied on `day`: the latest row from on or before it, else the group's own fields. */
export function scheduleOn(g: Scheduled, day: Date): Schedule {
  const best = rowOn(g.schedules, day);
  return best ? pick(best) : own(g);
}

/** The lesson days in force on `day`. */
export const daysOn = (g: DaysScheduled, day: Date) => rowOn(g.schedules, day)?.days ?? g.days;

/** Whether the group had (or will have) a lesson on `day` by its schedule (holidays and cancels aside). */
export const isLessonDay = (g: DaysScheduled, day: Date) => weekdaysOf(daysOn(g, day)).includes(day.getUTCDay());

/** The group's lesson dates in a month (0-based), each day judged by the schedule of that day. */
export function lessonDatesOf(g: DaysScheduled, year: number, month: number): Date[] {
  const out: Date[] = [];
  for (const d = new Date(Date.UTC(year, month, 1)); d.getUTCMonth() === month; d.setUTCDate(d.getUTCDate() + 1)) {
    if (isLessonDay(g, d)) out.push(new Date(d));
  }
  return out;
}

/** Lesson dates of a month without the closed days (ISO): the lessons that actually happen. */
export function heldLessonsOf(g: DaysScheduled, year: number, month: number, closed: string[]): Date[] {
  const off = new Set(closed);
  return lessonDatesOf(g, year, month).filter((d) => !off.has(d.toISOString().slice(0, 10)));
}

/** The schedule in force on `day` followed by every later one (for clash checks of what is still to come). */
export function schedulesFrom(g: Scheduled, day: Date): Schedule[] {
  const later = g.schedules.filter((r) => r.from.getTime() > day.getTime()).sort((a, b) => a.from.getTime() - b.from.getTime());
  return [scheduleOn(g, day), ...later.map(pick)];
}

const DAY = 86_400_000;
const ddmmyyyy = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;

/**
 * Why a schedule change can't start on `from` (null when fine): not before the 1st of the current month (earlier
 * salaries may be paid), the group's start or its latest change (a change on that same day replaces it), and at most
 * 60 days ahead. `today` is the centre's date (UTC midnight).
 */
export function scheduleChangeProblem(p: { from: Date; today: Date; startDate: Date; rows: ScheduleRow[] }): string | null {
  const earliest = new Date(Date.UTC(p.today.getUTCFullYear(), p.today.getUTCMonth(), 1));
  if (p.from < earliest) return `Jadvalni o'tgan oylardan boshlab o'zgartirib bo'lmaydi — eng erta sana: ${ddmmyyyy(earliest)}`;
  if (p.from.getTime() > p.today.getTime() + 60 * DAY) return "Ko'pi bilan 60 kun oldinga";
  const start = new Date(Date.UTC(p.startDate.getUTCFullYear(), p.startDate.getUTCMonth(), p.startDate.getUTCDate()));
  if (p.from < start) return "Sana guruh boshlanishidan oldin bo'lishi mumkin emas";
  const latest = p.rows.reduce<Date | null>((m, r) => (!m || r.from > m ? r.from : m), null);
  if (latest && p.from < latest) return `Sana oldingi jadval o'zgarishidan (${ddmmyyyy(latest)}) oldin bo'lishi mumkin emas`;
  return null;
}

/** Marked days (ISO) from `from` on that the new `days` no longer has as lessons; make-up days are kept. Sorted. */
export function removedLessonDays(p: { marked: string[]; from: Date; days: string; makeups: string[] }): string[] {
  const weekdays = weekdaysOf(p.days);
  const fromIso = p.from.toISOString().slice(0, 10);
  const extra = new Set(p.makeups);
  return [...new Set(p.marked)]
    .filter((day) => day >= fromIso && !extra.has(day) && !weekdays.includes(new Date(day + "T00:00:00Z").getUTCDay()))
    .sort();
}

/**
 * Rows to upsert (by group + from) for a change: the first change also records the schedule the group had until
 * then, from its start date, so earlier lessons keep it; a later change adds only the new row.
 */
export function scheduleRowsToWrite(p: { before: ScheduleRow; startDate: Date; rows: ScheduleRow[]; next: ScheduleRow }): ScheduleRow[] {
  if (p.rows.length) return [p.next];
  const start = new Date(Date.UTC(p.startDate.getUTCFullYear(), p.startDate.getUTCMonth(), p.startDate.getUTCDate()));
  return [{ ...p.before, from: start }, p.next];
}

/** The refusal for marks on days a new schedule drops: up to five dates (DD.MM), then "…". */
export function marksMessage(dates: string[]): string {
  const shown = dates.slice(0, 5).map((d) => `${d.slice(8, 10)}.${d.slice(5, 7)}`).join(", ");
  return `Bu sanalarda davomat bor: ${shown}${dates.length > 5 ? " …" : ""} — avval ularni tozalang`;
}
