/// <reference lib="webworker" />
import { World, type SpawnRequest } from "@/engine/sim/world";
import { seasonName } from "@/engine/sim/climate";
import type { CatastropheKind, WorldConfig } from "@/engine/sim/types";
import type { SpeciesId } from "@/engine/species/types";
import { heterozygosity } from "@/engine/genetics/expression";
import { bodyOf } from "@/sim/bodies";
import { FLAG, STRIDE, type FromWorker, type ToWorker } from "@/sim/protocol";
import { serializeWorld, deserializeWorld } from "@/engine/sim/serialize";
import { founderGenome } from "@/engine/species/founders";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (msg: FromWorker, transfer: Transferable[] = []) => ctx.postMessage(msg, transfer);

let world: World | null = null;
let scenario = "temperate";
let schedule: [number, CatastropheKind][] = [];
let running = false;
let daysPerSec = 0.2;
let pendingStep = 0;
let last = performance.now();
let lastStats = 0;
let lastVeg = 0;
let sentPoints = 0;
let sentNotices = 0;
let lastLineageCount = -1;
let rate = 0;
const MAX_DT = 0.1;
const BUDGET_MS = 12;

const STATE_CODE: Record<string, number> = {
  wander: 0,
  forage: 1,
  flee: 2,
  hunt: 3,
  mate: 4,
  rest: 5,
  eat: 6,
};

function start(config: Partial<WorldConfig>, scen: string, sched: [number, CatastropheKind][] = []) {
  world = new World(config);
  scenario = scen;
  schedule = [...sched].sort((a, b) => a[0] - b[0]);
  sentPoints = 0;
  sentNotices = 0;
  lastLineageCount = -1;
  world.drainChanges();
  post({
    type: "ready",
    info: {
      seed: world.config.seed,
      terrain: world.config.terrain,
      maxAgents: world.config.maxAgents,
      scenario,
    },
    bodies: world.agents.map(bodyOf),
  });
  sendFrame();
  sendStats(true);
  sendVeg();
}

function sendFrame() {
  if (!world) return;
  const w = world;
  const n = w.agents.length;
  const buf = new Float32Array(n * STRIDE);
  for (let i = 0; i < n; i++) {
    const a = w.agents[i];
    const o = i * STRIDE;
    let flags = 0;
    if (a.infected > 0) flags |= FLAG.infected;
    if (a.flying) flags |= FLAG.flying;
    if (!a.st.aquatic && !a.flying && w.terrain.heightAt(a.x, a.z) < -0.2) flags |= FLAG.swimming;
    if (a.sex === "M") flags |= FLAG.male;
    if (a.state === "eat") flags |= FLAG.eating;
    if (a.gestation) flags |= FLAG.gestating;
    const g = w.growth(a);
    if (g < 1) flags |= FLAG.juvenile;
    buf[o] = a.id;
    buf[o + 1] = a.x;
    buf[o + 2] = a.y;
    buf[o + 3] = a.z;
    buf[o + 4] = a.heading;
    buf[o + 5] = 0.45 + 0.55 * g;
    buf[o + 6] = a.anim;
    buf[o + 7] = flags;
    buf[o + 8] = STATE_CODE[a.state] ?? 0;
    buf[o + 9] = a.lineage;
  }
  const { born, died } = w.drainChanges();
  post({ type: "frame", day: w.day, count: n, buf, born: born.map(bodyOf), died, rate }, [buf.buffer]);
}

function sendStats(force = false) {
  if (!world) return;
  const w = world;
  const speciesCounts: Partial<Record<SpeciesId, number>> = {};
  const lineageCounts: Record<number, number> = {};
  for (const a of w.agents) {
    speciesCounts[a.species] = (speciesCounts[a.species] ?? 0) + 1;
    lineageCounts[a.lineage] = (lineageCounts[a.lineage] ?? 0) + 1;
  }
  const pts = w.recorder.points;
  const reset = pts.length < sentPoints || force;
  const series = reset ? pts : pts.slice(sentPoints);
  sentPoints = pts.length;
  if (w.notices.length < sentNotices) sentNotices = 0;
  const notices = w.notices.slice(sentNotices);
  sentNotices = w.notices.length;
  const lineagesChanged =
    w.lineages.length !== lastLineageCount || w.lineages.some((l) => l.extinctDay === w.day);
  lastLineageCount = w.lineages.length;
  post({
    type: "stats",
    day: w.day,
    temperature: w.temperatureNow(),
    season: seasonName(w.day),
    seasonWarmth: w.seasonWarmth(),
    speciesCounts,
    lineageCounts,
    lineages: force || lineagesChanged || true ? w.lineages : [],
    totals: { ...w.totals },
    deathCauses: { ...w.deathCauses },
    notices,
    events: w.events,
    series,
    seriesReset: reset,
    agentCount: w.agents.length,
  });
}

function sendVeg() {
  if (!world) return;
  const data = world.veg.snapshot();
  post({ type: "veg", data }, [data.buffer]);
}

