import { editorFactory } from "./alleles";
import { LOCUS_INDEX, MODULE_LOCI } from "./layout";
import { SPECIES } from "../species/roster";
import type { SpeciesId } from "../species/types";
import type { Allele, Genome, Slot } from "./types";

/** Slots that may be left empty (a chimera without wings, fins, tail…). Vital organs can't. */
export const OPTIONAL_SLOTS: ReadonlySet<Slot> = new Set([
  "wings",
  "fins",
  "tail",
  "ears",
  "teeth",
  "forelimbs",
  "hindlimbs",
]);

const SLOT_LOCUS = Object.fromEntries(MODULE_LOCI.map(({ l, i }) => [l.slot!, i])) as Record<Slot, number>;
const PIGMENT = ["colB", "colE", "colS"].map((k) => LOCUS_INDEX[k]);

export function slotLocus(slot: Slot) {
  return SLOT_LOCUS[slot];
}

/** Species that can donate a given part. */
export function donorsFor(slot: Slot): SpeciesId[] {
  return (Object.keys(SPECIES) as SpeciesId[]).filter((id) => SPECIES[id].parts[slot] !== null);
}

/**
 * Write body-module alleles into a genome (homozygously, so the chimera breeds true).
 * `donors` supplies a genome per donor species to copy the module allele from; swapping the
 * covering also transfers the donor's pigmentation genes (skin and colour develop together).
 */
export function splice(
  base: Genome,
  changes: Partial<Record<Slot, SpeciesId | null>>,
  donors: Partial<Record<SpeciesId, Genome>>,
): Genome {
  const a = [...base.a];
  const b = [...base.b];
  const f = editorFactory();
  for (const [slot, donor] of Object.entries(changes) as [Slot, SpeciesId | null][]) {
    const li = SLOT_LOCUS[slot];
    let allele: Allele | null = null;
    if (donor === null) {
      if (!OPTIONAL_SLOTS.has(slot)) continue;
      allele = f.make({
        effect: 0,
        dom: 1,
        copies: 1,
        expr: 1,
        lof: false,
        origin: "splice",
        module: { slot, species: null },
      });
    } else {
      const dg = donors[donor];
      allele =
        dg?.a[li] ??
        dg?.b[li] ??
        f.make({
          effect: 0,
          dom: 1,
          copies: 1,
          expr: 1,
          lof: false,
          origin: "splice",
          module: { slot, species: donor },
        });
      if (slot === "covering" && dg) {
        for (const pi of PIGMENT) {
          const p = dg.a[pi] ?? dg.b[pi];
          if (p) {
            a[pi] = p;
            b[pi] = p;
          }
        }
      }
    }
    a[li] = allele;
    b[li] = allele;
  }
  return { a, b };
}

/** Current module donor per slot (from the maternal strand, which splice keeps identical). */
export function modulesOf(g: Genome): Record<Slot, SpeciesId | null> {
  const out = {} as Record<Slot, SpeciesId | null>;
  for (const { l, i } of MODULE_LOCI)
    out[l.slot!] = ((g.a[i] ?? g.b[i])?.module?.species as SpeciesId | null) ?? null;
  return out;
}
