import { describe, expect, it } from "vitest";
import { Rng } from "../rng/rng";
import {
  coatGenotype,
  genotypeValue,
  heterozygosity,
  loadViability,
  locusValue,
  traitValues,
} from "./expression";
import { CHROMOSOMES, LOCI, LOCI_BY_CHROM, LOCUS_INDEX, SEX_CHROM } from "./layout";
import {
  determineSex,
  fertilize,
  isHeterogametic,
  makeGamete,
  tsdMaleProbability,
  withKaryotype,
} from "./meiosis";
import { DEFAULT_RATES, mutateAllele, mutateGamete } from "./mutation";
import { alleleFrequencies, expectedHeterozygosity, fixationIndex, observedHeterozygosity } from "./popgen";
import { crossFertility, geneticDistance } from "./distance";
import { testKit } from "./test-utils";
import type { Genome } from "./types";

const L = LOCUS_INDEX;

/** Chi-square goodness-of-fit statistic. */
function chi2(observed: number[], expectedP: number[]) {
  const n = observed.reduce((a, b) => a + b, 0);
  return observed.reduce((acc, o, i) => acc + (o - n * expectedP[i]) ** 2 / (n * expectedP[i]), 0);
}

describe("layout", () => {
  it("has 40–80 loci on 9 chromosomes, all within map bounds", () => {
    expect(LOCI.length).toBeGreaterThanOrEqual(40);
    expect(LOCI.length).toBeLessThanOrEqual(80);
    expect(CHROMOSOMES).toHaveLength(9);
    for (const l of LOCI) expect(l.posCM).toBeLessThanOrEqual(CHROMOSOMES[l.chrom].lengthCM);
    expect(new Set(LOCI.map((l) => l.key)).size).toBe(LOCI.length);
  });
});

describe("dominance and expression", () => {
  const { allele } = testKit();
  it("dominant allele masks recessive in heterozygotes", () => {
    const A = allele({ effect: 1, dom: 50 });
    const a = allele({ effect: -1, dom: 1 });
    expect(locusValue(A, A)).toBeCloseTo(2);
    expect(locusValue(a, a)).toBeCloseTo(-2);
    expect(locusValue(A, a)).toBeGreaterThan(1.8);
  });
  it("equal dominance weights give additive (intermediate) heterozygotes", () => {
    expect(locusValue(allele({ effect: 1 }), allele({ effect: -1 }))).toBeCloseTo(0);
  });
  it("loss-of-function alleles are recessive and contribute nothing", () => {
    const wt = allele({ effect: 1 });
    const lof = allele({ effect: 1, lof: true });
    expect(locusValue(lof, lof)).toBe(0);
    expect(locusValue(wt, lof)).toBeGreaterThan(1.6);
  });
  it("duplication raises dosage and regulatory shifts scale expression", () => {
    expect(locusValue(allele({ effect: 1, copies: 2 }), allele({ effect: 1, copies: 2 }))).toBeCloseTo(4);
    expect(locusValue(allele({ effect: 1, expr: 0.5 }), allele({ effect: 1, expr: 0.5 }))).toBeCloseTo(1);
  });
  it("hemizygous loci are dosage compensated", () => {
    expect(locusValue(allele({ effect: 0.7 }), null)).toBeCloseTo(1.4);
  });
  it("regulatory loci scale every locus of their target trait", () => {
    const { hap, genome } = testKit();
    const up = allele({ effect: 1 });
    const g0 = genome(hap({ [L.size1]: up }), hap({ [L.size1]: up }));
    const reg = allele({ effect: 0.5 });
    const g1 = genome(hap({ [L.size1]: up, [L.regSize]: reg }), hap({ [L.size1]: up, [L.regSize]: reg }));
    expect(traitValues(g1).size).toBeCloseTo(traitValues(g0).size * Math.exp(0.5));
  });
  it("epistasis adds an interaction term", () => {
    const { hap, genome } = testKit();
    const up = allele({ effect: 1 });
    const only1 = genome(hap({ [L.size1]: up }), hap({ [L.size1]: up }));
    const only3 = genome(hap({ [L.size3]: up }), hap({ [L.size3]: up }));
    const both = genome(hap({ [L.size1]: up, [L.size3]: up }), hap({ [L.size1]: up, [L.size3]: up }));
    const additive = traitValues(only1).size + traitValues(only3).size;
    expect(traitValues(both).size).toBeCloseTo(additive + 0.15 * 2 * 2);
  });
});

