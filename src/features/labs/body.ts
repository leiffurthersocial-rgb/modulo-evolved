import { computePhenotype, type Phenotype } from "@/engine/anatomy/phenotype";
import { computeStats, type Stats } from "@/engine/anatomy/stats";
import type { Genome, Sex } from "@/engine/genetics/types";
import type { SpeciesId } from "@/engine/species/types";
import type { RigInput } from "@/render/creatures/rig";

export interface Expressed {
  ph: Phenotype;
  st: Stats;
  rig: RigInput;
}

/** Genotype → phenotype → stats → render body, all on the main thread (pure engine code). */
export function express(genome: Genome, species: SpeciesId, sex: Sex): Expressed {
  const ph = computePhenotype(genome, species, sex);
  const st = computeStats(ph);
  const rig: RigInput = {
    species,
    sex,
    modules: ph.modules,
    color: ph.color,
    color2: ph.color2,
    pattern: ph.pattern,
    ornament: ph.ornament,
    limb: ph.limb,
    fat: ph.fat,
  };
  return { ph, st, rig };
}
