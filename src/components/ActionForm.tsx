"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ActionState } from "@/lib/action-result";

/** For client code that calls an action itself: the refusal to show, or null. A lost connection counts as one too. */
export async function answer(res: Promise<ActionState>): Promise<string | null> {
  try {
    return (await res)?.error ?? null;
  } catch {
    return "Aloqa uzildi — qayta urinib ko'ring";
  }
}

const ERROR = "basis-full rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger";

/**
 * A form for an action that answers with `{ error }` instead of throwing: the message shows in the form (with what was
 * typed kept) and the dialog around it closes only after a successful save; then the form clears for the next entry.
 * `submit={null}` when the form places its own submit button (one-line forms).
 */
export function ActionForm({
  action, children, submitText = "Saqlash", submitClassName = "btn-primary", submit, className = "space-y-3",
}: {
  action: (state: ActionState, f: FormData) => Promise<ActionState>; children: React.ReactNode;
  submitText?: React.ReactNode; submitClassName?: string; submit?: null; className?: string;
}) {
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
          if (pending) return;
          const form = e.currentTarget;
          const data = new FormData(form);
          start(async () => {
            setError(null);
            const res = await action(null, data);
            if (res?.error) return setError(res.error);
            closer.current?.requestSubmit(); // an empty submit that reaches the dialog and closes it
            form.reset();
          });
        }}
      >
        {children}
        {error && <p role="alert" className={ERROR}>{error}</p>}
        {submit !== null && (
          <div className="flex justify-end pt-1">
            <button type="submit" className={submitClassName} disabled={pending}>{pending ? "Saqlanmoqda..." : submitText}</button>
          </div>
        )}
      </form>
      <form ref={closer} onSubmit={(e) => e.preventDefault()} hidden />
    </>
  );
}

/**
 * A one-click button (delete, block, pin, restore…) for an action that answers with `{ error }`: a refusal shows in a
 * small note right next to the button and goes away after a few seconds or on the next click.
 */
export function ActionButton({
  action, children, className = "btn-ghost px-2", label, title, disabled, alignLeft,
}: { action: () => Promise<ActionState>; children: React.ReactNode; className?: string; label?: string; title?: string; disabled?: boolean; alignLeft?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useFadingError();
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className={className}
        aria-label={label}
        title={title}
        disabled={disabled || pending}
        onClick={() => start(async () => {
          setError(null);
          const res = await action();
          if (res?.error) setError(res.error);
        })}
      >
        {children}
      </button>
      {error && <ErrorNote text={error} alignLeft={alignLeft} />}
    </span>
  );
}

/** An error that clears itself after a few seconds. */
export function useFadingError() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);
  return [error, setError] as const;
}

/** The small note under a button or cell whose action was refused; the parent is `relative`. */
export function ErrorNote({ text, alignLeft }: { text: string; alignLeft?: boolean }) {
  return (
    <span role="alert" className={`absolute top-full ${alignLeft ? "left-0" : "right-0"} z-30 mt-1 w-max max-w-64 rounded-xl border border-danger/30 bg-danger-tint px-3 py-2 text-left text-xs font-medium normal-case text-danger shadow-lg`}>
      {text}
    </span>
  );
}
