"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CHROMOSOMES, LOCI } from "@/engine/genetics/layout";
import type { Genome } from "@/engine/genetics/types";
import { cn } from "@/lib/cn";
import { KIND_COLOR } from "../labs/ideogram";

export function LocusList({
  genome,
  baseline,
  selected,
  onSelect,
}: {
  genome: Genome;
  baseline: Genome;
  selected: number;
  onSelect: (i: number) => void;
}) {
  const [q, setQ] = useState("");
  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return LOCI.map((l, i) => ({ l, i })).filter(
      ({ l }) =>
        !s ||
        l.name.toLowerCase().includes(s) ||
        l.key.toLowerCase().includes(s) ||
        (l.trait ?? l.slot ?? l.kind).toLowerCase().includes(s),
    );
  }, [q]);
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <label className="flex h-11 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 focus-within:border-accent/60">
        <Search className="size-4 text-fg-subtle" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search genes, traits…"
          aria-label="Search loci"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-subtle"
        />
      </label>
      <ul className="space-y-0.5" aria-label="Loci">
        {items.map(({ l, i }) => {
          const a = genome.a[i];
          const b = genome.b[i];
          const changed = a?.id !== baseline.a[i]?.id || b?.id !== baseline.b[i]?.id;
          const het = a && b && a.id !== b.id;
          return (
            <li key={l.key}>
              <button
                type="button"
                aria-current={selected === i}
                onClick={() => onSelect(i)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm text-fg-muted focus-ring hover:bg-surface-3 hover:text-fg",
                  selected === i && "bg-surface-3 text-fg",
                )}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: KIND_COLOR[l.kind] }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">
                  {l.name}
                  <span className="ml-1.5 text-[11px] text-fg-subtle">{l.trait ?? l.slot ?? l.kind}</span>
                </span>
                <span className="font-mono text-[10px] text-fg-subtle">
                  {CHROMOSOMES[l.chrom].name}:{l.posCM}
                </span>
                {het && (
                  <span className="text-[10px] text-fg-subtle" title="Heterozygous">
                    het
                  </span>
                )}
                {changed && <span className="size-1.5 rounded-full bg-warning" title="Edited" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
