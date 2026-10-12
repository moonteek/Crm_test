"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { DialogFrame } from "./Modal";

/** The group's "⋯" menu; deleting asks first, because it removes the group's attendance, grades and exams too. */
export function GroupMenu({ groupName, remove }: { groupName: string; remove: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button type="button" className="btn-secondary px-3" onClick={() => setOpen((o) => !o)} aria-label="Boshqa amallar" aria-expanded={open}>
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-2 w-48 rounded-2xl border border-line bg-raised p-1.5 shadow-xl">
          <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger hover:bg-danger-tint" onClick={() => { setOpen(false); setConfirm(true); }}>
            <Trash2 className="h-4 w-4" /> O&apos;chirish
          </button>
        </div>
      )}
      {confirm && (
        <DialogFrame title="Guruhni o'chirish" onClose={() => setConfirm(false)}>
          <p className="text-sm text-muted">
            <b className="text-ink">{groupName}</b> guruhi va uning davomat, baho, imtihonlari o&apos;chiriladi. Rostdan o&apos;chirilsinmi?
          </p>
          <form action={remove} className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setConfirm(false)}>Bekor qilish</button>
            <button className="btn-danger"><Trash2 className="h-4 w-4" /> O&apos;chirish</button>
          </form>
        </DialogFrame>
      )}
    </div>
  );
}
