import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, UserPlus, Users, UsersRound, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can, firstAllowedPage, groupScope, studentScope } from "@/lib/access";
import { balance } from "@/lib/billing";
import { date, money, MONTHS, PAYMENT_METHODS, LEAD_STATUSES } from "@/lib/format";
import { PageHeader, StatCard, Empty } from "@/components/ui";

export default async function Dashboard() {
  const user = await requireUser();
  if (!can(user, "dashboard.view")) redirect(firstAllowedPage(user));
  const show = {
    finance: can(user, "finance.view"),
    leads: can(user, "leads.view"),
    payments: can(user, "payments.view"),
    debtors: can(user, "debtors.view"),
  };
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [students, groups, leads, monthPayments, monthExpenses, recent, leadCounts, todayGroups, monthShop] = await Promise.all([
    db.student.findMany({
      where: { AND: [{ groups: { some: { leftAt: null } } }, studentScope(user)] },
      include: { payments: { select: { amount: true } }, groups: { include: { group: { include: { course: true } } } } },
    }),
    db.group.count({ where: { status: "ACTIVE", ...groupScope(user) } }),
    db.lead.count({ where: { status: { in: ["NEW", "CONTACTED", "TRIAL"] } } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { date: { gte: monthStart } } }),
    db.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: monthStart } } }),
    db.payment.findMany({ take: 6, orderBy: { date: "desc" }, include: { student: true } }),
    db.lead.groupBy({ by: ["status"], _count: true }),
    db.group.findMany({
      where: { status: "ACTIVE", days: { in: todayDays(now.getDay()) }, ...groupScope(user) },
      include: { course: true, teacher: true, room: true, _count: { select: { students: { where: { leftAt: null } } } } },
      orderBy: { time: "asc" },
    }),
    db.sale.aggregate({ _sum: { total: true }, where: { date: { gte: monthStart } } }),
  ]);

  const debtors = students.filter((s) => balance(s.groups, s.payments) < 0).length;
  const income = (monthPayments._sum.amount ?? 0) + (monthShop._sum.total ?? 0);
  const expense = monthExpenses._sum.amount ?? 0;
  const totalLeads = leadCounts.reduce((s, l) => s + l._count, 0) || 1;

  return (
    <>
      <PageHeader title="Bosh sahifa" subtitle={`${now.getDate()}-${MONTHS[now.getMonth()].toLowerCase()}, ${now.getFullYear()}`} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Faol o'quvchilar" value={students.length} icon={<Users />} href="/students" />
        <StatCard label="Faol guruhlar" value={groups} icon={<UsersRound />} tone="green" href="/groups" />
        {show.leads && <StatCard label="Yangi lidlar" value={leads} icon={<UserPlus />} tone="amber" href="/leads" />}
        {show.debtors && <StatCard label="Qarzdorlar" value={debtors} icon={<AlertCircle />} tone="rose" href="/debtors" />}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          {show.finance && (
            <>
              <h2 className="mb-4 font-semibold">{MONTHS[now.getMonth()]} oyi moliyasi</h2>
              <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <Metric label="Tushum" value={money(income)} cls="text-emerald-600" />
                <Metric label="Xarajat" value={money(expense)} cls="text-rose-600" />
                <Metric label="Foyda" value={money(income - expense)} cls="text-brand-600" />
              </div>
            </>
          )}
          <h3 className="mb-2 text-sm font-semibold text-slate-600">Bugungi darslar</h3>
          {todayGroups.length === 0 ? (
            <Empty text="Bugun dars yo'q" />
          ) : (
            <div className="divide-y divide-slate-100">
              {todayGroups.map((g) => (
                <Link key={g.id} href={`/groups/${g.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-brand-600">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{g.name}</p>
                    <p className="text-xs text-slate-500">{g.course.name} · {g.teacher?.name ?? "O'qituvchi yo'q"} · {g.room?.name ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{g.time}</p>
                    <p className="text-xs text-slate-500">{g._count.students} o&apos;quvchi</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {show.leads && <div className="card p-5">
          <h2 className="mb-4 font-semibold">Lidlar voronkasi</h2>
          <div className="space-y-3">
            {LEAD_STATUSES.map((s) => {
              const count = leadCounts.find((l) => l.status === s.key)?._count ?? 0;
              return (
                <div key={s.key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{s.label}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className={`h-2 rounded-full ${s.color}`} style={{ width: `${(count / totalLeads) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>}
      </div>

      {show.payments && <div className="card mt-6">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-semibold">So&apos;nggi to&apos;lovlar</h2>
          <Link href="/payments" className="text-sm text-brand-600 hover:underline">Barchasi</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>O&apos;quvchi</th><th>Summa</th><th>Turi</th><th>Sana</th></tr></thead>
            <tbody>
              {recent.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/students/${p.studentId}`} className="font-medium hover:text-brand-600">{p.student.name}</Link></td>
                  <td className="font-semibold text-emerald-600">{money(p.amount)}</td>
                  <td>{PAYMENT_METHODS[p.method]}</td>
                  <td>{date(p.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recent.length === 0 && <Empty text="To'lovlar yo'q" />}
        </div>
      </div>}
    </>
  );
}

function todayDays(weekday: number) {
  if (weekday === 0) return [];
  return [weekday % 2 === 1 ? "ODD" : "EVEN", "DAILY"];
}

function Metric({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${cls}`}>{value}</p>
    </div>
  );
}
