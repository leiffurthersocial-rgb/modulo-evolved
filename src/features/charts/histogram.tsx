"use client";

/** Compact SVG histogram with optional reference markers (e.g. parent values). */
export function Histogram({
  values,
  bins = 16,
  markers = [],
  format = (v: number) => v.toFixed(1),
  color = "#2dd4bf",
  height = 96,
  label,
}: {
  values: number[];
  bins?: number;
  markers?: { value: number; label: string; color?: string }[];
  format?: (v: number) => string;
  color?: string;
  height?: number;
  label: string;
}) {
  if (!values.length) return <p className="text-xs text-fg-subtle">No data</p>;
  const all = [...values, ...markers.map((m) => m.value)];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi - lo < 1e-9) {
    lo -= 0.5;
    hi += 0.5;
  }
  const counts = new Array(bins).fill(0);
  for (const v of values) counts[Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo)) * bins))]++;
  const max = Math.max(...counts);
  const W = 300;
  const H = height;
  const bw = W / bins;
  const x = (v: number) => ((v - lo) / (hi - lo)) * W;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H + 16}`}
        className="w-full"
        role="img"
        aria-label={`${label} distribution, mean ${format(mean)}`}
      >
        {counts.map((c, i) => (
          <rect
            key={i}
            x={i * bw + 1}
            y={H - (c / max) * H}
            width={bw - 2}
            height={(c / max) * H}
            rx={1.5}
            fill={color}
            opacity={0.75}
          />
        ))}
        <line
          x1={x(mean)}
          x2={x(mean)}
          y1={0}
          y2={H}
          stroke="#e6edf3"
          strokeDasharray="3 3"
          strokeWidth={1}
        />
        {markers.map((m) => (
          <g key={m.label}>
            <line
              x1={x(m.value)}
              x2={x(m.value)}
              y1={0}
              y2={H}
              stroke={m.color ?? "#fbbf24"}
              strokeWidth={2}
            />
            <text
              x={Math.min(W - 4, Math.max(4, x(m.value)))}
              y={10}
              fontSize={10}
              fill={m.color ?? "#fbbf24"}
              textAnchor="middle"
            >
              {m.label}
            </text>
          </g>
        ))}
        <text x={0} y={H + 13} fontSize={10} fill="#6b7886">
          {format(lo)}
        </text>
        <text x={W} y={H + 13} fontSize={10} fill="#6b7886" textAnchor="end">
          {format(hi)}
        </text>
      </svg>
      <figcaption className="flex justify-between text-xs text-fg-muted">
        <span>{label}</span>
        <span className="font-mono">mean {format(mean)}</span>
      </figcaption>
    </figure>
  );
}
