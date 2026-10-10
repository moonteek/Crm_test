"use client";

import { useTransition } from "react";
import { setGrade } from "@/app/(app)/actions";

const TONE: Record<number, string> = {
  5: "border-success/40 bg-success-tint text-success",
  4: "border-line-strong bg-ink/5 text-ink",
  3: "border-warning/40 bg-warning-tint text-warning",
  2: "border-danger/40 bg-danger-tint text-danger",
  1: "border-danger/40 bg-danger-tint text-danger",
};

export function GradeCell({
  groupId, studentId, day, value, editable,
}: { groupId: number; studentId: number; day: string; value?: number; editable: boolean }) {
  const [pending, start] = useTransition();
  const cls = `h-7 w-9 rounded-full border text-center font-mono text-sm font-medium ${value ? TONE[value] : "border-line bg-raised text-faint"}`;
  if (!editable) return <span className={`inline-flex items-center justify-center ${cls}`}>{value ?? "·"}</span>;
  return (
    <select
      aria-label={`Baho ${day}`}
      value={value ?? ""}
      disabled={pending}
      onChange={(e) => start(() => setGrade(groupId, studentId, day, e.target.value ? Number(e.target.value) : null))}
      className={`${cls} cursor-pointer appearance-none hover:border-ink disabled:opacity-50`}
    >
      <option value="">·</option>
      {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}
