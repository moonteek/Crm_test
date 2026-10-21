import { lessonWeekdays } from "./format";
import { centreToday, fromMinutes, toMinutes } from "./schedule";

// One group's lesson on one day can be cancelled ("Darsni qoldirish": a closed day for that group, like a holiday)
// or taught by a substitute ("O'qituvchini almashtirish": that lesson's pay goes to them).

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function lessonChangeProblem(
  input: {
    kind: "CANCEL" | "SUBSTITUTE";
    date: Date;
    days: string;
    holidays: string[];
    existing: { kind: string; date: Date }[];
    substituteId?: number | null;
    /** who had this lesson in the replaced role on that day (teacher history) */
    absentId?: number | null;
    /** everyone who had this lesson that day (teacher and assistant) */
    onLesson?: (number | null)[];
  },
  today: Date,
): string | null {
  if (!lessonWeekdays(input.days).includes(input.date.getUTCDay())) return "Bu kunda dars yo'q";
  if (input.holidays.includes(iso(input.date))) return "Bayram kuni — dars yo'q";
  if (!lessonChangeOpen(input.date, today)) return "Faqat shu oydan boshlab";
  const same = input.existing.filter((e) => iso(e.date) === iso(input.date));
  if (same.some((e) => e.kind === "CANCEL")) return "Bu dars allaqachon bekor qilingan";
  if (input.kind === "CANCEL" && same.some((e) => e.kind === "SUBSTITUTE")) return "Bu darsga o'rinbosar biriktirilgan — avval uni bekor qiling";
  if (input.kind === "SUBSTITUTE") {
    if (!input.substituteId) return "O'rinbosarni tanlang";
    if (input.substituteId === input.absentId) return "O'zini o'zi almashtira olmaydi";
    if (input.onLesson?.includes(input.substituteId)) return "Bu darsda u allaqachon bor (guruhning o'qituvchisi)";
  }
  return null;
}

/** Cancel / substitute (and their undo) only for lessons from this month on, centre time. */
export function lessonChangeOpen(date: Date, today: Date) {
  const t = centreToday(today);
  return date.getTime() >= Date.UTC(t.year, t.month - 1, 1);
}

/** The days a group has no lesson: the centre's holidays and its own cancelled lessons (ISO, each once). */
export const closedDays = (holidays: string[], cancelled: Date[]) => [...new Set([...holidays, ...cancelled.map(iso)])];

/** Who taught `role` on `day`: a substitute for that day and role, else the regular person. */
export function whoTaught(day: Date, role: string, regular: number | null, subs: { date: Date; role: string | null; substituteId: number | null }[]) {
  const sub = subs.find((s) => s.role === role && iso(s.date) === iso(day));
  return sub ? sub.substituteId : regular;
}

/** Attendance and grades go only on lessons that already happened: today or earlier. */
export function markProblem(date: Date, today: Date): string | null {
  return date.getTime() > today.getTime() ? "Hali bo'lmagan darsni belgilab bo'lmaydi" : null;
}

// ---------- make-ups, charged cancels, cover access ----------
// A cancel may move the lesson to a make-up day (money as if held on the original day) or keep it charged
// (`charged`, the toggle OFF). A plain cancel is like a holiday for money.

export type CancelRow = {
  groupId: number; date: Date; charged: boolean;
  makeupDate: Date | null; makeupTime: string | null; makeupRoomId: number | null; makeupTeacherId: number | null;
};

/** Days nobody is charged or paid for: holidays and plain cancels (not charged, not moved). */
export function unchargedDays(holidays: string[], cancels: Pick<CancelRow, "date" | "charged" | "makeupDate">[]) {
  return [...new Set([...holidays, ...cancels.filter((c) => !c.charged && !c.makeupDate).map((c) => iso(c.date))])];
}

/** The extra lesson days a group's cancels were moved to. */
export const makeupDays = (cancels: Pick<CancelRow, "makeupDate">[]) => cancels.flatMap((c) => (c.makeupDate ? [iso(c.makeupDate)] : []));

const DAY = 86_400_000;

