import { describe, expect, it } from "vitest";
import { Rng } from "../rng/rng";
import { AlleleFactory } from "./alleles";
import { buildPools, founderGenome } from "../species/founders";
import { computePhenotype } from "../anatomy/phenotype";
import { computeStats } from "../anatomy/stats";
import { fertilize, makeGamete } from "./meiosis";
import { modulesOf, splice } from "./splice";

const rng = new Rng(4);
const pools = buildPools(rng, new AlleleFactory());

describe("splice", () => {
  it("writes homozygous module alleles that breed true", () => {
    const lion = founderGenome("lion", pools, rng, "F");
    const lionM = founderGenome("lion", pools, rng, "M");
    const croc = founderGenome("crocodile", pools, rng, "F");
    const chimF = splice(lion, { jaw: "crocodile" }, { crocodile: croc });
    const chimM = splice(lionM, { jaw: "crocodile" }, { crocodile: croc });
    expect(modulesOf(chimF).jaw).toBe("crocodile");
    for (let i = 0; i < 20; i++) {
      const kid = fertilize(makeGamete(chimF, rng), makeGamete(chimM, rng));
      expect(computePhenotype(kid, "lion", "F").modules.jaw).toBe("crocodile");
    }
  });

  it("removes optional parts but not vital ones", () => {
    const hawk = founderGenome("hawk", pools, rng, "F");
    const g = splice(hawk, { wings: null, head: null }, {});
    expect(modulesOf(g).wings).toBeNull();
    expect(modulesOf(g).head).toBe("hawk");
    expect(computeStats(computePhenotype(g, "hawk", "F")).canFly).toBe(false);
  });

  it("covering transfers the donor's pigmentation", () => {
    const lion = founderGenome("lion", pools, rng, "F");
    const zebra = founderGenome("zebra", pools, rng, "F");
    const g = splice(lion, { covering: "zebra" }, { zebra });
    const ph = computePhenotype(g, "lion", "F");
    expect(ph.modules.covering).toBe("zebra");
    expect(ph.pattern).toBeGreaterThan(0.4);
  });
});
