"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, Plus, Trash2 } from "lucide-react";
import { saveLine, saveSection } from "@/app/(app)/actions";
import type { ActionState } from "@/lib/action-result";
import { sectionLessons, sectionLevels } from "@/lib/curriculum";
import { money } from "@/lib/format";
import { DialogFrame } from "./Modal";

type Line = { id: number; name: string; levels: number; lessons: number; position: number };
type Section = { id: number; name: string; price: number | null; subjects: Line[] };

/** "Bo'limlar va darajalar" for one course: its sections, and in each its level lines (name × levels, lessons each). */
export function SectionEditor({ courseId, courseName, coursePrice, sections }: { courseId: number; courseName: string; coursePrice: number; sections: Section[] }) {
  const [open, setOpen] = useState(false);
  const [sectionState, sectionAction, sectionPending] = useActionState<ActionState, FormData>(saveSection, null);
  const [lineState, lineAction, linePending] = useActionState<ActionState, FormData>(saveLine, null);
  const pending = sectionPending || linePending;
  const error = sectionState?.error ?? lineState?.error;

  return (
    <>
      <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setOpen(true)}>
        <BookOpen className="h-3.5 w-3.5" /> Bo&apos;limlar va darajalar
      </button>
      {open && (
        <DialogFrame wide title={`Bo'limlar va darajalar — ${courseName}`} onClose={() => setOpen(false)}>
          <p className="mb-3 text-sm text-muted">
            Guruh bitta bo&apos;limni o&apos;qiydi. Daraja shuncha dars o&apos;tilgach tugaydi va oxirgi darsida imtihon bo&apos;ladi
            (bayram va qoldirilgan darslar hisoblanmaydi). Odatda 1 daraja = 13 dars ≈ 1 oy.
          </p>
          {error && <p role="alert" className="mb-3 rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="space-y-4">
            {sections.map((s, i) => (
              <section key={s.id} className="rounded-2xl border border-line bg-raised p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <form action={sectionAction} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <input type="hidden" name="op" value="update" />
                    <input type="hidden" name="id" value={s.id} />
                    <input name="name" defaultValue={s.name} className="input min-w-0 flex-1 py-1.5 font-semibold" required maxLength={60} aria-label="Bo'lim nomi" />
                    <input name="price" type="number" min={0} defaultValue={s.price ?? ""} placeholder={`${money(coursePrice)} (kurs)`} className="input w-40 py-1.5" aria-label="Bo'lim narxi" />
                    <button className="btn-secondary px-2.5 py-1.5 text-xs" disabled={pending}>Saqlash</button>
                  </form>
                  <RowAction action={sectionAction} id={s.id} op="up" label="Yuqoriga" disabled={pending || i === 0}><ArrowUp className="h-4 w-4" /></RowAction>
                  <RowAction action={sectionAction} id={s.id} op="down" label="Pastga" disabled={pending || i === sections.length - 1}><ArrowDown className="h-4 w-4" /></RowAction>
                  <RowAction action={sectionAction} id={s.id} op="delete" label="Bo'limni o'chirish" disabled={pending || sections.length === 1} danger><Trash2 className="h-4 w-4" /></RowAction>
                </div>
                <p className="label-mono mt-2 mb-1.5">
                  {sectionLevels(s.subjects)} daraja · {sectionLessons(s.subjects)} dars ≈ {Math.max(1, Math.round(sectionLessons(s.subjects) / 13))} oy
                </p>
                <ol className="space-y-1.5">
                  {s.subjects.map((l, j) => (
                    <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2">
                      <form action={lineAction} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        <input type="hidden" name="op" value="update" />
                        <input type="hidden" name="id" value={l.id} />
                        <span className="w-5 text-center font-mono text-xs text-faint">{j + 1}</span>
                        <input name="name" defaultValue={l.name} className="input min-w-0 flex-1 py-1.5" required maxLength={60} aria-label="Daraja nomi" />
                        <LineNumbers levels={l.levels} lessons={l.lessons} />
                        <button className="btn-secondary px-2.5 py-1.5 text-xs" disabled={pending}>Saqlash</button>
                      </form>
                      <RowAction action={lineAction} id={l.id} op="up" label="Yuqoriga" disabled={pending || j === 0}><ArrowUp className="h-4 w-4" /></RowAction>
                      <RowAction action={lineAction} id={l.id} op="down" label="Pastga" disabled={pending || j === s.subjects.length - 1}><ArrowDown className="h-4 w-4" /></RowAction>
                      <RowAction action={lineAction} id={l.id} op="delete" label="O'chirish" disabled={pending} danger><Trash2 className="h-4 w-4" /></RowAction>
                    </li>
                  ))}
                </ol>
                <form action={lineAction} className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line-strong p-2">
                  <input type="hidden" name="op" value="add" />
                  <input type="hidden" name="sectionId" value={s.id} />
                  <input name="name" className="input min-w-0 flex-1 py-1.5" placeholder="Masalan: JavaScript" required maxLength={60} aria-label="Yangi daraja" />
                  <LineNumbers levels={1} lessons={13} />
                  <button className="btn-primary px-3 py-1.5 text-xs" disabled={pending}><Plus className="h-3.5 w-3.5" /> Daraja qo&apos;shish</button>
                </form>
              </section>
            ))}
          </div>
          <form action={sectionAction} className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line-strong p-2.5">
            <input type="hidden" name="op" value="add" />
            <input type="hidden" name="courseId" value={courseId} />
            <input name="name" className="input min-w-0 flex-1 py-1.5" placeholder="Masalan: Backend" required maxLength={60} aria-label="Yangi bo'lim" />
            <input name="price" type="number" min={0} placeholder="Narx (ixtiyoriy)" className="input w-40 py-1.5" aria-label="Bo'lim narxi" />
            <button className="btn-primary px-3 py-1.5 text-xs" disabled={pending}><Plus className="h-3.5 w-3.5" /> Bo&apos;lim qo&apos;shish</button>
          </form>
        </DialogFrame>
      )}
    </>
  );
}

function LineNumbers({ levels, lessons }: { levels: number; lessons: number }) {
  return (
    <>
      <span className="text-xs text-muted">×</span>
      <input name="levels" type="number" min={1} max={24} defaultValue={levels} className="input w-16 py-1.5" required aria-label="Darajalar soni" title="Darajalar soni" />
      <input name="lessons" type="number" min={1} max={60} defaultValue={lessons} className="input w-16 py-1.5" required aria-label="Har darajada dars" title="Har darajada dars" />
      <span className="text-xs text-muted">dars</span>
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
