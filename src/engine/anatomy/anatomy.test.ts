import { describe, expect, it } from "vitest";
import { Rng } from "../rng/rng";
import { AlleleFactory } from "../genetics/alleles";
import { geneticDistance, crossFertility } from "../genetics/distance";
import { LOCUS_INDEX } from "../genetics/layout";
import type { Genome, Slot } from "../genetics/types";
import { buildPools, founderGenome } from "../species/founders";
import { SPECIES, SPECIES_IDS } from "../species/roster";
import { divergenceMya } from "../species/phylo";
import type { SpeciesId } from "../species/types";
import { computePhenotype } from "./phenotype";
import { computeStats, kleiberKJ } from "./stats";

const rng = new Rng(99);
const f = new AlleleFactory();
const pools = buildPools(rng, f);

function avgStats(id: SpeciesId, n = 30) {
  const out = { bite: 0, speed: 0, fly: 0, mass: 0 };
  for (let i = 0; i < n; i++) {
    const g = founderGenome(id, pools, rng, "F");
    const s = computeStats(computePhenotype(g, id, "F"));
    out.bite += s.biteN / n;
    out.speed += s.speedKmh / n;
    out.fly += (s.canFly ? 1 : 0) / n;
    out.mass += computePhenotype(g, id, "F").massKg / n;
  }
  return out;
}

/** Replace module alleles for given slots with those of a donor species (what Splice Lab does). */
function splice(g: Genome, donor: SpeciesId, slots: Slot[]): Genome {
  const donorG = founderGenome(donor, pools, rng, "F");
  const a = [...g.a];
  const b = [...g.b];
  const keys: Record<Slot, string> = {
    head: "modHead",
    jaw: "modJaw",
    teeth: "modTeeth",
    eyes: "modEyes",
    ears: "modEars",
    forelimbs: "modFore",
    hindlimbs: "modHind",
    tail: "modTail",
    covering: "modCover",
    wings: "modWings",
    fins: "modFins",
  };
  for (const s of slots) {
    const i = LOCUS_INDEX[keys[s]];
    a[i] = donorG.a[i];
    b[i] = donorG.b[i];
  }
  return { a, b };
}

describe("species roster", () => {
  it("has 18 species including humans, each with complete parts", () => {
    expect(SPECIES_IDS).toHaveLength(18);
    expect(SPECIES_IDS).toContain("human");
    for (const id of SPECIES_IDS) expect(SPECIES[id].parts.torso).toBeDefined();
  });
  it("divergence times follow the deep tree", () => {
    expect(divergenceMya("fox", "wolf")).toBe(9);
    expect(divergenceMya("human", "rabbit")).toBe(87);
    expect(divergenceMya("human", "shark")).toBe(465);
    expect(divergenceMya("crocodile", "sparrow")).toBe(245);
  });
});

describe("derived anatomy", () => {
  it("bite force: crocodile > lion > wolf > human, roughly real magnitudes", () => {
    const croc = avgStats("crocodile").bite;
    const lion = avgStats("lion").bite;
    const wolf = avgStats("wolf").bite;
    const human = avgStats("human").bite;
    expect(croc).toBeGreaterThan(lion);
    expect(lion).toBeGreaterThan(wolf);
    expect(wolf).toBeGreaterThan(human);
    expect(human).toBeGreaterThan(300);
    expect(human).toBeLessThan(1500);
  });
  it("speeds: lion and deer fast, elephant and human slower, fish can't walk", () => {
    expect(avgStats("lion").speed).toBeGreaterThan(50);
    expect(avgStats("deer").speed).toBeGreaterThan(50);
    expect(avgStats("elephant").speed).toBeLessThan(40);
    expect(avgStats("human").speed).toBeLessThan(45);
    expect(avgStats("sardine").speed).toBe(0);
  });
  it("only birds fly by default", () => {
    for (const id of SPECIES_IDS) expect(avgStats(id, 5).fly > 0.5).toBe(SPECIES[id].clade === "bird");
  });
  it("Kleiber BMR for a 58 kg human ≈ 1500 kcal/day", () => {
    expect(kleiberKJ(58, true, false) / 4.184).toBeGreaterThan(1300);
    expect(kleiberKJ(58, true, false) / 4.184).toBeLessThan(1700);
  });
});

