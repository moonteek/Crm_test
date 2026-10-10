import { lessonValues, type BillableMembership } from "./billing";
import { lessonDates } from "./format";
import { teacherOn, type TeacherRow } from "./teachers-history";

export type PayMembership = BillableMembership & {
  student: { id: number; name: string };
  group: BillableMembership["group"] & { id: number; teacherId: number | null; assistantId: number | null; teachers?: TeacherRow[] };
};

export type EarningRow = {
  studentId: number;
  studentName: string;
  groupId: number;
  groupName: string;
  /** lessons this teacher taught the student this month */
  lessons: number;
  /** all lessons of the group that month */
  lessonsInMonth: number;
  /** what the student was charged for those lessons */
  value: number;
  /** the teacher's (unrounded) share */
  share: number;
};

/**
 * What one teacher earns in a month (0-based), lesson by lesson: a lesson counts for whoever taught that group that
 * day (as teacher or assistant). PERCENT: amount% of the lessons' charged value. PER_STUDENT: amount × the share of
 * the month's lessons the student spent with this teacher. Rounded once, on the total.
 */
export function teacherEarnings(
  teacherId: number,
  salary: { type: "PERCENT" | "PER_STUDENT"; amount: number },
  memberships: PayMembership[],
  year: number,
  month: number,
  now = new Date(),
): { rows: EarningRow[]; total: number } {
  const rows: EarningRow[] = [];
  for (const m of memberships) {
    const history = m.group.teachers ?? [];
    const current = { teacherId: m.group.teacherId, assistantId: m.group.assistantId };
    const taught = lessonValues(m, year, month, now).filter(
      (l) => teacherOn(history, current, l.day, "TEACHER") === teacherId || teacherOn(history, current, l.day, "ASSISTANT") === teacherId,
    );
    if (!taught.length) continue;
    const lessonsInMonth = lessonDates(m.group.days, year, month).length;
    const value = taught.reduce((s, l) => s + l.value, 0);
    const share = salary.type === "PERCENT" ? (value * salary.amount) / 100 : (salary.amount * taught.length) / lessonsInMonth;
    rows.push({ studentId: m.student.id, studentName: m.student.name, groupId: m.group.id, groupName: m.group.name, lessons: taught.length, lessonsInMonth, value, share });
  }
  return { rows, total: Math.round(rows.reduce((s, r) => s + r.share, 0)) };
}