describe("Mendelian inheritance", () => {
  const { hap, allele, genome } = testKit();
  const B = allele({ effect: 1, dom: 4 });
  const b = allele({ effect: -1, dom: 1 });
  const E = allele({ effect: 1, dom: 4 });
  const e = allele({ effect: -1, dom: 1 });

  it("monohybrid cross Bb × Bb gives 3:1 (black:brown)", () => {
    const rng = new Rng(1);
    const P = genome(hap({ [L.colB]: B, [L.colE]: E }), hap({ [L.colB]: b, [L.colE]: E }));
    const counts = { black: 0, brown: 0, red: 0 };
    for (let i = 0; i < 8000; i++)
      counts[coatGenotype(fertilize(makeGamete(P, rng), makeGamete(P, rng))).base]++;
    expect(chi2([counts.black, counts.brown], [0.75, 0.25])).toBeLessThan(10.8); // p > 0.001
    expect(counts.red).toBe(0);
  });

  it("dihybrid BbEe × BbEe gives 9:3:4 (recessive epistasis of ee over B)", () => {
    const rng = new Rng(2);
    const P = genome(hap({ [L.colB]: B, [L.colE]: E }), hap({ [L.colB]: b, [L.colE]: e }));
    const counts = { black: 0, brown: 0, red: 0 };
    for (let i = 0; i < 16000; i++)
      counts[coatGenotype(fertilize(makeGamete(P, rng), makeGamete(P, rng))).base]++;
    expect(chi2([counts.black, counts.brown, counts.red], [9 / 16, 3 / 16, 4 / 16])).toBeLessThan(13.8);
  });

  it("incomplete dominance at S gives 1:2:1 pattern classes", () => {
    const rng = new Rng(3);
    const S = allele({ effect: 1 });
    const s = allele({ effect: -1 });
    const P = genome(hap({ [L.colS]: S }), hap({ [L.colS]: s }));
    const c = [0, 0, 0];
    for (let i = 0; i < 8000; i++)
      c[Math.round(coatGenotype(fertilize(makeGamete(P, rng), makeGamete(P, rng))).pattern * 2)]++;
    expect(chi2(c, [0.25, 0.5, 0.25])).toBeLessThan(13.8);
  });
});

describe("linkage and recombination", () => {
  const { hap, allele, genome } = testKit();
  const haldane = (cM: number) => 0.5 * (1 - Math.exp((-2 * cM) / 100));

  function recombFraction(l1: number, l2: number, n = 30000) {
    const rng = new Rng(7);
    const A1 = allele();
    const A2 = allele();
    const P = genome(hap({ [l1]: A1, [l2]: A2 }), hap());
    let rec = 0;
    for (let i = 0; i < n; i++) {
      const g = makeGamete(P, rng);
      if ((g[l1] === A1) !== (g[l2] === A2)) rec++;
    }
    return rec / n;
  }

  it("tightly linked loci (2 cM) rarely recombine", () => {
    expect(recombFraction(L.size2, L.limb1)).toBeCloseTo(haldane(2), 2);
  });
  it("loci 60 cM apart follow Haldane's map function", () => {
    expect(recombFraction(L.size1, L.metab1)).toBeCloseTo(haldane(60), 1);
  });
  it("loci on different chromosomes assort independently (r = 0.5)", () => {
    expect(recombFraction(L.size1, L.vis1)).toBeCloseTo(0.5, 1);
  });
});

