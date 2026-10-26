import * as THREE from "three";
import { createNoise2D, fbm } from "@/engine/rng/noise";

export interface TerrainOptions {
  seed: number;
  size: number;
  segments: number;
  maxHeight: number;
}

const SAND = new THREE.Color("#c9b98a");
const GRASS = new THREE.Color("#5f8a3c");
const FOREST = new THREE.Color("#3b6332");
const ROCK = new THREE.Color("#6b6a68");
const SNOW = new THREE.Color("#e8eef2");
const SEABED = new THREE.Color("#2c4a52");

/** Island-shaped heightfield: fbm noise multiplied by a radial falloff. */
export function sampleHeight(
  noise: (x: number, y: number) => number,
  x: number,
  z: number,
  o: TerrainOptions,
) {
  const nx = x / o.size;
  const nz = z / o.size;
  const d = Math.sqrt(nx * nx + nz * nz) * 2; // 0 at centre, 1 at edge
  const falloff = 1 - Math.pow(Math.min(1, d), 2.2);
  const h = (fbm(noise, nx * 3.2 + 10, nz * 3.2 + 10, 5) + 0.35) * falloff;
  return h * o.maxHeight - 1.2;
}

/** Non-indexed (flat-shaded, low-poly) terrain geometry with per-face colours. */
export function buildTerrainGeometry(o: TerrainOptions) {
  const noise = createNoise2D(o.seed);
  const plane = new THREE.PlaneGeometry(o.size, o.size, o.segments, o.segments);
  plane.rotateX(-Math.PI / 2);
  const pos = plane.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, sampleHeight(noise, pos.getX(i), pos.getZ(i), o));
  }
  const geo = plane.toNonIndexed();
  plane.dispose();
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let f = 0; f < p.count; f += 3) {
    const h = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3;
    const t = h / o.maxHeight;
    if (h < -0.2) c.copy(SEABED);
    else if (h < 0.5) c.copy(SAND);
    else if (t < 0.28) c.copy(GRASS).lerp(FOREST, t / 0.28);
    else if (t < 0.5) c.copy(FOREST).lerp(ROCK, (t - 0.28) / 0.22);
    else if (t < 0.62) c.copy(ROCK);
    else c.copy(SNOW);
    // Subtle per-face jitter gives the faceted look some life.
    const j = 1 + (((f * 2654435761) >>> 0) / 4294967296 - 0.5) * 0.08;
    for (let k = 0; k < 3; k++) {
      colors[(f + k) * 3] = c.r * j;
      colors[(f + k) * 3 + 1] = c.g * j;
      colors[(f + k) * 3 + 2] = c.b * j;
    }
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return { geometry: geo, height: (x: number, z: number) => sampleHeight(noise, x, z, o) };
}
