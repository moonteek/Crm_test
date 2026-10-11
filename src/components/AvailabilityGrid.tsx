"use client";

import { useState, useTransition } from "react";
import { setSlot } from "@/app/(app)/actions";
import type { Cell, DayType } from "@/lib/availability";

const NEXT = { unset: "free", free: "busy", busy: "unset" } as const;
const LOOK: Record<Exclude<Cell["state"], "lesson">, { cls: string; label: string }> = {
  unset: { cls: "border border-dashed border-line-strong text-muted", label: "Belgilanmagan" },
  free: { cls: "bg-success-tint text-success", label: "Bo'sh" },
  busy: { cls: "bg-danger-tint text-danger", label: "Band" },
};
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** One day type of a teacher's week: 12 hour rows; tapping cycles a mark, lesson hours are fixed. */
export function AvailabilityGrid({ userId, dayType, cells, editable }: { userId: number; dayType: DayType; cells: { hour: number; cell: Cell }[]; editable: boolean }) {
  const [marks, setMarks] = useState(() => new Map(cells.map((c) => [c.hour, c.cell])));
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const tap = (hour: number) => {
    const cell = marks.get(hour)!;
    if (cell.state === "lesson") return;
    const next = NEXT[cell.state];
    setMarks((m) => new Map(m).set(hour, { state: next }));
    setError(null);
    start(async () => {
      const r = await setSlot(userId, dayType, hour, next);
      if (r?.error) {
        setMarks((m) => new Map(m).set(hour, cell)); // put it back
        setError(r.error);
      }
    });
  };

  return (
    <div className="card p-3 md:p-4">
      <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {cells.map(({ hour }) => {
          const cell = marks.get(hour)!;
          const range = `${hh(hour)}–${hh(hour + 1)}`;
          if (cell.state === "lesson") {
            return (
              <li key={hour} className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-page">
                <span className="font-mono text-sm">{range}</span>
                <span className="truncate text-sm font-medium">Dars · {cell.group}</span>
              </li>
            );
          }
          const look = LOOK[cell.state];
          return (
            <li key={hour}>
              <button
                type="button"
                disabled={!editable}
                onClick={() => tap(hour)}
                aria-label={`${range}: ${look.label}`}
                className={`press flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left disabled:cursor-default ${look.cls}`}
              >
                <span className="font-mono text-sm text-ink">{range}</span>
                <span className="text-sm font-medium">{look.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-3 rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
