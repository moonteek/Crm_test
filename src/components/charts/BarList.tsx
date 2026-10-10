import { fmt, SERIES, type Fmt } from "./format";

/** Horizontal bars with the value at the tip — for ranked categories. */
export function BarList({
  items, format, max,
}: { items: { label: string; value: number; sub?: string }[]; format: Fmt; max?: number }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="py-6 text-center text-sm text-faint">Ma&apos;lumot yo&apos;q</p>;
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label} title={`${it.label}: ${fmt(it.value, format)}`}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate text-ink">{it.label}{it.sub && <span className="ml-1 text-xs text-faint">{it.sub}</span>}</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">{fmt(it.value, format)}</span>
          </div>
          <div className="h-2 rounded-full bg-ink/5">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(1, (it.value / top) * 100)}%`, background: SERIES[0] }} />
          </div>
        </div>
      ))}
    </div>
  );
}
