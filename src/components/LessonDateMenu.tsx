"use client";

import { startTransition, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, Ban, Check, ListChecks, RotateCcw } from "lucide-react";
import { markAllPresent, removeSubstitute, restoreLesson, setAbsenceReason } from "@/app/(app)/actions";
import { DialogFrame } from "./Modal";
import { LessonChangeDialog, PopoverPanel, useLessonGrid, usePopover } from "./lesson-grid";
import { lessonChangeOpen } from "@/lib/lesson-changes";

type Absent = { studentId: number; name: string; reasonId: number | null };
const WIDTH = 240;

/**
 * The menu on a lesson date in the attendance grid: everyone present, absence reasons, cancel the lesson, or a
 * substitute teacher for it — each item only for staff allowed to do it.
 */
export function LessonDateMenu({
  day, label, cancelled, substitutes, absent,
}: {
  day: string; label: string;
  cancelled: string | null; // reason ("" when none) or null when not cancelled
  substitutes: { role: string; name: string }[];
  absent: Absent[];
}) {
  const { groupId, today, canMark, canManage, reasons } = useLessonGrid();
  const past = day <= today;
  const popover = usePopover(WIDTH);
  const [dialog, setDialog] = useState<"reasons" | "cancel" | "substitute" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>) => startTransition(async () => {
    setError(null);
    try { await fn(); popover.close(); } catch (e) { setError((e as Error).message); }
  });
  const show = (d: typeof dialog) => { popover.close(); setDialog(d); };
  const item = "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-ink/5";
  // a teacher on a lesson yet to come has nothing to do here: no empty menu
  // cancel / substitute (and undo) only from this month on — the server refuses earlier ones
  const manage = canManage && lessonChangeOpen(new Date(day), new Date());
  const anything = manage || (cancelled === null && canMark && (past || absent.length > 0));

  return (
    <div className="inline-block">
      <button
        ref={popover.anchor}
        type="button"
        disabled={!anything}
        onClick={() => { setError(null); popover.toggle(); }}
        className={`rounded-md px-1 font-medium ${cancelled !== null ? "text-faint line-through" : ""} ${anything ? "hover:bg-ink/5" : ""}`}
        title={cancelled !== null ? `Dars bekor qilingan${cancelled ? `: ${cancelled}` : ""}` : substitutes.length ? substitutes.map((s) => `O'rinbosar: ${s.name}`).join(", ") : undefined}
        aria-label={`${label} — dars amallari`}
      >
        {label}{substitutes.length > 0 && <span className="ml-0.5 text-accent-ink">↔</span>}
      </button>
      <PopoverPanel popover={popover} width={WIDTH} label={`${label} — dars amallari`}>
        {cancelled === null && canMark && past && (
          <button type="button" className={item} onClick={() => run(() => markAllPresent(groupId, day))}><Check className="h-4 w-4 text-success" /> Hammasi keldi</button>
        )}
        {cancelled === null && canMark && absent.length > 0 && (
          <button type="button" className={item} onClick={() => show("reasons")}><ListChecks className="h-4 w-4" /> Kelmaganlik sabablari</button>
        )}
        {manage && (cancelled === null ? (
          <>
            {substitutes.length === 0 && <button type="button" className={`${item} text-danger`} onClick={() => show("cancel")}><Ban className="h-4 w-4" /> Darsni qoldirish</button>}
            <button type="button" className={item} onClick={() => show("substitute")}><ArrowLeftRight className="h-4 w-4" /> O&apos;qituvchini almashtirish</button>
            {substitutes.map((s) => (
              <button key={s.role} type="button" className={item} onClick={() => run(() => removeSubstitute(groupId, day, s.role))}><RotateCcw className="h-4 w-4" /> Almashtirishni bekor qilish ({s.name})</button>
            ))}
          </>
        ) : (
          <button type="button" className={item} onClick={() => run(() => restoreLesson(groupId, day))}><RotateCcw className="h-4 w-4" /> Qoldirishni bekor qilish</button>
        ))}
        {error && <p className="mt-1 rounded-xl bg-danger-tint px-3 py-2 text-xs text-danger">{error}</p>}
      </PopoverPanel>
      {dialog === "reasons" && createPortal(
        <DialogFrame title={`Kelmaganlik sabablari — ${label}`} onClose={() => setDialog(null)}>
          <ul className="space-y-2 text-left normal-case">
            {absent.map((a) => (
              <li key={a.studentId} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{a.name}</span>
                <select
                  className="input w-48"
                  defaultValue={a.reasonId ?? ""}
                  onChange={(e) => run(() => setAbsenceReason(groupId, a.studentId, day, e.target.value ? Number(e.target.value) : null))}
                  aria-label={`${a.name} — sabab`}
                >
                  <option value="">Sabab tanlanmagan</option>
                  {reasons.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </li>
            ))}
          </ul>
          {error && <p className="mt-3 rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="mt-4 flex justify-end"><button type="button" className="btn-primary" onClick={() => setDialog(null)}>Tayyor</button></div>
        </DialogFrame>,
        document.body,
      )}
      {(dialog === "cancel" || dialog === "substitute") && <LessonChangeDialog kind={dialog} day={day} label={label} onClose={() => setDialog(null)} />}
    </div>
  );
}
