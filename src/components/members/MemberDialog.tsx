"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { chargeChangeIf, previewCharge, totalCharges } from "@/lib/billing";
import { money, MONTHS } from "@/lib/format";
import type { EventType } from "@/lib/membership";
import { centreToday } from "@/lib/schedule";
import { memberAction, transferStudent, type MemberActionState } from "@/app/(app)/actions";
import { DialogFrame } from "../Modal";
import { Field } from "../ui";
import { toBillable, type MemberData, type MemberGroup, type ReasonOption } from "./types";

export type MemberDialogKind = "ACTIVATE" | "FREEZE" | "UNFREEZE" | "BACK_TO_TRIAL" | "LEAVE" | "TRANSFER";

const TITLE: Record<MemberDialogKind, string> = {
  ACTIVATE: "Faollashtirish",
  FREEZE: "Muzlatish",
  UNFREEZE: "Muzlatishdan chiqarish",
  BACK_TO_TRIAL: "Sinov darsiga qaytarish",
  LEAVE: "Guruhdan chiqarish",
  TRANSFER: "Boshqa guruhga o'tkazish",
};
const NEEDS_REASON: MemberDialogKind[] = ["FREEZE", "LEAVE", "TRANSFER"];
const STARTS: MemberDialogKind[] = ["ACTIVATE", "UNFREEZE"];

const today = () => {
  const t = centreToday();
  return `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
};
const ddmm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

function PreviewLine({ kind, member, date }: { kind: Exclude<MemberDialogKind, "TRANSFER">; member: MemberData; date: Date }) {
  const p = previewCharge(toBillable(member), { type: kind as EventType, date });
  const month = MONTHS[p.month];
  if (p.legacy) {
    return (
      <p className="text-sm text-muted">
        {month}: 1-noyabrgacha eski qoida — oy to&apos;liq hisoblanadi: <b className="text-ink">{money(p.amount)}</b>. Darsbay hisob 1-noyabrdan.
      </p>
    );
  }
  if (!p.billable) return <p className="text-sm text-muted">{month}: bu guruhda dars hisoblanmaydi — <b className="text-ink">0 so&apos;m</b></p>;
  return STARTS.includes(kind) ? (
    <p className="text-sm text-muted">
      {month}: <b className="text-ink">{ddmm(p.from!)}</b> dan <b className="text-ink">{ddmm(p.to!)}</b> gacha {p.billable} ta dars —{" "}
      <b className="text-ink">{money(p.amount)}</b>
    </p>
  ) : (
    <p className="text-sm text-muted">
      {month}: talaba <b className="text-ink">{ddmm(p.from!)}</b> dan <b className="text-ink">{ddmm(p.to!)}</b> gacha o&apos;qidi ({p.billable}/{p.lessons} dars) —{" "}
      <b className="text-ink">{money(p.amount)}</b>
    </p>
  );
}

export function MemberDialog({
  kind, member, reasons, groups, balance, onClose,
}: {
  kind: MemberDialogKind;
  member: MemberData;
  reasons: ReasonOption[];
  groups: MemberGroup[];
  balance: number | null;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<MemberActionState, FormData>(kind === "TRANSFER" ? transferStudent : memberAction, null);
  const [dateStr, setDateStr] = useState(today());
  const [toGroupId, setToGroupId] = useState<number | null>(null);
  const [mode, setMode] = useState<"ACTIVE" | "TRIAL">("ACTIVE");
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);

  const date = useMemo(() => new Date(`${dateStr || today()}T00:00:00Z`), [dateStr]);
  const target = groups.find((g) => g.id === toGroupId) ?? null;

  // how the balance moves: every month from the action up to today can change (a late freeze cancels later months too)
  const now = new Date();
  let delta = chargeChangeIf(toBillable(member), { type: kind === "TRANSFER" ? "LEAVE" : (kind as EventType), date }, now);
  if (kind === "TRANSFER" && target && mode === "ACTIVE") {
    delta += totalCharges([toBillable({ events: [{ type: "ACTIVATE", date: date.toISOString() }], group: target })], now);
  }

  return (
    <DialogFrame title={`${TITLE[kind]} — ${member.student.name}`} onClose={onClose}>
      <form action={action} className="space-y-3">
        <input type="hidden" name="groupStudentId" value={member.id} />
        {kind !== "TRANSFER" && <input type="hidden" name="type" value={kind} />}
        <p className="label-mono">{member.group.name}</p>

        {kind === "TRANSFER" && (
          <Field label="Yangi guruh">
            <select name="toGroupId" className="input" required value={toGroupId ?? ""} onChange={(e) => setToGroupId(Number(e.target.value) || null)}>
              <option value="">Guruhni tanlang</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name} — {g.course.name}</option>)}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={STARTS.includes(kind) ? "Qaysi kundan" : "Sana"}>
            <input name="date" type="date" className="input" value={dateStr} onChange={(e) => setDateStr(e.target.value)} required />
          </Field>
          {NEEDS_REASON.includes(kind) && (
            <Field label="Sabab">
              <select name="reasonId" className="input" required defaultValue="">
                <option value="">Sababni tanlang</option>
                {reasons.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
          )}
        </div>

        {kind === "TRANSFER" && (
          <div className="flex gap-2">
            {(["ACTIVE", "TRIAL"] as const).map((m) => (
              <label key={m} className={`press flex-1 cursor-pointer rounded-full border px-3 py-2 text-center text-sm font-medium ${mode === m ? "border-ink bg-ink/5" : "border-line text-muted"}`}>
                <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
                {m === "ACTIVE" ? "Faol bo'lib o'tadi" : "Sinov darsida"}
              </label>
            ))}
          </div>
        )}

        {(kind === "FREEZE" || kind === "LEAVE") && (
          <Field label="Izoh (ixtiyoriy)"><input name="comment" className="input" maxLength={300} /></Field>
        )}

        <div className="space-y-1.5 rounded-xl border border-line bg-raised p-3">
          {kind === "TRANSFER" ? (
            <>
              <PreviewLine kind="LEAVE" member={member} date={date} />
              {target && mode === "ACTIVE" && <PreviewLine kind="ACTIVATE" member={{ ...member, events: [], group: target }} date={date} />}
              {target && mode === "TRIAL" && <p className="text-sm text-muted">{target.name}: sinov darslari bepul</p>}
            </>
          ) : (
            <PreviewLine kind={kind} member={member} date={date} />
          )}
          {balance !== null && (
            <p className="label-mono pt-1">
              Balans: {money(balance)} → <span className={balance - delta < 0 ? "text-danger" : "text-success"}>{money(balance - delta)}</span>
            </p>
          )}
        </div>

        {state?.error && <p className="rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{state.error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Bekor qilish</button>
          <button className={kind === "LEAVE" ? "btn-danger" : "btn-primary"} disabled={pending || (kind === "TRANSFER" && !target)}>
            {pending ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}
