/**
 * Deterministic, seedable PRNG (sfc32, seeded via splitmix32).
 *
 * The whole engine must draw randomness only from an explicitly passed Rng so
 * that runs are reproducible from a seed. Never use Math.random in src/engine.
 */
export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

function splitmix32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number | RngState) {
    if (typeof seed === "number") {
      const sm = splitmix32(seed);
      this.a = sm();
      this.b = sm();
      this.c = sm();
      this.d = sm();
      // Warm up to decorrelate nearby seeds.
      for (let i = 0; i < 12; i++) this.nextU32();
    } else {
      ({ a: this.a, b: this.b, c: this.c, d: this.d } = seed);
    }
  }

  /** Uniform 32-bit unsigned integer. */
  nextU32(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [0, n). Unbiased (rejection sampling). */
  int(n: number): number {
    if (n <= 0 || !Number.isInteger(n)) throw new RangeError(`int(n) requires a positive integer, got ${n}`);
    const limit = 4294967296 - (4294967296 % n);
    let x: number;
    do x = this.nextU32();
    while (x >= limit);
    return x % n;
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Standard normal via Box–Muller. */
  normal(mean = 0, sd = 1): number {
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Poisson-distributed integer (Knuth for small λ, normal approximation for large). */
  poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    if (lambda > 30) return Math.max(0, Math.round(this.normal(lambda, Math.sqrt(lambda))));
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > L);
    return k - 1;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError("pick() on empty array");
    return items[this.int(items.length)];
  }

  /** In-place Fisher–Yates shuffle. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  /** Independent child stream, e.g. one per subsystem, so adding draws in one doesn't perturb others. */
  fork(): Rng {
    return new Rng(this.nextU32() ^ 0xa5a5a5a5);
  }

  getState(): RngState {
    return { a: this.a, b: this.b, c: this.c, d: this.d };
  }
}
