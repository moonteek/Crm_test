import { Eye, EyeOff, Pencil, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { Modal } from "@/components/Modal";
import { Empty, Field } from "@/components/ui";
import { TAG_COLORS } from "@/lib/format";
import { TagChip } from "@/components/students/TagChip";
import { ActionButton, ActionForm } from "@/components/ActionForm";
import { createAbsenceReason, createReason, renameReason, toggleAbsenceReason, toggleReason, updateAbsenceReason } from "../../actions";

const COLOR_LABEL: Record<string, string> = { amber: "Sariq", green: "Yashil", red: "Qizil", orange: "To'q sariq", grey: "Kulrang" };

function ColorSelect({ value = "grey" }: { value?: string }) {
  return (
    <select name="color" className="input" defaultValue={value} aria-label="Rang">
      {TAG_COLORS.map((c) => <option key={c} value={c}>{COLOR_LABEL[c]}</option>)}
    </select>
  );
}

export default async function ReasonsPage() {
  await requirePage("staff.manage");
  const [reasons, absence] = await Promise.all([
    db.reason.findMany({ include: { _count: { select: { events: true } } }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    db.absenceReason.findMany({ include: { _count: { select: { marks: true } } }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
  ]);

  return (
    <div className="space-y-4 md:space-y-6">
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 md:px-5">
        <div>
          <h2 className="font-semibold">Sabablar</h2>
          <p className="mt-0.5 text-sm text-muted">O&apos;quvchini muzlatish yoki guruhdan chiqarishda tanlanadi</p>
        </div>
        <ActionForm action={createReason} className="flex w-full gap-2 sm:w-auto" submit={null}>
          <input name="name" className="input sm:w-64" placeholder="Masalan: Ish vaqti to'g'ri kelmadi" required maxLength={80} />
          <button className="btn-primary shrink-0"><Plus className="h-4 w-4" /> Qo&apos;shish</button>
        </ActionForm>
      </div>
      {reasons.length === 0 ? (
        <Empty text="Sabablar hali qo'shilmagan" />
      ) : (
        <ul className="divide-y divide-line">
          {reasons.map((r) => (
            <li key={r.id} className={`flex items-center gap-3 px-4 py-3 md:px-5 ${r.active ? "" : "opacity-55"}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name}</p>
                <p className="label-mono mt-0.5">{r.active ? `${r._count.events} marta tanlangan` : "Yashirilgan"}</p>
              </div>
              <Modal title="Sababni tahrirlash" triggerClassName="btn-ghost px-2" trigger={<Pencil className="h-4 w-4" aria-label="Tahrirlash" />}>
                <ActionForm action={renameReason.bind(null, r.id)} className="space-y-3">
                  <Field label="Sabab"><input name="name" className="input" defaultValue={r.name} required maxLength={80} /></Field>
                </ActionForm>
              </Modal>
              <ActionButton action={toggleReason.bind(null, r.id)} className="btn-ghost px-2" title={r.active ? "Yashirish" : "Qayta yoqish"} label={r.active ? "Yashirish" : "Qayta yoqish"}>
                  {r.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </ActionButton>
            </li>
          ))}
        </ul>
      )}
    </div>
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 md:px-5">
        <div>
          <h2 className="font-semibold">Kelmaganlik sabablari</h2>
          <p className="mt-0.5 text-sm text-muted">Davomatda kelmagan o&apos;quvchiga ixtiyoriy tanlanadi; rang jadvalda ko&apos;rinadi</p>
        </div>
        <ActionForm action={createAbsenceReason} className="flex w-full flex-wrap gap-2 sm:w-auto" submit={null}>
          <input name="name" className="input min-w-0 flex-1 sm:w-56" placeholder="Masalan: Kasal" required maxLength={60} aria-label="Sabab" />
          <div className="w-32"><ColorSelect /></div>
          <button className="btn-primary shrink-0"><Plus className="h-4 w-4" /> Qo&apos;shish</button>
        </ActionForm>
      </div>
      {absence.length === 0 ? (
        <Empty text="Kelmaganlik sabablari hali qo'shilmagan" />
      ) : (
        <ul className="divide-y divide-line">
          {absence.map((r) => (
            <li key={r.id} className={`flex items-center gap-3 px-4 py-3 md:px-5 ${r.active ? "" : "opacity-55"}`}>
              <div className="min-w-0 flex-1">
                <TagChip name={r.name} color={r.color} />
                <p className="label-mono mt-1">{r.active ? `${r._count.marks} marta tanlangan` : "Yashirilgan"}</p>
              </div>
              <Modal title="Sababni tahrirlash" triggerClassName="btn-ghost px-2" trigger={<Pencil className="h-4 w-4" aria-label="Tahrirlash" />}>
                <ActionForm action={updateAbsenceReason.bind(null, r.id)}>
                  <Field label="Sabab"><input name="name" className="input" defaultValue={r.name} required maxLength={60} /></Field>
                  <Field label="Rang"><ColorSelect value={r.color} /></Field>
                </ActionForm>
              </Modal>
              <ActionButton action={toggleAbsenceReason.bind(null, r.id)} className="btn-ghost px-2" title={r.active ? "Yashirish" : "Qayta yoqish"} label={r.active ? "Yashirish" : "Qayta yoqish"}>
                  {r.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </ActionButton>
            </li>
          ))}
        </ul>
      )}
    </div>
    </div>
  );
}
