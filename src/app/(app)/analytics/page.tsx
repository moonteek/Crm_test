import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/access";
import { getAnalytics, resolvePeriod, type Analytics } from "@/lib/analytics";
import { LineChart } from "@/components/charts/LineChart";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { BarList } from "@/components/charts/BarList";
import { Kpi } from "@/components/charts/Kpi";
import { fmt } from "@/components/charts/format";
import { Empty, Segmented } from "@/components/ui";

const TABS = [
  { key: "overview", label: "Umumiy" },
  { key: "payments", label: "To'lovlar", money: true },
  { key: "attendance", label: "Davomat" },
  { key: "grades", label: "Baholar" },
  { key: "teachers", label: "O'qituvchilar" },
  { key: "leads", label: "Lidlar" },
  { key: "finance", label: "Moliya", money: true },
];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ tab?: string; range?: string }> }) {
  const user = await requirePage("analytics.view");
  // money figures (income, debts, salaries) only for roles that may see finances
  const money = can(user, "finance.view");
  const tabs = TABS.filter((x) => money || !x.money);
  const { tab: t, range = "6" } = await searchParams;
  const tab = tabs.some((x) => x.key === t) ? t! : "overview";
  const period = resolvePeriod(range);
  const a = await getAnalytics(period);
  const year = new Date().getFullYear();
  const ranges = [
    { key: "3", label: "3 oy" }, { key: "6", label: "6 oy" }, { key: "12", label: "12 oy" },
    { key: String(year), label: `${year}` }, { key: String(year - 1), label: `${year - 1}` },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Analitika</h1>
          <p className="mt-1 text-sm text-muted">{period.label} · {a.period.from} — {a.period.to}</p>
        </div>
        <Segmented options={ranges.map((r) => ({ href: `/analytics?tab=${tab}&range=${r.key}`, label: r.label, active: range === r.key }))} />
      </div>
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((x) => (
          <Link key={x.key} href={`/analytics?tab=${x.key}&range=${range}`}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${tab === x.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {x.label}
          </Link>
        ))}
      </div>
      {tab === "overview" && <Overview a={a} money={money} />}
      {tab === "payments" && <Payments a={a} />}
      {tab === "attendance" && <Attendance a={a} />}
      {tab === "grades" && <Grades a={a} />}
      {tab === "teachers" && <Teachers a={a} money={money} />}
      {tab === "leads" && <Leads a={a} />}
      {tab === "finance" && <Finance a={a} />}
    </>
  );
}

