export type Fmt = "money" | "number" | "percent" | "grade";

export function fmt(v: number | null | undefined, f: Fmt, compact = false): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (f === "percent") return `${Math.round(v)}%`;
  if (f === "grade") return v.toFixed(1);
  if (f === "money") {
    if (compact) {
      const a = Math.abs(v);
      if (a >= 1e9) return `${+(v / 1e9).toFixed(1)} mlrd`;
      if (a >= 1e6) return `${+(v / 1e6).toFixed(1)} mln`;
      if (a >= 1e3) return `${+(v / 1e3).toFixed(0)} ming`;
    }
    return new Intl.NumberFormat("ru-RU").format(Math.round(v)).replace(/ /g, " ") + " so'm";
  }
  return new Intl.NumberFormat("ru-RU").format(Math.round(v * 10) / 10).replace(/ /g, " ");
}

/** Clean axis ticks from 0 (or min) to a rounded max. */
export function niceTicks(max: number, count = 4, min = 0) {
  if (max <= min) max = min + 1;
  const raw = (max - min) / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= top + step / 2; t += step) ticks.push(+t.toFixed(6));
  return ticks;
}

// Validated categorical slots 1–3 (blue, orange, aqua) and chart chrome.
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"];
export const GRID = "#e1e0d9";
export const AXIS = "#c3c2b7";
export const MUTED = "#898781";
