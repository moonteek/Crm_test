"use client";

import { useState } from "react";
import { AXIS, fmt, GRID, MUTED, niceTicks, SERIES, type Fmt } from "./format";
import { useWidth } from "./useWidth";
import { Legend } from "./Legend";

type Series = { name: string; values: number[] };

const H = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 64 };

/** Column chart, 1–3 grouped series, per-column hover tooltip. */
export function ColumnChart({ labels, series, format }: { labels: string[]; series: Series[]; format: Fmt }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(1, ...series.flatMap((s) => s.values)));
  const top = ticks.at(-1)!;
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = H - PAD.top - PAD.bottom;
  const band = labels.length ? innerW / labels.length : 0;
  const barW = Math.max(4, Math.min(24, (band * 0.7 - (series.length - 1) * 2) / series.length));
  const groupW = series.length * barW + (series.length - 1) * 2;
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  // show every n-th label so they never collide (~52px per label)
  const every = Math.max(1, Math.ceil((labels.length * 52) / Math.max(1, innerW)));

  const bar = (x0: number, v: number) => {
    const h = Math.max(0, y(0) - y(v));
    const r = Math.min(4, h, barW / 2);
    const yt = y(v);
    return `M${x0},${y(0)}V${yt + r}Q${x0},${yt} ${x0 + r},${yt}H${x0 + barW - r}Q${x0 + barW},${yt} ${x0 + barW},${yt + r}V${y(0)}Z`;
  };

  return (
    <div>
      {series.length > 1 && <Legend names={series.map((s) => s.name)} />}
      <div ref={ref} className="relative w-full" style={{ height: H }}>
        {width > 0 && (
          <svg width={width} height={H} onMouseLeave={() => setHover(null)} role="img" aria-label="Ustunli grafik">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED} className="tabular-nums">{fmt(t, format, true)}</text>
              </g>
            ))}
            {labels.map((l, i) => {
              const cx = PAD.left + band * i + band / 2;
              return (
                <g key={i} onMouseEnter={() => setHover(i)}>
                  <rect x={PAD.left + band * i} y={PAD.top} width={band} height={innerH} fill={hover === i ? "var(--line)" : "transparent"} />
                  {series.map((s, si) => (
                    <path key={s.name} d={bar(cx - groupW / 2 + si * (barW + 2), s.values[i])} fill={SERIES[si]} />
                  ))}
                  {i % every === 0 && <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill={MUTED}>{l}</text>}
                </g>
              );
            })}
          </svg>
        )}
        {hover !== null && width > 0 && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
            style={hover >= labels.length / 2 ? { right: width - (PAD.left + band * hover) + 4 } : { left: PAD.left + band * (hover + 1) + 4 }}
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
