import type { EventType } from "./membership";
import { eventsFromLegacy } from "./membership-legacy";
import { priceAt, type PriceRow } from "./prices";
import { lessonDatesOf, type DaysScheduled } from "./group-schedule";

/**
 * What a student is charged for being in a group, worked out by replaying the membership's events.
 *
 * - Before PER_LESSON_FROM (the old rule): the full price for every calendar month that overlaps a period
 *   between ACTIVATE and LEAVE. Trial time before the first activation is free; freezes are ignored. This only
 *   applies to months whose history was migrated from before statuses existed: a month in which staff did
 *   anything in the new screens (an event with migrated: false) is charged per lesson like later months.
 * - Per lesson: price × (lessons the student was active for) ÷ (lessons in that month), rounded
 *   once per month. Start and end days are both charged: activating, freezing or leaving on a lesson day
 *   includes that lesson.
 *
 * Months are charged up to and including the month of `now` (the current month in full, as before).
 * Balance = payments − charges.
 */
export const PER_LESSON_FROM = new Date(Date.UTC(2026, 10, 1));

export type BillableMembership = {
  groupId: number;
  /** migrated: true for history copied from before statuses existed; absent counts as migrated */
  events: { type: EventType | string; date: Date; migrated?: boolean }[];
  /** price: the group's own monthly price; when empty the course price applies */
  /** schedules: the group's schedule changes (src/lib/group-schedule.ts) — each lesson day follows the schedule of that day */
  group: { name: string; price?: number | null; course: { price: number }; prices?: PriceRow[] } & DaysScheduled;
  /** used only when the membership has no events yet (database not migrated) */
  joinedAt?: Date;
  leftAt?: Date | null;
  /** so'm off each month of [from, to] (UTC 1sts, inclusive); lowers the charge, never lessonValues */
  discounts?: { from: Date; to: Date; amount: number }[];
  /** the centre's holidays (ISO days): never billable, never taught. Required, so no caller can forget them. */
  holidays: string[];
};

export type ChargeLine = { year: number; month: number; lessons: number; billable: number; amount: number; legacy: boolean; discount: number };

type Ev = { type: EventType; date: Date; migrated?: boolean };

/** The group's current price setting (own price, else the course price) — history aside. */
export const groupPrice = (g: { price?: number | null; course: { price: number } }) => g.price ?? g.course.price;

/** The price the group charges in the month of `now`, history included. */
export const priceNow = (g: { price?: number | null; course: { price: number }; prices?: PriceRow[] }, now = new Date()) =>
  priceAt(g.prices ?? [], groupPrice(g), now.getUTCFullYear(), now.getUTCMonth());

const time = (d: Date) => d.getTime();
const monthKey = (y: number, m: number) => y * 12 + m;
const startsActive = (t: EventType) => t === "ACTIVATE" || t === "UNFREEZE";
const PER_LESSON_KEY = monthKey(PER_LESSON_FROM.getUTCFullYear(), PER_LESSON_FROM.getUTCMonth());

