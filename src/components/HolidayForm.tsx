"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { createHolidays, type MemberActionState } from "@/app/(app)/actions";

/** Adds one day or a range; a refusal (past month, already a holiday) shows here and keeps what was typed. */
export function HolidayForm({ min }: { min: string }) {
  const [state, action, pending] = useActionState<MemberActionState, FormData>(createHolidays, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) form.current?.reset(); }, [state]);

  return (
    <div className="w-full sm:w-auto">
      <form
        ref={form}
        onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); startTransition(() => action(data)); }}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="text-xs text-muted">Sana<input name="from" type="date" className="input mt-1" required min={min} /></label>
        <label className="text-xs text-muted">Gacha (ixtiyoriy)<input name="to" type="date" className="input mt-1" min={min} /></label>
        <label className="min-w-0 flex-1 text-xs text-muted">Nomi<input name="name" className="input mt-1" required maxLength={80} placeholder="Navro'z" /></label>
        <button className="btn-primary shrink-0" disabled={pending}><Plus className="h-4 w-4" /> Qo&apos;shish</button>
      </form>
      {state?.error && <p className="mt-2 rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{state.error}</p>}
    </div>
  );
}
