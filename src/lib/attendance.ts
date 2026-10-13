import { lessonWeekdays } from "./format";
import { centreToday, toMinutes } from "./schedule";

// Attendance marks: keldi (present), kechikdi (present, late), kelmadi (absent). Late counts as present.

export type Mark = { present: boolean; late: boolean };

/** A plain keldi / kelmadi (the AI tools): never late, so an earlier "kechikdi" doesn't linger. */
export const plainMark = (present: boolean): Mark => ({ present, late: false });

export const MARK_KEYS = ["present", "late", "absent"] as const;
export type MarkKey = (typeof MARK_KEYS)[number];

/** What a chosen mark writes: keldi / kechikdi drop an absence reason; kelmadi keeps one already given. */
export function markWrite(key: MarkKey): Mark & { reasonId?: null } {
  if (key === "absent") return { present: false, late: false };
  return { present: true, late: key === "late", reasonId: null };
}

/** Share of marked lessons attended (late included); null when nothing is marked. */
export function attendancePercent(marks: Mark[]) {
  return marks.length ? Math.round((marks.filter((m) => m.present).length / marks.length) * 100) : null;
}

/** "Hammasi keldi": the students not marked yet — an absence or a late mark already given is kept. */
export const fillPresent = (studentIds: number[], existing: Map<number, Mark>) => studentIds.filter((id) => !existing.has(id));

/**
 * Active groups whose lesson today has started (centre time), today isn't a holiday, and nobody is marked yet:
 * "davomat qilinmagan".
 */
export function unmarkedToday(
  groups: { id: number; days: string; time: string; status: string; startDate?: Date; members?: number }[],
  marked: Set<number>,
  now: Date,
  holidays: string[],
) {
  const t = centreToday(now);
  const today = `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
  if (holidays.includes(today)) return [];
  const minutes = t.hour * 60 + t.minute;
  return groups
    // a group that hasn't started yet, or has nobody to mark, can't be "not marked"
    .filter((g) => !g.startDate || g.startDate.getTime() <= Date.UTC(t.year, t.month - 1, t.day, 23, 59))
    .filter((g) => g.members === undefined || g.members > 0)
    .filter((g) => g.status === "ACTIVE" && lessonWeekdays(g.days).includes(t.weekday) && toMinutes(g.time) <= minutes && !marked.has(g.id))
    .map((g) => g.id);
}
