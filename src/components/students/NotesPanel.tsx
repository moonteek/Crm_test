import { date } from "@/lib/format";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { addNote, deleteNote, pinNote } from "@/app/(app)/actions";
import { Empty } from "@/components/ui";
import { ActionButton, ActionForm } from "@/components/ActionForm";

type Note = { id: number; text: string; pinned: boolean; createdAt: Date; userId: number | null; user: { name: string } | null };
const when = (d: Date) => `${date(d)} ${d.toLocaleTimeString("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" })}`;

/** "Eslatma": add (staff who edit students), pin one to the profile card, delete own (admins: any). */
export function NotesPanel({ studentId, notes, canWrite, me }: { studentId: number; notes: Note[]; canWrite: boolean; me: { id: number; isAdmin: boolean } }) {
  return (
    <div className="space-y-3 p-4 md:p-5">
      {canWrite && (
        <ActionForm action={addNote.bind(null, studentId)} className="flex flex-col gap-2 sm:flex-row" submit={null}>
          <textarea name="text" className="input min-h-11 flex-1" rows={2} required maxLength={2000} placeholder="Masalan: 2+1 aksiyada qatnashdi" aria-label="Yangi eslatma" />
          <button className="btn-primary shrink-0 self-end">Qo&apos;shish</button>
        </ActionForm>
      )}
      {notes.length === 0 && <Empty text="Eslatmalar yo'q" />}
      <ul className="space-y-2">
        {notes.map((n) => (
          <li key={n.id} className={`rounded-xl border p-3 ${n.pinned ? "border-accent bg-accent-tint" : "border-line bg-raised"}`}>
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 whitespace-pre-wrap text-sm text-ink">{n.text}</p>
              {canWrite && (
                <div className="flex shrink-0 gap-1">
                  <ActionButton action={pinNote.bind(null, n.id)} className="btn-ghost px-1.5" label={n.pinned ? "Qadashni bekor qilish" : "Profilga qadash"} title={n.pinned ? "Qadashni bekor qilish" : "Profilga qadash"}>
                      {n.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </ActionButton>
                  {(n.userId === me.id || me.isAdmin) && (
                    <ActionButton action={deleteNote.bind(null, n.id)} className="btn-ghost px-1.5 hover:text-danger" label="O'chirish" title="O'chirish"><Trash2 className="h-4 w-4" /></ActionButton>
                  )}
                </div>
              )}
            </div>
            <p className="label-mono mt-2">{when(n.createdAt)} · {n.user?.name ?? "Tizim"}{n.pinned ? " · qadalgan" : ""}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
