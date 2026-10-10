import { SERIES } from "./format";

export function Legend({ names }: { names: string[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted">
      {names.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i] }} />{n}
        </span>
      ))}
    </div>
  );
}
