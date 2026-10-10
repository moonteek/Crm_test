"use client";

import { useState } from "react";
import { AXIS, fmt, GRID, MUTED, niceTicks, SERIES, type Fmt } from "./format";
import { useWidth } from "./useWidth";
import { Legend } from "./Legend";

type Series = { name: string; values: (number | null)[] };

const H = 220;
const PAD = { top: 12, right: 16, bottom: 28, left: 64 };

/** Multi-series line chart with a crosshair tooltip. One y-axis only. */
export function LineChart({
  labels, series, format, yMax, area = false,
}: { labels: string[]; series: Series[]; format: Fmt; yMax?: number; area?: boolean }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const ticks = niceTicks(yMax ?? Math.max(1, ...all));
  const top = ticks.at(-1)!;
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (labels.length <= 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  // show every n-th month label so they never collide (~52px per label)
  const every = Math.max(1, Math.ceil((labels.length * 52) / Math.max(1, innerW)));

  const path = (vals: (number | null)[]) => {
    let d = "";
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i)},${y(v)}`;
      pen = true;
    });
    return d;
  };

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (labels.length <= 1) return setHover(0);
    const i = Math.round(((px - PAD.left) / innerW) * (labels.length - 1));
    setHover(Math.min(labels.length - 1, Math.max(0, i)));
  }

  return (
    <div>
      {series.length > 1 && <Legend names={series.map((s) => s.name)} />}
      <div ref={ref} className="relative w-full" style={{ height: H }}>
        {width > 0 && (
          <svg width={width} height={H} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Chiziqli grafik">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED} className="tabular-nums">{fmt(t, format, true)}</text>
              </g>
            ))}
            {labels.map((l, i) => i % every === 0 && (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={MUTED}>{l}</text>
            ))}
            {series.map((s, si) => (
              <g key={s.name}>
                {area && si === 0 && (
                  <path d={`${path(s.values)}L${x(s.values.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={SERIES[si]} opacity={0.1} />
                )}
                <path d={path(s.values)} fill="none" stroke={SERIES[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              </g>
            ))}
            {hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke={AXIS} strokeWidth={1} />
                {series.map((s, si) => s.values[hover] !== null && (
                  <circle key={s.name} cx={x(hover)} cy={y(s.values[hover]!)} r={4} fill={SERIES[si]} stroke="var(--surface)" strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>
        )}
        {hover !== null && width > 0 && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
            style={x(hover) > width / 2 ? { right: width - x(hover) + 12 } : { left: x(hover) + 12 }}
          >
            <p className="mb-1 font-semibold text-ink">{labels[hover]}</p>
            {series.map((s, si) => (
              <p key={s.name} className="flex items-center justify-between gap-3 text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SERIES[si] }} />{s.name}</span>
                <span className="font-semibold text-ink tabular-nums">{fmt(s.values[hover], format)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
