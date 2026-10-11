import { db } from "./db";
import { monthBounds } from "./month";
import { salesStats } from "./sales";
import { billedStudentCount, PER_LESSON_FROM } from "./billing";
import { teacherEarnings } from "./teacher-pay";
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
    } else if ((u.salaryType === "PERCENT" || u.salaryType === "PER_STUDENT") && lessonBased(month)) {
      // from November 2026: exactly the lessons this person taught (see src/lib/teacher-pay.ts)
      const e = await earningsFor(u.id, { type: u.salaryType, amount: u.salaryAmount }, month);
      base = u.salaryType === "PERCENT" ? e.rows.reduce((s, r) => s + r.value, 0) : Math.round(e.rows.reduce((s, r) => s + r.lessons / r.lessonsInMonth, 0) * 100) / 100;
      accrued = e.total;
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

/** Months from the per-lesson switch on pay teachers by the lessons they taught. */
export function lessonBased(month: string) {
  const [y, m] = month.split("-").map(Number);
  return Date.UTC(y, m - 1, 1) >= PER_LESSON_FROM.getTime();
}

/** Every student-group the person may have taught that month, with what teacher pay needs. */
async function earningsFor(userId: number, salary: { type: "PERCENT" | "PER_STUDENT"; amount: number }, month: string) {
  const { from, to } = monthBounds(month);
  const memberships = await db.groupStudent.findMany({
    where: {
      group: { OR: [{ teacherId: userId }, { assistantId: userId }, { teachers: { some: { userId } } }] },
      joinedAt: { lt: to },
      OR: [{ leftAt: null }, { leftAt: { gte: from } }],
    },
    include: { ...membershipInclude, student: { select: { id: true, name: true } }, group: { include: { course: true, prices: true, teachers: true } } },
  });
  const [y, m] = month.split("-").map(Number);
  return teacherEarnings(userId, salary, memberships, y, m - 1);
}

export type SalaryBreakdown =
  | { kind: "lessons"; rows: Awaited<ReturnType<typeof earningsFor>>["rows"]; total: number }
  | { kind: "payments"; rows: { date: Date; studentName: string; groupName: string; amount: number }[]; total: number }
  | { kind: "students"; rows: { studentName: string; groupName: string }[]; total: number };

/** Where a teacher's salary for a month comes from, row by row. */
export async function salaryBreakdown(userId: number, month: string): Promise<SalaryBreakdown | null> {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (u.salaryType !== "PERCENT" && u.salaryType !== "PER_STUDENT") return null;
  if (lessonBased(month)) {
    const e = await earningsFor(userId, { type: u.salaryType, amount: u.salaryAmount }, month);
    return { kind: "lessons", rows: e.rows, total: e.total };
  }
  const { from, to } = monthBounds(month);
  if (u.salaryType === "PERCENT") {
    const payments = await db.payment.findMany({
      where: { date: { gte: from, lt: to }, group: { OR: [{ teacherId: userId }, { assistantId: userId }] } },
      include: { student: true, group: true },
      orderBy: { date: "asc" },
    });
    const sum = payments.reduce((s, p) => s + p.amount, 0);
    return { kind: "payments", rows: payments.map((p) => ({ date: p.date, studentName: p.student.name, groupName: p.group?.name ?? "—", amount: p.amount })), total: Math.round((sum * u.salaryAmount) / 100) };
  }
  const memberships = await db.groupStudent.findMany({
    where: { group: { OR: [{ teacherId: userId }, { assistantId: userId }] }, joinedAt: { lt: to }, OR: [{ leftAt: null }, { leftAt: { gte: from } }] },
    include: { ...membershipInclude, student: true },
  });
  const [y, m] = month.split("-").map(Number);
  const counted = memberships.filter((ms) => billedStudentCount([ms], y, m - 1) > 0);
  return { kind: "students", rows: counted.map((ms) => ({ studentName: ms.student.name, groupName: ms.group.name })), total: counted.length * u.salaryAmount };
}
