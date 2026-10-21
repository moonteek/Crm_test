import "server-only";
import { db } from "../db";
import type { CurrentUser } from "../access";
import type { Table } from "../export";
import { courseMonths, sectionLessons } from "../curriculum";

export async function coursesTable(_user: CurrentUser, _params: Record<string, string> = {}): Promise<Table> {
  const courses = await db.course.findMany({
    include: { sections: { orderBy: { position: "asc" }, include: { subjects: { orderBy: { position: "asc" } } } }, groups: { where: { status: "ACTIVE" }, include: { _count: { select: { students: { where: { leftAt: null } } } } } } },
    orderBy: { name: "asc" },
  });
  return {
    title: "Kurslar",
    columns: ["Kurs", "Narx", "Davomiylik (oy)", "Dars (daqiqa)", "O'tish bali (%)", "Bo'limlar", "Faol guruhlar", "O'quvchilar"],
    rows: courses.map((c) => [
      c.name, c.price, courseMonths(c.sections) ?? c.durationMon, c.lessonMin, c.passPercent,
      c.sections.map((sec) => `${sec.name}: ${sec.subjects.map((l) => (l.levels > 1 ? `${l.name} ×${l.levels}` : l.name)).join(", ")} (${sectionLessons(sec.subjects)} dars)`).join("; "), c.groups.length, c.groups.reduce((n, g) => n + g._count.students, 0),
    ]),
  };
}
