"use client";

import { useMemo, useState } from "react";
import { hexToRgb, rgbToHex, shade } from "@/engine/anatomy/color";
import { LOCI, LOCUS_INDEX } from "@/engine/genetics/layout";
import { alleleSymbols, punnett, recombination } from "@/engine/genetics/punnett";
import type { Allele, Genome } from "@/engine/genetics/types";
import { SPECIES } from "@/engine/species/roster";
import type { SpeciesId } from "@/engine/species/types";
import { cn } from "@/lib/cn";
import { InfoTip } from "@/ui/info-tip";
import { SectionTitle } from "../inspector/inspector-panel";

const PRESETS: { label: string; loci: string[]; note: string }[] = [
  {
    label: "Coat (B × E)",
    loci: ["colB", "colE"],
    note: "Dihybrid cross with recessive epistasis: ee masks B, giving 9:3:4 from double heterozygotes.",
  },
  {
    label: "Stripes (S)",
    loci: ["colS"],
    note: "Incomplete dominance: heterozygotes are intermediate (1:2:1).",
  },
  {
    label: "Linked (IGF1 × LIMB1)",
    loci: ["size2", "limb1"],
    note: "2 cM apart: parental combinations dominate; recombinants are rare.",
  },
  {
    label: "X-linked (OPN1LW)",
    loci: ["vis2"],
    note: "Sex-linked: sons get their only X from their mother.",
  },
  { label: "Lactase (LCT)", loci: ["lactase"], note: "Dominant lactase persistence (humans)." },
];

export function PunnettSquare({
  mother,
  father,
  species,
}: {
  mother: Genome;
  father: Genome;
  species: SpeciesId;
}) {
  const [preset, setPreset] = useState(0);
  const [custom, setCustom] = useState<string | null>(null);
  const keys = custom ? [custom] : PRESETS[preset].loci;
  const lociKey = keys.join(",");
  const loci = useMemo(() => lociKey.split(",").map((k) => LOCUS_INDEX[k]), [lociKey]);
  const sq = useMemo(() => punnett(mother, father, loci, { motherBase: mother }), [mother, father, loci]);
  const symbols = loci.map((l) => alleleSymbols(l, [mother.a[l], mother.b[l], father.a[l], father.b[l]]));
  const pal = SPECIES[species].palette;
  const coatColor = (coat?: string, pattern = 0) => {
    if (!coat) return undefined;
    const base = hexToRgb(pal[coat as "black" | "brown" | "red"]);
    return rgbToHex(pattern > 0.25 ? shade(base, 0.15) : base);
  };
  const gameteLabel = (alleles: (Allele | null)[]) =>
    alleles.map((a, k) => (a ? (symbols[k].get(a.id) ?? "?") : "Y")).join(" ");
  const r = loci.length === 2 ? recombination(mother, loci[0], loci[1]) : null;
  const tooBig = sq.eggs.length * sq.sperm.length > 16;

  return (
    <section className="space-y-3">
      <SectionTitle info="Rows are the mother's gamete types, columns the father's, each with its exact probability (linkage uses Haldane's map function). Cells are coloured by predicted coat when pigmentation loci are shown.">
        Punnett square
      </SectionTitle>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={!custom && preset === i}
            onClick={() => {
              setPreset(i);
              setCustom(null);
            }}
            className={cn(
              "h-9 rounded-md border border-border px-3 text-xs text-fg-muted focus-ring pointer-coarse:h-11",
              !custom && preset === i && "border-accent/60 bg-accent-muted/40 text-accent-strong",
            )}
          >
            {p.label}
          </button>
        ))}
        <select
          aria-label="Any locus"
          value={custom ?? ""}
          onChange={(e) => setCustom(e.target.value || null)}
          className="h-9 rounded-md border border-border bg-surface-2 px-2 text-xs text-fg-muted focus-ring pointer-coarse:h-11"
        >
          <option value="">Any locus…</option>
          {LOCI.map((l) => (
            <option key={l.key} value={l.key}>
              {l.name} ({l.key})
            </option>
          ))}
        </select>
      </div>
      {!custom && <p className="text-xs text-fg-muted">{PRESETS[preset].note}</p>}
      {r !== null && (
        <p className="flex items-center gap-1 text-xs text-fg-muted">
          Recombination fraction r = {r.toFixed(3)}
          <InfoTip title="Recombination" side="top">
            The probability that a crossover separates the two loci in one meiosis. Unlinked loci assort
            independently (r = 0.5).
          </InfoTip>
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-center text-xs">
          <thead>
            <tr>
              <th className="p-1 text-left text-[10px] font-normal text-fg-subtle">♀ \ ♂</th>
              {sq.sperm.map((s, j) => (
                <th key={j} className="rounded bg-surface-2 p-1.5 font-mono font-normal">
                  {gameteLabel(s.alleles)}
                  <span className="block text-[10px] text-fg-subtle">
                    {(s.p * 100).toFixed(tooBig ? 0 : 1)}%
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sq.cells.map((row, i) => (
              <tr key={i}>
                <th className="rounded bg-surface-2 p-1.5 font-mono font-normal">
                  {gameteLabel(sq.eggs[i].alleles)}
                  <span className="block text-[10px] text-fg-subtle">{(sq.eggs[i].p * 100).toFixed(1)}%</span>
                </th>
                {row.map((c, j) => {
                  const bg = coatColor(c.coat, c.pattern);
                  return (
                    <td
                      key={j}
                      className="rounded border border-border p-1.5"
                      style={bg ? { background: `${bg}55`, borderColor: `${bg}99` } : undefined}
                      title={c.label}
                    >
                      <span className="block font-mono">
                        {c.genotype
                          .map(
                            (gt, k) =>
                              `${gt[0] ? symbols[k].get(gt[0].id) : "Y"}${gt[1] ? symbols[k].get(gt[1].id) : "Y"}`,
                          )
                          .join(" ")}
                      </span>
                      <span className="block truncate text-[10px] text-fg-muted">{c.label}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <div className="flex h-3 overflow-hidden rounded-full">
          {sq.classes.map((c) => (
            <div
              key={c.label}
              style={{ width: `${c.p * 100}%`, background: coatColor(c.coat) ?? "#2dd4bf" }}
              title={c.label}
              className="border-r border-bg last:border-0"
            />
          ))}
        </div>
        <ul className="mt-2 space-y-1 text-xs">
          {sq.classes.map((c) => (
            <li key={c.label} className="flex justify-between gap-2">
              <span className="flex items-center gap-1.5 text-fg-muted">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ background: coatColor(c.coat) ?? "#2dd4bf" }}
                />
                {c.label}
              </span>
              <span className="font-mono">
                {(c.p * 100).toFixed(1)}%{" "}
                <span className="text-fg-subtle">
                  ({(c.p * 16).toFixed(c.p * 16 === Math.round(c.p * 16) ? 0 : 1)}/16)
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
