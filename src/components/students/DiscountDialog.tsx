"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { BadgePercent } from "lucide-react";
import { saveDiscount, type MemberActionState } from "@/app/(app)/actions";
import { DialogFrame } from "../Modal";
import { Field } from "../ui";

/** "Chegirma berish": so'm off each month for one of the student's current groups; keeps what was typed when refused. */
export function DiscountDialog({ groups, firstMonth }: { groups: { id: number; name: string }[]; firstMonth: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<MemberActionState, FormData>(saveDiscount, null);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)} disabled={!groups.length} title={groups.length ? undefined : "O'quvchi hech qaysi guruhda emas"}>
        <BadgePercent className="h-4 w-4" /> Chegirma berish
      </button>
      {open && (
        <DialogFrame title="Chegirma berish" onClose={() => setOpen(false)}>
          <form onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); startTransition(() => action(data)); }} className="space-y-3">
            <Field label="Guruh">
              <select name="groupStudentId" className="input" required>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
            <Field label="Har oy chegirma (so'm)"><input name="amount" type="number" min={1} className="input" required placeholder="200000" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Qaysi oydan"><input name="from" type="month" className="input" required min={firstMonth} defaultValue={firstMonth} /></Field>
              <Field label="Qaysi oygacha"><input name="to" type="month" className="input" required min={firstMonth} defaultValue={firstMonth} /></Field>
            </div>
            <Field label="Sabab / izoh"><input name="reason" className="input" maxLength={120} placeholder="Masalan: 2+1 aksiya, aka-uka" /></Field>
            <p className="text-xs text-muted">Chegirma o&apos;quvchi to&apos;lovini kamaytiradi, o&apos;qituvchi ulushiga ta&apos;sir qilmaydi. Qisman oyda dars soniga qarab hisoblanadi.</p>
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
