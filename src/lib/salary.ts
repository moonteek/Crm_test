import { db } from "./db";

export const SALARY_TYPES: Record<string, { label: string; unit: string }> = {
  NONE: { label: "Belgilanmagan", unit: "" },
  FIXED: { label: "Oylik (qat'iy)", unit: "so'm / oy" },
  PERCENT: { label: "Tushumdan foiz", unit: "% o'zi dars beradigan yoki yordamchi bo'lgan guruhlar to'lovlaridan" },
  PER_STUDENT: { label: "Har bir o'quvchi uchun", unit: "so'm / o'quvchi" },
};

export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
}

export function currentMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type SalaryRow = {
  userId: number;
  name: string;
  roleName: string;
  salaryType: string;
  salaryAmount: number;
  /** what the rule is based on: collected so'm for PERCENT, student count for PER_STUDENT */
  base: number;
  accrued: number;
  paid: number;
  remaining: number;
};

/** Salary accrued and paid for every staff member with a salary rule, for one month. */
export async function salariesForMonth(month: string, { allActive = false } = {}): Promise<SalaryRow[]> {
  const { from, to } = monthBounds(month);
  const [users, payouts] = await Promise.all([
    db.user.findMany({
      where: { OR: [allActive ? { active: true } : { salaryType: { not: "NONE" } }, { salaryPayments: { some: { month } } }] },
      include: { role: true },
      orderBy: { name: "asc" },
    }),
    db.salaryPayment.groupBy({ by: ["userId"], where: { month }, _sum: { amount: true } }),
  ]);

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
      // students enrolled in this teacher's groups at any point during the month
      base = await db.groupStudent.count({
        where: { group: { OR: [{ teacherId: u.id }, { assistantId: u.id }] }, joinedAt: { lt: to }, OR: [{ leftAt: null }, { leftAt: { gte: from } }] },
      });
      accrued = base * u.salaryAmount;
    }
    const paid = payouts.find((p) => p.userId === u.id)?._sum.amount ?? 0;
    rows.push({
      userId: u.id, name: u.name, roleName: u.role.name, salaryType: u.salaryType, salaryAmount: u.salaryAmount,
      base, accrued, paid, remaining: Math.max(0, accrued - paid),
    });
  }
  return rows;
}
