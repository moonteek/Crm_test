import { requirePage } from "@/lib/auth";
import { Field } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { getRiskSettings } from "@/lib/risk-db";
import type { RiskSettings } from "@/lib/risk";
import { saveRiskSettings } from "../../actions";

const FIELDS: { key: keyof RiskSettings; label: string; hint: string; step?: string }[] = [
  { key: "streak", label: "Ketma-ket qoldirilgan darslar", hint: "Shuncha dars ketma-ket \"kelmadi\" bo'lsa (kechikdi — keldi hisoblanadi)" },
  { key: "ratePercent", label: "Davomat chegarasi (%)", hint: "Davr ichidagi davomat shundan past bo'lsa" },
  { key: "days", label: "Davr (kun)", hint: "Davomat va baholar shu kunlar ichida hisoblanadi" },
  { key: "minLessons", label: "Kamida belgilangan darslar", hint: "Davomat foizi shundan kam dars bo'lsa hisoblanmaydi" },
  { key: "lowGrade", label: "Past o'rtacha baho", hint: "Davr ichidagi o'rtacha baho shundan past bo'lsa", step: "0.1" },
  { key: "gradeDrop", label: "Baho tushishi", hint: "O'rtacha baho oldingi davrga nisbatan shuncha tushsa", step: "0.1" },
  { key: "minGrades", label: "Kamida baholar soni", hint: "Baholar shundan kam bo'lsa o'rtacha hisoblanmaydi" },
];

export default async function RiskSettingsPage() {
  await requirePage("staff.manage");
  const s = await getRiskSettings();
  return (
    <div className="card max-w-2xl p-4 md:p-5">
      <h2 className="font-semibold">Xavfli o&apos;quvchilar</h2>
      <p className="mt-0.5 mb-4 text-sm text-muted">
        Faol va sinovdagi o&apos;quvchi shu chegaralardan biriga tushsa, &quot;Xavfli o&apos;quvchilar&quot; ro&apos;yxatida chiqadi. Daraja imtihonidan o&apos;tmaganlar ham chiqadi.
      </p>
      <ActionForm action={saveRiskSettings}>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <input name={f.key} type="number" step={f.step ?? "1"} className="input" required defaultValue={s[f.key]} />
              <p className="mt-1 text-xs text-muted">{f.hint}</p>
            </Field>
          ))}
        </div>
      </ActionForm>
    </div>
  );
}
