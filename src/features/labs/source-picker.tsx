"use client";

import { useEffect, useState } from "react";
import { BookOpen, Globe2, PawPrint } from "lucide-react";
import type { Genome, Sex } from "@/engine/genetics/types";
import { SPECIES, SPECIES_IDS } from "@/engine/species/roster";
import type { SpeciesId } from "@/engine/species/types";
import { sim } from "@/sim/client";
import { useLab, newId, type LabGenome } from "@/state/lab-store";
import { Dialog, DialogContent } from "@/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { Button } from "@/ui/button";
import { cn } from "@/lib/cn";
import { LibraryList } from "./library-list";

/** Pick a genome from the library, a wild-type founder of any species, or a living animal. */
export function SourcePicker({
  open,
  onOpenChange,
  onPick,
  title = "Choose a genome",
  preferSex,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (g: LabGenome) => void;
  title?: string;
  preferSex?: Sex;
}) {
  const library = useLab((s) => s.library);
  const [tab, setTab] = useState(library.length ? "library" : "species");
  const [sex, setSex] = useState<Sex>(preferSex ?? "F");
  const [species, setSpecies] = useState<SpeciesId>("rabbit");
  const [world, setWorld] = useState<{ id: number; sex: Sex; genome: Genome }[] | null>(null);

  useEffect(() => {
    if (!open || tab !== "world") return;
    let alive = true;
    void sim
      .rpc<{ id: number; sex: Sex; genome: Genome }[]>("sampleGenomes", species, 24)
      .then((r) => alive && setWorld(r));
    return () => {
      alive = false;
    };
  }, [open, tab, species]);

  const pick = (g: LabGenome) => {
    onPick(g);
    onOpenChange(false);
  };

  const fromFounder = async (id: SpeciesId) => {
    const genome = await sim.rpc<Genome | null>("founder", id, sex);
    if (genome)
      pick({
        id: newId(),
        name: `Wild ${SPECIES[id].name.toLowerCase()} ${sex === "F" ? "♀" : "♂"}`,
        species: id,
        sex,
        genome,
        createdAt: Date.now(),
        kind: "wild",
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} className="max-w-[680px]">
        <div className="border-b border-border px-5 py-4 pr-14">
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <div className="px-5 pt-3">
            <TabsList className="w-full">
              <TabsTrigger value="library">
                <BookOpen /> Library ({library.length})
              </TabsTrigger>
              <TabsTrigger value="species">
                <PawPrint /> Wild type
              </TabsTrigger>
              <TabsTrigger value="world">
                <Globe2 /> From world
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
            <TabsContent value="library">
              {library.length ? (
                <LibraryList onPick={pick} />
              ) : (
                <p className="py-8 text-center text-sm text-fg-muted">
                  No saved lines yet. Save genomes from the editor, Cross Lab or Splice Lab.
                </p>
              )}
            </TabsContent>
            <TabsContent value="species" className="space-y-3">
              <SexToggle sex={sex} onChange={setSex} />
              <SpeciesGrid onPick={(id) => void fromFounder(id)} />
              <p className="text-xs text-fg-subtle">
                A fresh individual sampled from the species&apos; founding allele pool (Hardy–Weinberg
                proportions).
              </p>
            </TabsContent>
            <TabsContent value="world" className="space-y-3">
              <SpeciesGrid selected={species} onPick={(id) => setSpecies(id)} compact />
              {world === null ? (
                <p className="text-sm text-fg-muted">Loading…</p>
              ) : world.length === 0 ? (
                <p className="text-sm text-fg-muted">
                  No living {SPECIES[species].name.toLowerCase()} in this world.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                  {world.map((w) => (
                    <Button
                      key={w.id}
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        pick({
                          id: newId(),
                          name: `${SPECIES[species].name} #${w.id}`,
                          species,
                          sex: w.sex,
                          genome: w.genome,
                          createdAt: Date.now(),
                          kind: "wild",
                          sourceAgent: w.id,
                        })
                      }
                    >
                      #{w.id} {w.sex === "F" ? "♀" : "♂"}
                    </Button>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export function SexToggle({ sex, onChange }: { sex: Sex; onChange: (s: Sex) => void }) {
  return (
    <div role="radiogroup" aria-label="Sex" className="inline-flex gap-1 rounded-lg bg-surface-2 p-1">
      {(["F", "M"] as Sex[]).map((s) => (
        <button
          key={s}
          role="radio"
          aria-checked={sex === s}
          type="button"
          onClick={() => onChange(s)}
          className={cn(
            "h-9 rounded-md px-4 text-sm text-fg-muted focus-ring pointer-coarse:h-11",
            sex === s && "bg-surface-3 text-fg",
          )}
        >
          {s === "F" ? "♀ Female" : "♂ Male"}
        </button>
      ))}
    </div>
  );
}

export function SpeciesGrid({
  onPick,
  selected,
  compact,
}: {
  onPick: (id: SpeciesId) => void;
  selected?: SpeciesId;
  compact?: boolean;
}) {
  return (
    <div
      className={cn("grid gap-1.5", compact ? "grid-cols-4 sm:grid-cols-6" : "grid-cols-3 sm:grid-cols-4")}
    >
      {SPECIES_IDS.map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={selected === id}
          onClick={() => onPick(id)}
          className={cn(
            "flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-2 text-left text-sm text-fg-muted focus-ring transition-colors hover:border-border-strong hover:text-fg",
            selected === id && "border-accent/60 bg-accent-muted/40 text-accent-strong",
          )}
        >
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: SPECIES[id].color }} />
          <span className="truncate">{SPECIES[id].name}</span>
        </button>
      ))}
    </div>
  );
}
