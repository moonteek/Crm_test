"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, Plus, Trash2 } from "lucide-react";
import { saveSubject, type MemberActionState } from "@/app/(app)/actions";
import { DialogFrame } from "./Modal";

type Subject = { id: number; name: string; months: number };

/** "Fanlar" for one course: its subjects in order, each so many months (levels) long. */
export function SubjectEditor({ courseId, courseName, subjects }: { courseId: number; courseName: string; subjects: Subject[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<MemberActionState, FormData>(saveSubject, null);
  const total = subjects.reduce((s, x) => s + x.months, 0);

  return (
    <>
      <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setOpen(true)}>
        <BookOpen className="h-3.5 w-3.5" /> Fanlar
      </button>
      {open && (
        <DialogFrame title={`Fanlar — ${courseName}`} onClose={() => setOpen(false)}>
          <p className="mb-3 text-sm text-muted">
            Har bir oy — bitta daraja. Guruh fanlarni shu tartibda o&apos;tadi. Jami: <b className="text-ink">{total} oy</b>
          </p>
          <ol className="space-y-2">
            {subjects.map((s, i) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-raised p-2.5">
                {/* each action is its own form with the action in a hidden field (a pressed button's value isn't reliable) */}
                <form action={action} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <input type="hidden" name="op" value="update" />
                  <input type="hidden" name="id" value={s.id} />
                  <span className="w-5 text-center font-mono text-xs text-faint">{i + 1}</span>
                  <input name="name" defaultValue={s.name} className="input min-w-0 flex-1 py-1.5" required maxLength={60} aria-label="Fan nomi" />
                  <input name="months" type="number" min={1} max={24} defaultValue={s.months} className="input w-20 py-1.5" required aria-label="Oylar" />
                  <span className="text-xs text-muted">oy</span>
                  <button className="btn-secondary px-2.5 py-1.5 text-xs" disabled={pending}>Saqlash</button>
                </form>
                <RowAction action={action} id={s.id} op="up" label="Yuqoriga" disabled={pending || i === 0}><ArrowUp className="h-4 w-4" /></RowAction>
                <RowAction action={action} id={s.id} op="down" label="Pastga" disabled={pending || i === subjects.length - 1}><ArrowDown className="h-4 w-4" /></RowAction>
                <RowAction action={action} id={s.id} op="delete" label="O'chirish" disabled={pending} danger><Trash2 className="h-4 w-4" /></RowAction>
              </li>
            ))}
          </ol>
          <form action={action} className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line-strong p-2.5">
            <input type="hidden" name="op" value="add" />
            <input type="hidden" name="courseId" value={courseId} />
            <input name="name" className="input min-w-0 flex-1 py-1.5" placeholder="Masalan: JavaScript" required maxLength={60} aria-label="Yangi fan" />
            <input name="months" type="number" min={1} max={24} defaultValue={1} className="input w-20 py-1.5" required aria-label="Oylar" />
            <span className="text-xs text-muted">oy</span>
            <button className="btn-primary px-3 py-1.5 text-xs" disabled={pending}><Plus className="h-3.5 w-3.5" /> Qo&apos;shish</button>
          </form>
          {state?.error && <p className="mt-3 rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{state.error}</p>}
        </DialogFrame>
      )}
    </>
  );
}

function RowAction({
  action, id, op, label, disabled, danger = false, children,
}: { action: (f: FormData) => void; id: number; op: string; label: string; disabled: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <form action={action}>
      <input type="hidden" name="op" value={op} />
      <input type="hidden" name="id" value={id} />
      <button className={`btn-ghost px-1.5 ${danger ? "hover:text-danger" : ""}`} disabled={disabled} aria-label={label} title={label}>{children}</button>
    </form>
  );
}
