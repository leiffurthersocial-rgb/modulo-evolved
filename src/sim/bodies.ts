import type { Agent } from "@/engine/sim/types";
import type { BodyDesc } from "./protocol";

export function bodyOf(a: Agent): BodyDesc {
  return {
    id: a.id,
    species: a.species,
    sex: a.sex,
    lineage: a.lineage,
    modules: a.ph.modules,
    color: a.ph.color,
    color2: a.ph.color2,
    pattern: a.ph.pattern,
    ornament: a.ph.ornament,
    limb: a.ph.limb,
    fat: a.ph.fat,
    lengthM: a.st.lengthM,
    canFly: a.st.canFly,
    aquatic: a.st.aquatic,
  };
}
