import { Rng } from "../rng/rng";
import { AlleleFactory } from "../genetics/alleles";
import { crossFertility, geneticDistance } from "../genetics/distance";
import { determineSex, fertilize, makeGamete, withKaryotype } from "../genetics/meiosis";
import { DEFAULT_RATES, mutateGamete, scaleRates, type MutationRates } from "../genetics/mutation";
import type { Genome, Sex } from "../genetics/types";
import { computePhenotype } from "../anatomy/phenotype";
import { computeStats } from "../anatomy/stats";
import { buildPools, founderGenome, type SpeciesPools } from "../species/founders";
import { SPECIES, SPECIES_IDS } from "../species/roster";
import type { SpeciesId } from "../species/types";
import { HALF, METERS_PER_UNIT, Terrain } from "../world/terrain";
import { seasonWarmth, temperatureAt } from "./climate";
import { Recorder } from "./recorder";
import { SpatialHash } from "./spatial";
import { trackSpeciation } from "./speciation";
import {
  DEFAULT_CONFIG,
  type Agent,
  type AgentState,
  type CatastropheKind,
  type DeathCause,
  type EnvSettings,
  type Lineage,
  type WorldConfig,
  type WorldEvent,
} from "./types";
import { Vegetation } from "./vegetation";

const TAU = Math.PI * 2;
const KJ_PER_KG_MEAT = 6000;
const PLANT_ASSIMILATION = 0.5;
const MEAT_ASSIMILATION = 0.8;
const THINK_INTERVAL = 0.15;

export interface DeathRecord {
  id: number;
  cause: DeathCause;
  x: number;
  y: number;
  z: number;
  species: SpeciesId;
}

export interface SpawnRequest {
  species: SpeciesId;
  genome: Genome;
  sex?: Sex;
  count?: number;
  x?: number;
  z?: number;
  lineageName?: string;
}

/** Deterministic, headless ecosystem simulation. Runs in a Web Worker in the app. */
export class World {
  day = 0;
  readonly rng: Rng;
  readonly alleles: AlleleFactory;
  readonly terrain: Terrain;
  readonly veg: Vegetation;
  readonly hash = new SpatialHash(12);
  /** Index of potential predators only (for cheap threat checks). */
  readonly predHash = new SpatialHash(16);
  readonly pools: SpeciesPools;
  agents: Agent[] = [];
  byId = new Map<number, Agent>();
  lineages: Lineage[] = [];
  events: WorldEvent[] = [];
  env: EnvSettings;
  config: WorldConfig;
  rates: MutationRates;
  recorder: Recorder;
  nextId = 1;
  /** Births/deaths since the last drain (for the renderer). */
  newborns: Agent[] = [];
  deaths: DeathRecord[] = [];
  /** Cumulative counters. */
  totals = { births: 0, deaths: 0, mutations: 0, stillborn: 0, speciations: 0, extinctions: 0 };
  deathCauses: Record<DeathCause, number> = {
    predation: 0,
    starvation: 0,
    age: 0,
    disease: 0,
    cold: 0,
    heat: 0,
    hunted: 0,
    catastrophe: 0,
    culled: 0,
    uv: 0,
  };
  notices: { day: number; text: string; kind: "speciation" | "extinction" | "event" }[] = [];
  nextSpeciationCheck = 30;
  vegDt = 0;
  private firstSex: Sex = "F";

