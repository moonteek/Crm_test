"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Trash2, User } from "lucide-react";
import { saveTeacher } from "@/app/(app)/actions";
import { imageProblem } from "@/lib/image";
import { STAFF_GENDERS } from "@/lib/teacher-profile";
import { SALARY_TYPES } from "@/lib/salary-types";
import { Field } from "./ui";

export type TeacherFormData = {
  id: number; name: string; phone: string; roleId: number; gender: string | null; birthDate: string | null;
  photo: string | null; telegramChatId: string | null; note: string | null; salaryType: string; salaryAmount: number;
};

/**
 * Add (no `teacher`) or edit a teacher. Errors stay in the form with what was typed; the dialog around it closes only
 * after a successful save. Salary fields show only for staff who may manage salaries.
 */
export function TeacherForm({
  teacher, roles, defaultRoleId, canSalary,
}: { teacher?: TeacherFormData; roles: { id: number; name: string }[]; defaultRoleId?: number; canSalary: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [gender, setGender] = useState(teacher?.gender ?? "");
  const [salaryType, setSalaryType] = useState(teacher?.salaryType ?? "PERCENT");
  // "" = keep the stored photo, "remove" = no photo, else a new data URL
  const [upload, setUpload] = useState("");
  const [preview, setPreview] = useState(teacher?.photo ?? null);
  const closer = useRef<HTMLFormElement>(null);

  const pick = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const problem = imageProblem(url, "Rasm");
      setError(problem);
      if (!problem) { setUpload(url); setPreview(url); }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          // the dialog closes on a submit: hold it until the teacher is saved (or refused)
          e.preventDefault();
          e.stopPropagation();
          const data = new FormData(e.currentTarget);
          data.set("photo", upload);
          start(async () => {
            setError(null);
            const res = await saveTeacher(null, data);
            if (res?.error) return setError(res.error);
            closer.current?.requestSubmit(); // an empty submit that reaches the dialog and closes it
          });
        }}
      >
        {teacher && <input type="hidden" name="id" value={teacher.id} />}
        <p className="label-mono">Asosiy ma&apos;lumotlar</p>
        <Field label="Ism familiya (FISH)"><input name="name" className="input" required maxLength={120} defaultValue={teacher?.name} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Telefon (login)"><input name="phone" className="input" required inputMode="tel" defaultValue={teacher?.phone} placeholder="90 123 45 67" /></Field>
          <Field label={teacher ? "Yangi parol (ixtiyoriy)" : "Parol"}>
            <input name="password" type="password" className="input" required={!teacher} minLength={6} autoComplete="new-password" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Jinsi">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Jinsi">
              {Object.entries(STAFF_GENDERS).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={gender === k}
                  onClick={() => setGender(k)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${gender === k ? "border-ink bg-ink text-page" : "border-line bg-raised hover:border-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input type="hidden" name="gender" value={gender} />
          </Field>
          <Field label="Tug'ilgan sana"><input name="birthDate" type="date" className="input" defaultValue={teacher?.birthDate ?? ""} /></Field>
        </div>
        <Field label="Rol">
          <select name="roleId" className="input" defaultValue={teacher?.roleId ?? defaultRoleId}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        {canSalary && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={salaryType === "PERCENT" ? "Ish haqi (%)" : "Ish haqi (so'm)"}>
              <input name="salaryAmount" type="number" min={0} max={salaryType === "PERCENT" ? 100 : undefined} className="input" disabled={salaryType === "NONE"} defaultValue={teacher?.salaryAmount || ""} />
            </Field>
            <Field label="Maosh turi">
              <select name="salaryType" className="input" value={salaryType} onChange={(e) => setSalaryType(e.target.value)}>
                {Object.entries(SALARY_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
              </select>
            </Field>
          </div>
        )}

        <Field label="O'qituvchi rasmi">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-tint text-accent-ink">
              {/* eslint-disable-next-line @next/next/no-img-element -- a data URL from the database */}
              {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <User className="h-7 w-7" />}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="btn-ghost cursor-pointer border border-line">
                <ImagePlus className="h-4 w-4" /> Rasm yuklash
                <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
              </label>
              {preview && (
                <button type="button" className="btn-ghost text-danger" onClick={() => { setUpload("remove"); setPreview(null); }}>
                  <Trash2 className="h-4 w-4" /> Rasmni olib tashlash
                </button>
              )}
            </div>
          </div>
          <p className="mt-1 text-xs text-muted">PNG yoki JPG, 300 KB gacha</p>
        </Field>

        <Field label="Telegram chat ID (ixtiyoriy)">
          <input name="telegramChatId" className="input" inputMode="numeric" maxLength={30} defaultValue={teacher?.telegramChatId ?? ""} placeholder="Masalan: 123456789" />
        </Field>
        <p className="-mt-2 text-xs text-muted">Keyinchalik bildirishnomalar shu Telegram chatiga yuboriladi.</p>
        <Field label="Izoh"><textarea name="note" className="input" rows={2} maxLength={1000} defaultValue={teacher?.note ?? ""} /></Field>

        {error && <p className="rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end pt-1">
          <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saqlanmoqda..." : "Saqlash"}</button>
        </div>
      </form>
      <form ref={closer} onSubmit={(e) => e.preventDefault()} hidden />
    </>
  );
}
