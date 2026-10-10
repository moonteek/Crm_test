import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/access";
import { date, EXPENSE_CATEGORIES, isoDate, money, MONTHS } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { Empty, Field, PageHeader, SubmitRow } from "@/components/ui";
import { createExpense, deleteExpense } from "../actions";

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ y?: string }> }) {
  const user = await requirePage("finance.view");
  const manage = can(user, "finance.manage");
  const year = Number((await searchParams).y) || new Date().getFullYear();
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);

  const [tuition, shop, expenses] = await Promise.all([
    db.payment.findMany({ where: { date: { gte: from, lt: to } }, select: { amount: true, date: true } }),
    db.sale.findMany({ where: { date: { gte: from, lt: to } }, select: { total: true, date: true } }),
    db.expense.findMany({ where: { date: { gte: from, lt: to } }, include: { salaryPayment: true }, orderBy: { date: "desc" } }),
  ]);

  // income = tuition payments + shop sales
  const payments = [...tuition, ...shop.map((s) => ({ amount: s.total, date: s.date }))];
  const rows = MONTHS.map((name, i) => {
    const income = payments.filter((p) => p.date.getMonth() === i).reduce((s, p) => s + p.amount, 0);
    const expense = expenses.filter((e) => e.date.getMonth() === i).reduce((s, e) => s + e.amount, 0);
    return { name, income, expense };
  });
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]));
  const totalIn = rows.reduce((s, r) => s + r.income, 0);
  const totalOut = rows.reduce((s, r) => s + r.expense, 0);

  return (
    <>
      <PageHeader title="Moliya" subtitle="Tushum, xarajat va foyda">
        <div className="flex items-center gap-2">
          <Link href={`/finance?y=${year - 1}`} className="btn-secondary px-2"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="w-16 text-center font-mono font-medium">{year}</span>
          <Link href={`/finance?y=${year + 1}`} className="btn-secondary px-2"><ChevronRight className="h-4 w-4" /></Link>
        </div>
        {manage && <Modal title="Yangi xarajat" trigger={<><Plus className="h-4 w-4" /> Xarajat qo&apos;shish</>}>
          <form action={createExpense} className="space-y-3">
            <Field label="Nomi"><input name="title" className="input" required placeholder="Oktabr ijarasi" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Summa"><input name="amount" type="number" min={1} className="input" required /></Field>
              <Field label="Turkum">
                <select name="category" className="input">
                  {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Sana"><input name="date" type="date" className="input" defaultValue={isoDate(new Date())} /></Field>
            <SubmitRow />
          </form>
        </Modal>}
      </PageHeader>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3 md:mb-6 md:gap-4">
        <div className="card p-5"><p className="label-mono">Yillik tushum</p><p className="mt-2 text-xl font-semibold tracking-tight text-success">{money(totalIn)}</p></div>
        <div className="card p-5"><p className="label-mono">Yillik xarajat</p><p className="mt-2 text-xl font-semibold tracking-tight text-danger">{money(totalOut)}</p></div>
        <div className="card p-5"><p className="label-mono">Sof foyda</p><p className={`mt-2 text-xl font-semibold tracking-tight ${totalIn - totalOut < 0 ? "text-danger" : "text-ink"}`}>{money(totalIn - totalOut)}</p></div>
      </div>

      <div className="card mb-4 p-4 md:mb-6 md:p-5">
        <div className="mb-4 flex items-center gap-4 text-sm">
          <h2 className="mr-auto font-semibold">Oylar kesimida</h2>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ink" />Tushum</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-accent" />Xarajat</span>
        </div>
        <div className="flex h-56 items-end gap-2 overflow-x-auto">
          {rows.map((r) => (
            <div key={r.name} className="flex min-w-10 flex-1 flex-col items-center gap-1">
              <div className="flex h-48 w-full items-end justify-center gap-0.5">
                <div className="w-1/2 max-w-4 rounded-full bg-ink transition-[height] duration-500 ease-smooth" style={{ height: `${(r.income / max) * 100}%` }} title={`Tushum: ${money(r.income)}`} />
                <div className="w-1/2 max-w-4 rounded-full bg-accent transition-[height] duration-500 ease-smooth" style={{ height: `${(r.expense / max) * 100}%` }} title={`Xarajat: ${money(r.expense)}`} />
              </div>
              <span className="label-mono">{r.name.slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card md:overflow-x-auto">
        <h2 className="px-5 py-4 font-semibold">Xarajatlar</h2>
        <table className="table table-stack">
          <thead><tr><th>Sana</th><th>Nomi</th><th>Turkum</th><th>Summa</th>{manage && <th></th>}</tr></thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td data-label="Sana" className="text-muted">{date(e.date)}</td>
                <td className="font-medium max-md:order-first max-md:text-base">{e.title}</td>
                <td data-label="Turkum"><span className="badge bg-ink/5 text-muted">{EXPENSE_CATEGORIES[e.category]}</span></td>
                <td data-label="Summa" className="font-semibold text-danger">{money(e.amount)}</td>
                {manage && (
                  <td>
                    {!e.salaryPayment && <form action={deleteExpense.bind(null, e.id)}>
                      <button className="text-faint hover:text-danger" aria-label="O'chirish"><Trash2 className="h-4 w-4" /></button>
                    </form>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {expenses.length === 0 && <Empty text="Xarajatlar yo'q" />}
      </div>
    </>
  );
}
