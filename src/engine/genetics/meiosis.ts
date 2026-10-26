import type { Rng } from "../rng/rng";
import { CHROMOSOMES, LOCI, LOCI_BY_CHROM, SEX_CHROM } from "./layout";
import type { Allele, Genome, Haplotype, Sex, SexSystem } from "./types";

/** True if the genome carries only one sex chromosome (XY male / ZW female). */
export function isHeterogametic(g: Genome): boolean {
  const first = LOCI_BY_CHROM[SEX_CHROM][0];
  return g.a[first] === null || g.b[first] === null;
}

/**
 * Meiosis: produce one haploid gamete.
 *
 * Crossovers per chromosome ~ Poisson(L / 100 cM) at uniform positions (no interference),
 * which yields Haldane's map function r = ½(1 − e^(−2d)) between loci d Morgans apart.
 * In the heterogametic sex the X/Y (Z/W) pair does not recombine; the gamete gets either
 * the X (all sex-linked alleles) or the Y (null at every sex-linked locus).
 */
export function makeGamete(g: Genome, rng: Rng): Haplotype {
  const out: Haplotype = new Array(LOCI.length);
  const hetero = isHeterogametic(g);
  for (let c = 0; c < CHROMOSOMES.length; c++) {
    const loci = LOCI_BY_CHROM[c];
    if (c === SEX_CHROM && hetero) {
      const passX = rng.chance(0.5);
      for (const i of loci) out[i] = passX ? (g.a[i] ?? g.b[i]) : null;
      continue;
    }
    const len = CHROMOSOMES[c].lengthCM;
    const n = rng.poisson(len / 100);
    const xo: number[] = [];
    for (let k = 0; k < n; k++) xo.push(rng.next() * len);
    xo.sort((x, y) => x - y);
    let fromA = rng.chance(0.5);
    let k = 0;
    for (const i of loci) {
      const pos = LOCI[i].posCM;
      while (k < xo.length && xo[k] < pos) {
        fromA = !fromA;
        k++;
      }
      out[i] = fromA ? g.a[i] : g.b[i];
    }
  }
  return out;
}

/** Fertilisation: maternal egg + paternal sperm. */
export function fertilize(egg: Haplotype, sperm: Haplotype): Genome {
  return { a: egg, b: sperm };
}

/**
 * Phenotypic sex.
 * - XY (mammals): heterogametic = male.
 * - ZW (birds): heterogametic = female.
 * - TSD (crocodilians): set by nest temperature. Males develop in a narrow band around
 *   ~32 °C; cooler and hotter nests produce females (pattern Ia/II as in Crocodylus).
 */
export function determineSex(g: Genome, system: SexSystem, rng: Rng, nestTempC = 30): Sex {
  if (system === "XY") return isHeterogametic(g) ? "M" : "F";
  if (system === "ZW") return isHeterogametic(g) ? "F" : "M";
  return rng.chance(tsdMaleProbability(nestTempC)) ? "M" : "F";
}

export function tsdMaleProbability(nestTempC: number) {
  return Math.exp(-(((nestTempC - 32) / 1.6) ** 2));
}

/** Build a genome of the right karyotype for a sex from two haplotypes of alleles. */
export function withKaryotype(
  a: (Allele | null)[],
  b: (Allele | null)[],
  sex: Sex,
  system: SexSystem,
): Genome {
  if (system === "TSD") return { a, b };
  const hetero = (system === "XY" && sex === "M") || (system === "ZW" && sex === "F");
  if (!hetero) return { a, b: b.map((x, i) => x ?? a[i]) };
  const a2 = [...a];
  const b2 = [...b];
  for (const i of LOCI_BY_CHROM[SEX_CHROM]) {
    // XY: Y comes from father (b). ZW: W comes from mother (a).
    if (system === "XY") {
      a2[i] = a2[i] ?? b2[i];
      b2[i] = null;
    } else {
      b2[i] = b2[i] ?? a2[i];
      a2[i] = null;
    }
  }
  return { a: a2, b: b2 };
}