describe("sex chromosomes", () => {
  const { hap, allele } = testKit();
  it("XY: heterogametic males, 1:1 sex ratio, X passed father→daughters only", () => {
    const rng = new Rng(11);
    const Xm = allele({ effect: 5 });
    const mother = withKaryotype(hap(), hap(), "F", "XY");
    const father = withKaryotype(hap({ [L.vis2]: Xm }), hap(), "M", "XY");
    expect(isHeterogametic(father)).toBe(true);
    expect(isHeterogametic(mother)).toBe(false);
    let males = 0;
    const n = 6000;
    for (let i = 0; i < n; i++) {
      const kid = fertilize(makeGamete(mother, rng), makeGamete(father, rng));
      const sex = determineSex(kid, "XY", rng);
      if (sex === "M") {
        males++;
        expect(kid.a[L.vis2]).not.toBe(Xm);
      } else expect(kid.b[L.vis2]).toBe(Xm);
    }
    expect(males / n).toBeCloseTo(0.5, 1);
  });
  it("ZW: heterogametic females", () => {
    const rng = new Rng(12);
    const hen = withKaryotype(hap(), hap(), "F", "ZW");
    const cock = withKaryotype(hap(), hap(), "M", "ZW");
    expect(isHeterogametic(hen)).toBe(true);
    let females = 0;
    for (let i = 0; i < 4000; i++) {
      if (determineSex(fertilize(makeGamete(hen, rng), makeGamete(cock, rng)), "ZW", rng) === "F") females++;
    }
    expect(females / 4000).toBeCloseTo(0.5, 1);
  });
  it("TSD: crocodile males only around 32 °C", () => {
    expect(tsdMaleProbability(32)).toBeCloseTo(1);
    expect(tsdMaleProbability(28)).toBeLessThan(0.05);
    expect(tsdMaleProbability(35)).toBeLessThan(0.1);
  });
  it("sex-linked recessives are exposed in hemizygous males", () => {
    const lof = allele({ lof: true });
    const wt = allele();
    const carrierF = withKaryotype(hap({ [L.load4]: lof }), hap({ [L.load4]: wt }), "F", "XY");
    const male = withKaryotype(hap({ [L.load4]: lof }), hap(), "M", "XY");
    expect(loadViability(carrierF)).toBeGreaterThan(0.95);
    expect(loadViability(male)).toBeCloseTo(0.7);
  });
  it("sex chromosome does not recombine in the heterogametic sex", () => {
    expect(LOCI_BY_CHROM[SEX_CHROM].length).toBeGreaterThan(2);
  });
});

describe("population genetics", () => {
  const { hap, allele, genome } = testKit();
  const A = allele();
  const a = allele();
  const locus = L.size1;

  function population(n: number, p: number, rng: Rng): Genome[] {
    return Array.from({ length: n }, () =>
      genome(hap({ [locus]: rng.chance(p) ? A : a }), hap({ [locus]: rng.chance(p) ? A : a })),
    );
  }
  function randomMating(pop: Genome[], n: number, rng: Rng): Genome[] {
    return Array.from({ length: n }, () =>
      fertilize(makeGamete(rng.pick(pop), rng), makeGamete(rng.pick(pop), rng)),
    );
  }

  it("Hardy–Weinberg: one round of random mating gives p², 2pq, q²", () => {
    const rng = new Rng(21);
    const kids = randomMating(population(4000, 0.7, rng), 20000, rng);
    const c = [0, 0, 0];
    for (const g of kids) c[(g.a[locus] === A ? 1 : 0) + (g.b[locus] === A ? 1 : 0)]++;
    const p = alleleFrequencies(kids, locus).get(A.id)!;
    expect(chi2(c, [(1 - p) ** 2, 2 * p * (1 - p), p * p])).toBeLessThan(13.8);
    expect(Math.abs(fixationIndex(kids, locus))).toBeLessThan(0.03);
    expect(observedHeterozygosity(kids, locus)).toBeCloseTo(
      expectedHeterozygosity(alleleFrequencies(kids, locus)),
      1,
    );
  });

  it("genetic drift: Var(Δp) ≈ p(1−p)/2N (Wright–Fisher)", () => {
    const rng = new Rng(22);
    const N = 40;
    const deltas: number[] = [];
    for (let rep = 0; rep < 600; rep++) {
      const pop = population(N, 0.5, rng);
      const p0 = alleleFrequencies(pop, locus).get(A.id) ?? 0;
      const next = randomMating(pop, N, rng);
      deltas.push((alleleFrequencies(next, locus).get(A.id) ?? 0) - p0);
    }
    const mean = deltas.reduce((s, d) => s + d, 0) / deltas.length;
    const v = deltas.reduce((s, d) => s + (d - mean) ** 2, 0) / deltas.length;
    const expected = (0.5 * 0.5) / (2 * N);
    expect(v / expected).toBeGreaterThan(0.75);
    expect(v / expected).toBeLessThan(1.3);
  });

  it("inbreeding (full-sib mating) raises homozygosity and exposes recessive load", () => {
    const rng = new Rng(23);
    const { allele: mk, hap: h } = testKit();
    // Each founder carries unique alleles everywhere plus load heterozygosity.
    const founder = () => {
      const ov: Record<number, ReturnType<typeof mk>> = {};
      LOCI.forEach((l, i) => (ov[i] = mk({ lof: l.kind === "load" && rng.chance(0.5) })));
      const ov2: Record<number, ReturnType<typeof mk>> = {};
      LOCI.forEach((l, i) => (ov2[i] = mk({ lof: l.kind === "load" && rng.chance(0.5) })));
      return genome(h(ov), h(ov2));
    };
    let inbredHet = 0;
    let outbredHet = 0;
    let inbredV = 0;
    let outbredV = 0;
    const reps = 60;
    for (let r = 0; r < reps; r++) {
      let [x, y] = [founder(), founder()];
      for (let gen = 0; gen < 6; gen++) {
        const s1 = fertilize(makeGamete(x, rng), makeGamete(y, rng));
        const s2 = fertilize(makeGamete(x, rng), makeGamete(y, rng));
        [x, y] = [s1, s2];
      }
      inbredHet += heterozygosity(x);
      inbredV += loadViability(x);
      const o = fertilize(makeGamete(founder(), rng), makeGamete(founder(), rng));
      outbredHet += heterozygosity(o);
      outbredV += loadViability(o);
    }
    expect(inbredHet / reps).toBeLessThan(0.5 * (outbredHet / reps));
    expect(inbredV / reps).toBeLessThan(outbredV / reps);
  });
});

