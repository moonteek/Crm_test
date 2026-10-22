import "server-only";
import { db } from "../db";
import { canSeeBalances, studentScope, type CurrentUser } from "../access";
import { balance, withHolidays } from "../billing";
import { unchargedDaysOf } from "../holidays-db";
import { MEMBER_STATUS, type Status } from "../membership";
import { studentWhere, type StudentFilters } from "../student-filters";
import type { Table } from "../export";

/** The student list for the page and its export: same filters, same scope, same rows. */
export async function loadStudents(user: CurrentUser, f: StudentFilters) {
  const showBalance = canSeeBalances(user);
  const found = await db.student.findMany({
    where: studentWhere(f, studentScope(user)),
    include: {
      payments: { select: { amount: true } },
      groups: {
        include: {
          events: { orderBy: [{ date: "asc" }, { id: "asc" }] },
          discounts: { select: { from: true, to: true, amount: true } },
          group: { include: { course: true, prices: true, teacher: { select: { name: true } }, assistant: { select: { name: true } } } },
        },
      },
      tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
    },
    orderBy: { name: "asc" },
  });

  const holidays = await unchargedDaysOf();
  const all = found
    .map((s) => {
      const current = s.groups.filter((g) => !g.leftAt);
      return {
        ...s,
        current,
        balance: showBalance ? balance(withHolidays(s.groups, holidays), s.payments) : null,
        teachers: [...new Set(current.flatMap((g) => [g.group.teacher?.name, g.group.assistant?.name]).filter((n): n is string => Boolean(n)))],
        statusLabel: current.length ? [...new Set(current.map((g) => MEMBER_STATUS[g.status as Status]))].join(", ") : "Guruhsiz",
      };
    })
    .filter((s) => f.status !== "debtor" || (s.balance ?? 0) < 0);

  const pages = Math.max(1, Math.ceil(all.length / f.per));
  const page = Math.min(f.page, pages);
  const table: Table = {
    title: "O'quvchilar",
    columns: ["№", "Ism", "Telefon", "Otasi telefoni", "Onasi telefoni", "Guruhlar", "O'qituvchilar", "Holati", ...(showBalance ? ["Balans"] : []), "Teglar", "Qayerdan keldi"],
    rows: all.map((s, i) => [
      i + 1, s.name, s.phone, s.fatherPhone, s.motherPhone, s.current.map((g) => g.group.name).join(", "), s.teachers.join(", "), s.statusLabel,
      ...(showBalance ? [s.balance] : []), s.tags.map((t) => t.tag.name).join(", "), s.source,
    ]),
  };
  return { rows: all.slice((page - 1) * f.per, page * f.per), total: all.length, page, pages, showBalance, table };
}
