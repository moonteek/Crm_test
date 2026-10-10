import { lessonDates } from "./format";
import type { EventType } from "./membership";

/**
 * What a student is charged for being in a group, worked out by replaying the membership's events.
 *
 * - Before PER_LESSON_FROM (the old rule): the full course price for every calendar month that overlaps a
 *   period between ACTIVATE and LEAVE. Trial time before the first activation is free; freezes are ignored.
 * - From PER_LESSON_FROM: price × (lessons the student was active for) ÷ (lessons in that month), rounded
 *   once per month. Start and end days are both charged: activating, freezing or leaving on a lesson day
 *   includes that lesson.
 *
 * Months are charged up to and including the month of `now` (the current month in full, as before).
 * Balance = payments − charges.
 */
export const PER_LESSON_FROM = new Date(Date.UTC(2026, 10, 1));

export type BillableMembership = {
  groupId: number;
  events: { type: EventType | string; date: Date }[];
  group: { name: string; days: string; course: { price: number } };
};

export type ChargeLine = { year: number; month: number; lessons: number; billable: number; amount: number; legacy: boolean };

type Ev = { type: EventType; date: Date };

const time = (d: Date) => d.getTime();
const monthKey = (y: number, m: number) => y * 12 + m;
const startsActive = (t: EventType) => t === "ACTIVATE" || t === "UNFREEZE";
const PER_LESSON_KEY = monthKey(PER_LESSON_FROM.getUTCFullYear(), PER_LESSON_FROM.getUTCMonth());

function sorted(m: BillableMembership): Ev[] {
  // events are stored in order; a stable sort by date keeps same-day events in that order
  return [...m.events].map((e) => ({ type: e.type as EventType, date: e.date })).sort((a, b) => time(a.date) - time(b.date));
}

/**
 * Per-lesson rule: a lesson is charged if the student started that day active (so freezing or leaving on
 * the day still pays for it) or became active that day.
 */
function billableOn(events: Ev[], day: Date) {
  let activeBefore = false;
  for (const e of events) {
    if (time(e.date) < time(day)) activeBefore = startsActive(e.type);
    else if (time(e.date) === time(day) && startsActive(e.type)) return true;
  }
  return activeBefore;
}

/** Old rule: in the group (activated, not left) at any point of the month. Freezes don't matter. */
function enrolledDuringMonth(events: Ev[], y: number, m: number) {
  const first = Date.UTC(y, m, 1);
  const next = Date.UTC(y, m + 1, 1);
  let enrolled = false;
  for (const e of events) {
    const t = time(e.date);
    if (t >= next) break;
    if (e.type === "ACTIVATE") enrolled = true;
    else if (e.type === "LEAVE") {
      if (enrolled && t >= first) return true; // left during this month
      enrolled = false;
    }
    if (enrolled && t >= first) return true;
  }
  return enrolled;
}

function lineFor(m: BillableMembership, events: Ev[], y: number, mo: number): ChargeLine & { days: Date[] } {
  const price = m.group.course.price;
  const lessons = lessonDates(m.group.days, y, mo);
  if (monthKey(y, mo) < PER_LESSON_KEY) {
    const on = enrolledDuringMonth(events, y, mo);
    return { year: y, month: mo, lessons: lessons.length, billable: on ? lessons.length : 0, amount: on ? price : 0, legacy: true, days: on ? lessons : [] };
  }
  const days = lessons.filter((day) => billableOn(events, day));
  const amount = lessons.length ? Math.round((price * days.length) / lessons.length) : 0;
  return { year: y, month: mo, lessons: lessons.length, billable: days.length, amount, legacy: false, days };
}

function months(events: Ev[], now: Date) {
  const out: [number, number][] = [];
  if (!events.length) return out;
  let y = events[0].date.getUTCFullYear();
  let mo = events[0].date.getUTCMonth();
  const end = monthKey(now.getUTCFullYear(), now.getUTCMonth());
  while (monthKey(y, mo) <= end) {
    out.push([y, mo]);
    if (++mo === 12) { mo = 0; y++; }
  }
  return out;
}

/** Month-by-month charges for one membership, oldest first; months with nothing to charge are left out. */
export function chargeLines(m: BillableMembership, now = new Date()): ChargeLine[] {
  const events = sorted(m);
  return months(events, now)
    .map(([y, mo]) => lineFor(m, events, y, mo))
    .filter((l) => l.amount > 0 || l.billable > 0)
    .map(({ days: _days, ...line }) => line);
}

export function totalCharges(memberships: BillableMembership[], now = new Date()) {
  return memberships.reduce((sum, m) => sum + chargeLines(m, now).reduce((s, l) => s + l.amount, 0), 0);
}

export function balance(memberships: BillableMembership[], payments: { amount: number }[], now = new Date()) {
  return payments.reduce((s, p) => s + p.amount, 0) - totalCharges(memberships, now);
}

/** Lessons charged to this membership in one month (0-based month). */
export function billableLessonsIn(m: BillableMembership, year: number, month: number, now = new Date()) {
  return chargeLines(m, now).find((l) => l.year === year && l.month === month)?.billable ?? 0;
}

/** What the month of `extra.date` would cost if `extra` were added, with the first and last charged lesson. */
export function previewCharge(m: BillableMembership, extra: { type: EventType; date: Date }) {
  const events = [...sorted(m), { type: extra.type, date: extra.date }];
  const y = extra.date.getUTCFullYear();
  const mo = extra.date.getUTCMonth();
  const { days, legacy: _legacy, ...line } = lineFor(m, events, y, mo);
  return { ...line, from: days[0] ?? null, to: days.at(-1) ?? null };
}