describe("chimeras", () => {
  it("rabbit with hawk wings can fly; human or lion with hawk wings cannot", () => {
    const rabbit = splice(founderGenome("rabbit", pools, rng, "F"), "hawk", ["wings"]);
    expect(computeStats(computePhenotype(rabbit, "rabbit", "F")).canFly).toBe(true);
    const human = splice(founderGenome("human", pools, rng, "F"), "hawk", ["wings"]);
    const hs = computeStats(computePhenotype(human, "human", "F"));
    expect(hs.canFly).toBe(false);
    expect(hs.notes.join(" ")).toMatch(/Too heavy to fly/);
    const lion = splice(founderGenome("lion", pools, rng, "M"), "hawk", ["wings"]);
    expect(computeStats(computePhenotype(lion, "lion", "M")).canFly).toBe(false);
  });
  it("lion with crocodile jaw bites harder but pays a developmental cost", () => {
    const g = founderGenome("lion", pools, rng, "M");
    const base = computeStats(computePhenotype(g, "lion", "M"));
    const chim = computeStats(computePhenotype(splice(g, "crocodile", ["jaw", "teeth"]), "lion", "M"));
    expect(chim.biteN).toBeGreaterThan(base.biteN * 1.5);
    expect(chim.devCost).toBeGreaterThan(0);
    expect(chim.fertilityMult).toBeLessThan(1);
  });
  it("rabbit legs on an elephant are overloaded", () => {
    const g = founderGenome("elephant", pools, rng, "F");
    const base = computeStats(computePhenotype(g, "elephant", "F"));
    const chim = computeStats(computePhenotype(splice(g, "rabbit", ["hindlimbs"]), "elephant", "F"));
    expect(chim.speedKmh).toBeLessThan(base.speedKmh * 1.2);
    expect(chim.notes.some((n) => n.includes("overloaded"))).toBe(true);
  });
  it("closely related parts cost less than distant ones", () => {
    const g = founderGenome("wolf", pools, rng, "F");
    const fox = computeStats(computePhenotype(splice(g, "fox", ["head"]), "wolf", "F"));
    const shark = computeStats(computePhenotype(splice(g, "shark", ["head"]), "wolf", "F"));
    expect(fox.devCost).toBeLessThan(shark.devCost);
  });
});

describe("species genetic distance", () => {
  it("is low within species and ~1 between species; hybrids infertile", () => {
    const d1 = geneticDistance(
      founderGenome("wolf", pools, rng, "F"),
      founderGenome("wolf", pools, rng, "M"),
    );
    const d2 = geneticDistance(founderGenome("wolf", pools, rng, "F"), founderGenome("fox", pools, rng, "M"));
    expect(d1).toBeLessThan(0.55);
    expect(d2).toBeGreaterThan(0.95);
    expect(crossFertility(d1)).toBe(1);
    expect(crossFertility(d2)).toBe(0);
  });
  it("humans carry lactase persistence at ~30%; other species never", () => {
    let lp = 0;
    for (let i = 0; i < 400; i++)
      if (computePhenotype(founderGenome("human", pools, rng, "F"), "human", "F").lactase) lp++;
    // Dominant allele at p = 0.3 → phenotype frequency 1 − 0.7² = 0.51
    expect(lp / 400).toBeGreaterThan(0.4);
    expect(lp / 400).toBeLessThan(0.62);
    for (let i = 0; i < 50; i++)
      expect(computePhenotype(founderGenome("wolf", pools, rng, "F"), "wolf", "F").lactase).toBe(false);
  });
});
