import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Phone, StickyNote, Trash2, Users, ArrowRightLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can, groupScope, leadScope } from "@/lib/access";
import { ACTIVITY_TYPES, CALL_RESULTS, date, LEAD_STATUSES } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { ActivityForm, LostForm } from "@/components/LeadForms";
import { Field, SubmitRow } from "@/components/ui";
import { assignLead, convertLead, deleteLead, setLeadStatus } from "../../actions";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CALL: Phone, MESSAGE: MessageCircle, MEETING: Users, NOTE: StickyNote, STATUS: ArrowRightLeft,
};

function stamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("leads.view");
  const id = Number((await params).id);
  const lead = await db.lead.findFirst({
    where: { id, ...leadScope(user) },
    include: { course: true, assignedTo: true, student: true, activities: { include: { user: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!lead) notFound();
  const manage = can(user, "leads.manage");
  const open = ["NEW", "CONTACTED", "TRIAL"].includes(lead.status);
  const [sellers, groups] = await Promise.all([
    db.user.findMany({ where: { isSales: true, active: true }, orderBy: { name: "asc" } }),
    db.group.findMany({ where: { status: "ACTIVE", ...groupScope(user) }, include: { course: true }, orderBy: { name: "asc" } }),
  ]);
  const status = LEAD_STATUSES.find((s) => s.key === lead.status);

  return (
    <>
      <Link href="/leads" className="text-sm text-slate-500 hover:text-brand-600">← Lidlar</Link>
      <div className="mt-3 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-xl font-bold">{lead.name}</h1>
              <span className="badge bg-slate-100 text-slate-700"><span className={`mr-1.5 h-2 w-2 rounded-full ${status?.color}`} />{status?.label}</span>
            </div>
            <a href={`tel:${lead.phone}`} className="mt-1 flex items-center gap-1 text-slate-600 hover:text-brand-600"><Phone className="h-4 w-4" />{lead.phone}</a>
            <dl className="mt-4 space-y-2 text-sm">
              <Row k="Manba">{lead.source ?? "—"}</Row>
              <Row k="Kurs">{lead.course?.name ?? "—"}</Row>
              <Row k="Sotuvchi">{lead.assignedTo?.name ?? "biriktirilmagan"}</Row>
              <Row k="Keyingi aloqa">{lead.nextActionAt && open ? stamp(lead.nextActionAt) : "—"}</Row>
              <Row k="Kelgan sana">{date(lead.createdAt)}</Row>
              {lead.lostReason && <Row k="Rad etish sababi">{lead.lostReason}</Row>}
              {lead.student && <Row k="O'quvchi"><Link className="text-brand-600 hover:underline" href={`/students/${lead.student.id}`}>Profilni ochish</Link></Row>}
              {lead.note && <Row k="Izoh">{lead.note}</Row>}
            </dl>
            {manage && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {open && lead.status !== "TRIAL" && (
                  <form action={setLeadStatus.bind(null, lead.id, "TRIAL")}><button className="btn-secondary">Sinov darsiga yozildi</button></form>
                )}
                {open && (
                  <Modal title="Rad etdi" triggerClassName="btn-secondary" trigger="Rad etdi">
                    <LostForm leadId={lead.id} />
                  </Modal>
                )}
                {!open && lead.status === "LOST" && (
                  <form action={setLeadStatus.bind(null, lead.id, "CONTACTED")}><button className="btn-secondary">Qayta ochish</button></form>
                )}
                {open && can(user, "students.manage") && (
                  <Modal title="O'quvchiga aylantirish" trigger="✓ O'qishga yozildi">
                    <form action={convertLead.bind(null, lead.id)} className="space-y-3">
                      <Field label="Guruh">
                        <select name="groupId" className="input">
                          <option value="">Hozircha guruhsiz</option>
                          {groups.map((g) => <option key={g.id} value={g.id}>{g.name} — {g.course.name} ({g.time})</option>)}
                        </select>
                      </Field>
                      <SubmitRow text="O'quvchi qilish" />
                    </form>
                  </Modal>
                )}
                <form action={deleteLead.bind(null, lead.id)}>
                  <button className="btn-secondary text-rose-600"><Trash2 className="h-4 w-4" /></button>
                </form>
              </div>
            )}
          </div>

          {manage && !can(user, "leads.own") && (
            <div className="card p-5">
              <h2 className="mb-3 font-semibold">Sotuvchiga biriktirish</h2>
              <form action={assignLead.bind(null, lead.id)} className="flex gap-2">
                <select name="assignedToId" className="input" defaultValue={lead.assignedToId ?? ""}>
                  <option value="">Biriktirilmagan</option>
                  {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button className="btn-primary">Saqlash</button>
              </form>
            </div>
          )}
        </div>

        <div className="space-y-6 xl:col-span-2">
          {manage && open && (
            <div className="card p-5">
              <h2 className="mb-3 font-semibold">Aloqani yozib qo&apos;yish</h2>
              <ActivityForm leadId={lead.id} />
            </div>
          )}
          <div className="card p-5">
            <h2 className="mb-4 font-semibold">Tarix ({lead.activities.length})</h2>
            {lead.activities.length === 0 && <p className="text-sm text-slate-400">Hali hech qanday aloqa yozilmagan</p>}
            <ol className="space-y-4">
              {lead.activities.map((a) => {
                const Icon = ICONS[a.type] ?? StickyNote;
                return (
                  <li key={a.id} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{ACTIVITY_TYPES[a.type]}</span>
                        {a.type === "CALL" && a.result && <span className="text-slate-500"> · {CALL_RESULTS[a.result]}</span>}
                        {a.type === "STATUS" && a.result && <span className="text-slate-500"> → {LEAD_STATUSES.find((s) => s.key === a.result)?.label}</span>}
                      </p>
                      {a.text && <p className="mt-0.5 text-sm text-slate-700">{a.text}</p>}
                      <p className="mt-0.5 text-xs text-slate-400">{stamp(a.createdAt)} · {a.user?.name ?? "Tizim"}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
