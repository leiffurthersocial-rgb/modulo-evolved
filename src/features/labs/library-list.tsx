"use client";

import { useState } from "react";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { SPECIES } from "@/engine/species/roster";
import { useLab, type LabGenome } from "@/state/lab-store";
import { Badge } from "@/ui/badge";
import { cn } from "@/lib/cn";

/** Saved lines, with a small pedigree for crossed lines. */
export function LibraryList({
  onPick,
  filter,
}: {
  onPick: (g: LabGenome) => void;
  filter?: (g: LabGenome) => boolean;
}) {
  const library = useLab((s) => s.library);
  const [renaming, setRenaming] = useState<string | null>(null);
  const items = filter ? library.filter(filter) : library;
  return (
    <ul className="space-y-1.5">
      {items.map((g) => (
        <li key={g.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 pr-1">
          <button
            type="button"
            onClick={() => onPick(g)}
            className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left focus-ring"
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: SPECIES[g.species].color }}
            />
            <span className="min-w-0 flex-1">
              {renaming === g.id ? (
                <input
                  autoFocus
                  defaultValue={g.name}
                  aria-label="Name"
                  className="w-full rounded bg-surface-3 px-1.5 py-0.5 text-sm outline-none"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      useLab.getState().rename(g.id, e.currentTarget.value || g.name);
                      setRenaming(null);
                    }
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  onBlur={(e) => {
                    useLab.getState().rename(g.id, e.currentTarget.value || g.name);
                    setRenaming(null);
                  }}
                />
              ) : (
                <span className="block truncate text-sm">
                  {g.name} <span className="text-fg-subtle">{g.sex === "F" ? "♀" : "♂"}</span>
                </span>
              )}
              <Pedigree g={g} />
            </span>
            <Badge
              tone={
                g.kind === "chimera"
                  ? "accent"
                  : g.kind === "cross"
                    ? "omnivore"
                    : g.kind === "edited"
                      ? "herbivore"
                      : "neutral"
              }
            >
              {g.kind}
            </Badge>
            <ChevronRight className="size-4 text-fg-subtle" />
          </button>
          <button
            type="button"
            aria-label={`Rename ${g.name}`}
            onClick={() => setRenaming(g.id)}
            className="flex size-11 items-center justify-center rounded-md text-fg-subtle focus-ring hover:text-fg"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${g.name}`}
            onClick={() => useLab.getState().remove(g.id)}
            className="flex size-11 items-center justify-center rounded-md text-fg-subtle focus-ring hover:text-danger"
          >
            <Trash2 className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function Pedigree({ g }: { g: LabGenome }) {
  const library = useLab((s) => s.library);
  if (!g.parents)
    return (
      <span className="block text-[11px] text-fg-subtle">{new Date(g.createdAt).toLocaleDateString()}</span>
    );
  const name = (id: string) => library.find((x) => x.id === id)?.name ?? "deleted line";
  return (
    <span className={cn("block truncate text-[11px] text-fg-subtle")}>
      ♀ {name(g.parents[0])} × ♂ {name(g.parents[1])}
    </span>
  );
}
