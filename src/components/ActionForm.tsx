"use client";

import { useRef, useState, useTransition } from "react";
import type { MemberActionState } from "@/app/(app)/actions";

/**
 * A form for an action that answers with `{ error }` instead of throwing: the message shows in the form (with what was
 * typed kept) and the dialog around it closes only after a successful save.
 */
export function ActionForm({
  action, children, submitText = "Saqlash", className = "space-y-3",
}: { action: (state: MemberActionState, f: FormData) => Promise<MemberActionState>; children: React.ReactNode; submitText?: string; className?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const closer = useRef<HTMLFormElement>(null);
  return (
    <>
      <form
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation(); // the dialog closes on a submit: hold it until the action answers
          const data = new FormData(e.currentTarget);
          start(async () => {
            setError(null);
            const res = await action(null, data);
            if (res?.error) return setError(res.error);
            closer.current?.requestSubmit(); // an empty submit that reaches the dialog and closes it
          });
        }}
      >
        {children}
        {error && <p className="rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end pt-1">
          <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saqlanmoqda..." : submitText}</button>
        </div>
      </form>
      <form ref={closer} onSubmit={(e) => e.preventDefault()} hidden />
    </>
  );
}
