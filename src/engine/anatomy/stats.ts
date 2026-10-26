import type { Slot } from "../genetics/types";
import { divergenceMya } from "../species/phylo";
import { SPECIES } from "../species/roster";
import type { PartSpecs, SpeciesId } from "../species/types";
import type { Phenotype } from "./phenotype";

/**
 * Anatomy-derived performance. Every number comes from the actual parts an individual
 * develops, so chimeras inherit honest trade-offs.
 */
export interface Stats {
  lengthM: number;
  /** Bite force at the canines/carnassials (N). */
  biteN: number;
  /** Top running speed (km/h); 0 if it cannot walk. */
  speedKmh: number;
  /** Burst swimming speed (km/h); 0 if it cannot swim. */
  swimKmh: number;
  /** Wing loading (N/m²) or Infinity without wings. */
  wingLoading: number;
  /** 0..1: lift and power margins; ≥ 0.7 can sustain flight. */
  flightScore: number;
  canWalk: boolean;
  canSwim: boolean;
  canFly: boolean;
  /** Gill-breathing: confined to water. */
  aquatic: boolean;
  /** Needs to stay near water (moist skin). */
  needsWater: boolean;
  /** Basal metabolic rate (kJ/day). */
  bmrKJ: number;
  /** Typical field metabolic rate including activity (kJ/day). */
  fmrKJ: number;
  /** Ambient temperature range tolerated without stress (°C). */
  coldLimitC: number;
  heatLimitC: number;
  /** Detection radius (m). */
  senseM: number;
  /** 0..1 developmental-integration cost of foreign parts. */
  devCost: number;
  fertilityMult: number;
  plantEff: number;
  meatEff: number;
  insulation: number;
  /** Notes explaining limiting factors (for UI). */
  notes: string[];
}

const SLOT_WEIGHT: Record<Slot, number> = {
  head: 0.12,
  jaw: 0.1,
  teeth: 0.05,
  eyes: 0.05,
  ears: 0.03,
  forelimbs: 0.12,
  hindlimbs: 0.15,
  tail: 0.06,
  covering: 0.1,
  wings: 0.12,
  fins: 0.1,
};

/** Part spec for a slot, from whichever species' module is expressed. */
export function partOf<S extends Slot>(
  ph: Phenotype,
  slot: S,
): { spec: NonNullable<PartSpecs[S]>; donor: SpeciesId } | null {
  const donor = ph.modules[slot];
  if (!donor) return null;
  const spec = SPECIES[donor].parts[slot];
  return spec ? { spec: spec as NonNullable<PartSpecs[S]>, donor } : null;
}

/** Hirt et al. 2017 (Nat Ecol Evol): running speed peaks at intermediate body mass. */
export function hirtSpeedKmh(massKg: number) {
  return 25.5 * massKg ** 0.26 * (1 - Math.exp(-22 * massKg ** -0.6));
}

/** Kleiber's law: BMR ∝ M^0.75 (≈ 70 kcal·kg^-0.75/day for placental mammals). */
export function kleiberKJ(massKg: number, endotherm: boolean, bird: boolean) {
  const k = endotherm ? (bird ? 380 : 293) : 30;
  return k * massKg ** 0.75;
}

