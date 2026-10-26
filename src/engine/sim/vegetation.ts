import { HALF, MAX_HEIGHT, WORLD_SIZE, type Terrain } from "../world/terrain";
import { effectiveHumidity, eventProductivity, temperatureAt } from "./climate";
import type { EnvSettings, WorldEvent } from "./types";

export const VEG_RES = 64;
const CELL = WORLD_SIZE / VEG_RES;

/** Energy (kJ) stored per cell at capacity, for land plants and aquatic plankton. */
const K_LAND = 1.2e6;
const K_WATER = 2e4;
/** Intrinsic regrowth rate per day under ideal conditions. */
const R_LAND = 0.08;
const R_WATER = 0.25;

/**
 * Primary producers as a logistic-growth biomass field (one value per cell).
 * Growth depends on temperature, humidity, season and catastrophes; herbivores remove it.
 */
export class Vegetation {
  readonly biomass = new Float32Array(VEG_RES * VEG_RES);
  readonly capacity = new Float32Array(VEG_RES * VEG_RES);
  readonly water = new Uint8Array(VEG_RES * VEG_RES);
  readonly height = new Float32Array(VEG_RES * VEG_RES);
  /**
   * Background fauna (insects, rodents, small fish) that is not simulated individually.
   * It grows on primary production and feeds insectivores and predators.
   */
  readonly fauna = new Float32Array(VEG_RES * VEG_RES);
  /** Base habitat suitability 0..1 (altitude, slope). */
  private suit = new Float32Array(VEG_RES * VEG_RES);

  constructor(private terrain: Terrain) {
    for (let j = 0; j < VEG_RES; j++) {
      for (let i = 0; i < VEG_RES; i++) {
        const k = j * VEG_RES + i;
        const x = (i + 0.5) * CELL - HALF;
        const z = (j + 0.5) * CELL - HALF;
        const h = terrain.heightAt(x, z);
        this.height[k] = h;
        this.water[k] = h < 0 ? 1 : 0;
        this.suit[k] = h < 0 ? Math.min(1, 0.4 + -h / 4) : Math.max(0.05, (1 - h / MAX_HEIGHT) ** 1.6);
      }
    }
  }

  static index(x: number, z: number) {
    const i = Math.max(0, Math.min(VEG_RES - 1, Math.floor((x + HALF) / CELL)));
    const j = Math.max(0, Math.min(VEG_RES - 1, Math.floor((z + HALF) / CELL)));
    return j * VEG_RES + i;
  }

  static cellCentre(k: number): [number, number] {
    return [((k % VEG_RES) + 0.5) * CELL - HALF, (Math.floor(k / VEG_RES) + 0.5) * CELL - HALF];
  }

  /** Recompute carrying capacities from the environment (cheap; call when settings change). */
  updateCapacity(env: EnvSettings) {
    const im = env.impact;
    const protR = im.protectedArea * HALF;
    for (let k = 0; k < this.capacity.length; k++) {
      if (this.water[k]) {
        this.capacity[k] = K_WATER * this.suit[k] * (0.5 + 0.5 * env.food);
        continue;
      }
      let cap = K_LAND * this.suit[k] * env.food;
      if (im.enabled) {
        const [x, z] = Vegetation.cellCentre(k);
        const inside = Math.hypot(x, z) < protR;
        if (!inside) cap *= 1 - 0.7 * im.clearing - 0.3 * im.farming;
      }
      this.capacity[k] = cap;
    }
  }

  fill(fraction: number) {
    for (let k = 0; k < this.biomass.length; k++) {
      this.biomass[k] = this.capacity[k] * fraction;
      this.fauna[k] = this.faunaCap(k) * fraction;
    }
  }

  /** Secondary production tracks primary biomass (~4% on land, ~40% for plankton → small fish). */
  private faunaCap(k: number) {
    return this.biomass[k] * (this.water[k] ? 0.4 : 0.04) + (this.water[k] ? 0 : 200);
  }

