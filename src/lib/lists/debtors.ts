import "server-only";
import { db } from "../db";
import { studentScope, type CurrentUser } from "../access";
import { balance, withHolidays } from "../billing";
import { unchargedDaysOf } from "../holidays-db";
import { membershipInclude } from "../billing-include";
import type { Table } from "../export";
import { DEBTOR_STATUSES, debtorMatches, type DebtorStatus } from "../debtor-status";

/** Students who owe money, biggest debt first: the page and its export. */
/** `status`: Faol (still in a group) / Chiqib ketgan / Hammasi — the dashboard counts Hammasi. */
export async function loadDebtors(user: CurrentUser, params: { status?: string } = {}) {
  const status: DebtorStatus = params.status && params.status in DEBTOR_STATUSES ? (params.status as DebtorStatus) : "all";
  const students = await db.student.findMany({
    where: studentScope(user),
    include: { payments: { select: { amount: true } }, groups: { include: membershipInclude } },
  });
  const holidays = await unchargedDaysOf();
  const debtors = students
    .map((s) => ({ ...s, balance: balance(withHolidays(s.groups, holidays), s.payments) }))
    .filter((s) => s.balance < 0 && debtorMatches(s, status))
    .sort((a, b) => a.balance - b.balance);
  const total = debtors.reduce((sum, s) => sum + s.balance, 0);
  const table: Table = {
    title: "Qarzdorlar",
    columns: ["Ism", "Telefon", "Ota-ona", "Guruhlar", "Qarz"],
    rows: debtors.map((s) => [s.name, s.phone, s.parentPhone, s.groups.filter((g) => !g.leftAt).map((g) => g.group.name).join(", "), -s.balance]),
  };
  return { debtors, total, table, status };
}
