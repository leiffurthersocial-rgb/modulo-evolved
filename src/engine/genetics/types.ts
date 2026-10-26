/**
 * Core genetic data model.
 *
 * Every species shares one genome architecture (see layout.ts): the same loci at the
 * same map positions. Species differ only in which alleles they carry. This mirrors
 * deep homology across vertebrates and is what makes cross-species distance, hybrids
 * and chimeras well defined.
 */

export type TraitId =
  | "size"
  | "limb"
  | "metabolism"
  | "vision"
  | "hearing"
  | "smell"
  | "thermalOpt"
  | "thermalBreadth"
  | "bite"
  | "fat"
  | "fertility"
  | "longevity"
  | "immunity"
  | "boldness"
  | "sociality"
  | "aggression"
  | "choosiness"
  | "ornament"
  | "dietBreadth"
  | "lightness"
  | "brain"
  | "sweat"
  | "altitude";

export type Slot =
  | "head"
  | "jaw"
  | "teeth"
  | "eyes"
  | "ears"
  | "forelimbs"
  | "hindlimbs"
  | "tail"
  | "covering"
  | "wings"
  | "fins";

export const SLOTS: readonly Slot[] = [
  "head",
  "jaw",
  "teeth",
  "eyes",
  "ears",
  "forelimbs",
  "hindlimbs",
  "tail",
  "covering",
  "wings",
  "fins",
];

export type LocusKind =
  /** Additive quantitative-trait locus (polygenic). */
  | "quant"
  /** Scales the expression of all loci for a target trait (gene-regulatory network node). */
  | "regulatory"
  /** Discrete Mendelian colour loci (B: eumelanin colour, E: extension, S: stripes). */
  | "color"
  /** Deleterious recessive load: loss-of-function homozygotes pay a viability cost. */
  | "load"
  /** Selectively neutral marker (microsatellite-like, fast mutating): ancestry and drift. */
  | "neutral"
  /** Body-module locus written by Splice Lab: which species' part develops in a slot. */
  | "module"
  /** Single-gene adaptation (lactase persistence, EPAS1-like altitude). Encoded as quant. */
  | "major";

export interface ChromosomeDef {
  name: string;
  /** Genetic map length in centiMorgans. 100 cM ≈ 1 expected crossover per meiosis. */
  lengthCM: number;
  /** Sex chromosome (X/Z). Heterogametic individuals carry only one copy. */
  sex?: boolean;
}

export interface LocusDef {
  key: string;
  /** Human-readable gene name shown in the editor. */
  name: string;
  chrom: number;
  posCM: number;
  kind: LocusKind;
  trait?: TraitId;
  /** Contribution weight of this locus to its trait. */
  weight?: number;
  slot?: Slot;
  /** Short explanation for tooltips. */
  info: string;
}

export interface ModuleRef {
  slot: Slot;
  /** Species whose developmental program builds this part. `null` = part absent. */
  species: string | null;
}

/**
 * An allele. Immutable and shared by reference between individuals (alleles are
 * identical by descent when they are the same object / have the same id).
 */
export interface Allele {
  readonly id: number;
  /** Additive effect on the locus' trait (or ±1 state for colour loci). */
  readonly effect: number;
  /** Dominance weight. Heterozygote value is the dominance-weighted mean of both alleles. */
  readonly dom: number;
  /** Copy number (tandem duplications increase dosage). */
  readonly copies: number;
  /** cis-regulatory expression multiplier. */
  readonly expr: number;
  /** Loss of function (e.g. frameshift indel, nonsense). */
  readonly lof: boolean;
  /** Body module carried by module loci. */
  readonly module?: ModuleRef;
  /** Generation-independent tag of where the allele arose (species id or "editor"). */
  readonly origin: string;
}

/**
 * Diploid genome: one allele per locus on each haplotype. `a` is maternal, `b` paternal.
 * At sex-chromosome loci the heterogametic sex (XY male, ZW female) has `null` on the
 * haplotype that carried the Y/W.
 */
export interface Genome {
  readonly a: readonly (Allele | null)[];
  readonly b: readonly (Allele | null)[];
}

export type Haplotype = (Allele | null)[];

export type SexSystem = "XY" | "ZW" | "TSD";
export type Sex = "F" | "M";
