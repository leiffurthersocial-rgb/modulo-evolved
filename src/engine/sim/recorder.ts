import { heterozygosity } from "../genetics/expression";
import { LOCI, LOCUS_INDEX } from "../genetics/layout";
import { shannon } from "../genetics/popgen";
import { SPECIES_IDS } from "../species/roster";
import type { SpeciesId } from "../species/types";
import type { World } from "./world";

export const TRAIT_KEYS = [
  "mass",
  "speed",
  "bite",
  "ornament",
  "sociality",
  "lightness",
  "immunity",
  "het",
  "culture",
] as const;
export type TraitKey = (typeof TRAIT_KEYS)[number];

export interface SpeciesSample {
  n: number;
  /** Mean of each tracked trait. */
  m: Record<TraitKey, number>;
}

export interface SeriesPoint {
  day: number;
  /** Population per lineage id. */
  lineages: Record<number, number>;
  species: Partial<Record<SpeciesId, SpeciesSample>>;
  shannon: number;
  richness: number;
  vegetation: number;
  temperature: number;
}

export interface AlleleTrack {
  species: SpeciesId;
  locus: string;
  days: number[];
  /** Per sample: allele id → frequency (alleles ≥ 1%). */
  freqs: Record<number, number>[];
}

const MAX_POINTS = 900;

/**
 * Records population-level time series. When full, it halves resolution and doubles the
 * sampling interval, so arbitrarily long runs fit in bounded memory.
 */
export class Recorder {
  points: SeriesPoint[] = [];
  tracks = new Map<string, AlleleTrack>();
  interval = 2;
  nextAt = 0;

  constructor() {
    for (const sp of SPECIES_IDS) {
      this.track(sp, "colE");
      this.track(sp, "size1");
    }
    this.track("human", "lactase");
    this.track("human", "light1");
  }

  track(species: SpeciesId, locus: string) {
    const key = `${species}:${locus}`;
    if (!this.tracks.has(key) && LOCUS_INDEX[locus] !== undefined) {
      this.tracks.set(key, { species, locus, days: [], freqs: [] });
    }
    return key;
  }

  sample(w: World, force = false) {
    if (!force && w.day < this.nextAt) return;
    this.nextAt = w.day + this.interval;

    const lineages: Record<number, number> = {};
    const acc: Partial<Record<SpeciesId, { n: number; s: Record<TraitKey, number> }>> = {};
    for (const a of w.agents) {
      lineages[a.lineage] = (lineages[a.lineage] ?? 0) + 1;
      const e = (acc[a.species] ??= {
        n: 0,
        s: {
          mass: 0,
          speed: 0,
          bite: 0,
          ornament: 0,
          sociality: 0,
          lightness: 0,
          immunity: 0,
          het: 0,
          culture: 0,
        },
      });
      e.n++;
      e.s.mass += a.ph.massKg;
      e.s.speed += a.st.speedKmh || a.st.swimKmh;
      e.s.bite += a.st.biteN;
      e.s.ornament += a.ph.ornament;
      e.s.sociality += a.ph.sociality;
      e.s.lightness += a.ph.lightness;
      e.s.immunity += a.ph.immunity;
      e.s.het += heterozygosity(a.genome);
      e.s.culture += a.culture;
    }
    const species: SeriesPoint["species"] = {};
    for (const [id, e] of Object.entries(acc) as [SpeciesId, { n: number; s: Record<TraitKey, number> }][]) {
      const m = {} as Record<TraitKey, number>;
      for (const k of TRAIT_KEYS) m[k] = e.s[k] / e.n;
      species[id] = { n: e.n, m };
    }
    const counts = Object.values(lineages);
    this.points.push({
      day: w.day,
      lineages,
      species,
      shannon: shannon(counts),
      richness: counts.filter((c) => c > 0).length,
      vegetation: w.veg.totalLand(),
      temperature: w.temperatureNow(),
    });

    for (const t of this.tracks.values()) {
      const li = LOCUS_INDEX[t.locus];
      const counts = new Map<number, number>();
      let total = 0;
      for (const a of w.agents) {
        if (a.species !== t.species) continue;
        for (const al of [a.genome.a[li], a.genome.b[li]]) {
          if (!al) continue;
          counts.set(al.id, (counts.get(al.id) ?? 0) + 1);
          total++;
        }
      }
      const f: Record<number, number> = {};
      for (const [id, c] of counts) if (c / total >= 0.01) f[id] = Math.round((c / total) * 1000) / 1000;
      t.days.push(w.day);
      t.freqs.push(f);
    }

    if (this.points.length > MAX_POINTS) {
      this.points = this.points.filter((_, i) => i % 2 === 0);
      for (const t of this.tracks.values()) {
        t.days = t.days.filter((_, i) => i % 2 === 0);
        t.freqs = t.freqs.filter((_, i) => i % 2 === 0);
      }
      this.interval *= 2;
    }
  }
}

export function locusLabel(key: string) {
  const l = LOCI[LOCUS_INDEX[key]];
  return l ? `${l.name}` : key;
}
