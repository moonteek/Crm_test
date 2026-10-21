"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight, Ban, Check, Clock, Flag, Minus, RotateCcw, X } from "lucide-react";
import { removeSubstitute, restoreLesson, setAbsenceReason, setAttendance } from "@/app/(app)/actions";
import type { MarkKey } from "@/lib/attendance";
import type { ActionState } from "@/lib/action-result";
import { answer } from "@/lib/action-result";
import { LessonChangeDialog, PopoverPanel, REASON_TONE, useLessonGrid, usePopover } from "./lesson-grid";
import { lessonChangeOpen } from "@/lib/lesson-changes";

type CellMark = { present: boolean; late: boolean; reason: { id: number; name: string; color: string } | null };
const WIDTH = 252;

const CHOICES: { key: MarkKey | null; label: string; icon: typeof Check; on: string }[] = [
  { key: "present", label: "Keldi", icon: Check, on: "border-success/40 bg-success-tint text-success" },
  { key: "late", label: "Kechikdi", icon: Clock, on: "border-warning/40 bg-warning-tint text-warning" },
  { key: "absent", label: "Kelmadi", icon: X, on: "border-danger/40 bg-danger-tint text-danger" },
  { key: null, label: "Tozalash", icon: Minus, on: "border-line-strong bg-ink/5 text-ink" },
];

const keyOf = (m: CellMark | null): MarkKey | null => (!m ? null : m.late ? "late" : m.present ? "present" : "absent");

/**
 * One attendance cell: a tap opens a popover to choose keldi / kechikdi / kelmadi / clear, an absence reason, and
 * (for staff who manage lessons) cancel or substitute that day's whole group lesson.
 */
export function AttendanceCell({
  studentId, studentName, day, label, mark, cancelled, substitutes,
}: {
  studentId: number; studentName: string; day: string; label: string;
  mark: CellMark | null; cancelled: boolean; substitutes: { role: string; name: string }[];
}) {
  const { groupId, today, canMark, canManage, reasons } = useLessonGrid();
  const past = day <= today;
  const popover = usePopover(WIDTH);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"cancel" | "substitute" | null>(null);
  // the choice shows at once; the server's answer replaces it when the page refreshes
  const [chosen, setChosen] = useState<{ key: MarkKey | null; reasonId: number | null } | null>(null);
  const current = chosen ?? { key: keyOf(mark), reasonId: mark?.reason?.id ?? null };
  const marks = canMark && past && !cancelled;
  // cancel / substitute (and undo) only from this month on — the server refuses earlier ones
  const manage = canManage && lessonChangeOpen(new Date(day), new Date());
  if (cancelled && !manage) return <span className="label-mono text-faint" title="Dars bekor qilingan">—</span>;

  const run = (fn: () => Promise<ActionState>, after: () => void) => start(async () => {
    setError(null);
    const problem = await answer(fn());
    if (problem) { setChosen(null); setError(problem); } else after();
  });
  const choose = (key: MarkKey | null) => {
    setChosen({ key, reasonId: key === "absent" ? current.reasonId : null });
    // kelmadi stays open for an optional reason
    run(() => setAttendance(groupId, studentId, day, key), () => (key === "absent" && reasons.length ? undefined : popover.close()));
  };
  const reason = (id: number) => {
    const next = current.reasonId === id ? null : id; // tapping the chosen reason again removes it
    setChosen({ key: "absent", reasonId: next });
    run(() => setAbsenceReason(groupId, studentId, day, next), popover.close);
  };
  const show = (d: "cancel" | "substitute") => { popover.close(); setDialog(d); };
  const open = () => { setError(null); setChosen(null); popover.toggle(); };

  const v = mark;
  const tone = cancelled ? "border-line/50 text-faint"
    : v?.late ? "border-warning/40 bg-warning-tint text-warning"
    : v?.present ? "border-success/40 bg-success-tint text-success"
    : v?.reason ? `border-line ${REASON_TONE[v.reason.color] ?? REASON_TONE.grey}`
    : v ? "border-danger/40 bg-danger-tint text-danger"
    : !past ? "border-line/50 text-faint/50"
    : "border-line bg-raised text-faint hover:border-ink";
  const enabled = marks || manage;
  const item = "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-ink/5";

  return (
    <>
      <button
        ref={popover.anchor}
        type="button"
        disabled={!enabled}
        onClick={open}
        aria-label={`${studentName}, ${label}`}
        title={cancelled ? "Dars bekor qilingan" : v && !v.present ? (v.reason ? `Kelmadi: ${v.reason.name}` : "Kelmadi — sabab kiritilmagan") : undefined}
        className={`press h-7 w-7 rounded-full border text-sm font-bold ${tone}`}
      >
        {cancelled ? "—" : v?.late ? "K" : v?.present ? "✓" : v?.reason ? "✗" : v ? <Flag className="mx-auto h-3.5 w-3.5" /> : "·"}
      </button>
      <PopoverPanel popover={popover} width={WIDTH} label={`${studentName}, ${label}`}>
        {marks && (
          <div className="grid grid-cols-4 gap-1">
            {CHOICES.map((c) => {
              // "Tozalash" lights up only right after clearing
              const on = c.key === null ? chosen?.key === null : current.key === c.key;
              return (
                <button
                  key={c.label}
                  type="button"
                  disabled={pending}
                  onClick={() => choose(c.key)}
                  aria-pressed={on}
                  className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border text-[11px] font-medium ${on ? c.on : "border-transparent text-muted hover:bg-ink/5"}`}
                >
                  <c.icon className="h-5 w-5" />
                  {c.label}
                </button>
              );
            })}
          </div>
        )}
        {marks && current.key === "absent" && reasons.length > 0 && (
          <div className="mt-1.5 border-t border-line px-1 pt-2">
            <p className="label-mono mb-1.5">Sabab (ixtiyoriy)</p>
            <div className="flex flex-wrap gap-1.5">
              {reasons.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={pending}
                  onClick={() => reason(r.id)}
                  aria-pressed={current.reasonId === r.id}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${REASON_TONE[r.color] ?? REASON_TONE.grey} ${current.reasonId === r.id ? "ring-2 ring-ink" : ""}`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {manage && (
          <div className={marks ? "mt-1.5 border-t border-line pt-1.5" : ""}>
            {cancelled ? (
              <button type="button" disabled={pending} className={item} onClick={() => run(() => restoreLesson(groupId, day), popover.close)}><RotateCcw className="h-4 w-4" /> Qoldirishni bekor qilish</button>
            ) : (
              <>
                {substitutes.length === 0 && <button type="button" className={`${item} text-danger`} onClick={() => show("cancel")}><Ban className="h-4 w-4" /> Darsni qoldirish</button>}
                <button type="button" className={item} onClick={() => show("substitute")}><ArrowLeftRight className="h-4 w-4" /> O&apos;qituvchini almashtirish</button>
                {substitutes.map((s) => (
                  <button key={s.role} type="button" disabled={pending} className={item} onClick={() => run(() => removeSubstitute(groupId, day, s.role), popover.close)}><RotateCcw className="h-4 w-4" /> Almashtirishni bekor qilish ({s.name})</button>
                ))}
              </>
            )}
          </div>
        )}
        {error && <p className="mt-1 rounded-xl bg-danger-tint px-3 py-2 text-xs text-danger">{error}</p>}
      </PopoverPanel>
      {dialog && <LessonChangeDialog kind={dialog} day={day} label={label} onClose={() => setDialog(null)} />}
    </>
  );
}
