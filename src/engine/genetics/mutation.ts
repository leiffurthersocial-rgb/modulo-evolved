import type { Rng } from "../rng/rng";
import type { AlleleFactory } from "./alleles";
import { LOCI } from "./layout";
import type { Allele, Haplotype } from "./types";

/** Per-locus, per-gamete mutation probabilities. */
export interface MutationRates {
  /** Base substitution: small change in effect size. */
  point: number;
  /** Insertion/deletion: usually a frameshift (loss of function), sometimes in-frame. */
  indel: number;
  /** Tandem duplication: +1 copy, raising dosage. */
  duplication: number;
  /** cis-regulatory change: scales expression up or down. */
  regulatory: number;
  /** Neutral marker (microsatellite slippage) rate. */
  neutral: number;
}

/**
 * Defaults are ~1000× higher than real per-locus rates so that evolution is visible in
 * minutes rather than millennia. The UI exposes a multiplier.
 */
export const DEFAULT_RATES: MutationRates = {
  point: 2e-3,
  indel: 4e-4,
  duplication: 2e-4,
  regulatory: 8e-4,
  neutral: 5e-3,
};

export function scaleRates(r: MutationRates, k: number): MutationRates {
  return {
    point: r.point * k,
    indel: r.indel * k,
    duplication: r.duplication * k,
    regulatory: r.regulatory * k,
    neutral: r.neutral * k,
  };
}

export type MutationKind = "point" | "indel" | "duplication" | "regulatory";

/** Apply one mutation of a given kind to an allele. Pure apart from new allele ids. */
export function mutateAllele(
  al: Allele,
  kind: MutationKind,
  rng: Rng,
  f: AlleleFactory,
  locus: number,
): Allele {
  const def = LOCI[locus];
  switch (def.kind) {
    case "neutral":
      return f.derive(al, { effect: al.effect + (rng.chance(0.5) ? 1 : -1) });
    case "module":
      // Developmental modules are large, integrated programs: only their dosage or
      // regulation can shift, which changes dominance in heterozygotes.
      if (kind === "duplication")
        return f.derive(al, { copies: Math.min(4, al.copies + 1), dom: al.dom * 1.5 });
      return f.derive(al, { dom: Math.max(0.1, al.dom * Math.exp(rng.normal(0, 0.4))) });
    case "color":
      if (kind === "indel" || kind === "point") {
        // Most coding changes in pigment genes are loss-of-function → recessive.
        return f.derive(al, { effect: -1, dom: 1, lof: false });
      }
      return f.derive(al, { dom: Math.max(0.2, al.dom * Math.exp(rng.normal(0, 0.5))) });
    case "load":
      if (al.lof) return rng.chance(0.1) ? f.derive(al, { lof: false }) : al;
      return kind === "regulatory"
        ? f.derive(al, { expr: al.expr * Math.exp(rng.normal(0, 0.2)) })
        : f.derive(al, { lof: true });
    default:
      break;
  }
  switch (kind) {
    case "point":
      return f.derive(al, {
        effect: al.effect + rng.normal(0, 0.3),
        dom: Math.max(0.1, al.dom * Math.exp(rng.normal(0, 0.2))),
      });
    case "indel":
      return rng.chance(2 / 3)
        ? f.derive(al, { lof: true })
        : f.derive(al, { effect: al.effect + rng.normal(0, 0.5), lof: false });
    case "duplication":
      return f.derive(al, { copies: Math.min(4, al.copies + 1) });
    case "regulatory":
      return f.derive(al, { expr: Math.min(4, Math.max(0.1, al.expr * Math.exp(rng.normal(0, 0.35)))) });
  }
}

/**
 * Mutate a gamete in place (copy-on-write at the array level is the caller's job).
 * Returns the number of mutations applied.
 */
export function mutateGamete(h: Haplotype, rates: MutationRates, rng: Rng, f: AlleleFactory): number {
  let n = 0;
  const total = rates.point + rates.indel + rates.duplication + rates.regulatory;
  for (let i = 0; i < h.length; i++) {
    const al = h[i];
    if (!al) continue;
    const def = LOCI[i];
    if (def.kind === "neutral") {
      if (rng.chance(rates.neutral)) {
        h[i] = mutateAllele(al, "point", rng, f, i);
        n++;
      }
      continue;
    }
    const p = def.kind === "module" ? total * 0.1 : total;
    if (!rng.chance(p)) continue;
    const u = rng.next() * total;
    const kind: MutationKind =
      u < rates.point
        ? "point"
        : u < rates.point + rates.indel
          ? "indel"
          : u < rates.point + rates.indel + rates.duplication
            ? "duplication"
            : "regulatory";
    h[i] = mutateAllele(al, kind, rng, f, i);
    n++;
  }
  return n;
}
