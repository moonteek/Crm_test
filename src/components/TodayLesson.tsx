"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Clock, X } from "lucide-react";
import { markAllPresent, markToday, setAbsenceReason } from "@/app/(app)/actions";

type MarkKey = "present" | "late" | "absent";
type Row = { id: number; name: string; mark: MarkKey | null; reasonId: number | null };

const BUTTONS: { key: MarkKey; label: string; icon: typeof Check; on: string }[] = [
  { key: "present", label: "Keldi", icon: Check, on: "border-success bg-success-tint text-success" },
  { key: "late", label: "Kechikdi", icon: Clock, on: "border-warning bg-warning-tint text-warning" },
  { key: "absent", label: "Kelmadi", icon: X, on: "border-danger bg-danger-tint text-danger" },
];

/** "Bugungi dars": today's list with one big button per mark; each tap is saved at once. */
export function TodayLesson({
  groupId, day, rows, editable, reasons, substitute,
}: { groupId: number; day: string; rows: Row[]; editable: boolean; reasons: { id: number; name: string }[]; substitute: string | null }) {
  const [marks, setMark] = useOptimistic(new Map(rows.map((r) => [r.id, r.mark])), (m, [id, mark]: [number, MarkKey]) => new Map(m).set(id, mark));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const done = rows.filter((r) => marks.get(r.id)).length;

  const tap = (id: number, mark: MarkKey) =>
    start(async () => {
      setMark([id, mark]);
      setError(null);
      try { await markToday(groupId, id, mark); } catch (e) { setError((e as Error).message); }
    });
  const all = () =>
    start(async () => {
      for (const r of rows) if (!marks.get(r.id)) setMark([r.id, "present"]);
      setError(null);
      try { await markAllPresent(groupId); } catch (e) { setError((e as Error).message); }
    });

  return (
    <section className="card mt-4 p-4 md:mt-6 md:p-5" aria-label="Bugungi dars">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Bugungi dars</h2>
          <p className="text-sm text-muted">Belgilandi: {done} / {rows.length}</p>
          {substitute && <p className="mt-1 text-sm text-accent-ink">{substitute}</p>}
        </div>
        {editable && done < rows.length && (
          <button type="button" className="btn-secondary" onClick={all} disabled={pending}><Check className="h-4 w-4" /> Hammasi keldi</button>
        )}
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const mark = marks.get(r.id);
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="min-w-0 truncate font-medium">{r.name}</span>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {mark === "absent" && editable && reasons.length > 0 && (
                  <select
                    className="input h-10 w-40 py-1 text-sm"
                    defaultValue={r.reasonId ?? ""}
                    aria-label={`${r.name} — kelmaganlik sababi`}
                    onChange={(e) => start(async () => {
                      setError(null);
                      try { await setAbsenceReason(groupId, r.id, day, e.target.value ? Number(e.target.value) : null); } catch (err) { setError((err as Error).message); }
                    })}
                  >
                    <option value="">Sabab…</option>
                    {reasons.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                )}
                {BUTTONS.map(({ key, label, icon: Icon, on }) => (
                  <button
                    key={key}
                    type="button"
                    disabled={!editable}
                    onClick={() => tap(r.id, key)}
                    aria-pressed={mark === key}
                    className={`press flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-medium ${mark === key ? on : "border-line bg-raised text-muted hover:border-ink"}`}
                  >
                    <Icon className="h-4 w-4" /><span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-3 rounded-xl bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
