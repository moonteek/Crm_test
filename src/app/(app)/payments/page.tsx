import Link from "next/link";
import { Search, Trash2, ReceiptText } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can, groupScope } from "@/lib/access";
import { date, money, MONTHS, PAYMENT_METHODS } from "@/lib/format";
import { Empty, PageHeader } from "@/components/ui";
import { ExportButtons } from "@/components/ExportButtons";
import { PaymentEditDialog } from "@/components/PaymentEditDialog";
import { redirect } from "next/navigation";
import { receiptDataFor } from "@/lib/receipt-db";
import { loadPayments } from "@/lib/lists/payments";
import { deletePayment } from "../actions";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthLabel = (d: Date | null) => (d ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : "—");
const stamp = (d: Date) => `${date(d)} ${d.toLocaleTimeString("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" })}`;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage("payments.view");
  const params = await searchParams;
  // "Chek №": open that payment's receipt, if it exists and this user may see it
  const lookup = params.chek?.trim();
  if (lookup) {
    const found = /^\d+$/.test(lookup) ? await receiptDataFor(user, Number(lookup)) : null;
    if (found) redirect(`/payments/${found.id}/receipt`);
  }
  const [{ filters: f, payments, total }, groups, teachers, staff] = await Promise.all([
    loadPayments(user, params),
    db.group.findMany({ where: groupScope(user), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { isTeacher: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { takenPayments: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const byMethod = Object.keys(PAYMENT_METHODS).map((k) => ({ k, sum: payments.filter((p) => p.method === k).reduce((s, p) => s + p.amount, 0) }));
  // keeps every filter and changes one
  const link = (change: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string"));
    for (const [k, v] of Object.entries(change)) if (v) q.set(k, v); else q.delete(k);
    return `/payments?${q}`;
  };
  const allow = { edit: can(user, "payments.edit"), remove: can(user, "payments.delete") };
  const filtered = Boolean(params.from || params.to || f.q || f.groupId || f.teacherId || f.userId || f.method);

  return (
    <>
      <PageHeader title="To'lovlar" subtitle={`Jami: ${money(total)} / ${payments.length} ta`}>
        <ExportButtons href="/payments/export" />
      </PageHeader>

      <form className="mb-3 flex max-w-sm items-center gap-2" aria-label="Chekni topish">
        <div className="relative flex-1">
          <ReceiptText className="absolute top-3 left-3.5 h-4 w-4 text-faint" />
          <input name="chek" inputMode="numeric" defaultValue={lookup} placeholder="Chek № (masalan 1234)" className="input pl-10" aria-label="Chek raqami" />
        </div>
        <button className="btn-secondary">Ochish</button>
      </form>
      {lookup && <p className="mb-3 rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">Chek topilmadi: № {lookup}</p>}

      <form className="card mb-4 grid grid-cols-2 gap-2 p-4 md:grid-cols-4 xl:grid-cols-8" aria-label="Filtrlar">
        <label className="text-xs text-muted">Dan<input type="date" name="from" defaultValue={iso(f.from)} className="input mt-1" /></label>
        <label className="text-xs text-muted">Gacha<input type="date" name="to" defaultValue={iso(f.to)} className="input mt-1" /></label>
        <div className="relative col-span-2 self-end">
          <Search className="absolute top-3 left-3.5 h-4 w-4 text-faint" />
          <input name="q" defaultValue={f.q} placeholder="O'quvchi ismi..." className="input pl-10" aria-label="O'quvchi ismi" />
        </div>
        <select name="group" defaultValue={f.groupId ?? ""} className="input min-w-0 self-end" aria-label="Guruh">
          <option value="">Barcha guruhlar</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select name="teacher" defaultValue={f.teacherId ?? ""} className="input min-w-0 self-end" aria-label="O'qituvchi">
          <option value="">Barcha o&apos;qituvchilar</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select name="hodim" defaultValue={f.userId ?? ""} className="input min-w-0 self-end" aria-label="Hodim">
          <option value="">Barcha hodimlar</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex gap-2 self-end">
          {f.method && <input type="hidden" name="method" value={f.method} />}
          <button className="btn-secondary flex-1">Filtrlash</button>
          {filtered && <Link href="/payments" className="btn-ghost px-2">Tozalash</Link>}
        </div>
      </form>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 md:mb-6 md:gap-4">
        <Link href={link({ method: undefined })} className={`card press block min-w-0 p-4 ${!f.method ? "border-ink" : "hover:border-line-strong"}`}>
          <p className="label-mono">Jami</p>
          <p className="mt-2 truncate text-lg font-semibold text-success">{money(f.method ? byMethod.reduce((s, m) => s + m.sum, 0) : total)}</p>
        </Link>
        {byMethod.map(({ k, sum }) => (
          <Link key={k} href={link({ method: k })} className={`card press block min-w-0 p-4 ${f.method === k ? "border-ink" : "hover:border-line-strong"}`}>
            <p className="label-mono">{PAYMENT_METHODS[k]}</p>
            <p className="mt-2 truncate text-lg font-semibold">{money(sum)}</p>
          </Link>
        ))}
      </div>

      <div className="card md:overflow-x-auto">
        <table className="table table-stack">
          <thead><tr><th>Sana</th><th>O&apos;quvchi</th><th>Guruh</th><th>Summa</th><th>Turi</th><th>Qaysi oy</th><th>Hodim</th><th>Izoh</th><th></th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td data-label="Sana" className="text-muted">{date(p.date)}</td>
                <td className="max-md:order-first max-md:text-base"><Link href={`/students/${p.studentId}`} className="font-medium hover:underline">{p.student.name}</Link></td>
                <td data-label="Guruh">{p.group?.name ?? "—"}</td>
                <td data-label="Summa" className="font-semibold text-success">{money(p.amount)}</td>
                <td data-label="Turi">{PAYMENT_METHODS[p.method]}</td>
                <td data-label="Qaysi oy" className="text-muted">{monthLabel(p.month)}</td>
                <td data-label="Hodim" className="whitespace-normal">
                  {p.user?.name ?? "—"}
                  {p.history.map((h, i) => (
                    <p key={i} className="text-xs text-muted">{h.who} · {stamp(h.at)}: {h.text}</p>
                  ))}
                </td>
                <td data-label="Izoh" className="text-muted">{p.note ?? ""}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <Link href={`/payments/${p.id}/receipt`} target="_blank" className="text-faint hover:text-ink" title={`Chek № ${p.id}`} aria-label={`Chek № ${p.id}`}><ReceiptText className="h-4 w-4" /></Link>
                    {allow.edit && (
                      <PaymentEditDialog payment={{ id: p.id, amount: p.amount, method: p.method, date: iso(p.date), month: p.month ? iso(p.month).slice(0, 7) : null, note: p.note, student: p.student.name }} />
                    )}
                    {allow.remove && (
                      <form action={deletePayment.bind(null, p.id)}>
                        <button className="text-faint hover:text-danger" aria-label="O'chirish"><Trash2 className="h-4 w-4" /></button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && <Empty text="Bu davrda to'lovlar yo'q" />}
      </div>
    </>
  );
}
