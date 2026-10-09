import { DoorOpen, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { GROUP_DAYS } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { Empty, Field, PageHeader, SubmitRow } from "@/components/ui";
import { createRoom, deleteRoom } from "../actions";

export default async function RoomsPage() {
  const [rooms, session] = await Promise.all([
    db.room.findMany({ include: { groups: { where: { status: "ACTIVE" }, orderBy: { time: "asc" } } }, orderBy: { name: "asc" } }),
    getSession(),
  ]);

  return (
    <>
      <PageHeader title="Xonalar" subtitle="Xonalar va ularning bandligi">
        <Modal title="Yangi xona" trigger={<><Plus className="h-4 w-4" /> Xona qo&apos;shish</>}>
          <form action={createRoom} className="space-y-3">
            <Field label="Xona nomi"><input name="name" className="input" required placeholder="1-xona" /></Field>
            <Field label="Sig'imi (o'rin)"><input name="capacity" type="number" className="input" defaultValue={15} /></Field>
            <SubmitRow />
          </form>
        </Modal>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rooms.map((r) => (
          <div key={r.id} className="card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DoorOpen className="h-5 w-5 text-brand-600" />
                <h3 className="font-semibold">{r.name}</h3>
                <span className="text-sm text-slate-500">· {r.capacity} o&apos;rin</span>
              </div>
              {session?.role === "ADMIN" && (
                <form action={deleteRoom.bind(null, r.id)}>
                  <button className="text-slate-400 hover:text-rose-600" aria-label="O'chirish"><Trash2 className="h-4 w-4" /></button>
                </form>
              )}
            </div>
            <div className="mt-3 space-y-1 text-sm">
              {r.groups.map((g) => (
                <div key={g.id} className="flex justify-between rounded-md bg-slate-50 px-3 py-1.5">
                  <span>{g.name}</span>
                  <span className="text-slate-500">{GROUP_DAYS[g.days]} · {g.time}</span>
                </div>
              ))}
              {r.groups.length === 0 && <p className="text-slate-400">Bo&apos;sh</p>}
            </div>
          </div>
        ))}
      </div>
      {rooms.length === 0 && <div className="card"><Empty text="Xonalar yo'q" /></div>}
    </>
  );
}
