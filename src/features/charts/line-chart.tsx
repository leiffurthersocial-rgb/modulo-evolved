"use client";

import { useMemo, useRef, useState } from "react";

export interface Series {
  key: string;
  label: string;
  color: string;
  points: [number, number][];
  dashed?: boolean;
}

const W = 320;
const PAD = { l: 34, r: 8, t: 8, b: 18 };

function niceTicks(lo: number, hi: number, n = 4) {
  const span = hi - lo || 1;
  const step = 10 ** Math.floor(Math.log10(span / n));
  const err = span / n / step;
  const k = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
  const s = k * step;
  const out: number[] = [];
  for (let v = Math.ceil(lo / s) * s; v <= hi + 1e-9; v += s) out.push(v);
  return out;
}

const compact = (v: number) =>
  Math.abs(v) >= 1e6
    ? `${(v / 1e6).toFixed(1)}M`
    : Math.abs(v) >= 1e3
      ? `${(v / 1e3).toFixed(1)}k`
      : Math.abs(v) < 10 && v % 1
        ? v.toFixed(2)
        : v.toFixed(0);

/**
 * Minimal multi-series SVG line chart with a scrub cursor (touch: drag across it).
 * x is simulated days; labels are shown in years.
 */
export function LineChart({
  series,
  height = 150,
  logY = false,
  yFormat = compact,
  label,
  yMin,
}: {
  series: Series[];
  height?: number;
  logY?: boolean;
  yFormat?: (v: number) => string;
  label: string;
  yMin?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const H = height;
  const { x0, x1, y0, y1 } = useMemo(() => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const s of series)
      for (const [x, y] of s.points) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        const yy = logY ? Math.log10(Math.max(1, y)) : y;
        if (yy < y0) y0 = yy;
        if (yy > y1) y1 = yy;
      }
    if (!isFinite(x0)) return { x0: 0, x1: 1, y0: 0, y1: 1 };
    if (yMin !== undefined) y0 = Math.min(y0, yMin);
    if (y1 - y0 < 1e-9) y1 = y0 + 1;
    return { x0, x1: x1 > x0 ? x1 : x0 + 1, y0, y1: y1 + (y1 - y0) * 0.05 };
  }, [series, logY, yMin]);
  const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => {
    const yy = logY ? Math.log10(Math.max(1, y)) : y;
    return PAD.t + (1 - (yy - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
  };
  const yTicks = logY ? niceTicks(y0, y1, 3).map((t) => 10 ** t) : niceTicks(y0, y1, 3);
  const xTicks = niceTicks(x0 / 365, x1 / 365, 4);

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    setCursor(x0 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (x1 - x0));
  };
  const nearest = (pts: [number, number][], x: number) => {
    let best = pts[0];
    for (const p of pts) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
    return best;
  };

  return (
    <figure className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y select-none"
        role="img"
        aria-label={label}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setCursor(null)}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="#1f2a35" />
            <text x={PAD.l - 4} y={sy(t) + 3} fontSize={9} fill="#6b7886" textAnchor="end">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={sx(t * 365)} y={H - 4} fontSize={9} fill="#6b7886" textAnchor="middle">
            {t % 1 ? t.toFixed(1) : t}y
          </text>
        ))}
        {series.map((s) =>
          s.points.length > 1 ? (
            <polyline
              key={s.key}
              fill="none"
              stroke={s.color}
              strokeWidth={1.6}
              strokeDasharray={s.dashed ? "4 3" : undefined}
              strokeLinejoin="round"
              points={s.points.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ")}
            />
          ) : null,
        )}
        {cursor !== null && cursor >= x0 && cursor <= x1 && (
          <line
            x1={sx(cursor)}
            x2={sx(cursor)}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="#e6edf3"
            strokeOpacity={0.4}
          />
        )}
      </svg>
      {cursor !== null && cursor >= x0 && cursor <= x1 && (
        <div className="pointer-events-none absolute top-1 right-1 max-h-[70%] min-w-28 overflow-hidden rounded-md border border-border bg-surface-3/95 px-2 py-1 text-[10px] shadow-panel">
          <p className="font-mono text-fg-subtle">
            Y{Math.floor(cursor / 365)} D{Math.floor(cursor % 365)}
          </p>
          {series
            .filter((s) => s.points.length)
            .map((s) => ({ s, v: nearest(s.points, cursor)[1] }))
            .sort((a, b) => b.v - a.v)
            .slice(0, 6)
            .map(({ s, v }) => (
              <p key={s.key} className="flex justify-between gap-2">
                <span className="truncate" style={{ color: s.color }}>
                  {s.label}
                </span>
                <span className="font-mono">{yFormat(v)}</span>
              </p>
            ))}
        </div>
      )}
    </figure>
  );
}
