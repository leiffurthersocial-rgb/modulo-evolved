import { describe, expect, it } from "vitest";
import { World } from "./world";
import { scenarioById, SCENARIOS } from "./scenarios";
import { SpatialHash } from "./spatial";
import { temperatureAt, seasonName } from "./climate";
import { DEFAULT_ENV } from "./types";

function run(world: World, days: number, dt = 0.1) {
  for (let d = 0; d < days; d += dt) world.tick(dt);
}

describe("world simulation", () => {
  it("is deterministic for a seed", () => {
    const sc = scenarioById("temperate");
    const a = new World({ seed: 42, terrain: sc.terrain, env: sc.env, counts: sc.counts });
    const b = new World({ seed: 42, terrain: sc.terrain, env: sc.env, counts: sc.counts });
    run(a, 30);
    run(b, 30);
    expect(a.agents.length).toBe(b.agents.length);
    expect(a.agents.map((x) => x.x.toFixed(6))).toEqual(b.agents.map((x) => x.x.toFixed(6)));
    expect(a.totals).toEqual(b.totals);
  });

  it("different seeds diverge", () => {
    const a = new World({ seed: 1 });
    const b = new World({ seed: 2 });
    run(a, 10);
    run(b, 10);
    expect(a.agents.map((x) => x.x)).not.toEqual(b.agents.map((x) => x.x));
  });

  it("temperate island keeps most species alive for a year, with births and predation", () => {
    const sc = scenarioById("temperate");
    const w = new World({ seed: 7, terrain: sc.terrain, env: sc.env, counts: sc.counts });
    run(w, 365);
    const alive = new Set(w.agents.map((a) => a.species));
    expect(alive.size).toBeGreaterThanOrEqual(11);
    expect(w.totals.births).toBeGreaterThan(100);
    expect(w.deathCauses.predation).toBeGreaterThan(20);
    expect(w.agents.length).toBeLessThanOrEqual(w.config.maxAgents);
  }, 120_000);

  it("offspring carry recombined parental genomes and track lineage", () => {
    const w = new World({ seed: 3 });
    run(w, 200);
    const kid = w.agents.find((a) => a.generation > 0 && w.byId.get(a.motherId));
    expect(kid).toBeDefined();
    const mom = w.byId.get(kid!.motherId)!;
    // Every maternal-haplotype allele came from the mother's genome (or is a new mutation).
    const momIds = new Set([...mom.genome.a, ...mom.genome.b].filter(Boolean).map((x) => x!.id));
    const inherited = kid!.genome.a.filter((x) => x && momIds.has(x.id)).length;
    expect(inherited / kid!.genome.a.length).toBeGreaterThan(0.8);
  }, 60_000);

  it("catastrophes kill and change climate", () => {
    const w = new World({ seed: 5 });
    const before = w.agents.length;
    w.trigger("meteor", 0, 0);
    w.tick(0.1);
    expect(w.agents.length).toBeLessThan(before);
    expect(w.temperatureNow()).toBeLessThan(temperatureAt(w.env, [], w.day, 0));
  });

  it("all scenarios construct", () => {
    for (const sc of SCENARIOS) {
      const w = new World({ seed: 1, terrain: sc.terrain, env: sc.env, counts: sc.counts });
      expect(w.agents.length).toBeGreaterThan(0);
      w.tick(0.1);
    }
  });
});

describe("climate", () => {
  it("has seasons and a lapse rate", () => {
    expect(seasonName(200)).toBe("Summer");
    expect(seasonName(10)).toBe("Winter");
    expect(temperatureAt(DEFAULT_ENV, [], 200, 0)).toBeGreaterThan(temperatureAt(DEFAULT_ENV, [], 10, 0));
    expect(temperatureAt(DEFAULT_ENV, [], 200, 20)).toBeLessThan(temperatureAt(DEFAULT_ENV, [], 200, 0));
  });
});

describe("spatial hash", () => {
  it("finds exactly the agents within the radius", () => {
    const w = new World({ seed: 9 });
    const h = new SpatialHash(12);
    h.rebuild(w.agents);
    const c = w.agents[0];
    const found: number[] = [];
    h.query(c.x, c.z, 20, (a) => found.push(a.id));
    const brute = w.agents.filter((a) => Math.hypot(a.x - c.x, a.z - c.z) <= 20).map((a) => a.id);
    expect(found.sort()).toEqual(brute.sort());
  });
});

import { serializeWorld, deserializeWorld } from "./serialize";

describe("save / load", () => {
  it("round-trips a world and continues identically", () => {
    const a = new World({ seed: 11 });
    run(a, 20);
    const save = JSON.parse(JSON.stringify(serializeWorld(a, "temperate")));
    const { world: b } = deserializeWorld(save);
    expect(b.agents.length).toBe(a.agents.length);
    expect(b.day).toBeCloseTo(a.day);
    run(a, 5);
    run(b, 5);
    expect(b.agents.length).toBe(a.agents.length);
    expect(b.agents.slice(0, 20).map((x) => x.x.toFixed(4))).toEqual(
      a.agents.slice(0, 20).map((x) => x.x.toFixed(4)),
    );
  }, 60_000);
});