describe("mutation", () => {
  const { hap, allele, f } = testKit();
  it("mutation counts match per-locus rates", () => {
    const rng = new Rng(31);
    let n = 0;
    const reps = 4000;
    for (let i = 0; i < reps; i++) n += mutateGamete(hap(), DEFAULT_RATES, rng, f);
    const functional = LOCI.filter((l) => l.kind !== "neutral" && l.kind !== "module").length;
    const modules = LOCI.filter((l) => l.kind === "module").length;
    const neutral = LOCI.filter((l) => l.kind === "neutral").length;
    const tot =
      DEFAULT_RATES.point + DEFAULT_RATES.indel + DEFAULT_RATES.duplication + DEFAULT_RATES.regulatory;
    const expected = reps * (functional * tot + modules * tot * 0.1 + neutral * DEFAULT_RATES.neutral);
    expect(n / expected).toBeGreaterThan(0.85);
    expect(n / expected).toBeLessThan(1.15);
  });
  it("each mutation type does what it says", () => {
    const rng = new Rng(32);
    const base = allele({ effect: 0.5 });
    const i = L.size1;
    expect(mutateAllele(base, "duplication", rng, f, i).copies).toBe(2);
    expect(mutateAllele(base, "point", rng, f, i).effect).not.toBe(0.5);
    expect(mutateAllele(base, "regulatory", rng, f, i).expr).not.toBe(1);
    const indels = Array.from({ length: 300 }, () => mutateAllele(base, "indel", rng, f, i));
    const frac = indels.filter((a) => a.lof).length / 300;
    expect(frac).toBeGreaterThan(0.55);
    expect(frac).toBeLessThan(0.78);
    expect(mutateAllele(base, "point", rng, f, i).id).not.toBe(base.id);
  });
  it("is deterministic for a seed", () => {
    const g1 = hap();
    const g2 = hap();
    mutateGamete(g1, DEFAULT_RATES, new Rng(5), testKit().f);
    mutateGamete(g2, DEFAULT_RATES, new Rng(5), testKit().f);
    expect(g1.map((a) => a?.effect)).toEqual(g2.map((a) => a?.effect));
  });
});

describe("distance", () => {
  const { hap, allele, genome } = testKit();
  it("is 0 for identical genomes and 1 for disjoint ones", () => {
    const g = genome(hap(), hap());
    expect(geneticDistance(g, g)).toBe(0);
    const other = genome(
      LOCI.map(() => allele()),
      LOCI.map(() => allele()),
    );
    expect(geneticDistance(g, other)).toBe(1);
  });
  it("cross fertility falls smoothly with distance", () => {
    expect(crossFertility(0.2)).toBe(1);
    expect(crossFertility(0.95)).toBe(0);
    expect(crossFertility(0.7)).toBeGreaterThan(0);
    expect(crossFertility(0.7)).toBeLessThan(1);
  });
  it("genotypeValue reads a locus", () => {
    const up = allele({ effect: 1 });
    expect(genotypeValue(genome(hap({ [L.size1]: up }), hap({ [L.size1]: up })), L.size1)).toBeCloseTo(2);
  });
});
