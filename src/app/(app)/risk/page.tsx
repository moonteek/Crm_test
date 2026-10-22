import Link from "next/link";
import { Phone } from "lucide-react";
import { requirePage } from "@/lib/auth";
import { loadRisk } from "@/lib/lists/risk";
import { CONTACT_RESULTS, RISK_KINDS } from "@/lib/risk";
import { date } from "@/lib/format";
import { ExportButtons } from "@/components/ExportButtons";
import { Modal } from "@/components/Modal";
import { RiskContactForm } from "@/components/RiskContactForm";
import { Empty, PageHeader, Segmented } from "@/components/ui";

type Params = { tab?: string; group?: string; teacher?: string; kind?: string };

export default async function RiskPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePage("risk.view");
  const params = await searchParams;
  const tab = params.tab === "done" || params.tab === "all" ? params.tab : "open";
  const { rows, counts, groups, teachers } = await loadRisk(params);
  const filtered = Boolean(params.group || params.teacher || (params.kind && params.kind in RISK_KINDS));
  const href = (t: string) => {
    const q = new URLSearchParams(Object.entries({ ...params, tab: t }).filter(([, v]) => v) as [string, string][]);
    return `/risk?${q}`;
  };

  return (
    <>
      <PageHeader title="Xavfli o'quvchilar" subtitle="Darsga kelmay qo'ygan, davomati yoki bahosi tushgan, daraja imtihonidan o'tmagan o'quvchilar">
        <ExportButtons href="/risk/export" />
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Segmented
          options={[
            { href: href("open"), label: `Bog'lanilmagan · ${counts.open}`, active: tab === "open" },
            { href: href("done"), label: `Bog'lanilgan · ${counts.done}`, active: tab === "done" },
            { href: href("all"), label: `Hammasi · ${counts.all}`, active: tab === "all" },
          ]}
        />
        <form className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="tab" value={tab} />
          <select name="group" defaultValue={params.group ?? ""} className="input w-auto" aria-label="Guruh">
            <option value="">Barcha guruhlar</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select name="teacher" defaultValue={params.teacher ?? ""} className="input w-auto" aria-label="O'qituvchi">
            <option value="">Barcha o&apos;qituvchilar</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select name="kind" defaultValue={params.kind ?? ""} className="input w-auto" aria-label="Sabab">
            <option value="">Barcha sabablar</option>
            {Object.entries(RISK_KINDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <button className="btn-secondary">Ko&apos;rsatish</button>
          {filtered && <Link href={`/risk?tab=${tab}`} className="btn-ghost">Tozalash</Link>}
        </form>
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.student.id} className="card flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between md:p-5">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link href={`/students/${r.student.id}`} className="font-semibold hover:underline">{r.student.name}</Link>
                <a href={`tel:${r.student.phone}`} className="flex items-center gap-1 font-mono text-sm text-muted hover:underline"><Phone className="h-3.5 w-3.5" />{r.student.phone}</a>
                {r.student.fatherPhone && <a href={`tel:${r.student.fatherPhone}`} className="font-mono text-sm text-muted hover:underline">otasi: {r.student.fatherPhone}</a>}
                {r.student.motherPhone && <a href={`tel:${r.student.motherPhone}`} className="font-mono text-sm text-muted hover:underline">onasi: {r.student.motherPhone}</a>}
              </div>
              {r.groups.map((g) => (
                <div key={g.id} className="flex flex-wrap items-center gap-1.5 text-sm">
                  <Link href={`/groups/${g.id}`} className="font-medium hover:underline">{g.name}</Link>
                  <span className="text-muted">· {g.teacher ?? "o'qituvchisiz"}</span>
                  {g.reasons.map((x) => <span key={x.label} className="badge bg-danger-tint text-danger">{x.label}</span>)}
                </div>
              ))}
              <p className="text-sm text-muted">
                {r.contact ? (
                  <>
                    Oxirgi aloqa: {date(r.contact.at)} · {r.contact.who ?? "—"} · <span className="font-medium text-ink">{CONTACT_RESULTS[r.contact.result] ?? r.contact.result}</span>
                    {r.contact.comment && <span className="block">{r.contact.comment}</span>}
                    {!r.contacted && <span className="block text-warning">Qo&apos;ng&apos;iroqdan keyin yangi muammo bor</span>}
                  </>
                ) : "Hali bog'lanilmagan"}
              </p>
            </div>
            <Modal title={`Bog'lanildi — ${r.student.name}`} triggerClassName="btn-secondary shrink-0" trigger="Bog'lanildi">
              <RiskContactForm studentId={r.student.id} />
            </Modal>
          </div>
        ))}
      </div>
      {rows.length === 0 && (
        <div className="card">
          <Empty text={tab === "open" && counts.all > 0 ? "Hammasi bilan bog'lanilgan" : "Xavfli o'quvchilar yo'q"} />
        </div>
      )}
    </>
  );
}
