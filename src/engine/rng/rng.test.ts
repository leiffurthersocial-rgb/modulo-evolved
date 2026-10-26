import { describe, expect, it } from "vitest";
import { Rng } from "./rng";
import { createNoise2D, fbm } from "./noise";

describe("Rng", () => {
  it("is deterministic for a given seed", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 1000; i++) expect(a.nextU32()).toBe(b.nextU32());
  });

  it("produces different streams for nearby seeds", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const same = Array.from({ length: 100 }, () => a.nextU32() === b.nextU32()).filter(Boolean).length;
    expect(same).toBeLessThan(2);
  });

  it("restores from saved state", () => {
    const a = new Rng(7);
    for (let i = 0; i < 50; i++) a.next();
    const b = new Rng(a.getState());
    for (let i = 0; i < 100; i++) expect(b.next()).toBe(a.next());
  });

  it("next() is uniform on [0,1) (mean, variance, bins)", () => {
    const r = new Rng(123);
    const n = 200_000;
    const bins = new Array(10).fill(0);
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
      sumSq += x * x;
      bins[Math.floor(x * 10)]++;
    }
    const mean = sum / n;
    expect(mean).toBeCloseTo(0.5, 2);
    expect(sumSq / n - mean * mean).toBeCloseTo(1 / 12, 2);
    // Chi-square with 9 dof; 99.9% critical value ≈ 27.9.
    const chi = bins.reduce((acc, o) => acc + (o - n / 10) ** 2 / (n / 10), 0);
    expect(chi).toBeLessThan(27.9);
  });

  it("int(n) is unbiased and in range", () => {
    const r = new Rng(9);
    const counts = new Array(6).fill(0);
    const n = 120_000;
    for (let i = 0; i < n; i++) counts[r.int(6)]++;
    const chi = counts.reduce((acc, o) => acc + (o - n / 6) ** 2 / (n / 6), 0);
    expect(chi).toBeLessThan(20.5); // 5 dof, 99.9%
    expect(() => r.int(0)).toThrow();
  });

  it("normal() has the requested mean and sd", () => {
    const r = new Rng(5);
    const xs = Array.from({ length: 100_000 }, () => r.normal(3, 2));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    expect(mean).toBeCloseTo(3, 1);
    expect(sd).toBeCloseTo(2, 1);
  });

  it("poisson() mean matches lambda", () => {
    const r = new Rng(11);
    for (const lambda of [0.5, 4, 50]) {
      const xs = Array.from({ length: 50_000 }, () => r.poisson(lambda));
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      expect(Math.abs(mean - lambda) / lambda).toBeLessThan(0.03);
    }
  });

  it("fork() gives independent reproducible streams", () => {
    const a = new Rng(99).fork();
    const b = new Rng(99).fork();
    expect(a.next()).toBe(b.next());
  });
});

describe("noise", () => {
  it("is deterministic and bounded", () => {
    const n1 = createNoise2D(3);
    const n2 = createNoise2D(3);
    for (let i = 0; i < 1000; i++) {
      const x = i * 0.137;
      const y = i * 0.071;
      const v = fbm(n1, x, y);
      expect(v).toBe(fbm(n2, x, y));
      expect(Math.abs(v)).toBeLessThanOrEqual(1.01);
    }
  });
});
