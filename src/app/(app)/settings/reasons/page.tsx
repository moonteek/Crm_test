import { Eye, EyeOff, Pencil, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { Modal } from "@/components/Modal";
import { Empty, Field, SubmitRow } from "@/components/ui";
import { createReason, renameReason, toggleReason } from "../../actions";

export default async function ReasonsPage() {
  await requirePage("staff.manage");
  const reasons = await db.reason.findMany({
    include: { _count: { select: { events: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 md:px-5">
        <div>
          <h2 className="font-semibold">Sabablar</h2>
          <p className="mt-0.5 text-sm text-muted">O&apos;quvchini muzlatish yoki guruhdan chiqarishda tanlanadi</p>
        </div>
        <form action={createReason} className="flex w-full gap-2 sm:w-auto">
          <input name="name" className="input sm:w-64" placeholder="Masalan: Ish vaqti to'g'ri kelmadi" required maxLength={80} />
          <button className="btn-primary shrink-0"><Plus className="h-4 w-4" /> Qo&apos;shish</button>
        </form>
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
                <form action={renameReason.bind(null, r.id)} className="space-y-3">
                  <Field label="Sabab"><input name="name" className="input" defaultValue={r.name} required maxLength={80} /></Field>
                  <SubmitRow />
                </form>
              </Modal>
              <form action={toggleReason.bind(null, r.id)}>
                <button className="btn-ghost px-2" title={r.active ? "Yashirish" : "Qayta yoqish"} aria-label={r.active ? "Yashirish" : "Qayta yoqish"}>
                  {r.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
