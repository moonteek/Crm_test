import "server-only";
import { db } from "../db";
import { groupScope, type CurrentUser } from "../access";
import { isoDate, MONTHS } from "../format";
import { lessonDatesOf } from "../group-schedule";
import { centreDay } from "../membership-db";
import { examColumns } from "../group-exams";
import { closedDaysOf, makeupDaysOf, holidayDays } from "../holidays-db";
import { fmtDate, type Table } from "../export";

/** One group page tab as a table: attendance or grades of the shown month, or exam scores. Null when not allowed. */
export async function groupSheet(user: CurrentUser, groupId: number, params: { tab?: string; m?: string }): Promise<Table | null> {
  const group = await db.group.findFirst({
    where: { id: groupId, ...groupScope(user) },
    include: { section: { include: { subjects: { orderBy: { position: "asc" } } } }, schedules: true, students: { where: { leftAt: null }, include: { student: true }, orderBy: { student: { name: "asc" } } } },
  });
  if (!group) return null;
  const now = new Date();
  const [year, month] = params.m ? params.m.split("-").map(Number).map((v, i) => (i === 1 ? v - 1 : v)) : [now.getFullYear(), now.getMonth()];
  const students = group.students.map((s) => s.student);

  if (params.tab === "exams") {
    const exams = await db.exam.findMany({ where: { groupId }, include: { results: true }, orderBy: { date: "asc" } });
    const cols = examColumns({ ...group, holidays: (await closedDaysOf())(groupId), extraDays: (await makeupDaysOf())(groupId) }, group.section?.subjects ?? [], exams, centreDay());
    return {
      title: `${group.name} imtihonlar`,
      columns: ["O'quvchi", ...cols.map((c) => `${c.title} (${fmtDate(c.date)}, ${c.maxScore})`)],
      rows: students.map((st) => [st.name, ...cols.map((c) => c.results.find((r) => r.studentId === st.id)?.score ?? null)]),
    };
  }

  // the month's lesson days plus make-up days (moved lessons) that fall in it
  const makeups = (await makeupDaysOf())(groupId).filter((x) => x.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`));
  const days = [...lessonDatesOf(group, year, month), ...makeups.map((x) => new Date(x + "T00:00:00Z"))].sort((a, b) => a.getTime() - b.getTime());
  // closed days: the centre's holidays ("Bayram") and this group's cancelled lessons ("Bekor")
  const holidays = new Set(await holidayDays());
  const off = new Set((await closedDaysOf())(groupId));
  const closedMark = (day: string) => (holidays.has(day) ? "Bayram" : off.has(day) ? "Bekor" : null);
  const range = { gte: days[0] ?? new Date(), lte: days.at(-1) ?? new Date() };
  const grades = params.tab === "grades";
  const marks = grades
    ? new Map((await db.grade.findMany({ where: { groupId, date: range } })).map((g) => [`${g.studentId}:${isoDate(g.date)}`, g.score as number | string]))
    : new Map((await db.attendance.findMany({ where: { groupId, date: range }, include: { reason: true } }))
      .map((a) => [`${a.studentId}:${isoDate(a.date)}`, a.late ? "K" : a.present ? "✓" : a.reason ? `✗ ${a.reason.name}` : "✗"]));
  return {
    title: `${group.name} ${grades ? "baholar" : "davomat"} ${MONTHS[month]} ${year}`,
    columns: ["O'quvchi", ...days.map((d) => fmtDate(d).slice(0, 5) + (makeups.includes(isoDate(d)) ? " (q)" : ""))],
    rows: students.map((st) => [st.name, ...days.map((d) => (closedMark(isoDate(d)) ?? marks.get(`${st.id}:${isoDate(d)}`) ?? null))]),
  };
}
