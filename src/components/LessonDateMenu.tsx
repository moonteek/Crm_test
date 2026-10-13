"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, Ban, Check, ListChecks, RotateCcw } from "lucide-react";
import {
  cancelLesson, markAllPresent, removeSubstitute, restoreLesson, setAbsenceReason, substituteLesson, type MemberActionState,
} from "@/app/(app)/actions";
import { DialogFrame } from "./Modal";
import { Field } from "./ui";

type Opt = { id: number; name: string };
type Absent = { studentId: number; name: string; reasonId: number | null };

/**
 * The menu on a lesson date in the attendance grid: everyone present, absence reasons, cancel the lesson, or a
 * substitute teacher for it — each item only for staff allowed to do it.
 */
export function LessonDateMenu({
  groupId, day, label, cancelled, substitutes, canMark, canManage, teachers, hasAssistant, absent, reasons, past,
}: {
  groupId: number; day: string; label: string;
  cancelled: string | null; // reason ("" when none) or null when not cancelled
  substitutes: { role: string; name: string }[];
  canMark: boolean; canManage: boolean; teachers: Opt[]; hasAssistant: boolean;
  absent: Absent[]; reasons: (Opt & { color: string })[]; past: boolean;
}) {
  // the menu is drawn in a portal at the date's position: the grid scrolls and would clip or cover it
  const [open, setOpen] = useState<{ x: number; y: number } | null>(null);
  const [dialog, setDialog] = useState<"reasons" | "cancel" | "substitute" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  // under the date, 240px wide, kept inside the screen with a 8px margin
  const place = () => {
    const r = button.current!.getBoundingClientRect();
    return { x: Math.min(Math.max(8, r.left + r.width / 2 - 120), window.innerWidth - 248), y: r.bottom + 4 };
  };
  const isOpen = open !== null;
  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent) => !menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node) && setOpen(null);
    const follow = () => setOpen(place()); // the page or the grid scrolled: stay under the date
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("scroll", follow, true); window.removeEventListener("resize", follow); };
  }, [isOpen]);
  const toggle = () => setOpen(open ? null : place());
  const run = (fn: () => Promise<unknown>) => startTransition(async () => {
    setError(null);
    try { await fn(); setOpen(null); } catch (e) { setError((e as Error).message); }
  });
  const item = "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-ink/5";
  // a teacher on a lesson yet to come has nothing to do here: no empty menu
  const anything = canManage || (cancelled === null && canMark && (past || absent.length > 0));

  return (
    <div className="inline-block">
      <button
        ref={button}
        type="button"
        disabled={!anything}
        onClick={toggle}
        className={`rounded-md px-1 font-medium ${cancelled !== null ? "text-faint line-through" : ""} ${anything ? "hover:bg-ink/5" : ""}`}
        title={cancelled !== null ? `Dars bekor qilingan${cancelled ? `: ${cancelled}` : ""}` : substitutes.length ? substitutes.map((s) => `O'rinbosar: ${s.name}`).join(", ") : undefined}
        aria-label={`${label} — dars amallari`}
      >
        {label}{substitutes.length > 0 && <span className="ml-0.5 text-accent-ink">↔</span>}
      </button>
      {open && createPortal(
        <div ref={menu} style={{ left: open.x, top: open.y }} className="fixed z-50 w-60 rounded-2xl border border-line bg-raised p-1.5 text-left text-ink font-normal normal-case tracking-normal shadow-xl">
          {cancelled === null && canMark && past && (
            <button type="button" className={item} onClick={() => run(() => markAllPresent(groupId, day))}><Check className="h-4 w-4 text-success" /> Hammasi keldi</button>
          )}
          {cancelled === null && canMark && absent.length > 0 && (
            <button type="button" className={item} onClick={() => { setOpen(null); setDialog("reasons"); }}><ListChecks className="h-4 w-4" /> Kelmaganlik sabablari</button>
          )}
          {canManage && (cancelled === null ? (
            <>
              {substitutes.length === 0 && <button type="button" className={`${item} text-danger`} onClick={() => { setOpen(null); setDialog("cancel"); }}><Ban className="h-4 w-4" /> Darsni qoldirish</button>}
              <button type="button" className={item} onClick={() => { setOpen(null); setDialog("substitute"); }}><ArrowLeftRight className="h-4 w-4" /> O&apos;qituvchini almashtirish</button>
              {substitutes.map((s) => (
                <button key={s.role} type="button" className={item} onClick={() => run(() => removeSubstitute(groupId, day, s.role))}><RotateCcw className="h-4 w-4" /> Almashtirishni bekor qilish ({s.name})</button>
              ))}
            </>
          ) : (
            <button type="button" className={item} onClick={() => run(() => restoreLesson(groupId, day))}><RotateCcw className="h-4 w-4" /> Qoldirishni bekor qilish</button>
          ))}
          {error && <p className="mt-1 rounded-xl bg-danger-tint px-3 py-2 text-xs text-danger">{error}</p>}
        </div>,
        document.body,
      )}
      {dialog && createPortal(<>
      {dialog === "reasons" && (
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
        </DialogFrame>
      )}
      {dialog === "cancel" && (
        <ChangeDialog title={`Darsni qoldirish — ${label}`} action={cancelLesson} groupId={groupId} day={day} onDone={() => setDialog(null)}
          note="O'quvchilardan bu dars uchun to'lov olinmaydi, o'qituvchiga hisoblanmaydi; shu kungi belgilar o'chadi." />
      )}
      {dialog === "substitute" && (
        <ChangeDialog title={`O'qituvchini almashtirish — ${label}`} action={substituteLesson} groupId={groupId} day={day} onDone={() => setDialog(null)}
          note="Bu dars uchun haq o'rinbosarga o'z ish haqi qoidasi bo'yicha hisoblanadi.">
          {hasAssistant && (
            <Field label="Kim o'rniga">
              <select name="role" className="input" defaultValue="TEACHER">
                <option value="TEACHER">O&apos;qituvchi</option>
                <option value="ASSISTANT">Yordamchi o&apos;qituvchi</option>
              </select>
            </Field>
          )}
          <Field label="O'rinbosar">
            <select name="substituteId" className="input" required defaultValue="">
              <option value="" disabled>O&apos;qituvchini tanlang</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </ChangeDialog>
      )}
      </>, document.body)}
    </div>
  );
}

function ChangeDialog({
  title, action, groupId, day, note, onDone, children,
}: {
  title: string; action: (s: MemberActionState, f: FormData) => Promise<MemberActionState>; groupId: number; day: string; note: string;
  onDone: () => void; children?: React.ReactNode;
}) {
  const [state, run, pending] = useActionState<MemberActionState, FormData>(action, null);
  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);
  return (
    <DialogFrame title={title} onClose={onDone}>
      <form onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); startTransition(() => run(data)); }} className="space-y-3 text-left normal-case">
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="date" value={day} />
        {children}
        <Field label="Sabab (ixtiyoriy)"><input name="reason" className="input" maxLength={200} placeholder="Masalan: o'qituvchi kasal" /></Field>
        <p className="text-xs text-muted">{note}</p>
        {state?.error && <p className="rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{state.error}</p>}
        <div className="flex justify-end pt-1">
          <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saqlanmoqda..." : "Saqlash"}</button>
        </div>
      </form>
    </DialogFrame>
  );
}
