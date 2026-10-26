import type { Rng } from "../rng/rng";
import type { AlleleFactory } from "../genetics/alleles";
import { LOCI } from "../genetics/layout";
import { withKaryotype } from "../genetics/meiosis";
import type { Allele, Genome, Haplotype, Sex } from "../genetics/types";
import { SPECIES, SPECIES_IDS } from "./roster";
import type { SpeciesId } from "./types";

export interface AllelePool {
  alleles: Allele[];
  /** Cumulative frequencies for sampling. */
  cum: number[];
}

export type SpeciesPools = Record<SpeciesId, AllelePool[]>;

function pool(entries: [Allele, number][]): AllelePool {
  const kept = entries.filter(([, p]) => p > 0);
  const total = kept.reduce((a, [, p]) => a + p, 0);
  let acc = 0;
  return {
    alleles: kept.map(([a]) => a),
    cum: kept.map(([, p]) => (acc += p / total)),
  };
}

/**
 * Standing genetic variation for every species: a small set of alleles per locus with
 * random frequencies. Alleles are species-specific objects, so between-species genetic
 * distance starts near 1 while within-species distance is moderate.
 */
export function buildPools(
  rng: Rng,
  f: AlleleFactory,
  ids: readonly SpeciesId[] = SPECIES_IDS,
): SpeciesPools {
  const out = {} as SpeciesPools;
  for (const id of ids) {
    const sp = SPECIES[id];
    const base = { copies: 1, expr: 1, lof: false, origin: id };
    out[id] = LOCI.map((def) => {
      const mk = (effect: number, dom: number, extra: Partial<Allele> = {}) =>
        f.make({ ...base, effect, dom, ...extra });
      switch (def.kind) {
        case "quant": {
          const n = 2 + rng.int(2);
          return pool(
            Array.from({ length: n }, () => [
              mk(rng.normal(0, 0.45), Math.exp(rng.normal(0, 0.6))),
              0.2 + rng.next() ** 2,
            ]),
          );
        }
        case "regulatory":
          return pool([
            [mk(rng.normal(0, 0.15), 1), 0.5 + rng.next()],
            [mk(rng.normal(0, 0.15), 1), 0.2 + rng.next()],
          ]);
        case "major": {
          // Lactase persistence: present (dominant) only in the human founder pool.
          const freq = id === "human" ? 0.3 : 0;
          return pool([
            [mk(1, 3), freq],
            [mk(-1, 1), 1 - freq],
          ]);
        }
        case "color": {
          const p =
            def.key === "colB" ? sp.palette.freqB : def.key === "colE" ? sp.palette.freqE : sp.palette.freqS;
          const domW = def.key === "colS" ? 1 : 4;
          return pool([
            [mk(1, domW), p],
            [mk(-1, 1), 1 - p],
          ]);
        }
        case "load": {
          const q = 0.05 + rng.next() * 0.1;
          return pool([
            [mk(0, 1), 1 - q],
            [mk(0, 1, { lof: true }), q],
          ]);
        }
        case "neutral": {
          const n = 4 + rng.int(3);
          return pool(Array.from({ length: n }, (_, k) => [mk(k + rng.int(20), 1), 0.3 + rng.next()]));
        }
        case "module": {
          const slot = def.slot!;
          const present = sp.parts[slot] !== null;
          return pool([[mk(0, 1, { module: { slot, species: present ? id : null } }), 1]]);
        }
      }
    });
  }
  return out;
}

function sample(p: AllelePool, rng: Rng): Allele {
  const u = rng.next();
  for (let i = 0; i < p.cum.length; i++) if (u < p.cum[i]) return p.alleles[i];
  return p.alleles[p.alleles.length - 1];
}

export function sampleHaplotype(pools: AllelePool[], rng: Rng): Haplotype {
  return pools.map((p) => sample(p, rng));
}

/** A wild-type founder individual drawn from its species' standing variation (Hardy–Weinberg). */
export function founderGenome(id: SpeciesId, pools: SpeciesPools, rng: Rng, sex: Sex): Genome {
  const a = sampleHaplotype(pools[id], rng);
  const b = sampleHaplotype(pools[id], rng);
  return withKaryotype(a, b, sex, SPECIES[id].sexSystem);
}
