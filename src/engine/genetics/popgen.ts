import type { Genome } from "./types";

/** Allele frequencies at a locus, keyed by allele id. Hemizygous loci count one copy. */
export function alleleFrequencies(genomes: readonly Genome[], locus: number): Map<number, number> {
  const counts = new Map<number, number>();
  let total = 0;
  for (const g of genomes) {
    for (const al of [g.a[locus], g.b[locus]]) {
      if (!al) continue;
      counts.set(al.id, (counts.get(al.id) ?? 0) + 1);
      total++;
    }
  }
  for (const [k, v] of counts) counts.set(k, v / total);
  return counts;
}

/** Expected heterozygosity (gene diversity) 1 − Σ p². */
export function expectedHeterozygosity(freqs: Map<number, number>): number {
  let s = 0;
  for (const p of freqs.values()) s += p * p;
  return 1 - s;
}

export function observedHeterozygosity(genomes: readonly Genome[], locus: number): number {
  let het = 0;
  let n = 0;
  for (const g of genomes) {
    const a = g.a[locus];
    const b = g.b[locus];
    if (!a || !b) continue;
    n++;
    if (a.id !== b.id) het++;
  }
  return n ? het / n : 0;
}

/** Wright's inbreeding coefficient F = 1 − Ho/He. */
export function fixationIndex(genomes: readonly Genome[], locus: number): number {
  const he = expectedHeterozygosity(alleleFrequencies(genomes, locus));
  return he > 0 ? 1 - observedHeterozygosity(genomes, locus) / he : 0;
}

/** Shannon diversity H' = −Σ p ln p over category counts. */
export function shannon(counts: Iterable<number>): number {
  const arr = [...counts].filter((c) => c > 0);
  const n = arr.reduce((a, b) => a + b, 0);
  if (!n) return 0;
  return -arr.reduce((acc, c) => acc + (c / n) * Math.log(c / n), 0);
}
