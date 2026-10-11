import "server-only";
import { db } from "../db";
import type { CurrentUser } from "../access";
import type { Table } from "../export";

export async function teachersTable(_user: CurrentUser, _params: Record<string, string> = {}): Promise<Table> {
  const teachers = await db.user.findMany({
    where: { isTeacher: true, active: true },
    include: {
      role: true,
      groups: { where: { status: "ACTIVE" }, include: { _count: { select: { students: { where: { leftAt: null } } } } } },
      assistedGroups: { where: { status: "ACTIVE" } },
    },
    orderBy: { name: "asc" },
  });
  return {
    title: "O'qituvchilar",
    columns: ["O'qituvchi", "Lavozim", "Telefon", "Guruhlar", "Yordamchi guruhlar", "O'quvchilar"],
    rows: teachers.map((t) => [
      t.name, t.role.name, t.phone, t.groups.map((g) => g.name).join(", "), t.assistedGroups.map((g) => g.name).join(", "),
      t.groups.reduce((n, g) => n + g._count.students, 0),
    ]),
  };
}
