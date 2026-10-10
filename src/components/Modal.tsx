"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * A button that opens a dialog. Children are rendered inside the dialog; forms in it
 * close the dialog after submitting. On phones the dialog is a bottom sheet.
 */
export function Modal({
  trigger,
  title,
  children,
  triggerClassName = "btn-primary",
  wide = false,
}: {
  trigger: React.ReactNode;
  title: string;
  children: React.ReactNode;
  triggerClassName?: string;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        {trigger}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4">
          <div className="absolute inset-0 animate-fade bg-black/50" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative flex max-h-[92vh] w-full animate-sheet flex-col rounded-t-3xl border border-line bg-surface md:max-h-[88vh] md:animate-pop md:rounded-[20px] ${
              wide ? "md:max-w-2xl" : "md:max-w-lg"
            }`}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong md:hidden" />
            <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-3 pb-3 md:pt-4">
              <h3 className="truncate text-lg font-semibold">{title}</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Yopish" className="btn-ghost -mr-2 px-2">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-5" onSubmit={() => setTimeout(() => setOpen(false), 0)}>
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
