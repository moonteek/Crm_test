"use client";

import { useState } from "react";
import { AtSign, IdCard, Mail, Phone, Send } from "lucide-react";
import { GENDERS, isoDate, LEAD_SOURCES } from "@/lib/format";
import { Field } from "./ui";

type StudentInfo = {
  name: string; phone: string; birthDate: Date | null;
  fatherName: string | null; fatherPhone: string | null; motherName: string | null; motherPhone: string | null;
  telegram: string | null; email: string | null;
  gender: string | null; phone2: string | null; school: string | null; address: string | null; source: string | null; passport: string | null;
};

type Extra = "telegram" | "email" | "phone2" | "passport";

/**
 * Student form fields: name, phone, birth date, father and mother; round icons open the extra contacts (Telegram,
 * email, extra phone, passport — passport only for staff who edit students); the rest folds under "+ qo'shimcha
 * ma'lumot".
 */
export function StudentFields({ s, canManage = true }: { s?: StudentInfo; canManage?: boolean }) {
  const icons: { key: Extra; label: string; icon: typeof Send }[] = [
    { key: "telegram", label: "Telegram", icon: Send },
    { key: "email", label: "Email", icon: Mail },
    { key: "phone2", label: "Qo'shimcha telefon", icon: Phone },
    ...(canManage ? [{ key: "passport" as const, label: "Pasport / ID", icon: IdCard }] : []),
  ];
  // a field that already has a value starts open
  const [open, setOpen] = useState<Set<Extra>>(new Set(icons.map((i) => i.key).filter((k) => Boolean(s?.[k]))));
  const toggle = (k: Extra) => setOpen((o) => {
    const n = new Set(o);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });
  const more = Boolean(s && (s.gender || s.school || s.address || s.source));
  return (
    <>
      <Field label="Ism familiya"><input name="name" className="input" required defaultValue={s?.name} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefon"><input name="phone" className="input" required defaultValue={s?.phone} /></Field>
        <Field label="Tug'ilgan sana">
          <input name="birthDate" type="date" className="input" defaultValue={s?.birthDate ? isoDate(s.birthDate) : ""} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Otasi (ism)"><input name="fatherName" className="input" maxLength={120} defaultValue={s?.fatherName ?? ""} /></Field>
        <Field label="Otasining telefoni"><input name="fatherPhone" className="input" maxLength={40} defaultValue={s?.fatherPhone ?? ""} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Onasi (ism)"><input name="motherName" className="input" maxLength={120} defaultValue={s?.motherName ?? ""} /></Field>
        <Field label="Onasining telefoni"><input name="motherPhone" className="input" maxLength={40} defaultValue={s?.motherPhone ?? ""} /></Field>
      </div>

      <div className="flex flex-wrap items-center gap-2" aria-label="Qo'shimcha aloqa">
        {icons.map(({ key, label, icon: Icon }) => (
          <button
            key={key} type="button" onClick={() => toggle(key)} aria-pressed={open.has(key)} aria-label={label} title={label}
            className={`relative flex h-10 w-10 items-center justify-center rounded-full border ${open.has(key) ? "border-ink bg-ink text-page" : "border-line bg-raised text-muted hover:border-ink"}`}
          >
            <Icon className="h-4 w-4" />
            {s?.[key] && !open.has(key) && <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-accent" />}
          </button>
        ))}
      </div>
      {open.has("telegram") && (
        <Field label="Telegram">
          <div className="relative">
            <AtSign className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
            <input name="telegram" className="input pl-9" maxLength={33} placeholder="username" defaultValue={s?.telegram ?? ""} />
          </div>
        </Field>
      )}
      {open.has("email") && <Field label="Email"><input name="email" type="email" className="input" maxLength={120} defaultValue={s?.email ?? ""} /></Field>}
      {open.has("phone2") && <Field label="Qo'shimcha telefon"><input name="phone2" className="input" maxLength={40} defaultValue={s?.phone2 ?? ""} /></Field>}
      {open.has("passport") && <Field label="Pasport / ID"><input name="passport" className="input" maxLength={40} defaultValue={s?.passport ?? ""} /></Field>}
      {/* closed icons keep their stored value (an edit must not wipe what isn't shown) */}
      {icons.filter((i) => !open.has(i.key)).map((i) => <input key={i.key} type="hidden" name={i.key} value={s?.[i.key] ?? ""} />)}

      <details className="rounded-xl border border-line px-3 py-2" open={more}>
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
          <Field label="Maktab / sinf"><input name="school" className="input" maxLength={120} placeholder="12-maktab, 7-sinf" defaultValue={s?.school ?? ""} /></Field>
          <Field label="Manzil"><input name="address" className="input" maxLength={200} defaultValue={s?.address ?? ""} /></Field>
        </div>
      </details>
    </>
  );
}
