import "server-only";
import { db } from "../db";
import type { CurrentUser } from "../access";
import { MONTHS } from "../format";
import { currentMonth, lessonBased, SALARY_TYPES, salariesForMonth } from "../salary";
import type { Table } from "../export";

/** One month's salaries (accrued, paid, left) and payouts: the page and its export. */
export async function loadSalaries(_user: CurrentUser, params: { m?: string }) {
  const month = params.m && /^\d{4}-\d{2}$/.test(params.m) ? params.m : currentMonth();
  const [y, mm] = month.split("-").map(Number);
  const [rows, payouts] = await Promise.all([
    salariesForMonth(month, { allActive: true }),
    db.salaryPayment.findMany({ where: { month }, include: { user: true }, orderBy: { date: "desc" } }),
  ]);
  const rule = (r: (typeof rows)[number]) =>
    r.salaryType === "NONE" ? SALARY_TYPES.NONE.label
    : `${SALARY_TYPES[r.salaryType].label}: ${r.salaryType === "PERCENT" ? `${r.salaryAmount}%` : r.salaryAmount}`;
  const base = (r: (typeof rows)[number]) =>
    r.salaryType === "PERCENT" ? `${r.base} ${lessonBased(month) ? "darslar qiymati" : "tushum"}` : r.salaryType === "PER_STUDENT" ? `${r.base} o'quvchi` : null;
  const table: Table = {
    title: `Ish haqi ${MONTHS[mm - 1]} ${y}`,
    columns: ["Xodim", "Lavozim", "Qoida", "Asos", "Bonus (KPI)", "Hisoblangan", "To'langan", "Qolgan"],
    rows: rows.map((r) => [r.name, r.roleName, rule(r), base(r), r.bonus, r.accrued, r.paid, r.remaining]),
  };
  return { month, y, mm, rows, payouts, table };
}
