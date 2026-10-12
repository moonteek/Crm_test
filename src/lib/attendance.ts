import { lessonWeekdays } from "./format";
import { centreToday, toMinutes } from "./schedule";

// Attendance marks: keldi (present), kechikdi (present, late), kelmadi (absent). Late counts as present.

export type Mark = { present: boolean; late: boolean };

/** One tap on a grid cell: empty → keldi → kechikdi → kelmadi → empty. */
export function nextMark(current: Mark | null): Mark | null {
  if (!current) return { present: true, late: false };
  if (current.present && !current.late) return { present: true, late: true };
  if (current.present) return { present: false, late: false };
  return null;
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
export function unmarkedToday(groups: { id: number; days: string; time: string; status: string }[], marked: Set<number>, now: Date, holidays: string[]) {
  const t = centreToday(now);
  const today = `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
  if (holidays.includes(today)) return [];
  const minutes = t.hour * 60 + t.minute;
  return groups
    .filter((g) => g.status === "ACTIVE" && lessonWeekdays(g.days).includes(t.weekday) && toMinutes(g.time) <= minutes && !marked.has(g.id))
    .map((g) => g.id);
}
