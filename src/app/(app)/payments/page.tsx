import Link from "next/link";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can, studentScope } from "@/lib/access";
import { date, money, MONTHS, PAYMENT_METHODS } from "@/lib/format";
import { Empty, PageHeader } from "@/components/ui";
import { deletePayment } from "../actions";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ m?: string; method?: string }> }) {
  const user = await requirePage("payments.view");
  const { m, method } = await searchParams;
  const now = new Date();
  const [year, month] = m ? [Number(m.split("-")[0]), Number(m.split("-")[1]) - 1] : [now.getFullYear(), now.getMonth()];
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1);

  const [payments] = await Promise.all([
    db.payment.findMany({
      where: { date: { gte: from, lt: to }, ...(method ? { method } : {}), student: studentScope(user) },
      include: { student: true, group: true },
      orderBy: { date: "desc" },
    }),
  ]);
  const total = payments.reduce((s, p) => s + p.amount, 0);
  const byMethod = Object.keys(PAYMENT_METHODS).map((k) => ({
    k, sum: payments.filter((p) => p.method === k).reduce((s, p) => s + p.amount, 0),
  }));
  const ym = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}`;
  const q = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const all = { m: ym(from), method, ...extra };
    Object.entries(all).forEach(([k, v]) => v && p.set(k, v));
    return `/payments?${p}`;
  };

  return (
    <>
      <PageHeader title="To'lovlar" subtitle="To'lovlar o'quvchi sahifasidan qabul qilinadi">
        <div className="flex items-center gap-2">
          <Link href={q({ m: ym(new Date(year, month - 1, 1)) })} className="btn-secondary px-2"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="w-32 text-center text-sm font-medium">{MONTHS[month]} {year}</span>
          <Link href={q({ m: ym(new Date(year, month + 1, 1)) })} className="btn-secondary px-2"><ChevronRight className="h-4 w-4" /></Link>
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Link href={q({ method: undefined })} className={`card p-4 ${!method ? "ring-2 ring-brand-500" : ""}`}>
          <p className="text-sm text-slate-500">Jami</p>
          <p className="text-lg font-bold text-emerald-600">{money(total)}</p>
        </Link>
        {byMethod.map(({ k, sum }) => (
          <Link key={k} href={q({ method: k })} className={`card p-4 ${method === k ? "ring-2 ring-brand-500" : ""}`}>
            <p className="text-sm text-slate-500">{PAYMENT_METHODS[k]}</p>
            <p className="text-lg font-bold">{money(sum)}</p>
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Sana</th><th>O&apos;quvchi</th><th>Guruh</th><th>Summa</th><th>Turi</th><th>Izoh</th>{can(user, "payments.delete") && <th></th>}</tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{date(p.date)}</td>
                <td><Link href={`/students/${p.studentId}`} className="font-medium hover:text-brand-600">{p.student.name}</Link></td>
                <td>{p.group?.name ?? "—"}</td>
                <td className="font-semibold text-emerald-600">{money(p.amount)}</td>
                <td>{PAYMENT_METHODS[p.method]}</td>
                <td className="text-slate-500">{p.note ?? ""}</td>
                {can(user, "payments.delete") && (
                  <td>
                    <form action={deletePayment.bind(null, p.id)}>
                      <button className="text-slate-400 hover:text-rose-600" aria-label="O'chirish"><Trash2 className="h-4 w-4" /></button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && <Empty text="Bu oyda to'lovlar yo'q" />}
      </div>
    </>
  );
}
