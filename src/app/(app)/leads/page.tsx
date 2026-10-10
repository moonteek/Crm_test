import Link from "next/link";
import { AlarmClock, Phone, Plus, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can, groupScope, leadScope } from "@/lib/access";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { ActivityForm, LostForm } from "@/components/LeadForms";
import { Field, PageHeader, SubmitRow } from "@/components/ui";
import { convertLead, createLead, setLeadStatus } from "../actions";

function when(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? `bugun ${p(d.getHours())}:${p(d.getMinutes())}` : `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ u?: string; src?: string }> }) {
  const user = await requirePage("leads.view");
  const { u, src } = await searchParams;
  const manage = can(user, "leads.manage");
  const own = can(user, "leads.own");
  const convert = manage && can(user, "students.manage");
  const filter = {
    ...leadScope(user),
    ...(!own && u ? { assignedToId: u === "none" ? null : Number(u) } : {}),
    ...(src ? { source: src } : {}),
  };
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const now = new Date();

  const [leads, courses, groups, sellers] = await Promise.all([
    db.lead.findMany({
      where: { ...filter, OR: [{ status: { in: ["NEW", "CONTACTED", "TRIAL"] } }, { createdAt: { gte: new Date(Date.now() - 60 * 86400_000) } }] },
      include: { course: true, assignedTo: true, _count: { select: { activities: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.course.findMany({ orderBy: { name: "asc" } }),
    db.group.findMany({ where: { status: "ACTIVE", ...groupScope(user) }, include: { course: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { isSales: true, active: true }, orderBy: { name: "asc" } }),
  ]);
  const due = leads
    .filter((l) => l.nextActionAt && l.nextActionAt <= endOfToday && ["NEW", "CONTACTED", "TRIAL"].includes(l.status))
    .sort((a, b) => a.nextActionAt!.getTime() - b.nextActionAt!.getTime());
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    Object.entries({ u, src, ...extra }).forEach(([k, v]) => v && p.set(k, v));
    return `/leads?${p}`;
  };

  return (
    <>
      <PageHeader title={own ? "Mening lidlarim" : "Lidlar"} subtitle="Bo'lajak o'quvchilar bilan ishlash">
        {manage && <Modal title="Yangi lid" trigger={<><Plus className="h-4 w-4" /> Lid qo&apos;shish</>}>
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
            {!own && (
              <Field label="Sotuvchi">
                <select name="assignedToId" className="input" defaultValue="auto">
                  <option value="auto">Avtomatik (eng kam band sotuvchiga)</option>
                  <option value="">Biriktirmaslik</option>
                  {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Izoh"><textarea name="note" className="input" rows={2} /></Field>
            <SubmitRow />
          </form>
        </Modal>}
      </PageHeader>

      {due.length > 0 && (
        <div className="card mb-6 border-amber-200">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
            <AlarmClock className="h-5 w-5 text-amber-600" />
            <h2 className="font-semibold">Bugun bog&apos;lanish kerak</h2>
            <span className="badge bg-amber-100 text-amber-800">{due.length}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {due.slice(0, 8).map((l) => {
              const late = l.nextActionAt! < now;
              return (
                <Link key={l.id} href={`/leads/${l.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="font-medium">{l.name} <span className="text-sm font-normal text-slate-500">{l.phone}</span></p>
                    <p className="text-xs text-slate-500">{l.course?.name ?? "Kurs tanlanmagan"}{!own && ` · ${l.assignedTo?.name ?? "biriktirilmagan"}`}</p>
                  </div>
                  <span className={`badge ${late ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
                    {late ? "Kechikdi · " : ""}{when(l.nextActionAt!)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {!own && (
          <>
            <Link href={qs({ u: undefined })} className={`rounded-full px-3 py-1 ${!u ? "bg-brand-600 text-white" : "bg-white text-slate-600"}`}>Barcha sotuvchilar</Link>
            {sellers.map((s) => (
              <Link key={s.id} href={qs({ u: String(s.id) })} className={`rounded-full px-3 py-1 ${u === String(s.id) ? "bg-brand-600 text-white" : "bg-white text-slate-600"}`}>{s.name}</Link>
            ))}
            <Link href={qs({ u: "none" })} className={`rounded-full px-3 py-1 ${u === "none" ? "bg-brand-600 text-white" : "bg-white text-slate-600"}`}>Biriktirilmagan</Link>
            <span className="mx-1 text-slate-300">|</span>
          </>
        )}
        <Link href={qs({ src: undefined })} className={`rounded-full px-3 py-1 ${!src ? "bg-slate-800 text-white" : "bg-white text-slate-600"}`}>Barcha manbalar</Link>
        {LEAD_SOURCES.map((s) => (
          <Link key={s} href={qs({ src: s })} className={`rounded-full px-3 py-1 ${src === s ? "bg-slate-800 text-white" : "bg-white text-slate-600"}`}>{s}</Link>
        ))}
      </div>

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
                    <Link href={`/leads/${lead.id}`} className="font-medium hover:text-brand-600">{lead.name}</Link>
                    <a href={`tel:${lead.phone}`} className="mt-1 flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
                      <Phone className="h-3.5 w-3.5" /> {lead.phone}
                    </a>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {lead.course && <span className="badge bg-brand-50 text-brand-700">{lead.course.name}</span>}
                      {lead.source && <span className="badge bg-slate-100 text-slate-600">{lead.source}</span>}
                      {lead.lostReason && <span className="badge bg-rose-50 text-rose-700">{lead.lostReason}</span>}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      {!own && <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{lead.assignedTo?.name ?? "biriktirilmagan"}</span>}
                      {lead.nextActionAt && ["NEW", "CONTACTED", "TRIAL"].includes(lead.status) && (
                        <span className={lead.nextActionAt < now ? "font-medium text-rose-600" : ""}>⏰ {when(lead.nextActionAt)}</span>
                      )}
                    </div>
                    {manage && ["NEW", "CONTACTED", "TRIAL"].includes(lead.status) && (
                      <div className="mt-3 flex flex-wrap gap-1 border-t border-slate-100 pt-3">
                        <Modal title={`${lead.name} — aloqa`} triggerClassName="rounded-md bg-brand-50 px-2 py-1 text-xs text-brand-700 hover:bg-brand-100" trigger="📞 Aloqa">
                          <ActivityForm leadId={lead.id} />
                        </Modal>
                        {lead.status !== "TRIAL" && (
                          <form action={setLeadStatus.bind(null, lead.id, "TRIAL")}>
                            <button className="rounded-md bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">→ Sinov darsi</button>
                          </form>
                        )}
                        <Modal title={`${lead.name} — rad etdi`} triggerClassName="rounded-md bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200" trigger="→ Rad etdi">
                          <LostForm leadId={lead.id} />
                        </Modal>
                        {convert && (
                          <Modal title={`${lead.name} — o'quvchiga aylantirish`} triggerClassName="rounded-md bg-emerald-100 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-200" trigger="✓ Yozildi">
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
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-400">Yakunlangan (yozildi / rad etdi) lidlar oxirgi 60 kun uchun ko&apos;rsatiladi.</p>
    </>
  );
}