function sorted(m: BillableMembership): Ev[] {
  // never bill a membership as "nothing" just because its history hasn't been migrated yet
  const events = !m.events.length && m.joinedAt ? eventsFromLegacy(m.joinedAt, m.leftAt ?? null) : m.events;
  // events are stored in order; a stable sort by date keeps same-day events in that order
  return [...events].map((e) => ({ type: e.type as EventType, date: e.date, migrated: (e as Ev).migrated })).sort((a, b) => time(a.date) - time(b.date));
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

/** Gives loaded memberships the centre's holidays (from holidayDays()), which every charge needs. */
export const withHolidays = <T extends { groupId: number }>(memberships: T[], holidays: string[] | ((groupId: number) => string[])) =>
  memberships.map((m) => ({ ...m, holidays: typeof holidays === "function" ? holidays(m.groupId) : holidays }));

/** The discount (so'm off the monthly price) for one month; discounts of a membership never overlap. */
export function discountIn(discounts: { from: Date; to: Date; amount: number }[] | undefined, y: number, mo: number) {
  const key = monthKey(y, mo);
  return (discounts ?? [])
    .filter((x) => monthKey(x.from.getUTCFullYear(), x.from.getUTCMonth()) <= key && key <= monthKey(x.to.getUTCFullYear(), x.to.getUTCMonth()))
    .reduce((sum, x) => sum + x.amount, 0);
}

/** The month as charged: `full` is the undiscounted amount that teacher pay is built on. */
function lineFor(m: BillableMembership, events: Ev[], y: number, mo: number): ChargeLine & { days: Date[]; full: number } {
  const price = priceAt(m.group.prices ?? [], groupPrice(m.group), y, mo);
  const lessons = lessonDatesOf(m.group, y, mo);
  const first = Date.UTC(y, mo, 1);
  const next = Date.UTC(y, mo + 1, 1);
  const touchedInApp = events.some((e) => e.migrated === false && time(e.date) >= first && time(e.date) < next);
  if (monthKey(y, mo) < PER_LESSON_KEY && !touchedInApp) {
    const on = enrolledDuringMonth(events, y, mo);
    // legacy months are never discounted (discounts start in the per-lesson era)
    return { year: y, month: mo, lessons: lessons.length, billable: on ? lessons.length : 0, amount: on ? price : 0, legacy: true, days: on ? lessons : [], full: on ? price : 0, discount: 0 };
  }
  // a holiday stays in the month's lesson count (the price is per scheduled lesson) but is never charged or taught
  // (per-lesson months only: an in-app October still follows the old rules for holidays and teacher pay)
  const off = new Set(monthKey(y, mo) >= PER_LESSON_KEY ? m.holidays : []);
  const days = lessons.filter((day) => billableOn(events, day) && !off.has(day.toISOString().slice(0, 10)));
  const share = (monthly: number) => (lessons.length ? Math.round((Math.max(0, monthly) * days.length) / lessons.length) : 0);
  const full = share(price);
  const amount = share(price - discountIn(m.discounts, y, mo));
  return { year: y, month: mo, lessons: lessons.length, billable: days.length, amount, legacy: false, days, full, discount: full - amount };
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
    .map(({ days: _days, full: _full, ...line }) => line);
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

/**
 * The lessons charged in one month (0-based) with what each is worth; the values add up exactly to the month's
 * charge (whole so'm, any remainder going to the earliest lessons). Teacher pay is built on these.
 */
export function lessonValues(m: BillableMembership, year: number, month: number, now = new Date()): { day: Date; value: number }[] {
  const nowKey = monthKey(now.getUTCFullYear(), now.getUTCMonth());
  if (monthKey(year, month) > nowKey) return [];
  const events = sorted(m);
  if (!events.length) return [];
  // the undiscounted amount: a discount lowers what the student pays, never the teacher's share
  const { days, full: amount } = lineFor(m, events, year, month);
  if (!days.length) return [];
  const base = Math.floor(amount / days.length);
  const extra = amount - base * days.length;
  return days.map((day, i) => ({ day, value: base + (i < extra ? 1 : 0) }));
}

/** How many of these memberships were charged at least one lesson in the month — per-student salaries use it. */
export function billedStudentCount(memberships: BillableMembership[], year: number, month: number, now = new Date()) {
  return memberships.filter((m) => billableLessonsIn(m, year, month, now) > 0).length;
}

/** How much the student's total charges (up to `now`) would change if `extra` were added: + owes more, − owes less. */
export function chargeChangeIf(m: BillableMembership, extra: { type: EventType; date: Date }, now = new Date()) {
  const withExtra = { ...m, events: [...sorted(m), { ...extra, migrated: false }] };
  return totalCharges([withExtra], now) - totalCharges([m], now);
}

/** What the month of `extra.date` would cost if `extra` were added, with the first and last charged lesson. */
export function previewCharge(m: BillableMembership, extra: { type: EventType; date: Date }) {
  const events = [...sorted(m), { type: extra.type, date: extra.date, migrated: false }];
  const y = extra.date.getUTCFullYear();
  const mo = extra.date.getUTCMonth();
  const { days, full: _full, ...line } = lineFor(m, events, y, mo);
  return { ...line, from: days[0] ?? null, to: days.at(-1) ?? null };
}
