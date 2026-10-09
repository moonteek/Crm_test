import { isoDate, PAYMENT_METHODS } from "@/lib/format";
import { Field, SubmitRow } from "./ui";
import { createPayment } from "@/app/(app)/actions";

type GroupOption = { id: number; name: string; course: { name: string; price?: number } };

export function PaymentForm({ studentId, groups }: { studentId: number; groups: GroupOption[] }) {
  return (
    <form action={createPayment} className="space-y-3">
      <input type="hidden" name="studentId" value={studentId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Summa (so'm)"><input name="amount" type="number" min={1} className="input" required /></Field>
        <Field label="To'lov turi">
          <select name="method" className="input">
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Guruh">
          <select name="groupId" className="input">
            <option value="">—</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.course.name})</option>)}
          </select>
        </Field>
        <Field label="Sana"><input name="date" type="date" className="input" defaultValue={isoDate(new Date())} /></Field>
      </div>
      <Field label="Izoh"><input name="note" className="input" /></Field>
      <SubmitRow text="To'lovni qabul qilish" />
    </form>
  );
}

export function StudentFields({ s }: { s?: { name: string; phone: string; parentPhone: string | null; birthDate: Date | null; note: string | null } }) {
  return (
    <>
      <Field label="Ism familiya"><input name="name" className="input" required defaultValue={s?.name} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefon"><input name="phone" className="input" required defaultValue={s?.phone} /></Field>
        <Field label="Ota-ona telefoni"><input name="parentPhone" className="input" defaultValue={s?.parentPhone ?? ""} /></Field>
      </div>
      <Field label="Tug'ilgan sana">
        <input name="birthDate" type="date" className="input" defaultValue={s?.birthDate ? isoDate(s.birthDate) : ""} />
      </Field>
      <Field label="Izoh"><textarea name="note" className="input" rows={2} defaultValue={s?.note ?? ""} /></Field>
    </>
  );
}