function loop() {
  const now = performance.now();
  const real = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (world) {
    let days = (running ? daysPerSec * real : 0) + pendingStep;
    pendingStep = 0;
    const t0 = performance.now();
    let done = 0;
    while (days > 1e-9) {
      const dt = Math.min(MAX_DT, days);
      world.tick(dt);
      days -= dt;
      done += dt;
      while (schedule.length && world.day >= schedule[0][0]) world.trigger(schedule.shift()![1]);
      if (performance.now() - t0 > BUDGET_MS) break; // drop the remainder: run slower than requested
    }
    rate = rate * 0.9 + (real > 0 ? done / real : 0) * 0.1;
    if (done > 0 || world.newborns.length || world.deaths.length) sendFrame();
    if (now - lastStats > 500) {
      lastStats = now;
      sendStats();
    }
    if (now - lastVeg > 1200) {
      lastVeg = now;
      sendVeg();
    }
  }
  setTimeout(loop, 16);
}
setTimeout(loop, 16);

// ------------------------------------------------------------------ RPC

const rpc: Record<string, (...args: never[]) => unknown> = {
  getAgent(id: number) {
    const a = world?.byId.get(id);
    if (!a || !world) return null;
    const lin = world.lineages[a.lineage];
    return {
      id: a.id,
      species: a.species,
      lineage: a.lineage,
      lineageName: lin?.name ?? "",
      sex: a.sex,
      ageDays: world.day - a.birthDay,
      generation: a.generation,
      motherId: a.motherId,
      fatherId: a.fatherId,
      offspring: a.offspring,
      energy: a.energy,
      maxEnergy: a.maxEnergy,
      state: a.state,
      culture: a.culture,
      infected: a.infected > 0,
      gestating: !!a.gestation,
      heterozygosity: heterozygosity(a.genome),
      ph: a.ph,
      st: a.st,
      genome: a.genome,
      position: [a.x, a.y, a.z],
      temperature: world.temperatureNow() - 0.28 * Math.max(0, world.terrain.heightAt(a.x, a.z)),
    };
  },
  getTrack(species: SpeciesId, locus: string) {
    if (!world) return null;
    const key = world.recorder.track(species, locus);
    return world.recorder.tracks.get(key) ?? null;
  },
  getSeries() {
    return world?.recorder.points ?? [];
  },
  /** Current values of a trait across a species (for distributions). */
  traitValues(species: SpeciesId, trait: string) {
    if (!world) return [];
    return world.agents
      .filter((a) => a.species === species)
      .map((a) => {
        switch (trait) {
          case "mass":
            return a.ph.massKg;
          case "speed":
            return a.st.speedKmh || a.st.swimKmh;
          case "bite":
            return a.st.biteN;
          case "ornament":
            return a.ph.ornament;
          case "lightness":
            return a.ph.lightness;
          case "sociality":
            return a.ph.sociality;
          case "immunity":
            return a.ph.immunity;
          case "het":
            return heterozygosity(a.genome);
          case "culture":
            return a.culture;
          default:
            return 0;
        }
      });
  },
  /** Genotype counts at a locus for a species: [aa, ab, bb] style by top-2 alleles. */
  genotypes(species: SpeciesId, locusIndex: number) {
    if (!world) return null;
    const pop = world.agents.filter((a) => a.species === species);
    return pop.map((a) => [a.genome.a[locusIndex]?.id ?? -1, a.genome.b[locusIndex]?.id ?? -1]);
  },
  spawn(req: SpawnRequest) {
    if (!world) return [];
    const ids = world.spawn(req);
    sendFrame();
    sendStats();
    return ids;
  },
  kill(id: number) {
    const a = world?.byId.get(id);
    if (a && world) world.kill(a, "culled");
    return true;
  },
  agentAt(id: number) {
    const a = world?.byId.get(id);
    return a ? [a.x, a.y, a.z] : null;
  },
  exportState() {
    return world ? serializeWorld(world, scenario) : null;
  },
  importState(data: unknown) {
    const res = deserializeWorld(data);
    world = res.world;
    scenario = res.scenario;
    schedule = [];
    sentPoints = 0;
    sentNotices = 0;
    world.drainChanges();
    post({
      type: "ready",
      info: {
        seed: world.config.seed,
        terrain: world.config.terrain,
        maxAgents: world.config.maxAgents,
        scenario,
      },
      bodies: world.agents.map(bodyOf),
    });
    sendFrame();
    sendStats(true);
    sendVeg();
    return true;
  },
  /** Sample genomes of a species (for the Genome Editor / Cross Lab pickers). */
  sampleGenomes(species: SpeciesId, n: number) {
    if (!world) return [];
    return world.agents
      .filter((a) => a.species === species)
      .slice(0, n)
      .map((a) => ({ id: a.id, sex: a.sex, genome: a.genome, lineage: a.lineage }));
  },
  founder(species: SpeciesId, sex: "F" | "M") {
    if (!world) return null;
    // A fresh wild-type genome from the species' founding allele pool.
    return founderGenome(species, world.pools, world.rng.fork(), sex);
  },
};

ctx.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  switch (m.type) {
    case "init":
      start(m.config, m.scenario, m.schedule);
      break;
    case "setRunning":
      running = m.running;
      last = performance.now();
      break;
    case "setSpeed":
      daysPerSec = m.daysPerSec;
      break;
    case "step":
      pendingStep += m.days;
      break;
    case "setEnv":
      world?.setEnv(m.env);
      break;
    case "trigger":
      world?.trigger(m.kind, m.x, m.z);
      sendFrame();
      sendStats();
      break;
    case "rpc": {
      try {
        const fn = rpc[m.method] as (...a: unknown[]) => unknown;
        if (!fn) throw new Error(`Unknown method ${m.method}`);
        post({ type: "rpc", id: m.id, result: fn(...m.args) });
      } catch (err) {
        post({ type: "rpc", id: m.id, error: String(err) });
      }
      break;
    }
  }
};
