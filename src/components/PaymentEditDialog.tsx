"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { editPayment, type MemberActionState } from "@/app/(app)/actions";
import { PAYMENT_METHODS } from "@/lib/format";
import { monthOptions } from "@/lib/payments";
import { DialogFrame } from "./Modal";
import { Field } from "./ui";

type P = { id: number; amount: number; method: string; date: string; month: string | null; note: string | null; student: string };

/** "Tahrirlash" for one payment; every change is kept as history under the payment. */
export function PaymentEditDialog({ payment }: { payment: P }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<MemberActionState, FormData>(editPayment, null);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);
  const months = monthOptions(new Date());
  if (payment.month && !months.some((m) => m.value === payment.month)) months.unshift({ value: payment.month, label: payment.month });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-faint hover:text-ink" aria-label="To'lovni tahrirlash" title="Tahrirlash">
        <Pencil className="h-4 w-4" />
      </button>
      {open && (
        <DialogFrame title={`To'lov — ${payment.student}`} onClose={() => setOpen(false)}>
          <form onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); startTransition(() => action(data)); }} className="space-y-3">
            <input type="hidden" name="id" value={payment.id} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Summa (so'm)"><input name="amount" type="number" min={1} className="input" required defaultValue={payment.amount} /></Field>
              <Field label="To'lov turi">
                <select name="method" className="input" defaultValue={payment.method}>
                  {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sana"><input name="date" type="date" className="input" defaultValue={payment.date} /></Field>
              <Field label="Qaysi oy uchun">
                <select name="month" className="input" defaultValue={payment.month ?? ""}>
                  <option value="">—</option>
                  {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Izoh"><input name="note" className="input" defaultValue={payment.note ?? ""} /></Field>
            <p className="text-xs text-muted">O&apos;zgarish tarixda saqlanadi: kim, qachon, nimadan nimaga.</p>
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
