import {
  coatGenotype,
  expressedModules,
  genotypeValue,
  loadViability,
  traitValues,
  type CoatBase,
} from "../genetics/expression";
import { LOCUS_INDEX } from "../genetics/layout";
import type { Genome, Sex, Slot } from "../genetics/types";
import { SPECIES } from "../species/roster";
import type { SpeciesId } from "../species/types";
import { hexToRgb, shade, type RGB } from "./color";

export interface Phenotype {
  species: SpeciesId;
  sex: Sex;
  massKg: number;
  /** Multipliers around 1. */
  limb: number;
  metabolism: number;
  bite: number;
  fertility: number;
  /** 0..1 abilities and dispositions. */
  vision: number;
  hearing: number;
  smell: number;
  immunity: number;
  boldness: number;
  sociality: number;
  aggression: number;
  choosiness: number;
  ornament: number;
  dietBreadth: number;
  fat: number;
  sweat: number;
  brain: number;
  altitude: number;
  lactase: boolean;
  thermalOpt: number;
  thermalBreadth: number;
  lifespanY: number;
  coat: CoatBase;
  pattern: number;
  lightness: number;
  color: RGB;
  color2: RGB;
  modules: Record<Slot, SpeciesId | null>;
  /** Survival multiplier from deleterious recessive load. */
  viability: number;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (p: number) => {
  const q = Math.min(0.98, Math.max(0.02, p));
  return Math.log(q / (1 - q));
};
const disp = (base: number, g: number, k = 0.5) => sigmoid(logit(base) + k * g);

/** Genotype → phenotype. `base` is the body-plan species (torso); modules can differ. */
export function computePhenotype(g: Genome, base: SpeciesId, sex: Sex): Phenotype {
  const sp = SPECIES[base];
  const t = traitValues(g);
  const coat = coatGenotype(g);
  const mods = expressedModules(g);
  const modules = Object.fromEntries(
    Object.entries(mods).map(([slot, m]) => [slot, (m.species as SpeciesId | null) ?? null]),
  ) as Record<Slot, SpeciesId | null>;

  // MHC heterozygote advantage: diverse antigen presentation.
  const het = (k: string) => {
    const i = LOCUS_INDEX[k];
    const a = g.a[i];
    const b = g.b[i];
    return a && b && a.id !== b.id ? 1 : 0;
  };
  const immunity = Math.min(1, disp(0.5, t.immunity) * 0.8 + 0.1 * (het("imm1") + het("imm2")));

  const coverSp = SPECIES[modules.covering ?? base];
  const pal = coverSp.palette;
  const lightness = 0.12 * t.lightness;
  const color = shade(hexToRgb(pal[coat.base]), Math.max(-0.7, Math.min(0.7, lightness)));
  const baseFat = 0.25 + 0.4 * sp.seasonality * (sp.endotherm ? 1 : 0.5);

  return {
    species: base,
    sex,
    massKg: sp.massKg * (sex === "M" ? sp.dimorphism : 1) * Math.exp(0.15 * t.size),
    limb: Math.exp(0.1 * t.limb),
    metabolism: Math.exp(0.08 * t.metabolism),
    bite: Math.exp(0.12 * t.bite),
    fertility: Math.exp(0.15 * t.fertility),
    vision: disp(sp.base.vision, t.vision, 0.4),
    hearing: disp(sp.base.hearing, t.hearing, 0.4),
    smell: disp(sp.base.smell, t.smell, 0.4),
    immunity,
    boldness: disp(sp.base.boldness, t.boldness),
    sociality: disp(sp.base.sociality, t.sociality),
    aggression: disp(sp.base.aggression, t.aggression),
    choosiness: disp(sp.base.choosiness, t.choosiness),
    ornament: disp(sp.base.ornament, t.ornament, 0.6) * (sex === "M" ? 1 : 0.3),
    dietBreadth: disp(sp.base.dietBreadth, t.dietBreadth),
    fat: disp(baseFat, t.fat),
    sweat: Math.max(0, Math.min(1.3, sp.base.sweat + 0.1 * t.sweat)),
    brain: sp.base.brain * Math.exp(0.1 * t.brain),
    altitude: t.altitude,
    lactase: genotypeValue(g, LOCUS_INDEX.lactase) > 0,
    thermalOpt: sp.base.thermalOpt + 1.5 * t.thermalOpt,
    thermalBreadth: sp.base.thermalBreadth * Math.exp(0.1 * t.thermalBreadth),
    lifespanY: sp.lifespanY * Math.exp(0.1 * t.longevity),
    coat: coat.base,
    pattern: coat.pattern,
    lightness,
    color,
    color2: hexToRgb(pal.pattern),
    modules,
    viability: loadViability(g),
  };
}