  constructor(config: Partial<WorldConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config, env: { ...DEFAULT_CONFIG.env, ...config.env } };
    this.env = structuredClone(this.config.env);
    this.rng = new Rng(this.config.seed);
    this.alleles = new AlleleFactory();
    this.terrain = new Terrain({ seed: this.config.seed, kind: this.config.terrain });
    this.veg = new Vegetation(this.terrain);
    this.veg.updateCapacity(this.env);
    this.veg.fill(0.7);
    this.rates = scaleRates(DEFAULT_RATES, this.env.mutationRate);
    this.pools = buildPools(this.rng.fork(), this.alleles);
    this.recorder = new Recorder();
    SPECIES_IDS.forEach((id) => this.lineages.push(rootLineage(this.lineages.length, id)));
    if (!this.config.skipPopulate) this.populate();
    this.recorder.sample(this, true);
  }

  // ------------------------------------------------------------------ setup

  private populate() {
    const rng = this.rng.fork();
    for (const id of SPECIES_IDS) {
      const n = this.initialCount(id);
      if (n <= 0) continue;
      const sp = SPECIES[id];
      // Social species start in a few groups; solitary ones scatter.
      const groups = Math.max(1, Math.round(n / (sp.base.sociality > 0.6 ? 10 : 2)));
      const centres = Array.from({ length: groups }, () => this.randomSpot(id, rng));
      for (let k = 0; k < n; k++) {
        const c = centres[k % groups];
        // Balanced founding sex ratio (random first sex), so tiny populations can still breed.
        const first = k === 0 ? (rng.chance(0.5) ? "F" : "M") : null;
        if (first) this.firstSex = first;
        const sex: Sex = k % 2 === 0 ? this.firstSex : this.firstSex === "F" ? "M" : "F";
        const g = founderGenome(id, this.pools, rng, sex);
        let x = c[0] + rng.normal(0, 4);
        let z = c[1] + rng.normal(0, 4);
        if (!this.habitatOk(id, x, z)) [x, z] = c;
        const ageDays = rng.range(sp.maturityY * 0.6, Math.min(sp.lifespanY * 0.6, sp.maturityY * 3)) * 365;
        this.addAgent({
          species: id,
          genome: g,
          sex,
          lineage: this.rootLineageOf(id),
          x,
          z,
          ageDays,
          generation: 0,
        });
      }
    }
  }

  /** Founding count: explicit scenario counts, or the roster default when none are given. */
  initialCount(id: SpeciesId) {
    const c = this.config.counts;
    return Object.keys(c).length ? (c[id] ?? 0) : SPECIES[id].initial;
  }

  private rootLineageOf(id: SpeciesId) {
    return this.lineages.findIndex((l) => l.species === id && l.parent === null);
  }

  private habitatOk(id: SpeciesId, x: number, z: number) {
    const h = this.terrain.heightAt(x, z);
    if (Math.abs(x) > HALF - 4 || Math.abs(z) > HALF - 4) return false;
    const sp = SPECIES[id];
    if (sp.parts.torso.kind === "fish") return h < -1;
    if (id === "frog" || id === "crocodile" || id === "duck") return h > -1.5 && this.nearWater(x, z, 10);
    return h > 0.4 && h < 18;
  }

  private nearWater(x: number, z: number, r: number) {
    for (let a = 0; a < TAU; a += TAU / 8) {
      if (this.terrain.heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r) < 0) return true;
    }
    return this.terrain.heightAt(x, z) < 0;
  }

  private randomSpot(id: SpeciesId, rng: Rng): [number, number] {
    for (let i = 0; i < 4000; i++) {
      const x = rng.range(-HALF + 6, HALF - 6);
      const z = rng.range(-HALF + 6, HALF - 6);
      if (this.habitatOk(id, x, z)) return [x, z];
    }
    return [0, 0];
  }

  addAgent(p: {
    species: SpeciesId;
    genome: Genome;
    sex: Sex;
    lineage: number;
    x: number;
    z: number;
    ageDays?: number;
    generation: number;
    motherId?: number;
    fatherId?: number;
  }): Agent {
    const ph = computePhenotype(p.genome, p.species, p.sex);
    const st = computeStats(ph);
    const storeDays = SPECIES[p.species].endotherm
      ? (4 + 30 * ph.fat) * Math.min(1.5, Math.max(0.4, (ph.massKg / 10) ** 0.15))
      : 60;
    const maxEnergy = st.fmrKJ * storeDays;
    const a: Agent = {
      id: this.nextId++,
      species: p.species,
      lineage: p.lineage,
      genome: p.genome,
      sex: p.sex,
      ph,
      st,
      generation: p.generation,
      motherId: p.motherId ?? 0,
      fatherId: p.fatherId ?? 0,
      birthDay: this.day - (p.ageDays ?? 0),
      offspring: 0,
      x: p.x,
      y: 0,
      z: p.z,
      vx: 0,
      vz: 0,
      heading: this.rng.next() * TAU,
      altitude: st.canFly ? this.rng.range(5, 14) : 0,
      flying: false,
      energy: maxEnergy * 0.75,
      maxEnergy,
      stamina: 1,
      state: "wander",
      targetId: 0,
      carcass: 0,
      chase: 0,
      thinkAt: this.day + this.rng.next() * THINK_INTERVAL,
      lastThink: this.day,
      wanderAngle: this.rng.next() * TAU,
      gestation: null,
      breedCooldownUntil: this.day + this.rng.range(0, 60),
      infected: 0,
      immuneUntil: 0,
      culture: p.species === "human" ? 0.35 + this.rng.range(-0.05, 0.05) : 0,
      anim: this.rng.next() * TAU,
    };
    this.placeY(a);
    this.agents.push(a);
    this.byId.set(a.id, a);
    this.newborns.push(a);
    return a;
  }

  // ------------------------------------------------------------------ public controls

  setEnv(env: EnvSettings) {
    const rateChanged = env.mutationRate !== this.env.mutationRate;
    this.env = structuredClone(env);
    if (rateChanged) this.rates = scaleRates(DEFAULT_RATES, env.mutationRate);
    this.veg.updateCapacity(this.env);
  }

  trigger(kind: CatastropheKind, x?: number, z?: number) {
    const d = this.day;
    if (kind === "drought") {
      this.events.push({ kind, start: d, end: d + 200 });
      for (let k = 0; k < this.veg.biomass.length; k++) if (!this.veg.water[k]) this.veg.biomass[k] *= 0.5;
      this.notice("Drought: rainfall collapses for ~7 months.", "event");
    } else if (kind === "iceAge") {
      this.events.push({ kind, start: d, end: d + 730 });
      this.notice("Ice age: temperatures drop ~13 °C for two years.", "event");
    } else if (kind === "plague") {
      this.events.push({ kind, start: d, end: d + 60 });
      for (const a of this.agents) if (this.rng.chance(0.15)) a.infected = 8;
      this.notice("Plague: a novel pathogen infects 15% of animals.", "event");
    } else if (kind === "meteor") {
      let mx = x;
      let mz = z;
      if (mx === undefined || mz === undefined) {
        const s = this.randomSpot("deer", this.rng);
        [mx, mz] = s;
      }
      this.events.push({ kind, start: d, end: d + 365, x: mx, z: mz });
      for (const a of this.agents) {
        const dist = Math.hypot(a.x - mx, a.z - mz);
        if (dist < 30 || (dist < 70 && this.rng.chance(0.5))) this.kill(a, "catastrophe");
      }
      const r = 30;
      for (let k = 0; k < this.veg.biomass.length; k++) {
        const [cx, cz] = Vegetation.cellCentre(k);
        if (Math.hypot(cx - mx, cz - mz) < r * 1.6) this.veg.biomass[k] = 0;
        else this.veg.biomass[k] *= 0.6;
      }
      this.notice("Meteor impact! Blast zone sterilised, impact winter for a year.", "event");
    }
  }

  private notice(text: string, kind: "speciation" | "extinction" | "event") {
    this.notices.push({ day: this.day, text, kind });
    if (this.notices.length > 60) this.notices.shift();
  }

  /** Release new individuals (from the editor, Cross Lab or Splice Lab). */
  spawn(req: SpawnRequest): number[] {
    const n = Math.max(1, Math.min(40, req.count ?? 1));
    let lineage = this.rootLineageOf(req.species);
    if (req.lineageName) {
      lineage = this.lineages.length;
      this.lineages.push({
        id: lineage,
        name: req.lineageName,
        species: req.species,
        parent: this.rootLineageOf(req.species),
        bornDay: this.day,
        extinctDay: null,
        color: SPECIES[req.species].color,
      });
    }
    let [cx, cz] =
      req.x !== undefined && req.z !== undefined ? [req.x, req.z] : this.randomSpot(req.species, this.rng);
    if (!this.habitatOk(req.species, cx, cz)) [cx, cz] = this.randomSpot(req.species, this.rng);
    const ids: number[] = [];
    for (let i = 0; i < n; i++) {
      const sex: Sex = req.sex ?? (i % 2 === 0 ? "F" : "M");
      const sp = SPECIES[req.species];
      // Give each individual the karyotype that matches its sex (XY/ZW).
      const genome = withKaryotype([...req.genome.a], [...req.genome.b], sex, sp.sexSystem);
      const a = this.addAgent({
        species: req.species,
        genome,
        sex,
        lineage,
        x: cx + this.rng.normal(0, 2),
        z: cz + this.rng.normal(0, 2),
        ageDays: sp.maturityY * 365 * 1.1,
        generation: 0,
      });
      ids.push(a.id);
    }
    return ids;
  }

  // ------------------------------------------------------------------ main loop

  /** Advance the simulation by dt days (dt ≤ ~0.25 for stable chases). */
  tick(dt: number) {
    this.day += dt;
    this.hash.rebuild(this.agents);
    this.predHash.rebuild(this.agents.filter((a) => a.st.meatEff >= 0.5 && a.ph.aggression >= 0.2));
    this.vegDt += dt;
    if (this.vegDt >= 0.25) {
      this.veg.grow(this.env, this.events, this.day, this.vegDt);
      this.vegDt = 0;
    }
    const tSea = temperatureAt(this.env, this.events, this.day, 0);

    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      if (a.dead) continue;
      if (this.day >= a.thinkAt) {
        const elapsed = this.day - a.lastThink;
        a.lastThink = this.day;
        this.think(a);
        a.thinkAt = this.day + THINK_INTERVAL * (0.8 + 0.4 * this.rng.next());
        this.hazards(a, Math.min(elapsed, 1), tSea);
        if (a.dead) continue;
      }
      this.act(a, dt);
      this.metabolise(a, dt, tSea);
      if (!a.dead) {
        this.move(a, dt);
        if (a.state === "hunt") this.tryStrike(a);
      }
    }

    if (this.agents.some((a) => a.dead)) {
      this.agents = this.agents.filter((a) => !a.dead);
    }
    this.events = this.events.filter((e) => e.end > this.day - 1);
    if (this.carcasses.length)
      this.carcasses = this.carcasses.filter((c) => c.until > this.day && c.energy > 200);

    if (this.day >= this.nextSpeciationCheck) {
      this.nextSpeciationCheck = this.day + 30;
      trackSpeciation(this);
    }
    this.recorder.sample(this);
  }

  // ------------------------------------------------------------------ perception & decisions

  private senseUnits(a: Agent) {
    return Math.min(32, a.st.senseM / METERS_PER_UNIT);
  }

  private inWater(a: Agent) {
    return this.terrain.heightAt(a.x, a.z) < 0;
  }

  isMature(a: Agent) {
    return this.day - a.birthDay >= SPECIES[a.species].maturityY * 365;
  }

  /** Can predator p attack prey q (diet, size and habitat reach)? */
  canEat(p: Agent, q: Agent, allies = 0): boolean {
    if (q.dead || q.lineage === p.lineage || q.species === p.species) return false;
    // Fire, spears and group defence: predators learn to avoid tool-using humans.
    if (q.species === "human" && q.culture > 0.25) return false;
    if (p.st.meatEff < 0.5 || p.ph.aggression < 0.2) return false;
    const sp = SPECIES[p.species];
    const toolBoost = p.species === "human" ? 1 + 2 * p.culture : 1;
    // Chimeras of herbivores that gained predator teeth get a modest default.
    const baseRatio = sp.maxPreyRatio > 0 ? sp.maxPreyRatio : p.st.meatEff >= 0.8 ? 0.3 : 0;
    const maxRatio = baseRatio * (1 + 0.35 * Math.min(allies, 4)) * toolBoost;
    const ratio = q.ph.massKg / p.ph.massKg;
    // Optimal foraging: prey too small to repay the chase are ignored (lions don't chase rabbits).
    if (ratio > maxRatio || ratio < 0.0004 * p.ph.massKg ** 0.8) return false;
    // Intraguild predation is rare: dangerous meat-eaters are only taken when much smaller.
    if (q.st.meatEff >= 0.5 && q.ph.aggression > 0.35 && ratio > 0.35) return false;
    const qh = this.terrain.heightAt(q.x, q.z);
    if (p.st.aquatic) return qh < -0.3 && !q.flying;
    if (p.st.canFly) return !q.st.aquatic || qh > -2.5;
    if (q.flying) return false;
    if (q.st.aquatic) return p.st.swimKmh >= 3 && qh < 0;
    if (qh < -0.4) return p.st.swimKmh >= 3;
    return true;
  }

  private think(a: Agent) {
    const sense = this.senseUnits(a);
    const hunger = 1 - a.energy / a.maxEnergy;
    const sp = SPECIES[a.species];

    // --- Threat detection ---
    let fx = 0;
    let fz = 0;
    let threatened = false;
    const fleeR = sense * (1.15 - 0.6 * a.ph.boldness);
    // --- Social & mating info gathered in the same pass ---
    let gx = 0;
    let gz = 0;
    let ghx = 0;
    let ghz = 0;
    let gn = 0;
    let maxCulture = a.culture;
    let allies = 0;
    let bestPrey: Agent | null = null;
    let bestPreyScore = 0;
    let bestMate: Agent | null = null;
    let bestMateScore = 0;
    const wantsMate =
      this.isMature(a) &&
      !a.gestation &&
      this.day >= a.breedCooldownUntil &&
      a.energy > 0.5 * a.maxEnergy &&
      this.rng.chance(this.breedingPropensity(a));
    const wantsHunt =
      hunger > 0.5 &&
      a.st.meatEff >= 0.5 &&
      a.ph.aggression >= 0.2 &&
      (sp.maxPreyRatio > 0 || a.st.meatEff >= 0.8);

    // 1) Threats: only predators are indexed in predHash, so this is cheap.
    this.predHash.query(a.x, a.z, fleeR, (b, d2) => {
      if (b === a || b.dead) return;
      const d = Math.sqrt(d2) + 1e-3;
      // Stalking predators are only noticed at close range; sprinting ones from afar.
      const sprinting = b.state === "hunt" && b.chase > 0;
      const noticed = sprinting ? fleeR : fleeR * 0.3;
      // Vigilance: stalkers are spotted only some of the time.
      if (d < noticed && (sprinting || this.rng.chance(0.2 + 0.3 * a.ph.hearing)) && this.canEat(b, a, 1)) {
        fx -= (b.x - a.x) / d;
        fz -= (b.z - a.z) / d;
        threatened = true;
      }
    });

    // 2) Group, culture and mates within a social radius.
    this.hash.query(a.x, a.z, Math.min(sense, 16), (b, d2) => {
      if (b === a || b.dead) return;
      const d = Math.sqrt(d2) + 1e-3;
      if (b.lineage === a.lineage) {
        gx += b.x;
        gz += b.z;
        ghx += b.vx;
        ghz += b.vz;
        gn++;
        if (d < 10) allies++;
        if (a.species === "human" && b.culture > maxCulture && d < 20) maxCulture = b.culture;
      }
    });

    // Mate search (females choose) over the full sensory range.
    if (wantsMate && a.sex === "F") {
      this.hash.query(a.x, a.z, sense, (b, d2) => {
        if (b === a || b.dead || b.sex === a.sex || b.species !== a.species || !this.isMature(b)) return;
        const d = Math.sqrt(d2) + 1e-3;
        const fert = b.lineage === a.lineage ? 1 : crossFertility(geneticDistance(a.genome, b.genome));
        if (fert <= 0) return;
        // Female choice: ornament weighted by choosiness (Fisherian sexual selection).
        const orn = (b.ph.ornament + 0.05) ** (3 * a.ph.choosiness);
        const score = (orn * fert) / (1 + d * 0.05);
        if (score > bestMateScore) {
          bestMateScore = score;
          bestMate = b;
        }
      });
    }

    // 3) Prey search over the full sensory range, only when hungry.
    if (wantsHunt) {
      this.hash.query(a.x, a.z, sense, (b, d2) => {
        if (b === a || b.dead || !this.canEat(a, b, allies)) return;
        const d = Math.sqrt(d2) + 1e-3;
        const vuln = 1 + (b.infected ? 0.5 : 0) + (this.isMature(b) ? 0 : 0.6);
        const score = (b.ph.massKg ** 0.5 * vuln * this.preyRefuge(b.species)) / d;
        if (score > bestPreyScore) {
          bestPreyScore = score;
          bestPrey = b;
        }
      });
    }

    // Disease transmission happens on contact during thinking.
    if (a.infected > 0 && this.env.disease) this.spreadDisease(a);

    // Cumulative culture: social learning from the most skilled neighbour, slow innovation, and
    // loss in isolation (the "Tasmanian effect").
    if (a.species === "human") {
      const learn = 0.15 * Math.min(1.5, a.ph.brain);
      a.culture += (maxCulture - a.culture) * learn * THINK_INTERVAL;
      a.culture += this.rng.normal(0.0004, 0.002) * a.ph.brain;
      if (gn < 3) a.culture -= 0.004 * THINK_INTERVAL * 10;
      a.culture = Math.max(0, Math.min(1, a.culture));
    }

    if (threatened) {
      a.state = "flee";
      a.wanderAngle = Math.atan2(fz, fx);
      if (a.st.canFly) a.flying = true;
      return;
    }

    // Long-range prey search (scent trails, scavenger birds) for hungry big predators.
    if (wantsHunt && !bestPrey && SPECIES[a.species].maxPreyRatio >= 1 && hunger > 0.6 && !threatened) {
      let bd = Infinity;
      let tx = 0;
      let tz = 0;
      this.hash.query(a.x, a.z, Math.min(90, sense * 2.5), (b, d2) => {
        if (d2 < bd && this.canEat(a, b, allies)) {
          bd = d2;
          tx = b.x;
          tz = b.z;
        }
      });
      if (bd < Infinity) {
        a.state = "wander";
        a.wanderAngle = Math.atan2(tz - a.z, tx - a.x);
        return;
      }
    }

    if (bestPrey && (a.state !== "hunt" || !this.byId.get(a.targetId))) {
      a.state = "hunt";
      a.targetId = (bestPrey as Agent).id;
      a.chase = 0;
      if (a.st.canFly) a.flying = true;
      return;
    }
    if (a.state === "hunt" && this.byId.get(a.targetId) && hunger > 0.1) return;

    if (bestMate && a.sex === "F" && a.energy > 0.5 * a.maxEnergy) {
      a.state = "mate";
      a.targetId = (bestMate as Agent).id;
      a.chase = 0;
      return;
    }
    // Courtship persists until it succeeds or the partner is lost.
    if (a.state === "mate" && this.byId.get(a.targetId) && a.energy > 0.35 * a.maxEnergy && !a.gestation)
      return;

    // Scavenging: meat-eaters home in on carrion.
    if (a.st.meatEff >= 0.5 && hunger > 0.15 && !a.st.aquatic) {
      const c = this.nearestCarcass(a.x, a.z, sense * 1.5);
      if (c) {
        a.state = "forage";
        a.carcass = c.id;
        a.wanderAngle = Math.atan2(c.z - a.z, c.x - a.x);
        return;
      }
    }
    a.carcass = 0;

    if (hunger > 0.12) {
      const here = this.foodRichness(a, a.x, a.z);
      if (here > 0.15) {
        a.state = "eat";
      } else {
        a.state = "forage";
        // Search rings of increasing radius; nearer food is preferred (travel costs energy).
        let best = -1;
        const flyer = a.st.canFly;
        for (const r of [10, 22, 40]) {
          for (let k = 0; k < 8; k++) {
            const ang = (k / 8) * TAU + this.rng.next() * 0.6;
            const x = a.x + Math.cos(ang) * r;
            const z = a.z + Math.sin(ang) * r;
            if (!this.canBeAt(flyer ? { ...a, flying: false } : a, x, z)) continue;
            const v = this.foodRichness(a, x, z) / (1 + r / 40);
            if (v > best) {
              best = v;
              a.wanderAngle = ang;
            }
          }
        }
        if (flyer && best >= 0) a.flying = true;
      }
    } else {
      a.state = hunger < 0.1 && this.rng.chance(0.4) ? "rest" : "wander";
      a.wanderAngle += this.rng.normal(0, 0.6);
    }

    // Social cohesion & alignment (herds, packs, bands, schools, flocks).
    if (gn > 0 && a.ph.sociality > 0.3) {
      const cx = gx / gn - a.x;
      const cz = gz / gn - a.z;
      const dist = Math.hypot(cx, cz);
      const pull = a.ph.sociality * Math.min(1, dist / 12) * (hunger > 0.3 ? 0.35 : 1);
      const ang = Math.atan2(cz, cx);
      const vx = Math.cos(a.wanderAngle) * (1 - pull) + Math.cos(ang) * pull + ghx * 0.002 * a.ph.sociality;
      const vz = Math.sin(a.wanderAngle) * (1 - pull) + Math.sin(ang) * pull + ghz * 0.002 * a.ph.sociality;
      a.wanderAngle = Math.atan2(vz, vx);
    }

    // Water-bound species (moist skin, crocodiles, ducks) drift back to the shore.
    if (
      (a.st.needsWater || a.species === "crocodile" || a.species === "duck") &&
      !this.nearWater(a.x, a.z, 8)
    ) {
      const dir = this.directionToWater(a.x, a.z);
      if (dir !== null) a.wanderAngle = dir;
    }

    // Flyers land to forage and rest, take off to travel.
    if (a.st.canFly) a.flying = a.state === "wander" || a.state === "forage" ? this.rng.chance(0.7) : false;
    if (a.st.canFly && !this.canBeAt({ ...a, flying: false }, a.x, a.z)) a.flying = true;
  }

  private directionToWater(x: number, z: number): number | null {
    for (let r = 8; r <= 48; r += 8) {
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * TAU;
        if (this.terrain.heightAt(x + Math.cos(ang) * r, z + Math.sin(ang) * r) < 0) return ang;
      }
    }
    return null;
  }

  /** Distance from which a stalking predator breaks into a sprint. */
  pounceRange(a: Agent) {
    return 6 + a.st.lengthM * 2 + (a.flying ? 10 : 0);
  }

  carcasses: { id: number; x: number; z: number; energy: number; until: number }[] = [];
  nextCarcassId = 1;

  private nearestCarcass(x: number, z: number, r: number) {
    let best: (typeof this.carcasses)[number] | null = null;
    let bd = r * r;
    for (const c of this.carcasses) {
      const d2 = (c.x - x) ** 2 + (c.z - z) ** 2;
      if (d2 < bd) {
        bd = d2;
        best = c;
      }
    }
    return best;
  }

  private leaveCarcass(x: number, z: number, energy: number) {
    if (energy < 500 || this.terrain.heightAt(x, z) < -0.5) return;
    this.carcasses.push({ id: this.nextCarcassId++, x, z, energy, until: this.day + 12 });
    if (this.carcasses.length > 80) this.carcasses.shift();
  }

  private breedingPropensity(a: Agent) {
    const s = SPECIES[a.species].seasonality;
    // Breeding window centred on spring (day ~100).
    const doy = ((this.day % 365) + 365) % 365;
    const window = Math.exp(-(((doy - 110) / 45) ** 2));
    return (1 - s) * 0.35 + s * window;
  }

  eatsPlants(a: Agent) {
    const d = SPECIES[a.species].diet;
    return d !== "carnivore" && d !== "insectivore" ? true : a.st.plantEff > 0.6;
  }

  eatsFauna(a: Agent) {
    return a.st.meatEff >= 0.5 || SPECIES[a.species].diet === "insectivore";
  }

  /** Foraging efficiency on background fauna: big predators can't live on insects and mice. */
  faunaEfficiency(a: Agent) {
    return Math.min(1, Math.max(0.05, (10 / a.ph.massKg) ** 0.6)) * Math.max(0.3, a.st.meatEff);
  }

  private foodRichness(a: Agent, x: number, z: number) {
    const k = Vegetation.index(x, z);
    const water = this.veg.water[k] === 1;
    const sp = SPECIES[a.species];
    const fauna = this.eatsFauna(a) ? this.veg.faunaRichness(x, z) * this.faunaEfficiency(a) : 0;
    if (a.st.aquatic)
      return water ? Math.max(sp.diet === "planktivore" ? this.veg.richness(x, z) : 0, fauna) : 0;
    if (water && a.species !== "duck" && a.st.swimKmh < 3) return 0;
    const plants = this.eatsPlants(a) && (!water || a.species === "duck") ? this.veg.richness(x, z) : 0;
    return Math.max(plants, fauna);
  }

  private spreadDisease(a: Agent) {
    const clade = SPECIES[a.species].clade;
    this.hash.query(a.x, a.z, 4, (b) => {
      if (b === a || b.infected > 0 || b.dead || this.day < b.immuneUntil) return;
      const cross = SPECIES[b.species].clade === clade ? (b.species === a.species ? 1 : 0.25) : 0.03;
      if (this.rng.chance(0.35 * THINK_INTERVAL * cross * (1 - b.ph.immunity))) b.infected = 8;
    });
  }

  // ------------------------------------------------------------------ actions

  private act(a: Agent, dt: number) {
    if (a.state === "hunt") {
      const prey = this.byId.get(a.targetId);
      if (!prey || prey.dead) {
        a.state = "wander";
        return;
      }
      const dPrey = Math.hypot(prey.x - a.x, prey.z - a.z);
      if (a.chase > 0 || dPrey < this.pounceRange(a)) a.chase += dt;
      if (dPrey > this.senseUnits(a) * 1.6) {
        a.state = "wander";
        a.chase = 0;
        return;
      }
      const giveUp = a.species === "human" ? 0.6 + 0.6 * a.ph.sweat : 0.25;
      if (a.chase > giveUp || (a.stamina <= 0 && a.species !== "human")) {
        a.state = "rest";
        a.chase = 0;
        return;
      }
      return;
    }
    if (a.carcass) {
      const c = this.carcasses.find((k) => k.id === a.carcass);
      if (!c) a.carcass = 0;
      else if (Math.hypot(c.x - a.x, c.z - a.z) < 2) {
        const take = Math.min(c.energy, a.maxEnergy - a.energy, a.st.fmrKJ * 20 * dt);
        a.energy += take * a.st.meatEff;
        c.energy -= take;
        a.state = "eat";
        a.wanderAngle = Math.atan2(c.z - a.z, c.x - a.x);
        if (a.energy >= a.maxEnergy * 0.95) a.carcass = 0;
      } else a.wanderAngle = Math.atan2(c.z - a.z, c.x - a.x);
    }
    if (a.state === "mate" && a.sex === "F") {
      const m = this.byId.get(a.targetId);
      if (!m || m.dead) {
        a.state = "wander";
        return;
      }
      if (Math.hypot(m.x - a.x, m.z - a.z) < 2.5) {
        const fert = m.lineage === a.lineage ? 1 : crossFertility(geneticDistance(a.genome, m.genome));
        if (fert > 0 && this.rng.chance(fert)) {
          const g = SPECIES[a.species].gestationD;
          a.gestation = {
            until: this.day + g * this.rng.range(0.9, 1.1),
            father: m.genome,
            fatherId: m.id,
            fatherLineage: m.lineage,
          };
        }
        a.breedCooldownUntil = this.day + 5;
        m.breedCooldownUntil = this.day + 0.5;
        a.state = "wander";
      }
    }
    if (a.gestation && this.day >= a.gestation.until) this.giveBirth(a);
  }

  /**
   * Holling type III functional response: when a prey species becomes rare, survivors are the
   * wary ones in refuges and predators switch to other food, so capture success falls.
   */
  preyRefuge(id: SpeciesId) {
    const rel = this.speciesCount(id) / (0.5 * this.speciesCap(id));
    return Math.min(1, rel) ** 1.5;
  }

  private tryStrike(a: Agent) {
    const prey = this.byId.get(a.targetId);
    if (!prey || prey.dead) return;
    const reach = (a.st.lengthM + prey.st.lengthM) / METERS_PER_UNIT + 0.8;
    if (Math.hypot(prey.x - a.x, prey.z - a.z) < reach) this.attack(a, prey);
  }

  private attack(p: Agent, q: Agent) {
    let allies = 0;
    this.hash.query(p.x, p.z, 8, (b) => {
      if (b !== p && b.lineage === p.lineage && b.state === "hunt") allies++;
    });
    const attack =
      Math.log10(p.st.biteN + 1) +
      0.5 * Math.min(allies, 4) +
      (p.species === "human" ? 1.8 * p.culture : 0) +
      (p.ph.massKg > q.ph.massKg ? 0.5 : 0) +
      (q.stamina <= 0 ? 0.8 : 0) +
      (this.isMature(q) ? 0 : 0.7);
    // Confusion effect: predators struggle to single out one member of a school/flock/herd.
    let group = 0;
    this.hash.query(q.x, q.z, 4, (b) => {
      if (b !== q && b.lineage === q.lineage) group++;
    });
    const defense =
      0.6 * Math.log10(q.ph.massKg * 100 + 1) +
      q.ph.aggression +
      (q.st.biteN > 2000 ? 0.5 : 0) +
      (q.flying ? 1 : 0) +
      0.12 * Math.min(group, 10) * q.ph.sociality +
      (q.species === "human" ? 2 * q.culture : 0);
    const p01 =
      Math.min(0.9, Math.max(0.03, 1 / (1 + Math.exp(-(attack - defense))))) * this.preyRefuge(q.species);
    if (this.rng.chance(p01)) {
      const food =
        q.ph.massKg * KJ_PER_KG_MEAT * MEAT_ASSIMILATION * p.st.meatEff + Math.max(0, q.energy) * 0.3;
      this.kill(q, "predation");
      let left = food;
      const take = Math.min(left, p.maxEnergy - p.energy);
      p.energy += take;
      left -= take;
      if (left > 0) {
        this.hash.query(p.x, p.z, 8, (b) => {
          if (left <= 0 || b === p || b.lineage !== p.lineage || b.dead) return;
          const t = Math.min(left, b.maxEnergy - b.energy);
          b.energy += t;
          left -= t;
        });
      }
      this.leaveCarcass(q.x, q.z, left * 0.8);
      p.state = "rest";
      p.chase = 0;
    } else {
      p.state = "rest";
      p.chase = 0;
      p.thinkAt = this.day + 0.2;
      if (q.ph.aggression > 0.6 && this.rng.chance(0.3)) p.energy -= 0.15 * p.maxEnergy;
    }
  }

  private giveBirth(m: Agent) {
    const gest = m.gestation!;
    m.gestation = null;
    const sp = SPECIES[m.species];
    m.breedCooldownUntil = this.day + Math.max(20, sp.gestationD * 0.4);
    const condition = Math.max(0.1, m.energy / m.maxEnergy);
    const expected = sp.litter * m.ph.fertility * m.st.fertilityMult * Math.sqrt(condition);
    let n = Math.floor(expected) + (this.rng.chance(expected % 1) ? 1 : 0);
    n = Math.min(n, Math.max(0, this.config.maxAgents - this.agents.length));
    // Each species is guaranteed its share of the agent budget and may borrow free space only
    // while the world is not crowded. Local crowding also lowers fecundity.
    const count = this.speciesCount(m.species);
    const cap = this.speciesCap(m.species);
    if (count >= cap * 1.6 || (count >= cap && this.agents.length >= this.config.maxAgents * 0.85)) n = 0;
    let crowd = 0;
    this.hash.query(m.x, m.z, 10, (b) => {
      if (b.species === m.species) crowd++;
    });
    if (crowd > 12 && this.rng.chance(1 - 12 / crowd)) n = Math.max(0, n - 1);
    if (n <= 0) return;
    m.energy -= 0.3 * m.maxEnergy * Math.sqrt(n / sp.litter);
    const hybridFert =
      gest.fatherLineage === m.lineage ? 1 : crossFertility(geneticDistance(m.genome, gest.father));
    const nestT = temperatureAt(this.env, this.events, this.day, this.terrain.heightAt(m.x, m.z)) + 6;
    for (let k = 0; k < n; k++) {
      const egg = makeGamete(m.genome, this.rng);
      const sperm = makeGamete(gest.father, this.rng);
      this.totals.mutations += mutateGamete(egg, this.rates, this.rng, this.alleles);
      this.totals.mutations += mutateGamete(sperm, this.rates, this.rng, this.alleles);
      const g = fertilize(egg, sperm);
      const sex = determineSex(g, sp.sexSystem, this.rng, nestT);
      const kid = this.addAgent({
        species: m.species,
        genome: g,
        sex,
        lineage: m.lineage,
        x: m.x + this.rng.normal(0, 0.8),
        z: m.z + this.rng.normal(0, 0.8),
        ageDays: 0,
        generation: m.generation + 1,
        motherId: m.id,
        fatherId: gest.fatherId,
      });
      // Viability selection: recessive load and hybrid incompatibilities.
      if (!this.rng.chance(kid.ph.viability * hybridFert)) {
        this.removeQuietly(kid);
        this.totals.stillborn++;
        continue;
      }
      kid.energy = kid.maxEnergy * 0.6;
      kid.culture = m.culture * 0.85;
      kid.wanderAngle = m.wanderAngle;
      m.offspring++;
      const father = this.byId.get(gest.fatherId);
      if (father) father.offspring++;
      this.totals.births++;
    }
  }

  private counts = new Map<SpeciesId, number>();
  private countsDay = -1;
  speciesCount(id: SpeciesId) {
    if (this.countsDay !== this.day) {
      this.counts.clear();
      for (const a of this.agents)
        if (!a.dead) this.counts.set(a.species, (this.counts.get(a.species) ?? 0) + 1);
      this.countsDay = this.day;
    }
    return this.counts.get(id) ?? 0;
  }

  /**
   * Agent budget per species: proportional to its founding share, with headroom. This keeps
   * small-bodied species from monopolising the budget (each agent stands for one animal).
   */
  speciesCap(id: SpeciesId) {
    const total = SPECIES_IDS.reduce((s, k) => s + this.initialCount(k), 0) || 1;
    const share = this.initialCount(id) || 4;
    return Math.max(8, Math.round((share / total) * this.config.maxAgents));
  }

  private removeQuietly(a: Agent) {
    a.dead = "culled";
    this.byId.delete(a.id);
    const i = this.newborns.indexOf(a);
    if (i >= 0) this.newborns.splice(i, 1);
    this.agents.pop();
  }

  kill(a: Agent, cause: DeathCause) {
    if (a.dead) return;
    a.dead = cause;
    this.byId.delete(a.id);
    this.totals.deaths++;
    this.deathCauses[cause]++;
    this.deaths.push({ id: a.id, cause, x: a.x, y: a.y, z: a.z, species: a.species });
    if (cause !== "predation" && cause !== "catastrophe" && cause !== "culled")
      this.leaveCarcass(a.x, a.z, a.ph.massKg * KJ_PER_KG_MEAT * 0.5);
  }

  // ------------------------------------------------------------------ physiology

  private metabolise(a: Agent, dt: number, tSea: number) {
    const sp = SPECIES[a.species];
    const h = this.terrain.heightAt(a.x, a.z);
    const T =
      a.st.aquatic || h < 0
        ? Math.max(tSea, 2)
        : tSea - 0.28 * Math.max(0, h) + (a.species === "human" ? 10 * a.culture : 0);

    // Activity level
    const sprinting = a.state === "flee" || (a.state === "hunt" && a.chase > 0);
    // Humans persistence-hunt at an economical jog rather than an all-out sprint.
    const activity = sprinting
      ? a.species === "human"
        ? 1.5
        : 2.4
      : a.state === "rest"
        ? 0.6
        : a.state === "eat"
          ? 0.9
          : 1;

    // Thermoregulation: endotherms pay to stay warm/cool; ectotherms slow down in the cold.
    let thermal = 1;
    if (sp.endotherm) {
      if (T < a.st.coldLimitC) thermal += 0.05 * (a.st.coldLimitC - T);
      if (T > a.st.heatLimitC) thermal += 0.06 * (T - a.st.heatLimitC);
    } else {
      thermal = Math.max(0.3, Math.min(1.2, (T - (a.ph.thermalOpt - 15)) / 15));
    }
    let cost = a.st.fmrKJ * activity * thermal * dt;
    if (a.infected > 0) cost *= 1.3;
    if (a.gestation) cost *= 1.25;
    a.energy -= cost;

    // Stamina: sweating lets endurance runners keep going in the heat (persistence hunting).
    if (sprinting) {
      const heat = T > 25 ? 1 + (T - 25) * 0.08 : 1;
      a.stamina -= dt * 7 * heat * (1 - 0.75 * Math.min(1, a.ph.sweat));
    } else a.stamina = Math.min(1, a.stamina + dt * 4);
    if (a.stamina < 0) a.stamina = 0;

    // Feeding on plants/plankton
    if ((a.state === "eat" || a.state === "forage") && !a.carcass) {
      if (this.eatsFauna(a)) {
        const need = a.maxEnergy - a.energy;
        const want = a.st.fmrKJ * 3 * dt * this.faunaEfficiency(a);
        const got = this.veg.preyOn(a.x, a.z, Math.min(want, need / MEAT_ASSIMILATION));
        a.energy = Math.min(a.maxEnergy, a.energy + got * MEAT_ASSIMILATION);
      }
      const rich = this.eatsPlants(a) ? this.foodRichness(a, a.x, a.z) : 0;
      if (rich > 0.02) {
        const need = a.maxEnergy - a.energy;
        let rate = a.st.fmrKJ * 6 * dt * (0.5 + 0.5 * a.ph.dietBreadth);
        if (sp.diet === "insectivore") rate *= 0.8;
        const eff = PLANT_ASSIMILATION * Math.max(0.1, a.st.plantEff);
        const eaten = this.veg.grazePatch(a.x, a.z, Math.min(rate, need / eff), a.st.lengthM > 2 ? 2 : 1);
        let gain = eaten * eff;
        if (a.species === "human") {
          gain *= 1 + 0.4 * a.culture;
          const im = this.env.impact;
          if (im.enabled) {
            gain *= 1 + im.farming;
            if (im.herding && a.ph.lactase) gain *= 1.25;
          }
        }
        a.energy = Math.min(a.maxEnergy, a.energy + gain);
      }
    }

    // Needs water nearby (amphibian skin)
    if (a.st.needsWater && h > 1.5 && !this.nearWater(a.x, a.z, 6)) a.energy -= a.st.fmrKJ * 0.8 * dt;

    if (a.energy <= 0) return this.kill(a, "starvation");
  }

  /** Stochastic mortality and disease course, evaluated at think time over `dt` days. */
  private hazards(a: Agent, dt: number, tSea: number) {
    const sp = SPECIES[a.species];
    const h = this.terrain.heightAt(a.x, a.z);
    const T =
      a.st.aquatic || h < 0
        ? Math.max(tSea, 2)
        : tSea - 0.28 * Math.max(0, h) + (a.species === "human" ? 10 * a.culture : 0);

    // Disease course
    if (a.infected > 0) {
      a.infected -= dt;
      if (this.rng.chance(0.012 * (1 - a.ph.immunity) * dt * 1.5)) return this.kill(a, "disease");
      if (a.infected <= 0) {
        a.infected = 0;
        a.immuneUntil = this.day + 150;
      }
    } else if (this.env.disease && this.rng.chance(0.00003 * dt)) {
      a.infected = 8;
    }

    // Mortality hazards (per day)
    const ageY = (this.day - a.birthDay) / 365;
    let hazard = 0.0004 * Math.exp(6 * (ageY / a.ph.lifespanY - 1));
    if (ageY < sp.maturityY * 0.3) hazard += 0.0015;
    if (this.rng.chance(hazard * dt)) return this.kill(a, "age");
    if (sp.endotherm) {
      if (T < a.st.coldLimitC - 8 && this.rng.chance(0.02 * dt * (a.st.coldLimitC - 8 - T)))
        return this.kill(a, "cold");
      if (T > a.st.heatLimitC + 5 && this.rng.chance(0.02 * dt * (T - a.st.heatLimitC - 5)))
        return this.kill(a, "heat");
    } else if (T < a.st.coldLimitC - 12 && this.rng.chance(0.03 * dt)) return this.kill(a, "cold");

    const im = this.env.impact;
    if (im.enabled && a.species !== "human" && a.ph.massKg > 4) {
      const protectedHere = Math.hypot(a.x, a.z) < im.protectedArea * HALF;
      if (!protectedHere && this.rng.chance(im.hunting * 0.002 * (a.ph.massKg > 40 ? 1.5 : 1) * dt))
        return this.kill(a, "hunted");
    }
    if (a.species === "human") {
      // Pigmentation: dark skin protects from UV (folate); light skin makes vitamin D at low UV.
      const ideal = 0.25 - 0.6 * this.env.uv;
      if (this.rng.chance(0.00005 * ((a.ph.lightness - ideal) / 0.2) ** 2 * dt)) return this.kill(a, "uv");
    }
  }

  // ------------------------------------------------------------------ movement

  maxSpeed(a: Agent) {
    const sprint = a.state === "flee" || (a.state === "hunt" && a.chase > 0);
    const grow = this.growth(a);
    let v: number;
    if (a.flying && a.st.canFly) v = 120 + 120 * a.st.flightScore;
    else if (a.st.aquatic || this.inWater(a)) v = 9 * Math.max(a.st.swimKmh, 1);
    else v = 3 * a.st.speedKmh;
    if (sprint && a.state === "hunt") v *= 1.15;
    if (!sprint || a.stamina <= 0)
      v *= a.state === "eat" ? 0.08 : a.state === "rest" ? 0.05 : a.state === "hunt" ? 0.45 : 0.28;
    if (!SPECIES[a.species].endotherm) {
      const T = temperatureAt(this.env, this.events, this.day, Math.max(0, a.y));
      v *= Math.max(0.25, Math.min(1, (T - (a.ph.thermalOpt - 18)) / 14));
    }
    return v * (0.55 + 0.45 * grow);
  }

  growth(a: Agent) {
    return Math.min(1, (this.day - a.birthDay) / (SPECIES[a.species].maturityY * 365));
  }

  canBeAt(a: Pick<Agent, "st" | "flying" | "species">, x: number, z: number) {
    if (Math.abs(x) > HALF - 2 || Math.abs(z) > HALF - 2) return false;
    if (a.flying && a.st.canFly) return true;
    const h = this.terrain.heightAt(x, z);
    if (a.st.aquatic) return h < -0.5;
    if (h < -0.4) return a.st.swimKmh >= 3 || a.st.canFly;
    if (!a.st.canWalk) return h < 0.5;
    return h < 22;
  }

  private move(a: Agent, dt: number) {
    let ang = a.wanderAngle;
    let target: Agent | undefined;
    if (a.state === "hunt" || a.state === "mate") {
      target = this.byId.get(a.targetId);
      if (target) ang = Math.atan2(target.z - a.z, target.x - a.x);
    } else if (a.state === "wander" || a.state === "forage") {
      a.wanderAngle += this.rng.normal(0, 1.2) * dt;
      ang = a.wanderAngle;
    }
    const speed = this.maxSpeed(a);
    const tx = Math.cos(ang) * speed;
    const tz = Math.sin(ang) * speed;
    const k = Math.min(1, dt * 12);
    a.vx += (tx - a.vx) * k;
    a.vz += (tz - a.vz) * k;
    let nx = a.x + a.vx * dt;
    let nz = a.z + a.vz * dt;
    // Swept approach: don't overshoot a pursued target within one (possibly large) step.
    if (target) {
      const dx = target.x - a.x;
      const dz = target.z - a.z;
      const d = Math.hypot(dx, dz);
      const step = Math.hypot(a.vx, a.vz) * dt;
      if (d > 1e-6 && step >= d - 0.5) {
        nx = target.x - (dx / d) * 0.5;
        nz = target.z - (dz / d) * 0.5;
      }
    }
    if (this.canBeAt(a, nx, nz)) {
      a.x = nx;
      a.z = nz;
    } else if (this.canBeAt(a, nx, a.z)) {
      a.x = nx;
      a.vz *= -0.3;
      a.wanderAngle = Math.atan2(-a.vz, a.vx);
    } else if (this.canBeAt(a, a.x, nz)) {
      a.z = nz;
      a.vx *= -0.3;
      a.wanderAngle = Math.atan2(a.vz, -a.vx);
    } else {
      a.vx *= -0.5;
      a.vz *= -0.5;
      a.wanderAngle += Math.PI * (0.6 + 0.8 * this.rng.next());
      if (!this.canBeAt(a, a.x, a.z)) this.rescue(a);
    }
    const sp2 = a.vx * a.vx + a.vz * a.vz;
    if (sp2 > 0.01) a.heading = Math.atan2(a.vx, a.vz);
    a.anim += Math.sqrt(sp2) * dt * (2.2 / Math.max(0.3, a.st.lengthM ** 0.4));
    this.placeY(a);
  }

  /** Nudge a stranded agent to the nearest valid spot (e.g. after a terrain/state change). */
  private rescue(a: Agent) {
    for (let r = 2; r < 40; r += 2) {
      for (let s = 0; s < 8; s++) {
        const ang = (s / 8) * TAU;
        const x = a.x + Math.cos(ang) * r;
        const z = a.z + Math.sin(ang) * r;
        if (this.canBeAt(a, x, z)) {
          a.x = x;
          a.z = z;
          return;
        }
      }
    }
  }

  placeY(a: Agent) {
    const h = this.terrain.heightAt(a.x, a.z);
    if (a.st.aquatic) a.y = Math.min(-0.5, Math.max(h + 0.4, -1.4 - (a.id % 5) * 0.25));
    else if (a.flying && a.st.canFly) a.y = Math.max(h, 0) + a.altitude;
    else a.y = Math.max(h, a.st.swimKmh >= 3 || a.st.canFly ? 0 : h);
  }

  // ------------------------------------------------------------------ queries

  seasonWarmth() {
    return seasonWarmth(this.day);
  }

  temperatureNow() {
    return temperatureAt(this.env, this.events, this.day, 0);
  }

  drainChanges() {
    const born = this.newborns.filter((a) => !a.dead);
    const died = this.deaths;
    this.newborns = [];
    this.deaths = [];
    return { born, died };
  }
}

function rootLineage(id: number, species: SpeciesId): Lineage {
  const sp = SPECIES[species];
  return { id, name: sp.latin, species, parent: null, bornDay: 0, extinctDay: null, color: sp.color };
}

export type { AgentState };
