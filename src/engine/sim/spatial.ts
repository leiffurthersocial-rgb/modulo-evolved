import { HALF, WORLD_SIZE } from "../world/terrain";
import type { Agent } from "./types";

/** Uniform-grid spatial hash for O(1) neighbourhood queries. */
export class SpatialHash {
  readonly cell: number;
  readonly n: number;
  private heads: Int32Array;
  private next: Int32Array;
  private items: Agent[] = [];

  constructor(cell = 12, capacity = 4096) {
    this.cell = cell;
    this.n = Math.ceil(WORLD_SIZE / cell) + 1;
    this.heads = new Int32Array(this.n * this.n);
    this.next = new Int32Array(capacity);
  }

  private key(x: number, z: number) {
    const i = Math.max(0, Math.min(this.n - 1, Math.floor((x + HALF) / this.cell)));
    const j = Math.max(0, Math.min(this.n - 1, Math.floor((z + HALF) / this.cell)));
    return j * this.n + i;
  }

  rebuild(agents: Agent[]) {
    this.items = agents;
    if (this.next.length < agents.length) this.next = new Int32Array(agents.length * 2);
    this.heads.fill(-1);
    for (let k = 0; k < agents.length; k++) {
      const a = agents[k];
      const h = this.key(a.x, a.z);
      this.next[k] = this.heads[h];
      this.heads[h] = k;
    }
  }

  /** Calls fn for every agent within radius r of (x, z). */
  query(x: number, z: number, r: number, fn: (a: Agent, d2: number) => void) {
    const r2 = r * r;
    const i0 = Math.max(0, Math.floor((x - r + HALF) / this.cell));
    const i1 = Math.min(this.n - 1, Math.floor((x + r + HALF) / this.cell));
    const j0 = Math.max(0, Math.floor((z - r + HALF) / this.cell));
    const j1 = Math.min(this.n - 1, Math.floor((z + r + HALF) / this.cell));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        for (let k = this.heads[j * this.n + i]; k !== -1; k = this.next[k]) {
          const a = this.items[k];
          const dx = a.x - x;
          const dz = a.z - z;
          const d2 = dx * dx + dz * dz;
          if (d2 <= r2) fn(a, d2);
        }
      }
    }
  }
}
