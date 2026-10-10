import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, UserPlus, Users, UsersRound, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can, firstAllowedPage, groupScope, studentScope } from "@/lib/access";
import { balance } from "@/lib/billing";
import { centreMonthStart, centreToday, fromMinutes, greeting, scheduleKeysOn, toMinutes, WEEKDAYS } from "@/lib/schedule";
import { date, money, MONTHS, PAYMENT_METHODS, LEAD_STATUSES } from "@/lib/format";
import { DotMeter, Empty, PageHeader, StatCard } from "@/components/ui";

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
  const today = centreToday(now);
  const monthStart = centreMonthStart(now);

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
      where: { status: "ACTIVE", days: { in: scheduleKeysOn(today.weekday) }, ...groupScope(user) },
      include: { course: true, teacher: true, room: true, _count: { select: { students: { where: { leftAt: null } } } } },
      orderBy: { time: "asc" },
    }),
    db.sale.aggregate({ _sum: { total: true }, where: { date: { gte: monthStart } } }),
  ]);

  const debtors = students.filter((s) => balance(s.groups, s.payments) < 0).length;
  const income = (monthPayments._sum.amount ?? 0) + (monthShop._sum.total ?? 0);
  const expense = monthExpenses._sum.amount ?? 0;
  const totalLeads = leadCounts.reduce((s, l) => s + l._count, 0) || 1;

  const weekday = WEEKDAYS.find((w) => w.day === today.weekday)?.label ?? "Yakshanba";
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <>
      <PageHeader
        eyebrow={`${weekday} · ${pad(today.day)}.${pad(today.month)}.${today.year}`}
        title={`${greeting(today.hour)}, ${user.name}`}
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard label="Faol o'quvchilar" value={students.length} icon={<Users />} href="/students" hero />
        <StatCard label="Faol guruhlar" value={groups} icon={<UsersRound />} href="/groups" />
        {show.leads && <StatCard label="Yangi lidlar" value={leads} icon={<UserPlus />} tone="amber" href="/leads" />}
        {show.debtors && <StatCard label="Qarzdorlar" value={debtors} icon={<AlertCircle />} tone="rose" href="/debtors" />}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:mt-6 md:gap-6 xl:grid-cols-3">
        <div className="card p-4 md:p-5 xl:col-span-2">
          {show.finance && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">{MONTHS[today.month - 1]} oyi moliyasi</h2>
                <Wallet className="h-[18px] w-[18px] text-faint" />
              </div>
              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                <Metric label="Tushum" value={money(income)} cls="text-success" />
                <Metric label="Xarajat" value={money(expense)} cls="text-danger" />
                <Metric label="Foyda" value={money(income - expense)} cls={income - expense < 0 ? "text-danger" : "text-ink"} />
              </div>
            </>
          )}
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Bugungi darslar</h2>
            <Link href="/schedule" className="label-mono hover:text-ink">Jadval →</Link>
          </div>
          {todayGroups.length === 0 ? (
            <Empty text="Bugun dars yo'q" />
          ) : (
            <div className="space-y-2">
              {todayGroups.map((g) => (
                <Link
                  key={g.id}
                  href={`/groups/${g.id}`}
                  className="press flex items-center gap-4 rounded-xl border border-line bg-raised px-3.5 py-3 hover:border-line-strong"
                >
                  <div className="w-[68px] shrink-0">
                    <p className="font-dot text-xl leading-none font-black">{g.time}</p>
                    <p className="label-mono mt-1">{fromMinutes(toMinutes(g.time) + g.course.lessonMin)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.name}</p>
                    <p className="truncate text-xs text-muted">{g.course.name} · {g.teacher?.name ?? "O'qituvchi yo'q"} · {g.room?.name ?? "—"}</p>
                  </div>
                  <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                    {g.room && <DotMeter value={g._count.students} max={g.room.capacity} label={`${g._count.students} / ${g.room.capacity} o'rin`} />}
                    <span className="label-mono">{g._count.students} o&apos;quvchi</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {show.leads && (
          <div className="card p-4 md:p-5">
            <h2 className="mb-4 font-semibold">Lidlar voronkasi</h2>
            <div className="space-y-3.5">
              {LEAD_STATUSES.map((s) => {
                const count = leadCounts.find((l) => l.status === s.key)?._count ?? 0;
                return (
                  <div key={s.key}>
                    <div className="mb-1.5 flex items-baseline justify-between text-sm">
                      <span className="text-muted">{s.label}</span>
                      <span className="font-dot text-base font-black">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-ink/[.06]">
                      <div className="h-1.5 rounded-full bg-accent transition-[width] duration-500 ease-smooth" style={{ width: `${(count / totalLeads) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {show.payments && (
        <div className="card mt-4 md:mt-6">
          <div className="flex items-center justify-between px-4 py-4 md:px-5">
            <h2 className="font-semibold">So&apos;nggi to&apos;lovlar</h2>
            <Link href="/payments" className="label-mono hover:text-ink">Barchasi →</Link>
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="table">
              <thead><tr><th>O&apos;quvchi</th><th>Summa</th><th>Turi</th><th>Sana</th></tr></thead>
              <tbody>
                {recent.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/students/${p.studentId}`} className="font-medium hover:underline">{p.student.name}</Link></td>
                    <td className="font-semibold text-success">{money(p.amount)}</td>
                    <td className="text-muted">{PAYMENT_METHODS[p.method]}</td>
                    <td className="text-muted">{date(p.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-line border-t border-line md:hidden">
            {recent.map((p) => (
              <Link key={p.id} href={`/students/${p.studentId}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.student.name}</p>
                  <p className="label-mono mt-0.5">{PAYMENT_METHODS[p.method]} · {date(p.date)}</p>
                </div>
                <span className="shrink-0 font-semibold text-success">{money(p.amount)}</span>
              </Link>
            ))}
          </div>
          {recent.length === 0 && <Empty text="To'lovlar yo'q" />}
        </div>
      )}
    </>
  );
}

function Metric({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="rounded-xl border border-line bg-raised p-4">
      <p className="label-mono">{label}</p>
      <p className={`mt-2 truncate text-lg font-semibold ${cls}`}>{value}</p>
    </div>
  );
}
