import { db } from "./db";
import { monthBounds } from "./month";
import { salesStats } from "./sales";
import { billedStudentCount } from "./billing";
import { membershipInclude } from "./billing-include";

export const SALARY_TYPES: Record<string, { label: string; unit: string }> = {
  NONE: { label: "Belgilanmagan", unit: "" },
  FIXED: { label: "Oylik (qat'iy)", unit: "so'm / oy" },
  PERCENT: { label: "Tushumdan foiz", unit: "% o'zi dars beradigan yoki yordamchi bo'lgan guruhlar to'lovlaridan" },
  PER_STUDENT: { label: "Har bir o'quvchi uchun", unit: "so'm / o'quvchi" },
};

export { monthBounds, currentMonth } from "./month";

export type SalaryRow = {
  userId: number;
  name: string;
  roleName: string;
  salaryType: string;
  salaryAmount: number;
  /** what the rule is based on: collected so'm for PERCENT, student count for PER_STUDENT */
  base: number;
  /** fixed/percent/per-student part */
  salary: number;
  /** KPI bonuses earned this month */
  bonus: number;
  accrued: number;
  paid: number;
  remaining: number;
};

/** Salary accrued and paid for every staff member with a salary rule, for one month. */
export async function salariesForMonth(month: string, { allActive = false } = {}): Promise<SalaryRow[]> {
  const { from, to } = monthBounds(month);
  const [users, payouts] = await Promise.all([
    db.user.findMany({
      where: { OR: [allActive ? { active: true } : { salaryType: { not: "NONE" } }, { salaryPayments: { some: { month } } }, { kpiTargets: { some: { month } } }] },
      include: { role: true },
      orderBy: { name: "asc" },
    }),
    db.salaryPayment.groupBy({ by: ["userId"], where: { month }, _sum: { amount: true } }),
  ]);

  const bonuses = new Map((await salesStats(month)).map((r) => [r.userId, r.bonus]));
  const rows: SalaryRow[] = [];
  for (const u of users) {
    let base = 0;
    let accrued = 0;
    if (u.salaryType === "FIXED") {
      accrued = u.salaryAmount;
    } else if (u.salaryType === "PERCENT") {
      const sum = await db.payment.aggregate({
        _sum: { amount: true },
        where: { date: { gte: from, lt: to }, group: { OR: [{ teacherId: u.id }, { assistantId: u.id }] } },
      });
      base = sum._sum.amount ?? 0;
      accrued = Math.round((base * u.salaryAmount) / 100);
    } else if (u.salaryType === "PER_STUDENT") {
      // students charged at least one lesson in this teacher's groups that month (not trial-only, not frozen all month)
      const memberships = await db.groupStudent.findMany({
        where: { group: { OR: [{ teacherId: u.id }, { assistantId: u.id }] }, joinedAt: { lt: to }, OR: [{ leftAt: null }, { leftAt: { gte: from } }] },
        include: membershipInclude,
      });
      const [y, m] = month.split("-").map(Number);
      base = billedStudentCount(memberships, y, m - 1);
      accrued = base * u.salaryAmount;
    }
    const paid = payouts.find((p) => p.userId === u.id)?._sum.amount ?? 0;
    const bonus = bonuses.get(u.id) ?? 0;
    const total = accrued + bonus;
    rows.push({
      userId: u.id, name: u.name, roleName: u.role.name, salaryType: u.salaryType, salaryAmount: u.salaryAmount,
      base, salary: accrued, bonus, accrued: total, paid, remaining: Math.max(0, total - paid),
    });
  }
  return rows;
}
