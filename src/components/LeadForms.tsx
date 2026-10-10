import { CALL_RESULTS, LOST_REASONS } from "@/lib/format";
import { Field, SubmitRow } from "./ui";
import { addLeadActivity, setLeadStatus } from "@/app/(app)/actions";

/** Local date-time string for <input type="datetime-local">, defaulting to tomorrow 10:00. */
function tomorrowAt10() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function ActivityForm({ leadId }: { leadId: number }) {
  return (
    <form action={addLeadActivity.bind(null, leadId)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Turi">
          <select name="type" className="input" defaultValue="CALL">
            <option value="CALL">Qo&apos;ng&apos;iroq</option>
            <option value="MESSAGE">Xabar (Telegram / Instagram)</option>
            <option value="MEETING">Uchrashuv</option>
            <option value="NOTE">Izoh</option>
          </select>
        </Field>
        <Field label="Qo'ng'iroq natijasi">
          <select name="result" className="input" defaultValue="ANSWERED">
            {Object.entries(CALL_RESULTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Nima gaplashildi">
        <textarea name="text" className="input" rows={2} placeholder="Masalan: narxni so'radi, shanba kuni sinov darsiga keladi" />
      </Field>
      <Field label="Keyingi aloqa (eslatma)">
        <input name="nextActionAt" type="datetime-local" className="input" defaultValue={tomorrowAt10()} />
      </Field>
      <SubmitRow />
    </form>
  );
}

export function LostForm({ leadId }: { leadId: number }) {
  return (
    <form action={setLeadStatus.bind(null, leadId, "LOST")} className="space-y-3">
      <Field label="Nima uchun rad etdi?">
        <select name="lostReason" className="input" required>
          {LOST_REASONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </Field>
      <SubmitRow text="Rad etdi deb belgilash" />
    </form>
  );
}
