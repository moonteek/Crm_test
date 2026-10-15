"use client";

import { startTransition, useActionState, useState } from "react";
import { saveReceipt, type MemberActionState } from "@/app/(app)/actions";
import { logoProblem, RECEIPT_LINE_LABEL, RECEIPT_LINES, SAMPLE_RECEIPT, type ReceiptSettings } from "@/lib/receipt";
import { Field } from "../ui";
import { ReceiptView } from "./ReceiptView";

export const DEFAULT_LOGO = "/receipt-logo.png";

/** Chek sozlamalari: the form on the left, the receipt it makes (with a sample payment) on the right, live. */
export function ReceiptSettingsForm({ saved }: { saved: ReceiptSettings }) {
  const [s, setS] = useState(saved);
  // "" = keep the stored logo, "remove" = back to the built-in one, else a new data URL
  const [upload, setUpload] = useState("");
  const [logoError, setLogoError] = useState<string | null>(null);
  const [state, run, pending] = useActionState<MemberActionState, FormData>(saveReceipt, null);
  const set = <K extends keyof ReceiptSettings>(k: K, v: ReceiptSettings[K]) => setS((x) => ({ ...x, [k]: v }));

  const pick = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const problem = logoProblem(url);
      setLogoError(problem);
      if (!problem) { setUpload(url); set("logo", url); }
    };
    reader.readAsDataURL(file);
  };
  const logoSrc = s.showLogo ? (s.logo ?? DEFAULT_LOGO) : null;

  return (
    <div className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
      <form
        className="card space-y-4 p-4 md:p-5"
        onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); data.set("logo", upload); startTransition(() => run(data)); }}
      >
        <div>
          <h2 className="font-semibold">Chek sozlamalari</h2>
          <p className="mt-0.5 text-sm text-muted">To&apos;lovdan keyin chiqariladigan chek. O&apos;ngda — qanday ko&apos;rinishi.</p>
        </div>
        <Field label="Markaz nomi"><input name="name" className="input" required maxLength={60} value={s.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Telefon (ixtiyoriy)"><input name="phone" className="input" maxLength={40} value={s.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+998 90 123 45 67" /></Field>
          <Field label="Qog'oz kengligi">
            <select name="paper" className="input" value={s.paper} onChange={(e) => set("paper", e.target.value === "58" ? 58 : 80)}>
              <option value="80">80 mm</option>
              <option value="58">58 mm</option>
            </select>
          </Field>
        </div>
        <Field label="Manzil (ixtiyoriy)"><input name="address" className="input" maxLength={120} value={s.address} onChange={(e) => set("address", e.target.value)} placeholder="Toshkent, Chilonzor 1" /></Field>

        <fieldset className="space-y-2">
          <legend className="label-mono mb-1">Logotip</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="showLogo" checked={s.showLogo} onChange={(e) => set("showLogo", e.target.checked)} /> Logotipni ko&apos;rsatish
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-ghost cursor-pointer border border-line">
              Rasm yuklash (PNG / JPG, 300 KB gacha)
              <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
            {s.logo && (
              <button type="button" className="btn-ghost text-danger" onClick={() => { setUpload("remove"); set("logo", null); setLogoError(null); }}>
                Standart logotipga qaytarish
              </button>
            )}
          </div>
          {logoError && <p className="rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{logoError}</p>}
          <p className="text-xs text-muted">Chek printeri faqat qora rangda chop etadi — oq fonli, aniq logotip yaxshi chiqadi.</p>
        </fieldset>

        <fieldset>
          <legend className="label-mono mb-2">Chekdagi qatorlar</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {RECEIPT_LINES.map((l) => (
              <label key={l} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={`line_${l}`} checked={s.lines[l]} onChange={(e) => set("lines", { ...s.lines, [l]: e.target.checked })} />
                {RECEIPT_LINE_LABEL[l]}
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked disabled /> Summa (doim)</label>
          </div>
        </fieldset>

        {state?.error && <p className="rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{state.error}</p>}
        {state?.ok && !pending && <p className="rounded-xl bg-success-tint px-3 py-2 text-sm text-success">Saqlandi</p>}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saqlanmoqda..." : "Saqlash"}</button>
        </div>
      </form>

      <section className="card p-4 md:p-5" aria-label="Chek ko'rinishi">
        <h2 className="mb-3 font-semibold">Chek ko&apos;rinishi</h2>
        <div className="overflow-x-auto rounded-xl bg-ink/5 p-4">
          <ReceiptView settings={s} data={SAMPLE_RECEIPT} logoSrc={logoSrc} />
        </div>
      </section>
    </div>
  );
}
