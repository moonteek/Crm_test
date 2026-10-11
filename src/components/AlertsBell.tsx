"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import type { AlertItem } from "@/lib/alerts";

const KEY = "algoritm.dismissedAlerts";
const id = (a: AlertItem) => `${a.groupId}:${a.state}`;

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Groups whose course is ending or over; each can be hidden on this device until its state changes. */
export function AlertsBell({ alerts, align = "left" }: { alerts: AlertItem[]; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setDismissed(readDismissed()), []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const shown = alerts.filter((a) => !dismissed.includes(id(a)));
  const dismiss = (a: AlertItem) => {
    // keep only keys of alerts that still exist, so the list doesn't grow forever
    const next = [...dismissed.filter((k) => alerts.some((x) => id(x) === k)), id(a)];
    setDismissed(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  };
  const day = (iso: string) => iso.split("-").reverse().join(".");

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="press relative flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink"
        aria-label={`Ogohlantirishlar: ${shown.length}`}
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px]" />
        {shown.length > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-bold text-on-accent">{shown.length}</span>
        )}
      </button>
      {open && (
        <div className={`absolute top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-raised p-2 shadow-xl ${align === "right" ? "right-0" : "left-0"}`}>
          <p className="label-mono px-2 pt-1 pb-2">Kursi tugayotgan guruhlar</p>
          {shown.length === 0 && <p className="px-2 pb-2 text-sm text-muted">Yangi ogohlantirish yo&apos;q</p>}
          <ul className="space-y-0.5">
            {shown.map((a) => (
              <li key={id(a)} className="flex items-center gap-1 rounded-xl hover:bg-ink/5">
                <Link href={`/groups/${a.groupId}`} onClick={() => setOpen(false)} className="min-w-0 flex-1 px-2 py-2">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className={`text-xs ${a.state === "ended" ? "text-danger" : "text-muted"}`}>
                    {a.state === "ended" ? `Kurs ${day(a.endsOn)} da tugagan — guruhni yakunlang` : `Kurs ${day(a.endsOn)} da tugaydi`}
                  </p>
                </Link>
                <button type="button" onClick={() => dismiss(a)} className="mr-1 rounded-full p-1.5 text-faint hover:text-ink" aria-label="Yashirish" title="Yashirish">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
