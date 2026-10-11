import { GENDERS, isoDate, LEAD_SOURCES, PAYMENT_METHODS } from "@/lib/format";
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

type StudentInfo = {
  name: string; phone: string; parentPhone: string | null; birthDate: Date | null;
  gender: string | null; parentName: string | null; phone2: string | null; school: string | null; address: string | null; source: string | null; passport: string | null;
};

/** Student form fields; the extra details fold under "+ qo'shimcha ma'lumot". Passport only for staff who edit students. */
export function StudentFields({ s, canManage = true }: { s?: StudentInfo; canManage?: boolean }) {
  const extra = Boolean(s && (s.gender || s.parentName || s.phone2 || s.school || s.address || s.source || s.passport));
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
      <details className="rounded-xl border border-line px-3 py-2" open={extra}>
        <summary className="cursor-pointer text-sm font-medium text-accent-ink">+ qo&apos;shimcha ma&apos;lumot</summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jinsi">
              <select name="gender" className="input" defaultValue={s?.gender ?? ""}>
                <option value="">—</option>
                {Object.entries(GENDERS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </Field>
            <Field label="Qayerdan keldi">
              <select name="source" className="input" defaultValue={s?.source ?? ""}>
                <option value="">—</option>
                {LEAD_SOURCES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ota-ona ismi"><input name="parentName" className="input" maxLength={120} defaultValue={s?.parentName ?? ""} /></Field>
            <Field label="Qo'shimcha telefon"><input name="phone2" className="input" maxLength={40} defaultValue={s?.phone2 ?? ""} /></Field>
          </div>
          <Field label="Maktab / sinf"><input name="school" className="input" maxLength={120} placeholder="12-maktab, 7-sinf" defaultValue={s?.school ?? ""} /></Field>
          <Field label="Manzil"><input name="address" className="input" maxLength={200} defaultValue={s?.address ?? ""} /></Field>
          {canManage && <Field label="Pasport / ID"><input name="passport" className="input" maxLength={40} defaultValue={s?.passport ?? ""} /></Field>}
        </div>
      </details>
    </>
  );
}
