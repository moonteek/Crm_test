import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/access";
import { date, isoDate, money, MONTHS } from "@/lib/format";
import { currentMonth, SALARY_TYPES, salariesForMonth } from "@/lib/salary";
import { Modal } from "@/components/Modal";
import { Empty, Field, PageHeader, SubmitRow } from "@/components/ui";
import { deleteSalaryPayment, paySalary, updateSalaryRule } from "../actions";

function shift(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return currentMonth(new Date(y, m - 1 + delta, 1));
}

export default async function SalariesPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await requirePage("salaries.view");
  const manage = can(user, "salaries.manage");
  const raw = (await searchParams).m;
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : currentMonth();
  const [y, mm] = month.split("-").map(Number);

  const [rows, payouts] = await Promise.all([
    salariesForMonth(month, { allActive: true }),
    db.salaryPayment.findMany({ where: { month }, include: { user: true }, orderBy: { date: "desc" } }),
  ]);
  const total = (k: "accrued" | "paid" | "remaining") => rows.reduce((s, r) => s + r[k], 0);

  return (
    <>
      <PageHeader title="Ish haqi" subtitle="Hisoblangan, to'langan va qolgan ish haqi">
        <div className="flex items-center gap-2">
          <Link href={`/salaries?m=${shift(month, -1)}`} className="btn-secondary px-2"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="w-32 text-center text-sm font-medium">{MONTHS[mm - 1]} {y}</span>
          <Link href={`/salaries?m=${shift(month, 1)}`} className="btn-secondary px-2"><ChevronRight className="h-4 w-4" /></Link>
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-sm text-slate-500">Hisoblangan</p><p className="text-xl font-bold">{money(total("accrued"))}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">To&apos;langan</p><p className="text-xl font-bold text-emerald-600">{money(total("paid"))}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Qolgan</p><p className="text-xl font-bold text-rose-600">{money(total("remaining"))}</p></div>
      </div>

      <div className="card mb-6 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Xodim</th><th>Qoida</th><th>Asos</th><th>Hisoblangan</th><th>To&apos;langan</th><th>Qolgan</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId}>
                <td><p className="font-medium">{r.name}</p><p className="text-xs text-slate-500">{r.roleName}</p></td>
                <td>
                  <div className="flex items-center gap-2">
                    <span>
                      {SALARY_TYPES[r.salaryType].label}
                      {r.salaryType !== "NONE" && (
                        <span className="block text-xs text-slate-500">
                          {r.salaryType === "PERCENT" ? `${r.salaryAmount}%` : money(r.salaryAmount)} {r.salaryType === "PER_STUDENT" ? "/ o'quvchi" : r.salaryType === "FIXED" ? "/ oy" : ""}
                        </span>
                      )}
                    </span>
                    {manage && (
                      <Modal title={`Ish haqi qoidasi — ${r.name}`} triggerClassName="text-slate-400 hover:text-brand-600" trigger={<Pencil className="h-4 w-4" />}>
                        <form action={updateSalaryRule.bind(null, r.userId)} className="space-y-3">
                          <Field label="Turi">
                            <select name="salaryType" className="input" defaultValue={r.salaryType}>
                              {Object.entries(SALARY_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                          </Field>
                          <Field label="Qiymati (oylik so'm / foiz / bir o'quvchi uchun so'm)">
                            <input name="salaryAmount" type="number" min={0} className="input" defaultValue={r.salaryAmount} />
                          </Field>
                          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
                            <li><b>Oylik</b> — har oy belgilangan summa.</li>
                            <li><b>Tushumdan foiz</b> — o&apos;qituvchi guruhlaridan shu oyda tushgan to&apos;lovlarning foizi.</li>
                            <li><b>Har bir o&apos;quvchi uchun</b> — shu oyda guruhlarida o&apos;qigan har bir o&apos;quvchi uchun summa.</li>
                          </ul>
                          <SubmitRow />
                        </form>
                      </Modal>
                    )}
                  </div>
                </td>
                <td className="text-slate-500">
                  {r.salaryType === "PERCENT" ? `${money(r.base)} tushum` : r.salaryType === "PER_STUDENT" ? `${r.base} o'quvchi` : "—"}
                </td>
                <td className="font-semibold">{money(r.accrued)}</td>
                <td className="text-emerald-600">{money(r.paid)}</td>
                <td className={r.remaining > 0 ? "font-semibold text-rose-600" : "text-slate-400"}>{money(r.remaining)}</td>
                <td>
                  {manage && r.salaryType !== "NONE" && (
                    <Modal title={`Ish haqi to'lash — ${r.name}`} triggerClassName="text-sm text-brand-600 hover:underline" trigger="To'lash">
                      <form action={paySalary} className="space-y-3">
                        <input type="hidden" name="userId" value={r.userId} />
                        <input type="hidden" name="month" value={month} />
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Summa"><input name="amount" type="number" min={1} className="input" required defaultValue={r.remaining || undefined} /></Field>
                          <Field label="Sana"><input name="date" type="date" className="input" defaultValue={isoDate(new Date())} /></Field>
                        </div>
                        <Field label="Izoh"><input name="note" className="input" placeholder="Avans, bonus..." /></Field>
                        <p className="text-xs text-slate-500">To&apos;lov Moliya bo&apos;limiga &quot;Ish haqi&quot; xarajati sifatida avtomatik yoziladi.</p>
                        <SubmitRow text="To'lash" />
                      </form>
                    </Modal>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty text="Xodimlar yo'q" />}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="px-5 py-4 font-semibold">{MONTHS[mm - 1]} uchun to&apos;lovlar</h2>
        <table className="table">
          <thead><tr><th>Sana</th><th>Xodim</th><th>Summa</th><th>Izoh</th>{manage && <th></th>}</tr></thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id}>
                <td>{date(p.date)}</td>
                <td className="font-medium">{p.user.name}</td>
                <td className="font-semibold">{money(p.amount)}</td>
                <td className="text-slate-500">{p.note ?? ""}</td>
                {manage && (
                  <td>
                    <form action={deleteSalaryPayment.bind(null, p.id)}>
                      <button className="text-slate-400 hover:text-rose-600" aria-label="Bekor qilish"><Trash2 className="h-4 w-4" /></button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {payouts.length === 0 && <Empty text="Bu oy uchun to'lov qilinmagan" />}
      </div>
    </>
  );
}
