import "server-only";
import { db } from "../db";
import { studentScope, type CurrentUser } from "../access";
import { balance } from "../billing";
import { membershipInclude } from "../billing-include";
import type { Table } from "../export";

/** Students who owe money, biggest debt first: the page and its export. */
export async function loadDebtors(user: CurrentUser, _params: Record<string, string> = {}) {
  const students = await db.student.findMany({
    where: studentScope(user),
    include: { payments: { select: { amount: true } }, groups: { include: membershipInclude } },
  });
  const debtors = students
    .map((s) => ({ ...s, balance: balance(s.groups, s.payments) }))
    .filter((s) => s.balance < 0)
    .sort((a, b) => a.balance - b.balance);
  const total = debtors.reduce((sum, s) => sum + s.balance, 0);
  const table: Table = {
    title: "Qarzdorlar",
    columns: ["Ism", "Telefon", "Ota-ona", "Guruhlar", "Qarz"],
    rows: debtors.map((s) => [s.name, s.phone, s.parentPhone, s.groups.filter((g) => !g.leftAt).map((g) => g.group.name).join(", "), -s.balance]),
  };
  return { debtors, total, table };
}