function Panel({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      <h2 className="font-semibold text-ink">{title}</h2>
      {sub && <p className="mb-3 text-xs text-muted">{sub}</p>}
      <div className={sub ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function Rate({ v, good = 85, ok = 70 }: { v: number | null; good?: number; ok?: number }) {
  if (v === null) return <span className="text-faint">—</span>;
  const cls = v >= good ? "bg-success-tint text-success" : v >= ok ? "bg-warning-tint text-warning" : "bg-danger-tint text-danger";
  return <span className={`badge ${cls}`}>{Math.round(v)}%</span>;
}

const labels = (a: Analytics) => a.monthly.map((m) => m.label);

function Overview({ a, money }: { a: Analytics; money: boolean }) {
  const c = a.current, p = a.previous;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {money ? (
          <>
            <Kpi label="Tushum" value={c.income} prev={p.income} format="money" />
            <Kpi label="Sof foyda" value={c.profit} prev={p.profit} format="money" />
            <Kpi label="To'lov yig'ilishi" value={c.collectionRate} prev={p.collectionRate} format="percent" hint="tushum / hisoblangan to'lov" />
          </>
        ) : (
          <>
            <Kpi label="Imtihonlar o'rtachasi" value={c.examAvg} prev={p.examAvg} format="percent" />
            <Kpi label="Yangi lidlar" value={c.leads} prev={p.leads} format="number" />
            <Kpi label="Lid konversiyasi" value={c.conversion} prev={p.conversion} format="percent" />
          </>
        )}
        <Kpi label="Faol o'quvchilar" value={c.activeStudents} prev={p.activeStudents} format="number" />
        <Kpi label="Yangi o'quvchilar" value={c.newStudents} prev={p.newStudents} format="number" />
        <Kpi label="Tashlab ketganlar" value={c.leftStudents} prev={p.leftStudents} format="number" upIsGood={false} hint={`bitirganlar: ${c.graduated}`} />
        <Kpi label="Davomat" value={c.attendanceRate} prev={p.attendanceRate} format="percent" />
        <Kpi label="O'rtacha baho" value={c.avgGrade} prev={p.avgGrade} format="grade" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {money ? (
          <Panel title="Tushum va xarajat" sub="Oylar kesimida, so'm">
            <LineChart labels={labels(a)} format="money" series={[
              { name: "Tushum", values: a.monthly.map((m) => m.income) },
              { name: "Xarajat", values: a.monthly.map((m) => m.expense) },
            ]} />
          </Panel>
        ) : (
          <Panel title="O'rtacha baho" sub="5 ballik tizim">
            <LineChart labels={labels(a)} format="grade" yMax={5} series={[{ name: "O'rtacha baho", values: a.monthly.map((m) => m.avgGrade) }]} />
          </Panel>
        )}
        <Panel title="O'quvchilar soni" sub="Oy oxiridagi faol o'quvchilar">
          <LineChart area labels={labels(a)} format="number" series={[{ name: "Faol o'quvchilar", values: a.monthly.map((m) => m.activeStudents) }]} />
        </Panel>
        <Panel title="O'quvchilar oqimi" sub="Yangi qo'shilgan, tashlab ketgan va bitirgan o'quvchilar">
          <ColumnChart labels={labels(a)} format="number" series={[
            { name: "Yangi", values: a.monthly.map((m) => m.newStudents) },
            { name: "Tashlab ketgan", values: a.monthly.map((m) => m.leftStudents) },
            { name: "Bitirgan", values: a.monthly.map((m) => m.graduated) },
          ]} />
        </Panel>
        <Panel title="Davomat" sub="Darsga kelganlar ulushi, %">
          <LineChart labels={labels(a)} format="percent" yMax={100} series={[{ name: "Davomat", values: a.monthly.map((m) => m.attendanceRate) }]} />
        </Panel>
      </div>
    </div>
  );
}

function Payments({ a }: { a: Analytics }) {
  const c = a.current, p = a.previous;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="O'qish to'lovlari" value={c.tuition} prev={p.tuition} format="money" />
        <Kpi label="Hisoblangan to'lovlar" value={c.charged} prev={p.charged} format="money" hint="kurs narxi × o'quvchi-oy" />
        <Kpi label="Yig'ilish darajasi" value={c.collectionRate} prev={p.collectionRate} format="percent" />
        <Kpi label="Umumiy qarzdorlik" value={a.payments.debtTotal} format="money" hint={`${a.payments.debtors.length} ta qarzdor (hozirgi holat)`} />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Tushum va hisoblangan to'lov" sub="Kutilgan to'lov qancha qismi yig'ilgani" className="xl:col-span-2">
          <ColumnChart labels={labels(a)} format="money" series={[
            { name: "Hisoblangan", values: a.monthly.map((m) => m.charged) },
            { name: "Tushum", values: a.monthly.map((m) => m.tuition) },
          ]} />
        </Panel>
        <Panel title="To'lov turlari"><BarList format="money" items={a.payments.byMethod} /></Panel>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Kurslar bo'yicha tushum"><BarList format="money" items={a.payments.byCourse} /></Panel>
        <Panel title="Eng katta qarzdorlar" className="xl:col-span-2">
          <table className="table">
            <thead><tr><th>O&apos;quvchi</th><th>Telefon</th><th className="text-right">Qarz</th></tr></thead>
            <tbody>
              {a.payments.debtors.slice(0, 10).map((d) => (
                <tr key={d.id}>
                  <td><Link className="font-medium hover:underline" href={`/students/${d.id}`}>{d.name}</Link></td>
                  <td>{d.phone}</td>
                  <td className="text-right font-semibold tabular-nums">{fmt(d.debt, "money")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {a.payments.debtors.length === 0 && <Empty text="Qarzdorlar yo'q" />}
        </Panel>
      </div>
      <GroupTable a={a} cols={["expected", "collected", "collectionRate"]} title="Guruhlar bo'yicha to'lovlar" />
    </div>
  );
}

function Attendance({ a }: { a: Analytics }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="O'rtacha davomat" value={a.current.attendanceRate} prev={a.previous.attendanceRate} format="percent" />
        <Kpi label="Xavf ostidagi o'quvchilar" value={a.attendance.atRisk.length} format="number" hint="davomati 70% dan past" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Davomat dinamikasi" sub="%" className="xl:col-span-2">
          <LineChart labels={labels(a)} format="percent" yMax={100} series={[{ name: "Davomat", values: a.monthly.map((m) => m.attendanceRate) }]} />
        </Panel>
        <Panel title="Hafta kunlari bo'yicha"><BarList format="percent" max={100} items={a.attendance.byWeekday} /></Panel>
      </div>
      <GroupTable a={a} cols={["attendanceRate", "lessonsMarked"]} title="Guruhlar bo'yicha davomat" />
      <Panel title="Ko'p dars qoldirayotgan o'quvchilar" sub="Davomati 70% dan past (kamida 4 ta belgilangan dars)">
        <StudentTable rows={a.attendance.atRisk.map((s) => ({ id: s.id, name: s.name, cells: [<Rate key="r" v={s.rate} />, `${s.missed} / ${s.marked}`] }))} head={["Davomat", "Qoldirgan / jami"]} />
      </Panel>
    </div>
  );
}

function Grades({ a }: { a: Analytics }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="O'rtacha baho" value={a.current.avgGrade} prev={a.previous.avgGrade} format="grade" />
        <Kpi label="Imtihonlar o'rtachasi" value={a.current.examAvg} prev={a.previous.examAvg} format="percent" />
        <Kpi label="Yordam kerak" value={a.grades.struggling.length} format="number" hint="o'rtacha < 3.5 yoki imtihon < 60%" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="O'rtacha baho dinamikasi" sub="5 ballik tizim" className="xl:col-span-2">
          <LineChart labels={labels(a)} format="grade" yMax={5} series={[{ name: "O'rtacha baho", values: a.monthly.map((m) => m.avgGrade) }]} />
        </Panel>
        <Panel title="Baholar taqsimoti" sub="Qo'yilgan baholar soni">
          <BarList format="number" items={a.grades.distribution.map((d) => ({ ...d, label: `${d.label} baho` }))} />
        </Panel>
      </div>
      <GroupTable a={a} cols={["avgGrade", "examAvg"]} title="Guruhlar bo'yicha o'zlashtirish" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Eng yaxshi o'quvchilar">
          <StudentTable head={["O'rtacha", "Imtihon", "Davomat"]} rows={a.grades.topStudents.map((s) => ({
            id: s.id, name: s.name, cells: [fmt(s.avgGrade, "grade"), <Rate key="e" v={s.examAvg} />, <Rate key="a" v={s.attendance} />],
          }))} />
        </Panel>
        <Panel title="Yordam kerak bo'lgan o'quvchilar">
          <StudentTable head={["O'rtacha", "Imtihon", "Davomat"]} rows={a.grades.struggling.map((s) => ({
            id: s.id, name: s.name, cells: [fmt(s.avgGrade, "grade"), <Rate key="e" v={s.examAvg} />, <Rate key="a" v={s.attendance} />],
          }))} />
        </Panel>
      </div>
    </div>
  );
}

function Teachers({ a, money }: { a: Analytics; money: boolean }) {
  return (
    <div className="space-y-6">
      <Panel title="O'qituvchilar samaradorligi" sub={money ? "Tanlangan davr bo'yicha. Ish haqi ulushi = hisoblangan ish haqi / guruhlaridan tushum" : "Tanlangan davr bo'yicha"}>
        <div className="-mx-5 overflow-x-auto">
          <table className="table">
            <thead><tr>
              <th>O&apos;qituvchi</th><th className="text-right">Guruh</th><th className="text-right">O&apos;quvchi</th><th>Davomat</th>
              <th className="text-right">O&apos;rt. baho</th><th>Imtihon</th><th>Saqlab qolish</th>
              {money && <><th className="text-right">Tushum</th><th className="text-right">Ish haqi</th><th>Ulushi</th></>}
            </tr></thead>
            <tbody>
              {a.teachers.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">{t.name}</td>
                  <td className="text-right tabular-nums">{t.groups}</td>
                  <td className="text-right tabular-nums">{t.students}</td>
                  <td><Rate v={t.attendanceRate} /></td>
                  <td className="text-right tabular-nums">{fmt(t.avgGrade, "grade")}</td>
                  <td><Rate v={t.examAvg} /></td>
                  <td><Rate v={t.retention} good={90} ok={75} /></td>
                  {money && <>
                    <td className="text-right tabular-nums">{fmt(t.collected, "money")}</td>
                    <td className="text-right tabular-nums">{fmt(t.salary, "money")}</td>
                    <td className="tabular-nums">{fmt(t.salaryShare, "percent")}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
          {a.teachers.length === 0 && <Empty text="O'qituvchilar yo'q" />}
        </div>
      </Panel>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {money
          ? <Panel title="Tushum bo'yicha"><BarList format="money" items={a.teachers.map((t) => ({ label: t.name, value: t.collected }))} /></Panel>
          : <Panel title="O'rtacha baho bo'yicha"><BarList format="grade" max={5} items={a.teachers.map((t) => ({ label: t.name, value: t.avgGrade ?? 0 }))} /></Panel>}
        <Panel title="Davomat bo'yicha"><BarList format="percent" max={100} items={a.teachers.map((t) => ({ label: t.name, value: t.attendanceRate ?? 0 }))} /></Panel>
      </div>
    </div>
  );
}

function Leads({ a }: { a: Analytics }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Yangi lidlar" value={a.current.leads} prev={a.previous.leads} format="number" />
        <Kpi label="O'qishga yozilganlar" value={a.current.leadsWon} prev={a.previous.leadsWon} format="number" />
        <Kpi label="Konversiya" value={a.current.conversion} prev={a.previous.conversion} format="percent" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Lidlar va yozilganlar" className="xl:col-span-2">
          <ColumnChart labels={labels(a)} format="number" series={[
            { name: "Lidlar", values: a.monthly.map((m) => m.leads) },
            { name: "Yozildi", values: a.monthly.map((m) => m.leadsWon) },
          ]} />
        </Panel>
        <Panel title="Voronka" sub="Tanlangan davrdagi lidlar holati"><BarList format="number" items={a.leads.funnel} /></Panel>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Manbalar samaradorligi" sub="Qaysi reklama kanali o'quvchi olib keladi" className="xl:col-span-2">
          <table className="table">
            <thead><tr><th>Manba</th><th className="text-right">Lidlar</th><th className="text-right">Yozildi</th><th className="text-right">Rad etdi</th><th>Konversiya</th></tr></thead>
            <tbody>
              {a.leads.sources.map((s) => (
                <tr key={s.source}>
                  <td className="font-medium">{s.source}</td>
                  <td className="text-right tabular-nums">{s.total}</td>
                  <td className="text-right tabular-nums">{s.won}</td>
                  <td className="text-right tabular-nums">{s.lost}</td>
                  <td><Rate v={s.conversion} good={40} ok={20} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {a.leads.sources.length === 0 && <Empty text="Lidlar yo'q" />}
        </Panel>
        <Panel title="Qaysi kurslarga qiziqish bor"><BarList format="number" items={a.leads.courseInterest} /></Panel>
      </div>
      <Panel title="Nima uchun rad etishdi" sub="Rad etgan lidlar sabablari — eng ko'p uchraydigan muammoni hal qiling">
        <BarList format="number" items={a.leads.lostReasons} />
      </Panel>
    </div>
  );
}

function Finance({ a }: { a: Analytics }) {
  const c = a.current, p = a.previous;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Tushum" value={c.income} prev={p.income} format="money" />
        <Kpi label="Xarajat" value={c.expense} prev={p.expense} format="money" upIsGood={false} />
        <Kpi label="Sof foyda" value={c.profit} prev={p.profit} format="money" />
        <Kpi label="Ish haqi / tushum" value={a.finance.salaryShare} format="percent" hint={`ish haqi: ${fmt(a.finance.salaryTotal, "money")}`} />
        <Kpi label="O'qish to'lovlari" value={c.tuition} prev={p.tuition} format="money" />
        <Kpi label="Do'kon savdosi" value={c.shopIncome} prev={p.shopIncome} format="money" hint={`yalpi foyda: ${fmt(c.shopGrossProfit, "money")}`} />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Sof foyda dinamikasi" sub="Tushum − xarajat, so'm" className="xl:col-span-2">
          <LineChart labels={labels(a)} format="money" series={[{ name: "Foyda", values: a.monthly.map((m) => m.profit) }]} />
        </Panel>
        <Panel title="Xarajatlar tarkibi"><BarList format="money" items={a.finance.expenseByCategory} /></Panel>
      </div>
      <Panel title="Oylar kesimida">
        <div className="-mx-5 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Oy</th><th className="text-right">Hisoblangan</th><th className="text-right">O&apos;qish to&apos;lovi</th><th className="text-right">Do&apos;kon</th><th>Yig&apos;ilish</th><th className="text-right">Xarajat</th><th className="text-right">Foyda</th></tr></thead>
            <tbody>
              {a.monthly.map((m) => (
                <tr key={m.key}>
                  <td className="font-medium">{m.label}</td>
                  <td className="text-right tabular-nums">{fmt(m.charged, "money")}</td>
                  <td className="text-right tabular-nums">{fmt(m.tuition, "money")}</td>
                  <td className="text-right tabular-nums">{fmt(m.shopIncome, "money")}</td>
                  <td><Rate v={m.collectionRate} good={95} ok={80} /></td>
                  <td className="text-right tabular-nums">{fmt(m.expense, "money")}</td>
                  <td className={`text-right font-semibold tabular-nums ${m.profit < 0 ? "text-danger" : "text-success"}`}>{fmt(m.profit, "money")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

type GroupCol = "expected" | "collected" | "collectionRate" | "attendanceRate" | "lessonsMarked" | "avgGrade" | "examAvg";
const GROUP_COLS: Record<GroupCol, { label: string; render: (g: Analytics["groups"][number]) => React.ReactNode; right?: boolean }> = {
  expected: { label: "Hisoblangan", render: (g) => fmt(g.expected, "money"), right: true },
  collected: { label: "Tushum", render: (g) => fmt(g.collected, "money"), right: true },
  collectionRate: { label: "Yig'ilish", render: (g) => <Rate v={g.collectionRate} good={95} ok={80} /> },
  attendanceRate: { label: "Davomat", render: (g) => <Rate v={g.attendanceRate} /> },
  lessonsMarked: { label: "Belgilar", render: (g) => g.lessonsMarked, right: true },
  avgGrade: { label: "O'rt. baho", render: (g) => fmt(g.avgGrade, "grade"), right: true },
  examAvg: { label: "Imtihon", render: (g) => <Rate v={g.examAvg} /> },
};

function GroupTable({ a, cols, title }: { a: Analytics; cols: GroupCol[]; title: string }) {
  return (
    <Panel title={title}>
      <div className="-mx-5 overflow-x-auto">
        <table className="table">
          <thead><tr>
            <th>Guruh</th><th>O&apos;qituvchi</th><th className="text-right">O&apos;quvchi</th>
            {cols.map((c) => <th key={c} className={GROUP_COLS[c].right ? "text-right" : ""}>{GROUP_COLS[c].label}</th>)}
          </tr></thead>
          <tbody>
            {a.groups.map((g) => (
              <tr key={g.id}>
                <td><Link href={`/groups/${g.id}`} className="font-medium hover:underline">{g.name}</Link><p className="text-xs text-muted">{g.course}</p></td>
                <td>{g.teacher}</td>
                <td className="text-right tabular-nums">{g.students}</td>
                {cols.map((c) => <td key={c} className={GROUP_COLS[c].right ? "text-right tabular-nums" : ""}>{GROUP_COLS[c].render(g)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {a.groups.length === 0 && <Empty text="Guruhlar yo'q" />}
      </div>
    </Panel>
  );
}

function StudentTable({ head, rows }: { head: string[]; rows: { id: number; name: string; cells: React.ReactNode[] }[] }) {
  if (!rows.length) return <Empty text="Bunday o'quvchilar yo'q" />;
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="table">
        <thead><tr><th>O&apos;quvchi</th>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><Link href={`/students/${r.id}`} className="font-medium hover:underline">{r.name}</Link></td>
              {r.cells.map((c, i) => <td key={i} className="tabular-nums">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
