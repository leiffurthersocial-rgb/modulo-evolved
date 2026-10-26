import { EPISTASIS, LOAD_LOCI, LOCI, LOCUS_INDEX, MODULE_LOCI, REGULATORS, TRAIT_LOCI } from "./layout";
import type { Allele, Genome, ModuleRef, Slot, TraitId } from "./types";

export function alleleValue(al: Allele): number {
  return al.lof ? 0 : al.effect * al.copies * al.expr;
}

function weight(al: Allele): number {
  // Loss-of-function alleles are usually recessive: one working copy is enough (haplosufficiency).
  return al.lof ? 0.1 : al.dom;
}

/**
 * Genotypic value at one locus, on a "two-copy" scale (homozygote = 2 × allele value).
 * Heterozygotes take the dominance-weighted mean, so dom ≫ partner → dominant,
 * dom ≪ partner → recessive, equal → additive (incomplete dominance).
 * Hemizygous loci (X in males) are dosage-compensated: the single copy counts double.
 */
export function locusValue(a: Allele | null, b: Allele | null): number {
  if (!a && !b) return 0;
  if (!a) return 2 * alleleValue(b!);
  if (!b) return 2 * alleleValue(a);
  const wa = weight(a);
  const wb = weight(b);
  return (2 * (wa * alleleValue(a) + wb * alleleValue(b))) / (wa + wb);
}

export function genotypeValue(g: Genome, locus: number): number {
  return locusValue(g.a[locus], g.b[locus]);
}

export type TraitValues = Record<TraitId, number>;

const TRAITS = Object.keys(TRAIT_LOCI) as TraitId[];

/**
 * Breeding-value-like genetic score per trait (≈ N(0, 1–1.5) in founders):
 * additive sum over loci, plus epistasis, scaled by regulatory loci.
 */
export function traitValues(g: Genome): TraitValues {
  const out = {} as TraitValues;
  for (const t of TRAITS) {
    let sum = 0;
    for (const i of TRAIT_LOCI[t]) sum += (LOCI[i].weight ?? 1) * genotypeValue(g, i);
    out[t] = sum;
  }
  for (const e of EPISTASIS) {
    out[e.trait] += e.k * genotypeValue(g, LOCUS_INDEX[e.a]) * genotypeValue(g, LOCUS_INDEX[e.b]);
  }
  for (const t of Object.keys(REGULATORS) as TraitId[]) {
    let r = 0;
    for (const i of REGULATORS[t]!) r += genotypeValue(g, i);
    out[t] *= Math.exp(0.5 * r);
  }
  return out;
}

export type CoatBase = "black" | "brown" | "red";

/**
 * Mendelian pigmentation: E (MC1R) is epistatic to B (TYRP1).
 *  E_ B_ → black, E_ bb → brown, ee __ → red/yellow. Dihybrid F2 ratio 9:3:4.
 * S (ASIP-like) is incompletely dominant: SS fully patterned, Ss half, ss plain.
 */
export function coatGenotype(g: Genome): { base: CoatBase; pattern: number } {
  const E = genotypeValue(g, LOCUS_INDEX.colE);
  const B = genotypeValue(g, LOCUS_INDEX.colB);
  const S = genotypeValue(g, LOCUS_INDEX.colS);
  const base: CoatBase = E < 0 ? "red" : B > 0 ? "black" : "brown";
  return { base, pattern: Math.min(1, Math.max(0, (S + 2) / 4)) };
}

/**
 * Viability from deleterious recessive load. Each locus homozygous (or hemizygous) for a
 * loss-of-function allele costs s = 0.3; heterozygotes pay h·s with h = 0.05.
 * Inbreeding raises homozygosity and so exposes this load (inbreeding depression).
 */
export function loadViability(g: Genome): number {
  let v = 1;
  for (const i of LOAD_LOCI) {
    const a = g.a[i];
    const b = g.b[i];
    const la = a ? a.lof : null;
    const lb = b ? b.lof : null;
    const broken = (la ?? lb ?? false) && (lb ?? la ?? false);
    if (broken) v *= 0.7;
    else if (la || lb) v *= 0.985;
  }
  return v;
}

/** Which species' developmental program builds each body part (dominance decides heterozygotes). */
export function expressedModules(g: Genome): Record<Slot, ModuleRef> {
  const out = {} as Record<Slot, ModuleRef>;
  for (const { l, i } of MODULE_LOCI) {
    const a = g.a[i];
    const b = g.b[i];
    const pick = !a ? b : !b ? a : weight(b) > weight(a) ? b : a;
    out[l.slot!] = pick?.module ?? { slot: l.slot!, species: null };
  }
  return out;
}

/** Fraction of loci that are heterozygous (by allele identity). */
export function heterozygosity(g: Genome): number {
  let het = 0;
  let n = 0;
  for (let i = 0; i < g.a.length; i++) {
    const a = g.a[i];
    const b = g.b[i];
    if (!a || !b) continue;
    n++;
    if (a.id !== b.id) het++;
  }
  return n ? het / n : 0;
}
