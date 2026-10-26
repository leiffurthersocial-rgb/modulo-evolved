import { describe, expect, it } from "vitest";
import { World } from "./world";
import { scenarioById } from "./scenarios";
import { ZOO_HALF } from "../world/terrain";

function run(world: World, days: number, dt = 0.25) {
  for (let d = 0; d < days; d += dt) world.tick(dt);
}

const zoo = (seed = 3) => {
  const sc = scenarioById("zoo");
  return new World({ seed, terrain: sc.terrain, env: sc.env, counts: sc.counts, maxAgents: sc.maxAgents });
};

describe("breeding zoo and keeper tools", () => {
  it("keeper rations feed the paddock up to the ration size, inside the fence", () => {
    const w = zoo();
    const starved = new Set<string>();
    const kill = w.kill.bind(w);
    w.kill = (a, cause) => {
      if (cause === "starvation") starved.add(a.species);
      kill(a, cause);
    };
    run(w, 300);
    // Humans and deer stay within their rations; rabbits outbreed theirs and level off near it.
    expect(starved.has("human")).toBe(false);
    expect(starved.has("deer")).toBe(false);
    expect(w.deathCauses.predation).toBe(0);
    expect(w.speciesCount("human")).toBeGreaterThanOrEqual(6);
    expect(w.speciesCount("rabbit")).toBeGreaterThan(6);
    expect(w.speciesCount("rabbit")).toBeLessThan(16 * 2.5);
    for (const a of w.agents) {
      expect(Math.abs(a.x)).toBeLessThanOrEqual(ZOO_HALF);
      expect(Math.abs(a.z)).toBeLessThanOrEqual(ZOO_HALF);
    }
  });

  it("without rations or forage the zoo animals starve", () => {
    const sc = scenarioById("zoo");
    const w = new World({
      seed: 3,
      terrain: sc.terrain,
      env: { ...sc.env, provision: {} },
      counts: { rabbit: 6 },
      maxAgents: 100,
    });
    run(w, 120);
    expect(w.deathCauses.starvation).toBeGreaterThan(0);
  });

  it("breedNow produces a litter of the right species from both parents' genomes", () => {
    const w = zoo();
    const f = w.agents.find((a) => a.species === "rabbit" && a.sex === "F")!;
    const m = w.agents.find((a) => a.species === "rabbit" && a.sex === "M")!;
    const res = w.breedNow(f, m);
    expect(res.error).toBeUndefined();
    expect(res.born.length + res.stillborn).toBeGreaterThan(0);
    for (const id of res.born) {
      const kid = w.byId.get(id)!;
      expect(kid.species).toBe("rabbit");
      expect(kid.motherId).toBe(f.id);
      expect(kid.fatherId).toBe(m.id);
      expect(kid.generation).toBe(1);
    }
    expect(w.breedNow(f, f).error).toBeTruthy();
  });

  it("user caps limit births", () => {
    const sc = scenarioById("zoo");
    const w = new World({
      seed: 5,
      terrain: sc.terrain,
      env: { ...sc.env, caps: { rabbit: 8 }, provision: { rabbit: 30 } },
      counts: { rabbit: 6 },
      maxAgents: 200,
    });
    run(w, 400);
    expect(w.speciesCount("rabbit")).toBeLessThanOrEqual(8);
    expect(w.totals.births).toBeGreaterThan(0);
  });

  it("spawns wild animals where asked, refuses impossible spots, clears and feeds", () => {
    const w = zoo();
    const ok = w.spawnWild("deer", 0, 5, 2, "pair");
    expect(ok.ids).toHaveLength(2);
    const d = w.byId.get(ok.ids[0])!;
    expect(Math.hypot(d.x - 0, d.z - 5)).toBeLessThan(6);
    expect(w.spawnWild("sardine", 0, 5, 1, "F").error).toBeTruthy();
    d.energy = 1;
    w.feed(d);
    expect(d.energy).toBe(d.maxEnergy);
    expect(w.clear("deer")).toBeGreaterThan(0);
    expect(w.speciesCount("deer")).toBe(0);
    w.clear();
    expect(w.agents).toHaveLength(0);
  });

  it("generations turn over in the zoo", () => {
    const w = zoo(11);
    run(w, 365 * 3);
    expect(w.meanGeneration("rabbit")).toBeGreaterThan(1);
  });
});
