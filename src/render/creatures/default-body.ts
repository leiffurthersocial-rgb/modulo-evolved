import { hexToRgb } from "@/engine/anatomy/color";
import { SLOTS, type Slot } from "@/engine/genetics/types";
import { SPECIES } from "@/engine/species/roster";
import type { SpeciesId } from "@/engine/species/types";
import type { RigInput } from "./rig";

/** Typical-looking body for a species (most common coat), for galleries and pickers. */
export function defaultBody(id: SpeciesId, sex: "F" | "M" = "M"): RigInput {
  const sp = SPECIES[id];
  const pal = sp.palette;
  const coat = pal.freqE < 0.5 ? pal.red : pal.freqB > 0.5 ? pal.black : pal.brown;
  const modules = Object.fromEntries(SLOTS.map((s) => [s, sp.parts[s] ? id : null])) as Record<
    Slot,
    SpeciesId | null
  >;
  return {
    species: id,
    sex,
    modules,
    color: hexToRgb(coat),
    color2: hexToRgb(pal.pattern),
    pattern: pal.freqS > 0.5 ? 1 : 0,
    ornament: sp.base.ornament,
    limb: 1,
    fat: 0.3,
  };
}

export function defaultLengthM(id: SpeciesId) {
  const sp = SPECIES[id];
  return sp.lenK * (sp.massKg * sp.dimorphism) ** (1 / 3);
}
