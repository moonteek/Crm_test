import { Phone, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { date, LEAD_SOURCES, LEAD_STATUSES } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { Field, PageHeader, SubmitRow } from "@/components/ui";
import { convertLead, createLead, deleteLead, setLeadStatus } from "../actions";

export default async function LeadsPage() {
  const [leads, courses, groups] = await Promise.all([
    db.lead.findMany({ include: { course: true }, orderBy: { createdAt: "desc" } }),
    db.course.findMany({ orderBy: { name: "asc" } }),
    db.group.findMany({ where: { status: "ACTIVE" }, include: { course: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Lidlar" subtitle="Potensial o'quvchilar bilan ishlash">
        <Modal title="Yangi lid" trigger={<><Plus className="h-4 w-4" /> Lid qo&apos;shish</>}>
          <form action={createLead} className="space-y-3">
            <Field label="Ism familiya"><input name="name" className="input" required /></Field>
            <Field label="Telefon"><input name="phone" className="input" required placeholder="+998 90 123 45 67" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Manba">
                <select name="source" className="input">
                  {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Qiziqqan kursi">
                <select name="courseId" className="input">
                  <option value="">—</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Izoh"><textarea name="note" className="input" rows={2} /></Field>
            <SubmitRow />
          </form>
        </Modal>
      </PageHeader>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {LEAD_STATUSES.map((status) => {
          const items = leads.filter((l) => l.status === status.key);
          return (
            <div key={status.key} className="w-72 shrink-0">
              <div className="mb-3 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${status.color}`} />
                <h2 className="text-sm font-semibold">{status.label}</h2>
                <span className="badge bg-slate-200 text-slate-600">{items.length}</span>
              </div>
              <div className="space-y-3">
                {items.map((lead) => (
                  <div key={lead.id} className="card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{lead.name}</p>
                      <form action={deleteLead.bind(null, lead.id)}>
                        <button className="text-slate-400 hover:text-rose-600" aria-label="O'chirish"><Trash2 className="h-4 w-4" /></button>
                      </form>
                    </div>
                    <a href={`tel:${lead.phone}`} className="mt-1 flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
                      <Phone className="h-3.5 w-3.5" /> {lead.phone}
                    </a>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {lead.course && <span className="badge bg-brand-50 text-brand-700">{lead.course.name}</span>}
                      {lead.source && <span className="badge bg-slate-100 text-slate-600">{lead.source}</span>}
                    </div>
                    {lead.note && <p className="mt-2 text-xs text-slate-500">{lead.note}</p>}
                    <p className="mt-2 text-xs text-slate-400">{date(lead.createdAt)}</p>
                    <div className="mt-3 flex flex-wrap gap-1 border-t border-slate-100 pt-3">
                      {LEAD_STATUSES.filter((s) => s.key !== lead.status && s.key !== "WON").map((s) => (
                        <form key={s.key} action={setLeadStatus.bind(null, lead.id, s.key)}>
                          <button className="rounded-md bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">→ {s.label}</button>
                        </form>
                      ))}
                      {lead.status !== "WON" && (
                        <Modal
                          title={`${lead.name} — o'quvchiga aylantirish`}
                          triggerClassName="rounded-md bg-emerald-100 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-200"
                          trigger="✓ Guruhga qo'shish"
                        >
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
