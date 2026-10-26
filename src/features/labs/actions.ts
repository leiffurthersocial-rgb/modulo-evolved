import type { Genome, Sex } from "@/engine/genetics/types";
import { SPECIES } from "@/engine/species/roster";
import type { SpeciesId } from "@/engine/species/types";
import { newId, useLab, type LabGenome } from "@/state/lab-store";
import { useUi } from "@/state/ui-store";

export function labGenomeFrom(
  p: { species: SpeciesId; sex: Sex; genome: Genome; id?: number; chimera?: boolean },
  name?: string,
): LabGenome {
  return {
    id: newId(),
    name: name ?? `${SPECIES[p.species].name}${p.id ? ` #${p.id}` : ""}`,
    species: p.species,
    sex: p.sex,
    genome: p.genome,
    createdAt: Date.now(),
    sourceAgent: p.id,
    kind: p.chimera ? "chimera" : "wild",
  };
}

export function openInEditor(g: LabGenome) {
  useLab.getState().edit(g);
  useUi.getState().setMode("genome");
}

export function sendToCross(slot: "a" | "b", g: LabGenome) {
  useLab.getState().setCross(slot, g);
  useUi.getState().setMode("cross");
}

export function sendToSplice(g: LabGenome) {
  useLab.getState().setSpliceBase(g);
  useUi.getState().setMode("splice");
}
