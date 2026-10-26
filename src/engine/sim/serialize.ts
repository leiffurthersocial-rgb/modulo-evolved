import { Rng, type RngState } from "../rng/rng";
import type { Allele, Genome } from "../genetics/types";
import { computePhenotype } from "../anatomy/phenotype";
import { computeStats } from "../anatomy/stats";
import type { SeriesPoint } from "./recorder";
import type { Agent, DeathCause, EnvSettings, Lineage, WorldConfig, WorldEvent } from "./types";
import { World } from "./world";

export const SAVE_VERSION = 1;

type GenomeRef = { a: number[]; b: number[] };

export interface SaveFile {
  format: "modulo-evolved/world";
  version: number;
  scenario: string;
  savedAt: string;
  config: WorldConfig;
  env: EnvSettings;
  day: number;
  nextId: number;
  alleleNextId: number;
  rng: RngState;
  alleles: Allele[];
  agents: (Omit<Agent, "genome" | "ph" | "st" | "gestation"> & {
    genome: GenomeRef;
    gestation: { until: number; father: GenomeRef; fatherId: number; fatherLineage: number } | null;
  })[];
  lineages: Lineage[];
  events: WorldEvent[];
  totals: World["totals"];
  deathCauses: Record<DeathCause, number>;
  notices: World["notices"];
  biomass: number[];
  fauna: number[];
  series: SeriesPoint[];
  nextSpeciationCheck: number;
  vegDt: number;
  carcasses: World["carcasses"];
  nextCarcassId: number;
  recorder: { interval: number; nextAt: number };
}

/** Shared alleles are stored once; genomes become index arrays (-1 = absent/hemizygous). */
export class AlleleTable {
  readonly list: Allele[] = [];
  private index = new Map<number, number>();
  ref(g: Genome): GenomeRef {
    return { a: g.a.map((x) => this.add(x)), b: g.b.map((x) => this.add(x)) };
  }
  private add(al: Allele | null) {
    if (!al) return -1;
    let i = this.index.get(al.id);
    if (i === undefined) {
      i = this.list.length;
      this.list.push(al);
      this.index.set(al.id, i);
    }
    return i;
  }
}

export function resolveGenome(ref: GenomeRef, alleles: readonly Allele[]): Genome {
  return {
    a: ref.a.map((i) => (i < 0 ? null : alleles[i])),
    b: ref.b.map((i) => (i < 0 ? null : alleles[i])),
  };
}

const round = (v: number, k = 1000) => Math.round(v * k) / k;

export function serializeWorld(w: World, scenario: string): SaveFile {
  const table = new AlleleTable();
  const agents = w.agents.map((a) => {
    const { genome, gestation, ...withDerived } = a;
    const rest: Partial<typeof withDerived> = { ...withDerived };
    // Phenotype and stats are recomputed from the genome on load.
    delete rest.ph;
    delete rest.st;
    return {
      ...(rest as Omit<Agent, "genome" | "ph" | "st" | "gestation">),
      genome: table.ref(genome),
      gestation: gestation ? { ...gestation, father: table.ref(gestation.father) } : null,
    };
  });
  return {
    format: "modulo-evolved/world",
    version: SAVE_VERSION,
    scenario,
    savedAt: new Date().toISOString(),
    config: w.config,
    env: w.env,
    day: w.day,
    nextId: w.nextId,
    alleleNextId: w.alleles.nextId,
    rng: w.rng.getState(),
    alleles: table.list,
    agents,
    lineages: w.lineages,
    events: w.events,
    totals: w.totals,
    deathCauses: w.deathCauses,
    notices: w.notices,
    biomass: Array.from(w.veg.biomass, (v) => round(v, 1)),
    fauna: Array.from(w.veg.fauna, (v) => round(v, 1)),
    series: w.recorder.points,
    nextSpeciationCheck: w.nextSpeciationCheck,
    vegDt: w.vegDt,
    carcasses: w.carcasses,
    nextCarcassId: w.nextCarcassId,
    recorder: { interval: w.recorder.interval, nextAt: w.recorder.nextAt },
  };
}

export function deserializeWorld(raw: unknown): { world: World; scenario: string } {
  const s = raw as SaveFile;
  if (!s || s.format !== "modulo-evolved/world") throw new Error("Not a Modulo Evolved world file");
  if (s.version > SAVE_VERSION) throw new Error(`Save version ${s.version} is newer than this app`);
  const w = new World({ ...s.config, skipPopulate: true });
  w.setEnv(s.env);
  w.day = s.day;
  w.nextId = s.nextId;
  w.alleles.nextId = s.alleleNextId;
  (w as unknown as { rng: Rng }).rng = new Rng(s.rng);
  const alleles = s.alleles.map((a) => Object.freeze({ ...a }));
  w.agents = [];
  w.byId.clear();
  for (const raw of s.agents) {
    const genome = resolveGenome(raw.genome, alleles);
    const ph = computePhenotype(genome, raw.species, raw.sex);
    const st = computeStats(ph);
    const a: Agent = {
      ...raw,
      genome,
      ph,
      st,
      gestation: raw.gestation
        ? { ...raw.gestation, father: resolveGenome(raw.gestation.father, alleles) }
        : null,
    };
    w.agents.push(a);
    w.byId.set(a.id, a);
  }
  w.lineages = s.lineages;
  w.events = s.events;
  Object.assign(w.totals, s.totals);
  Object.assign(w.deathCauses, s.deathCauses);
  w.notices = s.notices;
  w.veg.biomass.set(s.biomass);
  w.veg.fauna.set(s.fauna);
  w.recorder.points = s.series;
  w.nextSpeciationCheck = s.nextSpeciationCheck;
  w.vegDt = s.vegDt ?? 0;
  w.carcasses = s.carcasses ?? [];
  w.nextCarcassId = s.nextCarcassId ?? 1;
  if (s.recorder) {
    w.recorder.interval = s.recorder.interval;
    w.recorder.nextAt = s.recorder.nextAt;
  }
  w.newborns = [];
  return { world: w, scenario: s.scenario };
}
