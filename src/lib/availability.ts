import { GROUP_DAYS, lessonWeekdays } from "./format";
import { centreWeekday, fromMinutes, toMinutes } from "./schedule";

// Teachers' weekly hours, 08:00–20:00 in 1-hour cells, on odd (Du/Chor/Ju) and even (Se/Pay/Sha) days.
// Lessons are never stored here — they come from the active groups every time.

export type DayType = "ODD" | "EVEN";
export const DAY_TYPES: DayType[] = ["ODD", "EVEN"];
export const DAY_TYPE_LABEL: Record<DayType, string> = { ODD: "Toq kunlar (Du/Chor/Ju)", EVEN: "Juft kunlar (Se/Pay/Sha)" };
/** Fits a phone-width switch. */
export const DAY_TYPE_SHORT: Record<DayType, string> = { ODD: "Du / Chor / Ju", EVEN: "Se / Pay / Sha" };
export const DAY_START = 8;
export const DAY_END = 20;
/** Cell hours: 8 = 08:00–09:00 … 19 = 19:00–20:00. */
export const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

export type LessonLike = {
  id?: number; name: string; days: string; time: string; minutes: number;
  teacherId: number | null; assistantId: number | null; roomId: number | null;
};
export type Clash = { kind: "teacher" | "room"; who: string; group: LessonLike };
export type Cell = { state: "lesson"; group: string } | { state: "free" } | { state: "busy" } | { state: "unset" };
type Slot = { dayType: string; hour: number; free: boolean };

/** Today's day type: Tue/Thu/Sat are even days; Mon/Wed/Fri and Sunday show odd days. */
export const todayDayType = (d = new Date()): DayType => ([2, 4, 6].includes(centreWeekday(d)) ? "EVEN" : "ODD");

export const dayTypesOf = (days: string): DayType[] => (days === "ODD" ? ["ODD"] : days === "EVEN" ? ["EVEN"] : ["ODD", "EVEN"]);

/** Hours whose cell the lesson touches (14:30 + 90 min → 14 and 15). */
export function lessonCells(time: string, minutes: number) {
  const start = toMinutes(time);
  const out: number[] = [];
  for (let h = Math.floor(start / 60); h * 60 < start + minutes; h++) out.push(h);
  return out;
}

export const fitsDay = (time: string, minutes: number) => toMinutes(time) >= DAY_START * 60 && toMinutes(time) + minutes <= DAY_END * 60;

function overlaps(a: LessonLike, b: LessonLike) {
  const days = lessonWeekdays(b.days);
  if (!lessonWeekdays(a.days).some((d) => days.includes(d))) return false;
  const [as, bs] = [toMinutes(a.time), toMinutes(b.time)];
  return as < bs + b.minutes && bs < as + a.minutes;
}

const people = (l: LessonLike) => [l.teacherId, l.assistantId].filter((x): x is number => x !== null);

/** Other groups' lessons the candidate collides with: a shared teacher/assistant (either role) or room. */
export function groupClashes(candidate: LessonLike, others: LessonLike[], names: { users: Map<number, string>; rooms: Map<number, string> }): Clash[] {
  const out: Clash[] = [];
  for (const o of others) {
    if (candidate.id !== undefined && o.id === candidate.id) continue;
    if (!overlaps(candidate, o)) continue;
    for (const p of people(candidate)) if (people(o).includes(p)) out.push({ kind: "teacher", who: names.users.get(p) ?? "O'qituvchi", group: o });
    if (candidate.roomId !== null && candidate.roomId === o.roomId) out.push({ kind: "room", who: names.rooms.get(candidate.roomId) ?? "Xona", group: o });
  }
  return out;
}

export function clashMessage(c: Clash) {
  const g = c.group;
  const when = `${GROUP_DAYS[g.days] ?? g.days} ${g.time}–${fromMinutes(toMinutes(g.time) + g.minutes)}`;
  return c.kind === "teacher" ? `${c.who} ${when} da ${g.name} guruhida dars beradi` : `${c.who} ${when} da ${g.name} guruhi bilan band`;
}

/** A teacher's week: lessons (as teacher or assistant) first, then their own marks, else unset. */
export function teacherGrid(userId: number, lessons: LessonLike[], slots: Slot[]): Record<DayType, Map<number, Cell>> {
  const grid = { ODD: new Map<number, Cell>(), EVEN: new Map<number, Cell>() };
  for (const t of DAY_TYPES) for (const h of HOURS) {
    const s = slots.find((x) => x.dayType === t && x.hour === h);
    grid[t].set(h, s ? { state: s.free ? "free" : "busy" } : { state: "unset" });
  }
  for (const l of lessons) {
    if (!people(l).includes(userId)) continue;
    for (const t of dayTypesOf(l.days)) for (const h of lessonCells(l.time, l.minutes)) if (grid[t].has(h)) grid[t].set(h, { state: "lesson", group: l.name });
  }
  return grid;
}

/** Hours of the candidate's lesson that its teacher/assistant marked as busy (a warning, not a refusal). */
export function busyMarkWarnings(candidate: LessonLike, slots: (Slot & { userId: number })[]) {
  const types = dayTypesOf(candidate.days);
  const cells = lessonCells(candidate.time, candidate.minutes);
  return people(candidate).flatMap((userId) => {
    const hours = [...new Set(slots.filter((s) => s.userId === userId && !s.free && types.includes(s.dayType as DayType) && cells.includes(s.hour)).map((s) => s.hour))].sort((a, b) => a - b);
    return hours.length ? [{ userId, hours }] : [];
  });
}

type When = { days: string; time: string; teacherId: number | null; assistantId: number | null; roomId: number | null; courseId: number };
/** An edit is clash-checked only if it changes when, who, where or how long (course) the lesson is. */
export const needsClashCheck = (before: When, after: When) =>
  (["days", "time", "teacherId", "assistantId", "roomId", "courseId"] as const).some((k) => before[k] !== after[k]);
