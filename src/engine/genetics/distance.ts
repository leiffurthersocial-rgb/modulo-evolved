import { LOCI } from "./layout";
import type { Genome } from "./types";

/**
 * Allele-sharing distance D_ps between two individuals (Bowcock et al. 1994):
 * 1 − mean over loci of (number of shared alleles / 2). 0 = identical genotypes,
 * 1 = no alleles in common. Module loci are included, so chimeras read as divergent.
 */
export function geneticDistance(x: Genome, y: Genome): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < LOCI.length; i++) {
    const xa = x.a[i]?.id ?? -1;
    const xb = x.b[i]?.id ?? -1;
    const ya = y.a[i]?.id ?? -1;
    const yb = y.b[i]?.id ?? -1;
    const xs = [xa, xb].filter((v) => v !== -1);
    const ys = [ya, yb].filter((v) => v !== -1);
    if (!xs.length || !ys.length) continue;
    // Max matching between the two allele multisets, normalised to [0, 1].
    let shared = 0;
    const pool = [...ys];
    for (const v of xs) {
      const k = pool.indexOf(v);
      if (k >= 0) {
        shared++;
        pool.splice(k, 1);
      }
    }
    sum += shared / Math.max(xs.length, ys.length);
    n++;
  }
  return n ? 1 - sum / n : 1;
}

/**
 * Hybrid fertility as a function of genetic distance: postzygotic isolation from
 * accumulated Dobzhansky–Muller incompatibilities, modelled as a smooth threshold.
 */
export function crossFertility(distance: number): number {
  const lo = 0.55;
  const hi = 0.8;
  if (distance <= lo) return 1;
  if (distance >= hi) return 0;
  const t = (distance - lo) / (hi - lo);
  return 1 - t * t * (3 - 2 * t);
}
