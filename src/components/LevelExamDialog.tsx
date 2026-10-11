"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { saveLevelExamScores, type MemberActionState } from "@/app/(app)/actions";
import { DialogFrame } from "./Modal";

/** Scores of one automatic level exam; stays open and shows the reason when the save is refused. */
export function LevelExamDialog({
  groupId, level, title, dateLabel, maxScore, passPercent, students,
}: {
  groupId: number; level: number; title: string; dateLabel: string; maxScore: number; passPercent: number;
  students: { id: number; name: string; score: number | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<MemberActionState, FormData>(saveLevelExamScores, null);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  return (
    <>
      <button type="button" className="text-faint hover:text-ink" onClick={() => setOpen(true)} aria-label="Natijalarni kiritish" title="Natijalarni kiritish">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      {open && (
        <DialogFrame title={title} onClose={() => setOpen(false)}>
          <form action={action} className="space-y-3 text-left normal-case">
            <input type="hidden" name="groupId" value={groupId} />
            <input type="hidden" name="level" value={level} />
            <p className="text-sm text-muted">{dateLabel} · o&apos;tish bali {passPercent}%</p>
            <label className="flex items-center justify-between gap-3 text-sm font-medium">
              Maksimal ball
              <input name="maxScore" type="number" min={1} className="input w-24" defaultValue={maxScore} />
            </label>
            <div className="max-h-[45vh] space-y-2 overflow-y-auto rounded-lg border border-line p-3">
              {students.map((s) => (
                <label key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{s.name}</span>
                  <input name={`score_${s.id}`} type="number" min={0} className="input w-24" placeholder="ball" defaultValue={s.score ?? ""} />
                </label>
              ))}
            </div>
            {state?.error && <p className="rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{state.error}</p>}
            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saqlanmoqda..." : "Saqlash"}</button>
            </div>
          </form>
        </DialogFrame>
      )}
    </>
  );
}
