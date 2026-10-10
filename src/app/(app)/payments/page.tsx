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
          <span className="w-32 text-center text-sm font-medium tabular-nums">{MONTHS[month]} {year}</span>
          <Link href={q({ m: ym(new Date(year, month + 1, 1)) })} className="btn-secondary px-2"><ChevronRight className="h-4 w-4" /></Link>
        </div>
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 md:mb-6 md:gap-4">
        <Link href={q({ method: undefined })} className={`card press block min-w-0 p-4 ${!method ? "border-ink" : "hover:border-line-strong"}`}>
          <p className="label-mono">Jami</p>
          <p className="mt-2 truncate text-lg font-semibold text-success">{money(total)}</p>
        </Link>
        {byMethod.map(({ k, sum }) => (
          <Link key={k} href={q({ method: k })} className={`card press block min-w-0 p-4 ${method === k ? "border-ink" : "hover:border-line-strong"}`}>
            <p className="label-mono">{PAYMENT_METHODS[k]}</p>
            <p className="mt-2 truncate text-lg font-semibold">{money(sum)}</p>
          </Link>
        ))}
      </div>

      <div className="card md:overflow-x-auto">
        <table className="table table-stack">
          <thead><tr><th>Sana</th><th>O&apos;quvchi</th><th>Guruh</th><th>Summa</th><th>Turi</th><th>Izoh</th>{can(user, "payments.delete") && <th></th>}</tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td data-label="Sana" className="text-muted">{date(p.date)}</td>
                <td className="max-md:order-first max-md:text-base"><Link href={`/students/${p.studentId}`} className="font-medium hover:underline">{p.student.name}</Link></td>
                <td data-label="Guruh">{p.group?.name ?? "—"}</td>
                <td data-label="Summa" className="font-semibold text-success">{money(p.amount)}</td>
                <td data-label="Turi">{PAYMENT_METHODS[p.method]}</td>
                <td data-label="Izoh" className="text-muted">{p.note ?? ""}</td>
                {can(user, "payments.delete") && (
                  <td>
                    <form action={deletePayment.bind(null, p.id)}>
                      <button className="text-faint hover:text-danger" aria-label="O'chirish"><Trash2 className="h-4 w-4" /></button>
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
