import { db } from "./db";
import { monthBounds } from "./month";

export const OPEN_STATUSES = ["NEW", "CONTACTED", "TRIAL"];

/** The active salesperson with the fewest open leads, for automatic assignment. */
export async function pickAssignee(): Promise<number | null> {
  const sellers = await db.user.findMany({
    where: { isSales: true, active: true },
    include: { _count: { select: { assignedLeads: { where: { status: { in: OPEN_STATUSES } } } } } },
  });
  if (!sellers.length) return null;
  sellers.sort((a, b) => a._count.assignedLeads - b._count.assignedLeads || a.id - b.id);
  return sellers[0].id;
}

export type KpiRow = {
  metric: string;
  target: number;
  bonus: number;
  perExtra: number;
  achieved: number;
  progress: number; // %
  earned: number;
};

export type SellerStats = {
  userId: number;
  name: string;
  newLeads: number; // leads created this month and assigned to them
  openLeads: number; // currently open
  calls: number;
  contacts: number; // all logged activities except status changes
  trials: number;
  won: number;
  lost: number;
  revenue: number;
  conversion: number | null;
  overdue: number;
  kpis: KpiRow[];
  bonus: number;
};

const pct = (a: number, b: number) => (b ? (a / b) * 100 : null);

/** Sales results, KPI progress and earned bonuses of every salesperson for one month. */
export async function salesStats(month: string, onlyUserId?: number): Promise<SellerStats[]> {
  const { from, to } = monthBounds(month);
  const sellers = await db.user.findMany({
    where: {
      ...(onlyUserId ? { id: onlyUserId } : {}),
      OR: [{ isSales: true, active: true }, { kpiTargets: { some: { month } } }, { assignedLeads: { some: { createdAt: { gte: from, lt: to } } } }],
    },
    include: { kpiTargets: { where: { month } } },
    orderBy: { name: "asc" },
  });
  const ids = sellers.map((s) => s.id);
  const [leads, activities, convertedLeads] = await Promise.all([
    db.lead.findMany({ where: { assignedToId: { in: ids } }, select: { assignedToId: true, status: true, createdAt: true, wonAt: true, nextActionAt: true } }),
    db.leadActivity.findMany({ where: { userId: { in: ids }, createdAt: { gte: from, lt: to } }, select: { userId: true, type: true, result: true } }),
    db.lead.findMany({
      where: { assignedToId: { in: ids }, studentId: { not: null } },
      select: { assignedToId: true, student: { select: { payments: { orderBy: { date: "asc" }, take: 1, select: { amount: true, date: true } } } } },
    }),
  ]);
  const now = new Date();

  return sellers.map((s) => {
    const mine = leads.filter((l) => l.assignedToId === s.id);
    const created = mine.filter((l) => l.createdAt >= from && l.createdAt < to);
    const acts = activities.filter((a) => a.userId === s.id);
    const won = mine.filter((l) => l.wonAt && l.wonAt >= from && l.wonAt < to).length;
    const revenue = convertedLeads
      .filter((l) => l.assignedToId === s.id)
      .map((l) => l.student?.payments[0])
      .filter((p): p is { amount: number; date: Date } => !!p && p.date >= from && p.date < to)
      .reduce((sum, p) => sum + p.amount, 0);
    const stats = {
      newLeads: created.length,
      openLeads: mine.filter((l) => ["NEW", "CONTACTED", "TRIAL"].includes(l.status)).length,
      calls: acts.filter((a) => a.type === "CALL").length,
      contacts: acts.filter((a) => a.type !== "STATUS").length,
      trials: acts.filter((a) => a.type === "STATUS" && a.result === "TRIAL").length,
      won,
      lost: acts.filter((a) => a.type === "STATUS" && a.result === "LOST").length,
      revenue,
      conversion: pct(created.filter((l) => l.status === "WON").length, created.length),
      overdue: mine.filter((l) => l.nextActionAt && l.nextActionAt < now && ["NEW", "CONTACTED", "TRIAL"].includes(l.status)).length,
    };
    const achievedFor = (metric: string) =>
      metric === "WON" ? stats.won
      : metric === "REVENUE" ? stats.revenue
      : metric === "TRIALS" ? stats.trials
      : metric === "CALLS" ? stats.calls
      : Math.round(stats.conversion ?? 0);
    const kpis = s.kpiTargets.map((k) => {
      const achieved = achievedFor(k.metric);
      const earned = achieved >= k.target && k.target > 0 ? k.bonus + (achieved - k.target) * k.perExtra : 0;
      return { metric: k.metric, target: k.target, bonus: k.bonus, perExtra: k.perExtra, achieved, progress: pct(achieved, k.target) ?? 0, earned };
    });
    return { userId: s.id, name: s.name, ...stats, kpis, bonus: kpis.reduce((a, k) => a + k.earned, 0) };
  });
}
