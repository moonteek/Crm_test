import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { fmt, type Fmt } from "./format";

/** Stat tile: value plus change vs the previous period of the same length. */
export function Kpi({
  label, value, prev, format, upIsGood = true, hint,
}: { label: string; value: number | null; prev?: number | null; format: Fmt; upIsGood?: boolean; hint?: string }) {
  let delta: React.ReactNode = null;
  if (prev !== undefined && prev !== null && value !== null) {
    const diff = value - prev;
    const pct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : null;
    const shown = format === "percent" ? `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} p.p.` : format === "grade" ? `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}` : pct === null ? "" : `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
    const good = diff === 0 ? null : (diff > 0) === upIsGood;
    const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
    delta = shown && (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${good === null ? "text-slate-500" : good ? "text-emerald-700" : "text-rose-700"}`}>
        <Icon className="h-3.5 w-3.5" />{shown}
        <span className="ml-1 font-normal text-slate-400">oldingi davrga nisbatan</span>
      </span>
    );
  }
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{fmt(value, format)}</p>
      <div className="mt-1 min-h-4">{delta ?? (hint && <span className="text-xs text-slate-400">{hint}</span>)}</div>
    </div>
  );
}
