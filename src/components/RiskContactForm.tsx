"use client";

import { recordRiskContact } from "@/app/(app)/actions";
import { CONTACT_RESULTS } from "@/lib/risk";
import { ActionForm } from "./ActionForm";
import { Field } from "./ui";

/** "Bog'lanildi" dialog: the call's result and an optional comment. */
export function RiskContactForm({ studentId }: { studentId: number }) {
  return (
    <ActionForm action={recordRiskContact.bind(null, studentId)}>
      <Field label="Natija">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Natija">
          {Object.entries(CONTACT_RESULTS).map(([k, label]) => (
            <label key={k} className="cursor-pointer">
              <input type="radio" name="result" value={k} required className="peer sr-only" />
              <span className="block rounded-xl border border-line bg-raised px-3 py-2.5 text-center text-sm font-medium peer-checked:border-ink peer-checked:bg-ink peer-checked:text-page peer-focus-visible:ring-2 peer-focus-visible:ring-accent hover:border-ink">
                {label}
              </span>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Izoh (ixtiyoriy)">
        <textarea name="comment" className="input" rows={3} maxLength={500} placeholder="Masalan: onasi bilan gaplashildi, keyingi haftadan keladi" />
      </Field>
    </ActionForm>
  );
}
