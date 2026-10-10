"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, CircleDollarSign, LogOut, MoreHorizontal, Pause, Play, RotateCcw, UserCheck } from "lucide-react";
import { menuActions, type Status } from "@/lib/membership";
import { PaymentForm } from "../forms";
import { DialogFrame } from "../Modal";
import { MemberDialog, type MemberDialogKind } from "./MemberDialog";
import type { MemberData, MemberGroup, ReasonOption } from "./types";

const ITEMS: { kind: MemberDialogKind; label: string; icon: typeof Play }[] = [
  { kind: "ACTIVATE", label: "Faollashtirish", icon: UserCheck },
  { kind: "FREEZE", label: "Muzlatish", icon: Pause },
  { kind: "UNFREEZE", label: "Muzlatishdan chiqarish", icon: Play },
  { kind: "BACK_TO_TRIAL", label: "Sinov darsiga qaytarish", icon: RotateCcw },
  { kind: "TRANSFER", label: "Boshqa guruhga o'tkazish", icon: ArrowLeftRight },
  { kind: "LEAVE", label: "Guruhdan chiqarish", icon: LogOut },
];

/** The ⋯ menu for one student in one group: payment and every status change the status allows. */
export function MemberMenu({
  member, reasons, groups, balance, canManage, canPay,
}: {
  member: MemberData;
  reasons: ReasonOption[];
  groups: MemberGroup[];
  balance: number | null;
  canManage: boolean;
  canPay: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<MemberDialogKind | "PAY" | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setDialog(null), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const allowed = new Set<string>(menuActions(member.status as Status));
  const items = canManage
    ? ITEMS.filter((i) => (i.kind === "TRANSFER" ? member.status !== "LEFT" : allowed.has(i.kind)))
    : [];
  if (!items.length && !canPay) return null;

  const choose = (kind: MemberDialogKind | "PAY") => {
    setOpen(false);
    setDialog(kind);
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${member.student.name}: amallar`}
        className="btn-ghost px-2 py-1.5"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-60 animate-pop rounded-2xl border border-line bg-surface p-1.5 shadow-lg">
          {canPay && (
            <button type="button" role="menuitem" onClick={() => choose("PAY")} className="press flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-ink/5">
              <CircleDollarSign className="h-4 w-4 text-muted" /> To&apos;lov qilish
            </button>
          )}
          {items.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              onClick={() => choose(kind)}
              className={`press flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-ink/5 ${kind === "LEAVE" ? "text-danger" : ""}`}
            >
              <Icon className={`h-4 w-4 ${kind === "LEAVE" ? "" : "text-muted"}`} /> {label}
            </button>
          ))}
        </div>
      )}
      {dialog === "PAY" && (
        <DialogFrame title={`To'lov — ${member.student.name}`} onClose={close}>
          <div onSubmit={() => setTimeout(close, 0)}>
            <PaymentForm studentId={member.student.id} groups={[{ id: member.group.id, name: member.group.name, course: member.group.course }]} />
          </div>
        </DialogFrame>
      )}
      {dialog && dialog !== "PAY" && (
        <MemberDialog
          kind={dialog}
          member={member}
          reasons={reasons}
          groups={groups.filter((g) => g.id !== member.group.id)}
          balance={balance}
          onClose={close}
        />
      )}
    </div>
  );
}
