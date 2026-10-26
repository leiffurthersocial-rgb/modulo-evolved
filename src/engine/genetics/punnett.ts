import { CHROMOSOMES, LOCI, LOCUS_INDEX, SEX_CHROM } from "./layout";
import { coatGenotype, locusValue, type CoatBase } from "./expression";
import { isHeterogametic } from "./meiosis";
import type { Allele, Genome } from "./types";

export interface GameteClass {
  /** One allele (or null for Y/W) per requested locus. */
  alleles: (Allele | null)[];
  p: number;
}

/** Haldane map function: recombination fraction from map distance in cM. */
export function haldane(cM: number) {
  return 0.5 * (1 - Math.exp((-2 * cM) / 100));
}

/** Recombination fraction between two loci (0.5 if unlinked; 0 between X and Y in the heterogametic sex). */
export function recombination(g: Genome, l1: number, l2: number) {
  const a = LOCI[l1];
  const b = LOCI[l2];
  if (a.chrom !== b.chrom) return 0.5;
  if (a.chrom === SEX_CHROM && isHeterogametic(g)) return 0;
  return haldane(Math.abs(a.posCM - b.posCM));
}

/**
 * Exact gamete classes for up to two loci, accounting for linkage and sex chromosomes.
 * Identical classes (same allele identities) are merged.
 */
export function gameteClasses(g: Genome, loci: number[]): GameteClass[] {
  const hetero = isHeterogametic(g);
  const strands = (l: number): [Allele | null, Allele | null] => {
    if (LOCI[l].chrom === SEX_CHROM && hetero) {
      const x = g.a[l] ?? g.b[l];
      return g.a[l] ? [x, null] : [null, x];
    }
    return [g.a[l], g.b[l]];
  };
  let classes: GameteClass[];
  if (loci.length === 1) {
    const [a, b] = strands(loci[0]);
    classes = [
      { alleles: [a], p: 0.5 },
      { alleles: [b], p: 0.5 },
    ];
  } else {
    const [l1, l2] = loci;
    const [a1, b1] = strands(l1);
    const [a2, b2] = strands(l2);
    const r = recombination(g, l1, l2);
    classes = [
      { alleles: [a1, a2], p: (1 - r) / 2 },
      { alleles: [b1, b2], p: (1 - r) / 2 },
      { alleles: [a1, b2], p: r / 2 },
      { alleles: [b1, a2], p: r / 2 },
    ];
  }
  const merged = new Map<string, GameteClass>();
  for (const c of classes) {
    if (c.p <= 0) continue;
    const key = c.alleles.map((x) => x?.id ?? "Y").join("|");
    const m = merged.get(key);
    if (m) m.p += c.p;
    else merged.set(key, { alleles: [...c.alleles], p: c.p });
  }
  return [...merged.values()];
}

export interface PunnettCell {
  egg: GameteClass;
  sperm: GameteClass;
  /** Per locus: [maternal, paternal]. */
  genotype: [Allele | null, Allele | null][];
  p: number;
  label: string;
  coat?: CoatBase;
  pattern?: number;
}

export interface Punnett {
  eggs: GameteClass[];
  sperm: GameteClass[];
  cells: PunnettCell[][];
  /** Phenotype class → probability. */
  classes: { label: string; p: number; coat?: CoatBase }[];
}

/**
 * Punnett square for a cross. Pigmentation loci are scored as coat phenotypes (recessive
 * epistasis included); other loci by their genotypic value.
 */
export function punnett(
  mother: Genome,
  father: Genome,
  loci: number[],
  ctx?: { motherBase?: Genome },
): Punnett {
  const eggs = gameteClasses(mother, loci);
  const sperm = gameteClasses(father, loci);
  const base = ctx?.motherBase ?? mother;
  const cells = eggs.map((egg) =>
    sperm.map((sp) => {
      const genotype = loci.map((_, k) => [egg.alleles[k], sp.alleles[k]] as [Allele | null, Allele | null]);
      const { label, coat, pattern } = scoreCell(base, loci, genotype);
      return { egg, sperm: sp, genotype, p: egg.p * sp.p, label, coat, pattern };
    }),
  );
  const classMap = new Map<string, { label: string; p: number; coat?: CoatBase }>();
  for (const row of cells)
    for (const c of row) {
      const e = classMap.get(c.label);
      if (e) e.p += c.p;
      else classMap.set(c.label, { label: c.label, p: c.p, coat: c.coat });
    }
  return { eggs, sperm, cells, classes: [...classMap.values()].sort((a, b) => b.p - a.p) };
}

function scoreCell(base: Genome, loci: number[], genotype: [Allele | null, Allele | null][]) {
  const colorKeys = new Set(["colB", "colE", "colS"]);
  const isColor = loci.some((l) => colorKeys.has(LOCI[l].key));
  if (isColor) {
    // Evaluate coat on a copy of the base genome with the chosen loci substituted.
    const a = [...base.a];
    const b = [...base.b];
    loci.forEach((l, k) => {
      a[l] = genotype[k][0];
      b[l] = genotype[k][1];
    });
    const coat = coatGenotype({ a, b });
    const parts: string[] = [];
    if (loci.some((l) => LOCI[l].key === "colB" || LOCI[l].key === "colE")) parts.push(coat.base);
    if (loci.some((l) => LOCI[l].key === "colS"))
      parts.push(coat.pattern > 0.75 ? "striped" : coat.pattern > 0.25 ? "faint stripes" : "plain");
    return { label: parts.join(", "), coat: coat.base, pattern: coat.pattern };
  }
  const label = loci
    .map((l, k) => {
      const v = locusValue(genotype[k][0], genotype[k][1]);
      return `${LOCI[l].name} ${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
    })
    .join(" · ");
  return { label };
}

/** Short allele symbols per locus (uppercase = dominant), from the alleles present. */
export function alleleSymbols(locus: number, alleles: (Allele | null)[]): Map<number, string> {
  const def = LOCI[locus];
  const base =
    def.key === "colB"
      ? "B"
      : def.key === "colE"
        ? "E"
        : def.key === "colS"
          ? "S"
          : def.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3);
  const uniq = [...new Map(alleles.filter(Boolean).map((a) => [a!.id, a!])).values()].sort(
    (x, y) => y.dom - x.dom || y.effect - x.effect,
  );
  const out = new Map<number, string>();
  if (def.kind === "color") {
    // Pigment alleles: uppercase = functional/dominant, lowercase = recessive variant.
    const seen = new Map<string, number>();
    for (const a of uniq) {
      const sym = a.effect > 0 ? base.toUpperCase() : base.toLowerCase();
      const k = (seen.get(sym) ?? 0) + 1;
      seen.set(sym, k);
      out.set(a.id, k === 1 ? sym : `${sym}${"¹²³⁴⁵⁶⁷⁸⁹"[k - 1] ?? k}`);
    }
    return out;
  }
  uniq.forEach((a, i) => out.set(a.id, uniq.length === 1 ? base : `${base}${"¹²³⁴⁵⁶⁷⁸⁹"[i] ?? i + 1}`));
  return out;
}

export const COAT_KEYS = { colB: LOCUS_INDEX.colB, colE: LOCUS_INDEX.colE, colS: LOCUS_INDEX.colS };
export { CHROMOSOMES };
