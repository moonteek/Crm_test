"use client";

import { useState } from "react";
import { X } from "lucide-react";

/**
 * A button that opens a dialog. Children are rendered inside the dialog; forms in it
 * close the dialog after submitting.
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
  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        {trigger}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
          <div className={`card w-full ${wide ? "max-w-2xl" : "max-w-lg"}`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="font-semibold">{title}</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Yopish">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5" onSubmit={() => setTimeout(() => setOpen(false), 0)}>
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
