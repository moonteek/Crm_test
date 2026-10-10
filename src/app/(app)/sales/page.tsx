import Link from "next/link";
import { ChevronLeft, ChevronRight, Copy, Target, Trophy } from "lucide-react";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/access";
import { KPI_METRICS, MONTHS } from "@/lib/format";
import { currentMonth, shiftMonth } from "@/lib/month";
import { salesStats, type SellerStats } from "@/lib/sales";
import { fmt } from "@/components/charts/format";
import { BarList } from "@/components/charts/BarList";
import { Modal } from "@/components/Modal";
import { Empty, PageHeader, SubmitRow } from "@/components/ui";
import { copyKpiFromPrevious, saveKpiTargets } from "../actions";

const metricValue = (metric: string, v: number) => (metric === "REVENUE" ? fmt(v, "money") : metric === "CONVERSION" ? `${v}%` : `${v} ta`);

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await requirePage("sales.view");
  const own = can(user, "leads.own");
  const manage = can(user, "sales.manage");
  const raw = (await searchParams).m;
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : currentMonth();
  const [y, mm] = month.split("-").map(Number);
  const rows = await salesStats(month, own ? user.id : undefined);
  const total = (k: keyof SellerStats) => rows.reduce((s, r) => s + (r[k] as number), 0);

  return (
    <>
      <PageHeader title={own ? "Mening natijalarim" : "Sotuv"} subtitle="Sotuvchilar natijalari, KPI va bonuslar">
        <div className="flex items-center gap-2">
          <Link href={`/sales?m=${shiftMonth(month, -1)}`} className="btn-secondary px-2"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="w-32 text-center text-sm font-medium">{MONTHS[mm - 1]} {y}</span>
          <Link href={`/sales?m=${shiftMonth(month, 1)}`} className="btn-secondary px-2"><ChevronRight className="h-4 w-4" /></Link>
        </div>
        {manage && (
          <form action={copyKpiFromPrevious.bind(null, month)}>
            <button className="btn-secondary"><Copy className="h-4 w-4" /> O&apos;tgan oy KPI sini ko&apos;chirish</button>
          </form>
        )}
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Tile label="Yangi lidlar" value={total("newLeads")} />
        <Tile label="Qo'ng'iroqlar" value={total("calls")} />
        <Tile label="Sinov darsiga" value={total("trials")} />
        <Tile label="O'qishga yozildi" value={total("won")} />
        <Tile label="Birinchi to'lovlar" value={fmt(total("revenue"), "money")} />
      </div>

      {!own && rows.length > 0 && (
        <div className="card mb-6 overflow-x-auto">
          <div className="flex items-center gap-2 px-5 py-4"><Trophy className="h-5 w-5 text-amber-500" /><h2 className="font-semibold">Reyting</h2></div>
          <table className="table">
            <thead><tr>
              <th>#</th><th>Sotuvchi</th><th className="text-right">Yangi lid</th><th className="text-right">Ochiq</th><th className="text-right">Kechikkan</th>
              <th className="text-right">Qo&apos;ng&apos;iroq</th><th className="text-right">Sinov</th><th className="text-right">Yozildi</th>
              <th className="text-right">Konversiya</th><th className="text-right">1-to&apos;lovlar</th><th className="text-right">Bonus</th>
            </tr></thead>
            <tbody>
              {[...rows].sort((a, b) => b.won - a.won || b.revenue - a.revenue).map((r, i) => (
                <tr key={r.userId}>
                  <td className="text-slate-400">{i + 1}</td>
                  <td className="font-medium"><Link href={`/leads?u=${r.userId}`} className="hover:text-brand-600">{r.name}</Link></td>
                  <td className="text-right tabular-nums">{r.newLeads}</td>
                  <td className="text-right tabular-nums">{r.openLeads}</td>
                  <td className={`text-right tabular-nums ${r.overdue ? "font-semibold text-rose-600" : ""}`}>{r.overdue}</td>
                  <td className="text-right tabular-nums">{r.calls}</td>
                  <td className="text-right tabular-nums">{r.trials}</td>
                  <td className="text-right font-semibold tabular-nums">{r.won}</td>
                  <td className="text-right tabular-nums">{fmt(r.conversion, "percent")}</td>
                  <td className="text-right tabular-nums">{fmt(r.revenue, "money")}</td>
                  <td className="text-right font-semibold tabular-nums text-emerald-700">{fmt(r.bonus, "money")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {rows.map((r) => (
          <div key={r.userId} className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">{r.name}</h3>
                <p className="text-sm text-slate-500">Bu oy bonus: <span className="font-semibold text-emerald-700">{fmt(r.bonus, "money")}</span></p>
              </div>
              {manage && (
                <Modal wide title={`KPI — ${r.name} (${MONTHS[mm - 1]} ${y})`} triggerClassName="btn-secondary" trigger={<><Target className="h-4 w-4" /> KPI</>}>
                  <form action={saveKpiTargets.bind(null, r.userId, month)} className="space-y-3">
                    <p className="text-xs text-slate-500">Maqsad 0 bo&apos;lsa, o&apos;sha ko&apos;rsatkich o&apos;chiriladi. Bonus maqsadga yetganda beriladi; &quot;har bir ortiqcha uchun&quot; — maqsaddan oshgan har bir birlik uchun qo&apos;shimcha.</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs text-slate-500"><th className="py-1 pr-2">Ko&apos;rsatkich</th><th className="px-1">Maqsad</th><th className="px-1">Bonus (so&apos;m)</th><th className="px-1">Har bir ortiqcha uchun</th></tr></thead>
                        <tbody>
                          {Object.entries(KPI_METRICS).map(([k, m]) => {
                            const cur = r.kpis.find((x) => x.metric === k);
                            return (
                              <tr key={k}>
                                <td className="py-1 pr-2">{m.label} <span className="text-xs text-slate-400">({m.unit})</span></td>
                                <td className="px-1"><input name={`target_${k}`} type="number" min={0} className="input" defaultValue={cur?.target ?? 0} /></td>
                                <td className="px-1"><input name={`bonus_${k}`} type="number" min={0} className="input" defaultValue={cur?.bonus ?? 0} /></td>
                                <td className="px-1"><input name={`extra_${k}`} type="number" min={0} className="input" defaultValue={cur?.perExtra ?? 0} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <SubmitRow />
                  </form>
                </Modal>
              )}
            </div>
            <div className="mt-4 space-y-4">
              {r.kpis.length === 0 && <p className="text-sm text-slate-400">Bu oy uchun KPI belgilanmagan</p>}
              {r.kpis.map((k) => {
                const done = k.achieved >= k.target;
                return (
                  <div key={k.metric}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span>{KPI_METRICS[k.metric].label}</span>
                      <span className="tabular-nums"><b>{metricValue(k.metric, k.achieved)}</b> / {metricValue(k.metric, k.target)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-brand-100">
                      <div className={`h-2 rounded-full ${done ? "bg-emerald-500" : "bg-brand-500"}`} style={{ width: `${Math.min(100, k.progress)}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {done ? <span className="text-emerald-700">✓ Bajarildi — bonus {fmt(k.earned, "money")}</span> : <>Bonus: {fmt(k.bonus, "money")}{k.perExtra ? ` + ${fmt(k.perExtra, "money")} har bir ortiqcha uchun` : ""} · {Math.round(k.progress)}%</>}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center text-sm">
              <div><p className="text-lg font-semibold">{r.won}</p><p className="text-xs text-slate-500">yozildi</p></div>
              <div><p className="text-lg font-semibold">{r.calls}</p><p className="text-xs text-slate-500">qo&apos;ng&apos;iroq</p></div>
              <div><p className={`text-lg font-semibold ${r.overdue ? "text-rose-600" : ""}`}>{r.overdue}</p><p className="text-xs text-slate-500">kechikkan</p></div>
            </div>
          </div>
        ))}
      </div>
      {rows.length === 0 && (
        <div className="card"><Empty text="Sotuvchilar yo'q. Sozlamalar → Xodimlar bo'limida xodimga “Sotuvchi” belgisini qo'ying." /></div>
      )}
      {!own && rows.length > 1 && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="card p-5"><h2 className="mb-3 font-semibold">O&apos;qishga yozganlar</h2><BarList format="number" items={rows.map((r) => ({ label: r.name, value: r.won }))} /></div>
          <div className="card p-5"><h2 className="mb-3 font-semibold">Birinchi to&apos;lovlar</h2><BarList format="money" items={rows.map((r) => ({ label: r.name, value: r.revenue }))} /></div>
        </div>
      )}
    </>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
