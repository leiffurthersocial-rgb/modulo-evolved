"use client";

import { CHROMOSOMES, LOCI } from "@/engine/genetics/layout";
import type { Genome, LocusKind } from "@/engine/genetics/types";
import { cn } from "@/lib/cn";

export const KIND_COLOR: Record<LocusKind, string> = {
  quant: "#60a5fa",
  regulatory: "#c084fc",
  color: "#f59e0b",
  load: "#f87171",
  neutral: "#6b7886",
  module: "#2dd4bf",
  major: "#4ade80",
};

export const KIND_LABEL: Record<LocusKind, string> = {
  quant: "Quantitative (polygenic)",
  regulatory: "Regulatory",
  color: "Pigmentation (Mendelian)",
  load: "Deleterious load",
  neutral: "Neutral marker",
  module: "Body module",
  major: "Major-effect gene",
};

/**
 * Chromosome ideogram: one bar per chromosome (height ∝ map length in cM), loci as ticks.
 * Heterozygous loci are drawn full-width; homozygous half-width; hemizygous dashed.
 */
export function Ideogram({
  genome,
  selected,
  onSelect,
  compact = false,
  className,
}: {
  genome?: Genome | null;
  selected?: number | null;
  onSelect?: (locus: number) => void;
  compact?: boolean;
  className?: string;
}) {
  const H = compact ? 70 : 220;
  const maxLen = Math.max(...CHROMOSOMES.map((c) => c.lengthCM));
  const colW = compact ? 22 : 44;
  const barW = compact ? 8 : 14;
  return (
    <svg
      viewBox={`0 0 ${CHROMOSOMES.length * colW} ${H + (compact ? 12 : 22)}`}
      className={cn("w-full", className)}
      role="img"
      aria-label="Chromosome map"
    >
      {CHROMOSOMES.map((c, ci) => {
        const x = ci * colW + colW / 2;
        const h = (c.lengthCM / maxLen) * H;
        return (
          <g key={c.name}>
            <rect
              x={x - barW / 2}
              y={4}
              width={barW}
              height={h}
              rx={barW / 2}
              fill="#1a232d"
              stroke="#2c3a48"
            />
            {LOCI.map((l, li) => {
              if (l.chrom !== ci) return null;
              const y = 4 + (l.posCM / c.lengthCM) * h;
              const a = genome?.a[li];
              const b = genome?.b[li];
              const het = a && b && a.id !== b.id;
              const hemi = genome && (!a || !b);
              const w = het || !genome ? barW + 6 : barW;
              const isSel = selected === li;
              return (
                <g key={l.key}>
                  <rect
                    x={x - w / 2}
                    y={y - (compact ? 1 : 1.5)}
                    width={w}
                    height={compact ? 2 : 3}
                    fill={KIND_COLOR[l.kind]}
                    opacity={hemi ? 0.5 : 1}
                  />
                  {isSel && (
                    <rect
                      x={x - barW}
                      y={y - 4}
                      width={barW * 2}
                      height={8}
                      fill="none"
                      stroke="#e6edf3"
                      strokeWidth={1.5}
                      rx={2}
                    />
                  )}
                  {onSelect && (
                    <rect
                      x={x - colW / 2}
                      y={y - 5}
                      width={colW}
                      height={10}
                      fill="transparent"
                      className="cursor-pointer"
                      onClick={() => onSelect(li)}
                    >
                      <title>{`${l.name} (${l.key}) · chr ${c.name} @ ${l.posCM} cM`}</title>
                    </rect>
                  )}
                </g>
              );
            })}
            <text
              x={x}
              y={H + (compact ? 11 : 18)}
              textAnchor="middle"
              fontSize={compact ? 8 : 11}
              fill="#9aa7b4"
              fontFamily="var(--font-mono)"
            >
              {c.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