  /** Eat background fauna from a 3×3 patch; returns kJ taken. */
  preyOn(x: number, z: number, amount: number) {
    const ci = Math.max(0, Math.min(VEG_RES - 1, Math.floor((x + HALF) / CELL)));
    const cj = Math.max(0, Math.min(VEG_RES - 1, Math.floor((z + HALF) / CELL)));
    let total = 0;
    for (let j = Math.max(0, cj - 1); j <= Math.min(VEG_RES - 1, cj + 1); j++)
      for (let i = Math.max(0, ci - 1); i <= Math.min(VEG_RES - 1, ci + 1); i++)
        total += this.fauna[j * VEG_RES + i];
    if (total <= 0) return 0;
    const take = Math.min(amount, total * 0.25);
    const frac = take / total;
    for (let j = Math.max(0, cj - 1); j <= Math.min(VEG_RES - 1, cj + 1); j++)
      for (let i = Math.max(0, ci - 1); i <= Math.min(VEG_RES - 1, ci + 1); i++)
        this.fauna[j * VEG_RES + i] *= 1 - frac;
    return take;
  }

  faunaRichness(x: number, z: number) {
    const k = Vegetation.index(x, z);
    const cap = this.faunaCap(k);
    return cap > 0 ? Math.min(1, this.fauna[k] / cap) : 0;
  }

  /** Logistic regrowth for dt days. */
  grow(env: EnvSettings, events: readonly WorldEvent[], day: number, dt: number) {
    const hum = effectiveHumidity(env, events, day);
    const evK = eventProductivity(events, day);
    const tSea = temperatureAt(env, events, day, 0);
    const fHumLand = Math.max(0.03, hum) ** 0.7;
    for (let k = 0; k < this.biomass.length; k++) {
      const cap = this.capacity[k];
      if (cap <= 0) continue;
      const t = this.water[k] ? Math.max(tSea, 2) : tSea - 0.28 * this.height[k];
      // Plant growth peaks around 22 °C and stops near freezing.
      const fT = t <= 0 ? 0 : Math.exp(-(((t - 22) / 16) ** 2));
      const r = (this.water[k] ? R_WATER : R_LAND * fHumLand) * fT * evK;
      const b = this.biomass[k];
      this.biomass[k] = Math.min(cap, b + r * b * (1 - b / cap) * dt + cap * 0.0005 * dt * fT);
      const fc = this.faunaCap(k);
      const f = this.fauna[k];
      if (fc > 0) this.fauna[k] = Math.max(0, f + 0.12 * fT * evK * f * (1 - f / fc) * dt + fc * 0.001 * dt);
    }
  }

  /** Remove up to `amount` kJ from the cell at (x, z); returns what was eaten. */
  graze(x: number, z: number, amount: number) {
    const k = Vegetation.index(x, z);
    const take = Math.min(amount, this.biomass[k] * 0.5);
    this.biomass[k] -= take;
    return take;
  }

  /** Graze spread over a (2r+1)² patch of cells, best cells first. */
  grazePatch(x: number, z: number, amount: number, r = 1) {
    const ci = Math.max(0, Math.min(VEG_RES - 1, Math.floor((x + HALF) / CELL)));
    const cj = Math.max(0, Math.min(VEG_RES - 1, Math.floor((z + HALF) / CELL)));
    const landHere = this.water[cj * VEG_RES + ci];
    let total = 0;
    for (let j = Math.max(0, cj - r); j <= Math.min(VEG_RES - 1, cj + r); j++) {
      for (let i = Math.max(0, ci - r); i <= Math.min(VEG_RES - 1, ci + r); i++) {
        const k = j * VEG_RES + i;
        if (this.water[k] !== landHere) continue;
        total += this.biomass[k];
      }
    }
    if (total <= 0) return 0;
    const take = Math.min(amount, total * 0.3);
    const frac = take / total;
    for (let j = Math.max(0, cj - r); j <= Math.min(VEG_RES - 1, cj + r); j++) {
      for (let i = Math.max(0, ci - r); i <= Math.min(VEG_RES - 1, ci + r); i++) {
        const k = j * VEG_RES + i;
        if (this.water[k] !== landHere) continue;
        this.biomass[k] -= this.biomass[k] * frac;
      }
    }
    return take;
  }

  /** Fraction of capacity at (x, z). */
  richness(x: number, z: number) {
    const k = Vegetation.index(x, z);
    return this.capacity[k] > 0 ? this.biomass[k] / this.capacity[k] : 0;
  }

  /** Normalised field (0..1 of a reference capacity) for rendering. */
  snapshot(): Float32Array {
    const out = new Float32Array(this.biomass.length);
    for (let k = 0; k < out.length; k++)
      out[k] = this.water[k] ? -this.biomass[k] / K_WATER : this.biomass[k] / K_LAND;
    return out;
  }

  totalLand() {
    let s = 0;
    for (let k = 0; k < this.biomass.length; k++) if (!this.water[k]) s += this.biomass[k];
    return s;
  }
}