export function computeStats(ph: Phenotype): Stats {
  const sp = SPECIES[ph.species];
  const m = ph.massKg;
  const notes: string[] = [];
  const lengthM = sp.lenK * m ** (1 / 3);

  // --- Developmental compatibility ---
  let devCost = 0;
  for (const slot of Object.keys(SLOT_WEIGHT) as Slot[]) {
    const donor = ph.modules[slot];
    const own = sp.parts[slot] ? ph.species : null;
    if (donor === own) continue;
    const dist = donor && own ? divergenceMya(own, donor) / 465 : 0.6;
    devCost += SLOT_WEIGHT[slot] * dist;
  }
  devCost = Math.min(1, devCost);
  const fertilityMult = Math.exp(-2.5 * devCost);
  if (devCost > 0.05)
    notes.push(`Foreign parts strain development (−${Math.round((1 - fertilityMult) * 100)}% fertility).`);

  // --- Bite ---
  const jaw = partOf(ph, "jaw");
  const teeth = partOf(ph, "teeth");
  const biteN = (jaw?.spec.biteK ?? 0.3) * 60 * m ** 0.67 * (teeth?.spec.biteMult ?? 0.6) * ph.bite;

  // --- Locomotion on land ---
  const hind = partOf(ph, "hindlimbs");
  const fore = partOf(ph, "forelimbs");
  const torso = sp.parts.torso.kind;
  const aquatic = torso === "fish";
  let speedKmh = 0;
  if (hind && hind.spec.kind !== "none" && !aquatic) {
    // Bones and muscles scale with the donor's body; borrowed limbs on a heavier body are overloaded.
    const loadF = Math.min(1.1, Math.max(0.35, (SPECIES[hind.donor].massKg / m) ** 0.12));
    let posture = 1;
    if ((torso === "quad" || torso === "heavy") && hind.spec.kind === "bipedal") posture = 0.75;
    if (torso === "biped" && hind.spec.kind !== "bipedal") posture = 0.8;
    if ((torso === "quad" || torso === "heavy") && (!fore || fore.spec.kind === "none")) posture *= 0.7;
    speedKmh = hirtSpeedKmh(m) * hind.spec.speedK * ph.limb * loadF * posture * (1 - 0.15 * ph.fat);
    if (loadF < 0.85) notes.push(`${SPECIES[hind.donor].name} legs are overloaded by this body's mass.`);
    if (posture < 1) notes.push("Limb arrangement doesn't suit this body plan.");
  }

  // --- Swimming ---
  const fins = partOf(ph, "fins");
  const tail = partOf(ph, "tail");
  let swimKmh = 0;
  if (fins) swimKmh = 12 * m ** 0.17 * fins.spec.swimK * (0.6 + fins.spec.size);
  else if (tail?.spec.kind === "heavy") swimKmh = 4 * m ** 0.2;
  else if (
    hind &&
    (hind.spec.kind === "webbed" || (hind.spec.kind === "hopping" && sp.clade === "amphibian"))
  )
    swimKmh = 3 * m ** 0.15 + 2;
  else if (sp.clade === "mammal" || sp.clade === "reptile") swimKmh = 1.5 * m ** 0.1;
  if (aquatic && !fins) swimKmh = Math.max(swimKmh, 2);
  const canSwim = swimKmh > 0;

  // --- Flight ---
  const wings = partOf(ph, "wings");
  let wingLoading = Infinity;
  let flightScore = 0;
  if (wings) {
    // Isometric scaling: transplanted wings grow with the body, area ∝ M^(2/3),
    // so wing loading rises as M^(1/3). Flight muscle power ∝ M while required power
    // ∝ M^(7/6), which caps flapping flight at roughly 15–20 kg.
    const area = wings.spec.area * (m / SPECIES[wings.donor].massKg) ** (2 / 3);
    wingLoading = (m * 9.81) / area;
    flightScore = Math.min(1, 130 / wingLoading) * Math.min(1, Math.sqrt(15 / m));
    if (flightScore < 0.7)
      notes.push(`Too heavy to fly: wing loading ${Math.round(wingLoading)} N/m², ${m.toFixed(0)} kg.`);
  }
  const canFly = flightScore >= 0.7;
  const canWalk = speedKmh > 0.5;

  // --- Energetics ---
  const bird = sp.clade === "bird";
  const bmrKJ = kleiberKJ(m, sp.endotherm, bird) * ph.metabolism * (1 + 0.3 * devCost) * (1 + 0.2 * ph.brain);
  const fmrKJ = bmrKJ * (sp.endotherm ? 2.5 : 1.6) * (wings ? 1.1 : 1);

  // --- Thermal tolerance ---
  const cover = partOf(ph, "covering");
  const insulation = (cover?.spec.insulation ?? 0) * (sp.endotherm ? 1 : 0.2);
  const ears = partOf(ph, "ears");
  const coldLimitC = ph.thermalOpt - ph.thermalBreadth - insulation - 6 * ph.fat;
  const heatLimitC =
    ph.thermalOpt +
    ph.thermalBreadth +
    8 * ph.sweat +
    (ears?.spec.kind === "large" ? 3 : 0) -
    0.25 * insulation;

  // --- Senses ---
  const eyes = partOf(ph, "eyes");
  const eyeK = Math.min(2, Math.max(0.5, (eyes?.spec.size ?? 0.03) / 0.05));
  const visionM = 110 * ph.vision * Math.sqrt(eyeK) * m ** 0.08;
  const hearingM = 70 * ph.hearing * (ears?.spec.hearingK ?? 0.6);
  const smellM = 90 * ph.smell;
  const senseM = Math.max(visionM, hearingM, smellM);

  const needsWater = cover?.spec.kind === "moist";
  if (aquatic && hind && hind.spec.kind !== "none")
    notes.push("Legs can't help a gill-breather leave the water.");

  return {
    lengthM,
    biteN,
    speedKmh,
    swimKmh,
    wingLoading,
    flightScore,
    canWalk,
    canSwim,
    canFly,
    aquatic,
    needsWater,
    bmrKJ,
    fmrKJ,
    coldLimitC,
    heatLimitC,
    senseM,
    devCost,
    fertilityMult,
    plantEff: teeth?.spec.plant ?? 0.5,
    meatEff: teeth?.spec.meat ?? 0.5,
    insulation,
    notes,
  };
}