/** Where a moved lesson may go: today … 60 days ahead, not a holiday, not a day without lessons, not a usual lesson day. */
export function makeupProblem(p: { date: Date; original: Date; today: Date; days: string; holidays: string[]; noLesson: string[]; taken?: string[] }): string | null {
  const today = Date.UTC(p.today.getUTCFullYear(), p.today.getUTCMonth(), p.today.getUTCDate());
  if (p.date.getTime() < today || p.date.getTime() > today + 60 * DAY) return "Sana bugundan 60 kungacha bo'lishi kerak";
  if (p.holidays.includes(iso(p.date))) return "Bayram kuni";
  if (p.noLesson.includes(iso(p.date)) || iso(p.date) === iso(p.original)) return "Bu kun ham bekor qilingan";
  if (lessonWeekdays(p.days).includes(p.date.getUTCDay())) return "Guruhning shu kuni darsi bor";
  // the group's other moved lessons already use that day
  if (p.taken?.includes(iso(p.date))) return "Bu kunga boshqa dars ko'chirilgan";
  return null;
}

/** Who or what is busy at a make-up's time on that date: the teacher (as teacher or assistant) and the room. */
export function clashesOn(
  c: { start: string; minutes: number; teacherId: number | null; roomId: number | null },
  others: { name: string; start: string; minutes: number; teacherId: number | null; assistantId: number | null; roomId: number | null }[],
): string[] {
  const from = toMinutes(c.start);
  const to = from + c.minutes;
  const out: string[] = [];
  for (const o of others) {
    const a = toMinutes(o.start);
    const b = a + o.minutes;
    if (!(a < to && from < b)) continue;
    const when = `${o.name} ${fromMinutes(a)}–${fromMinutes(b)}`;
    if (c.teacherId !== null && (o.teacherId === c.teacherId || o.assistantId === c.teacherId)) out.push(`O'qituvchi band: ${when}`);
    if (c.roomId !== null && o.roomId === c.roomId) out.push(`Xona band: ${when}`);
  }
  return out;
}

/** A moved lesson taught by someone other than the group's teacher pays them like a substitute for the original day. */
export function makeupSubstitutes(cancels: CancelRow[], teacherOn: (groupId: number, day: Date) => number | null) {
  return cancels.flatMap((c) =>
    c.makeupDate && c.makeupTeacherId !== null && c.makeupTeacherId !== teacherOn(c.groupId, c.date)
      ? [{ groupId: c.groupId, date: c.date, role: "TEACHER" as const, substituteId: c.makeupTeacherId }]
      : [],
  );
}

/** A substitute or make-up teacher may mark and grade that group's lesson on that day — and only on the day itself. */
export function coverAllowed(p: {
  userId: number; groupId: number; day: string; today: string;
  subs: { groupId: number; date: Date; substituteId: number | null }[];
  makeups: CancelRow[];
}): boolean {
  if (p.day !== p.today) return false;
  return (
    p.subs.some((s) => s.groupId === p.groupId && s.substituteId === p.userId && iso(s.date) === p.day)
    || p.makeups.some((m) => m.groupId === p.groupId && m.makeupTeacherId === p.userId && m.makeupDate !== null && iso(m.makeupDate) === p.day)
  );
}

/** A make-up that already has marks or grades stays: undo or move would lose them. */
export function makeupLocked(marks: number, grades: number): string | null {
  return marks > 0 || grades > 0 ? "Qo'shimcha darsda davomat bor — avval uni o'chiring" : null;
}

/** Whether a group has a lesson on `day` (ISO): a make-up day, or a usual lesson day that isn't a holiday or cancelled. */
export function lessonOpenOn(day: string, s: { noLesson: string[]; extra: string[]; weekdayLesson: boolean }) {
  return s.extra.includes(day) || (s.weekdayLesson && !s.noLesson.includes(day));
}

const PAST_MONTH = "O'tgan oy darsi: faqat kuni, vaqti va xonasini o'zgartirish mumkin";

/**
 * Changing a moved lesson. Its money sits on the original day, so once that month is over only the make-up's day,
 * time and room may change (same teacher — no money effect); cancelling the make-up or undoing the cancel would
 * change a closed month.
 */
export function makeupEditProblem(op: "move" | "cancel" | "restore", original: Date, today: Date, teacherChanged: boolean): string | null {
  if (lessonChangeOpen(original, today)) return null;
  return op === "move" && !teacherChanged ? null : PAST_MONTH;
}

/**
 * Who must hear that a make-up is off. Undo / cancel (`moved` false): the group's people and the make-up teacher.
 * A move to another teacher (`moved` true): only the replaced make-up teacher, unless they are one of the group's
 * people (who get the new "ko'chirildi" message anyway).
 */
export function makeupOffRecipients(people: number[], oldTeacher: number | null, newTeacher: number | null, moved = false): number[] {
  if (!moved) return [...new Set([...people, ...(oldTeacher !== null ? [oldTeacher] : [])])];
  return oldTeacher !== null && oldTeacher !== newTeacher && !people.includes(oldTeacher) ? [oldTeacher] : [];
}
