import "server-only";
import { db } from "../db";
import type { CurrentUser } from "../access";
import type { Table } from "../export";

export async function coursesTable(_user: CurrentUser, _params: Record<string, string> = {}): Promise<Table> {
  const courses = await db.course.findMany({
    include: { subjects: { orderBy: { position: "asc" } }, groups: { where: { status: "ACTIVE" }, include: { _count: { select: { students: { where: { leftAt: null } } } } } } },
    orderBy: { name: "asc" },
  });
  return {
    title: "Kurslar",
    columns: ["Kurs", "Narx", "Davomiylik (oy)", "Dars (daqiqa)", "O'tish bali (%)", "Fanlar", "Faol guruhlar", "O'quvchilar"],
    rows: courses.map((c) => [
      c.name, c.price, c.durationMon, c.lessonMin, c.passPercent,
      c.subjects.map((s) => `${s.name} (${s.months} oy)`).join(", "), c.groups.length, c.groups.reduce((n, g) => n + g._count.students, 0),
    ]),
  };
}
