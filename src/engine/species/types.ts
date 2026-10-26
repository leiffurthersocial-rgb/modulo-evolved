import type { SexSystem } from "../genetics/types";

export type SpeciesId =
  | "rabbit"
  | "deer"
  | "zebra"
  | "elephant"
  | "boar"
  | "bear"
  | "human"
  | "fox"
  | "wolf"
  | "lion"
  | "crocodile"
  | "frog"
  | "sparrow"
  | "duck"
  | "hawk"
  | "sardine"
  | "pike"
  | "shark";

export type Diet = "herbivore" | "granivore" | "planktivore" | "insectivore" | "omnivore" | "carnivore";
export type Clade = "mammal" | "bird" | "reptile" | "amphibian" | "fish";

export type TorsoKind = "quad" | "heavy" | "biped" | "bird" | "fish" | "croc" | "frog";
export type HeadKind = "mammal" | "human" | "bird" | "reptile" | "frog" | "fish";
export type JawKind =
  "short" | "long" | "croc" | "human" | "beak" | "hooked" | "flatbill" | "frog" | "fish" | "shark";
export type TeethKind = "grinding" | "carnassial" | "omnivore" | "tusks" | "conical" | "serrated" | "none";
export type EarKind = "none" | "pointed" | "round" | "long" | "large" | "human";
export type LimbKind =
  | "none"
  | "cursorial"
  | "plantigrade"
  | "pillar"
  | "grasping"
  | "bipedal"
  | "hopping"
  | "sprawling"
  | "bird"
  | "webbed"
  | "talons";
export type TailKind =
  "none" | "short" | "thin" | "tufted" | "bushy" | "heavy" | "feather" | "fish" | "shark";
export type CoverKind = "fur" | "hair" | "hide" | "feathers" | "scales" | "moist" | "fishscale" | "denticles";
export type WingKind = "short" | "pointed" | "broad";
export type FinKind = "fish" | "shark";

/** Parametric part specifications. Lengths are relative to torso length (= 1). */
export interface PartSpecs {
  torso: { kind: TorsoKind; w: number; h: number };
  head: { kind: HeadKind; size: number; neck: number; trunk?: boolean; antlers?: boolean; mane?: boolean };
  jaw: { kind: JawKind; len: number; biteK: number };
  teeth: { kind: TeethKind; biteMult: number; meat: number; plant: number };
  eyes: { size: number; forward: number; night: number };
  ears: { kind: EarKind; size: number; hearingK: number };
  forelimbs: { kind: LimbKind; len: number; thick: number };
  hindlimbs: { kind: LimbKind; len: number; thick: number; speedK: number };
  tail: { kind: TailKind; len: number; thick: number };
  covering: { kind: CoverKind; insulation: number; waterproof: number };
  wings: {
    kind: WingKind;
    span: number;
    /** Wing area (m²) at the donor's reference mass. */ area: number;
  } | null;
  fins: { kind: FinKind; size: number; swimK: number } | null;
}

export interface CoatPalette {
  black: string;
  brown: string;
  red: string;
  pattern: string;
  /** Allele frequency of the dominant allele at B, E, S in founders. */
  freqB: number;
  freqE: number;
  freqS: number;
}

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  latin: string;
  clade: Clade;
  diet: Diet;
  sexSystem: SexSystem;
  endotherm: boolean;
  /** Mean adult female mass (kg). */
  massKg: number;
  /** Male:female mass ratio (sexual size dimorphism). */
  dimorphism: number;
  /** Body length (m) ≈ lenK · mass^(1/3). */
  lenK: number;
  lifespanY: number;
  maturityY: number;
  gestationD: number;
  /** Surviving offspring per birth event (for egg-layers: effective survivors). */
  litter: number;
  /** 0 = breeds year round, 1 = strictly seasonal. */
  seasonality: number;
  /** Baseline phenotype values before genetic deviation. */
  base: {
    thermalOpt: number;
    thermalBreadth: number;
    vision: number;
    hearing: number;
    smell: number;
    boldness: number;
    sociality: number;
    aggression: number;
    choosiness: number;
    ornament: number;
    dietBreadth: number;
    brain: number;
    sweat: number;
  };
  /** Max prey : predator mass ratio this species will attempt (pack/tool hunters go higher). */
  maxPreyRatio: number;
  parts: PartSpecs;
  palette: CoatPalette;
  /** UI/chart colour. */
  color: string;
  /** Default founding population. */
  initial: number;
  blurb: string;
}
