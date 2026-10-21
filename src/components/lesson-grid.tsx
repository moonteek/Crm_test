"use client";

import { createContext, startTransition, useActionState, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cancelLesson, cancelMakeup, moveMakeup, substituteLesson, type MemberActionState } from "@/app/(app)/actions";
import { DialogFrame } from "./Modal";
import { Field } from "./ui";

// Shared by the attendance grid's date menu and cell popover.

type Opt = { id: number; name: string };
export type ReasonOpt = Opt & { color: string };

/** absence reason colours (same tints as tags) */
export const REASON_TONE: Record<string, string> = {
  amber: "bg-accent-tint text-accent-ink", green: "bg-success-tint text-success", red: "bg-danger-tint text-danger",
  orange: "bg-warning-tint text-warning", grey: "bg-ink/5 text-muted",
};

/** What every cell and date of one group's grid needs — sent once, not per cell. */
export type LessonGrid = {
  groupId: number; today: string; canMark: boolean; canManage: boolean;
  teachers: Opt[]; hasAssistant: boolean; reasons: ReasonOpt[];
  /** make-up lessons: every active teacher, the rooms, and the group's usual time / room */
  allTeachers: Opt[]; rooms: Opt[]; groupTime: string; groupRoomId: number | null;
};
const GridContext = createContext<LessonGrid | null>(null);
export function LessonGridProvider({ value, children }: { value: LessonGrid; children: React.ReactNode }) {
  return <GridContext.Provider value={value}>{children}</GridContext.Provider>;
}
export function useLessonGrid() {
  const grid = useContext(GridContext);
  if (!grid) throw new Error("LessonGridProvider missing");
  return grid;
}

/**
 * A popover drawn in a portal under its anchor: the grid scrolls and would clip or cover it. It follows the anchor
 * on scroll, and closes on a tap outside or Escape.
 */
export function usePopover(width: number) {
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  // under the anchor (above it when there's no room below), kept inside the screen with a 8px margin
  const place = useCallback(() => {
    const r = anchor.current!.getBoundingClientRect();
    const height = panel.current?.offsetHeight ?? 0;
    const below = r.bottom + 4;
    const above = r.top - height - 4;
    const y = height && below + height > window.innerHeight - 8 && above >= 8 ? above : below;
    return { x: Math.min(Math.max(8, r.left + r.width / 2 - width / 2), window.innerWidth - width - 8), y };
  }, [width]);
  const open = pos !== null;
  // once drawn (and whenever it grows, e.g. the reasons appear) its height is known: flip above if it doesn't fit below
  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    setPos(place());
    const watch = new ResizeObserver(() => setPos(place()));
    watch.observe(panel.current);
    return () => watch.disconnect();
  }, [open, place]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => !panel.current?.contains(e.target as Node) && !anchor.current?.contains(e.target as Node) && setPos(null);
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setPos(null);
    const follow = () => setPos(place());
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [open, place]);
  return { anchor, panel, pos, toggle: () => setPos(open ? null : place()), close: () => setPos(null) };
}

export function PopoverPanel({ popover, width, label, children }: {
  popover: ReturnType<typeof usePopover>; width: number; label: string; children: React.ReactNode;
}) {
  if (!popover.pos) return null;
  return createPortal(
    <div
      ref={popover.panel}
      role="dialog"
      aria-label={label}
      style={{ left: popover.pos.x, top: popover.pos.y, width }}
      className="fixed z-50 rounded-2xl border border-line bg-raised p-1.5 text-left text-ink font-normal normal-case tracking-normal shadow-xl"
    >
      {children}
    </div>,
    document.body,
  );
}

/** "Darsni qoldirish" / "O'qituvchini almashtirish" for one group lesson, as a dialog over the page. */
export function LessonChangeDialog({ kind, day, label, onClose }: { kind: "cancel" | "substitute"; day: string; label: string; onClose: () => void }) {
  const { groupId, teachers, hasAssistant } = useLessonGrid();
  return createPortal(
    kind === "cancel" ? (
      <ChangeDialog title={`Darsni qoldirish — ${label}`} action={cancelLesson} groupId={groupId} day={day} onDone={onClose}
        note="Butun guruh uchun; shu kungi belgilar o'chadi.">
        <CancelFields />
      </ChangeDialog>
    ) : (
      <ChangeDialog title={`O'qituvchini almashtirish — ${label}`} action={substituteLesson} groupId={groupId} day={day} onDone={onClose}
        note="Butun guruh darsi uchun: haq o'rinbosarga o'z ish haqi qoidasi bo'yicha hisoblanadi.">
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
    ),
    document.body,
  );
}

