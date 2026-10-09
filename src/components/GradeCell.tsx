"use client";

import { useTransition } from "react";
import { setGrade } from "@/app/(app)/actions";

const TONE: Record<number, string> = {
  5: "border-emerald-200 bg-emerald-50 text-emerald-700",
  4: "border-sky-200 bg-sky-50 text-sky-700",
  3: "border-amber-200 bg-amber-50 text-amber-700",
  2: "border-rose-200 bg-rose-50 text-rose-700",
  1: "border-rose-300 bg-rose-100 text-rose-800",
};

export function GradeCell({
  groupId, studentId, day, value, editable,
}: { groupId: number; studentId: number; day: string; value?: number; editable: boolean }) {
  const [pending, start] = useTransition();
  const cls = `h-7 w-9 rounded-md border text-center text-sm font-bold ${value ? TONE[value] : "border-slate-200 bg-white text-slate-300"}`;
  if (!editable) return <span className={`inline-flex items-center justify-center ${cls}`}>{value ?? "·"}</span>;
  return (
    <select
      aria-label={`Baho ${day}`}
      value={value ?? ""}
      disabled={pending}
      onChange={(e) => start(() => setGrade(groupId, studentId, day, e.target.value ? Number(e.target.value) : null))}
      className={`${cls} cursor-pointer appearance-none hover:border-brand-500 disabled:opacity-50`}
    >
      <option value="">·</option>
      {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}
