"use client";

import { useState } from "react";
import { createPayment } from "@/app/(app)/actions";
import { isoDate, money, PAYMENT_METHODS } from "@/lib/format";
import { defaultAmount, monthOptions } from "@/lib/payments";
import { Field, SubmitRow } from "./ui";

export type PaymentGroup = { id: number; name: string; price: number };

/**
 * Take a payment: shows the group's monthly price and the student's debt and suggests the amount (the debt, or the
 * monthly price when nothing is owed). `balance` is null for staff who can't see balances.
 */
export function PaymentForm({ studentId, groups, balance }: { studentId: number; groups: PaymentGroup[]; balance: number | null }) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? 0);
  const price = groups.find((g) => g.id === groupId)?.price ?? 0;
  const [amount, setAmount] = useState(String(defaultAmount(balance ?? 0, price)));
  const [touched, setTouched] = useState(false);
  const months = monthOptions(new Date());

  return (
    <form action={createPayment} className="space-y-3">
      <input type="hidden" name="studentId" value={studentId} />
      <Field label="Guruh">
        <select
          name="groupId"
          className="input"
          value={groupId || ""}
          onChange={(e) => {
            const id = Number(e.target.value);
            setGroupId(id);
            // follow the group's price until the cashier types an amount
            if (!touched) setAmount(String(defaultAmount(balance ?? 0, groups.find((g) => g.id === id)?.price ?? 0)));
          }}
        >
          {groups.length === 0 && <option value="">—</option>}
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </Field>
      <p className="rounded-xl bg-raised px-3 py-2 text-sm text-muted">
        Guruh narxi: <b className="text-ink">{money(price)}</b> / oy
        {balance !== null && <> · {balance < 0 ? <>Qarz: <b className="text-danger">{money(-balance)}</b></> : <>Qarz yo&apos;q</>}</>}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Summa (so'm)">
          <input name="amount" type="number" min={1} className="input" required value={amount} onChange={(e) => { setAmount(e.target.value); setTouched(true); }} />
        </Field>
        <Field label="To'lov turi">
          <select name="method" className="input">
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sana"><input name="date" type="date" className="input" defaultValue={isoDate(new Date())} /></Field>
        <Field label="Qaysi oy uchun">
          <select name="month" className="input" defaultValue={months[1].value}>
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Izoh"><input name="note" className="input" /></Field>
      <SubmitRow text="To'lovni qabul qilish" />
    </form>
  );
}