function ChangeDialog({
  title, action, groupId, day, note, onDone, children, noReason = false,
}: {
  title: string; action: (s: MemberActionState, f: FormData) => Promise<MemberActionState>; groupId: number; day: string; note: string;
  onDone: () => void; children?: React.ReactNode; noReason?: boolean;
}) {
  const [state, run, pending] = useActionState<MemberActionState, FormData>(action, null);
  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);
  return (
    <DialogFrame title={title} onClose={onDone}>
      <form onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); startTransition(() => run(data)); }} className="space-y-3 text-left normal-case">
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="date" value={day} />
        {children}
        {!noReason && <Field label="Sabab (ixtiyoriy)"><input name="reason" className="input" maxLength={200} placeholder="Masalan: o'qituvchi kasal" /></Field>}
        <p className="text-xs text-muted">{note}</p>
        {state?.error && <p className="rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{state.error}</p>}
        <div className="flex justify-end pt-1">
          <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saqlanmoqda..." : "Saqlash"}</button>
        </div>
      </form>
    </DialogFrame>
  );
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (day: string, n: number) => iso(new Date(new Date(day + "T00:00:00Z").getTime() + n * 86_400_000));

/** Make-up day, time, room and teacher; time and room default to the group's usual ones. */
function MakeupFields({ makeup }: { makeup?: { date: string; time: string; roomId: number | null; teacherId: number | null } }) {
  const { today, rooms, allTeachers, groupTime, groupRoomId } = useLessonGrid();
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Sana"><input name="makeupDate" type="date" className="input" required min={today} max={plusDays(today, 60)} defaultValue={makeup?.date} /></Field>
      <Field label="Vaqt"><input name="makeupTime" type="time" className="input" required defaultValue={makeup?.time ?? groupTime} /></Field>
      <Field label="Xona">
        <select name="makeupRoomId" className="input" defaultValue={makeup ? makeup.roomId ?? "" : groupRoomId ?? ""}>
          <option value="">—</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>
      <Field label="O'qituvchi">
        <select name="makeupTeacherId" className="input" defaultValue={makeup?.teacherId ?? ""}>
          <option value="">Guruh o&apos;qituvchisi</option>
          {allTeachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
    </div>
  );
}

/** The "charged" switch: on (default) = like a holiday, off = students charged and the teacher paid as if held. */
function BalanceToggle() {
  const [affects, setAffects] = useState(true);
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input type="checkbox" className="mt-0.5" checked={affects} onChange={(e) => setAffects(e.target.checked)} />
      <span>
        Talabalar va o&apos;qituvchi balansiga ta&apos;sir qilsin
        <span className="block text-xs text-muted">{affects ? "Bu dars uchun to'lov olinmaydi, o'qituvchiga hisoblanmaydi" : "To'lov olinadi va o'qituvchiga hisoblanadi (dars bo'lmasa ham)"}</span>
      </span>
      <input type="hidden" name="charged" value={affects ? "" : "1"} />
    </label>
  );
}

/** "Boshqa sanada darsni o'tasizmi?": a make-up day (money unchanged) or no make-up with the balance switch. */
function CancelFields() {
  const [makeup, setMakeup] = useState(false);
  return (
    <>
      <Field label="Boshqa sanada darsni o'tasizmi?">
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {([[true, "Ha, roziman"], [false, "Yo'q"]] as const).map(([v, label]) => (
            <button key={label} type="button" role="radio" aria-checked={makeup === v} onClick={() => setMakeup(v)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium ${makeup === v ? "border-ink bg-ink text-page" : "border-line bg-raised hover:border-ink"}`}>
              {label}
            </button>
          ))}
        </div>
      </Field>
      {makeup ? (
        <>
          <input type="hidden" name="makeup" value="1" />
          <MakeupFields />
          <p className="text-xs text-muted">Dars ko&apos;chiriladi: to&apos;lov va o&apos;qituvchi haqi o&apos;zgarmaydi; davomat qo&apos;shimcha kunda olinadi.</p>
        </>
      ) : <BalanceToggle />}
    </>
  );
}

/** A moved lesson's own menu: move it again, or cancel it (then it's a plain cancel, charged or not). */
export function MakeupDialog({ kind, original, makeup, onClose }: {
  kind: "move" | "cancel"; original: string; makeup: { date: string; time: string; roomId: number | null; teacherId: number | null }; onClose: () => void;
}) {
  const { groupId } = useLessonGrid();
  return createPortal(
    kind === "move" ? (
      <ChangeDialog title="Qo'shimcha darsni ko'chirish" action={moveMakeup} groupId={groupId} day={original} onDone={onClose} note="Pul o'zgarmaydi; yangi kunda davomat olinadi." noReason>
        <MakeupFields makeup={makeup} />
      </ChangeDialog>
    ) : (
      <ChangeDialog title="Qo'shimcha darsni bekor qilish" action={cancelMakeup} groupId={groupId} day={original} onDone={onClose} note="Asl dars bekor qilingan bo'lib qoladi." noReason>
        <BalanceToggle />
      </ChangeDialog>
    ),
    document.body,
  );
}
