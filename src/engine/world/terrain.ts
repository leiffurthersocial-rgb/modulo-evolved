import { Rng } from "../rng/rng";
import { createNoise2D, fbm } from "../rng/noise";

export type TerrainKind = "island" | "archipelago" | "continent" | "mini" | "zoo";

export interface TerrainConfig {
  seed: number;
  kind: TerrainKind;
}

/** World is a square of WORLD_SIZE units centred on the origin; sea level is y = 0. */
export const WORLD_SIZE = 220;
export const HALF = WORLD_SIZE / 2;
export const MAX_HEIGHT = 26;
/** Roughly 4 m per world unit (used to convert sensory ranges). */
export const METERS_PER_UNIT = 4;
/** Half-width of the fenced zoo enclosure. */
export const ZOO_HALF = 34;
/** Centre and radius of the zoo pond. */
export const ZOO_POND = { x: 15, z: -13, r: 9 };

/** Animals stay within ±bounds (the zoo fence, or the edge of the map). */
export function worldBounds(kind: TerrainKind) {
  return kind === "zoo" ? ZOO_HALF : HALF - 2;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Deterministic heightfield shared by the simulation worker and the renderer.
 * Sampled onto a grid once, then bilinearly interpolated.
 */
export class Terrain {
  readonly res = 129;
  readonly heights: Float32Array;
  readonly config: TerrainConfig;

  constructor(config: TerrainConfig) {
    this.config = config;
    const raw = rawHeightFn(config);
    this.heights = new Float32Array(this.res * this.res);
    for (let j = 0; j < this.res; j++) {
      for (let i = 0; i < this.res; i++) {
        const x = (i / (this.res - 1)) * WORLD_SIZE - HALF;
        const z = (j / (this.res - 1)) * WORLD_SIZE - HALF;
        this.heights[j * this.res + i] = raw(x, z);
      }
    }
  }

  heightAt(x: number, z: number): number {
    const fx = ((x + HALF) / WORLD_SIZE) * (this.res - 1);
    const fz = ((z + HALF) / WORLD_SIZE) * (this.res - 1);
    const i = Math.max(0, Math.min(this.res - 2, Math.floor(fx)));
    const j = Math.max(0, Math.min(this.res - 2, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - i));
    const tz = Math.max(0, Math.min(1, fz - j));
    const h = this.heights;
    const r = this.res;
    const a = h[j * r + i] + (h[j * r + i + 1] - h[j * r + i]) * tx;
    const b = h[(j + 1) * r + i] + (h[(j + 1) * r + i + 1] - h[(j + 1) * r + i]) * tx;
    return a + (b - a) * tz;
  }

  /** Unit-ish gradient pointing uphill. */
  slopeAt(x: number, z: number): [number, number] {
    const e = 1.5;
    return [
      (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e),
      (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e),
    ];
  }

  isWater(x: number, z: number) {
    return this.heightAt(x, z) < 0;
  }
}

export function rawHeightFn(config: TerrainConfig): (x: number, z: number) => number {
  const noise = createNoise2D(config.seed);
  const detail = (nx: number, nz: number) => fbm(noise, nx * 3.2 + 10, nz * 3.2 + 10, 5);

  if (config.kind === "archipelago") {
    const rng = new Rng(config.seed ^ 0xa4c1);
    // A central island and four outer ones, separated by deep channels (no land bridges).
    const centres = Array.from({ length: 5 }, (_, k) => {
      const ang = (k / 4) * Math.PI * 2 + rng.range(-0.25, 0.25);
      const r = k === 0 ? 0 : rng.range(0.31, 0.35);
      return { x: Math.cos(ang) * r, z: Math.sin(ang) * r, s: rng.range(0.1, 0.12) };
    });
    centres[0] = { x: 0, z: 0, s: 0.11 };
    return (x, z) => {
      const nx = x / WORLD_SIZE;
      const nz = z / WORLD_SIZE;
      let m = 0;
      for (const c of centres) {
        const d = Math.hypot(nx - c.x, nz - c.z) / c.s;
        m = Math.max(m, 1 - Math.min(1, d) ** 2);
      }
      return (detail(nx, nz) + 0.45) * m * 0.85 * MAX_HEIGHT - 1.4;
    };
  }

  if (config.kind === "continent") {
    return (x, z) => {
      const nx = x / WORLD_SIZE;
      const nz = z / WORLD_SIZE;
      const edge = Math.max(Math.abs(nx), Math.abs(nz)) * 2;
      const falloff = 1 - Math.max(0, edge - 0.82) / 0.18;
      return (detail(nx, nz) + 0.42) * Math.max(0, falloff) * 0.9 * MAX_HEIGHT - 1.0;
    };
  }

  if (config.kind === "zoo") {
    // A flat fenced paddock with a pond, set in gentle countryside.
    return (x, z) => {
      const nx = x / WORLD_SIZE;
      const nz = z / WORLD_SIZE;
      const d = Math.sqrt(nx * nx + nz * nz) * 2;
      const outer = (detail(nx, nz) + 0.35) * (1 - Math.pow(Math.min(1, d), 2.2)) * MAX_HEIGHT * 0.5 - 1.2;
      let inner = 1.5 + detail(nx * 2, nz * 2) * 0.8;
      const pond = Math.hypot(x - ZOO_POND.x, z - ZOO_POND.z);
      inner += (-3 - inner) * smoothstep(ZOO_POND.r, ZOO_POND.r * 0.45, pond);
      const t = smoothstep(ZOO_HALF + 2, ZOO_HALF + 14, Math.max(Math.abs(x), Math.abs(z)));
      return inner * (1 - t) + outer * t;
    };
  }

  // "mini" is the same island at less than half the size.
  const shrink = config.kind === "mini" ? 2.3 : 1;
  return (x, z) => {
    const nx = x / WORLD_SIZE;
    const nz = z / WORLD_SIZE;
    const d = Math.sqrt(nx * nx + nz * nz) * 2 * shrink;
    const falloff = 1 - Math.pow(Math.min(1, d), 2.2);
    return (detail(nx, nz) + 0.35) * falloff * MAX_HEIGHT - 1.2;
  };
}
