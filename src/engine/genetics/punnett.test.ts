import { describe, expect, it } from "vitest";
import { LOCUS_INDEX as L } from "./layout";
import { gameteClasses, haldane, punnett } from "./punnett";
import { withKaryotype } from "./meiosis";
import { testKit } from "./test-utils";
import { editAllele, makeHomozygous } from "./edit";

describe("Punnett squares", () => {
  const { hap, allele, genome } = testKit();
  const B = allele({ effect: 1, dom: 4 });
  const b = allele({ effect: -1, dom: 1 });
  const E = allele({ effect: 1, dom: 4 });
  const e = allele({ effect: -1, dom: 1 });

  it("dihybrid BbEe × BbEe yields exactly 9:3:4", () => {
    const P = genome(hap({ [L.colB]: B, [L.colE]: E }), hap({ [L.colB]: b, [L.colE]: e }));
    const sq = punnett(P, P, [L.colB, L.colE]);
    const by = Object.fromEntries(sq.classes.map((c) => [c.label, c.p]));
    expect(by.black).toBeCloseTo(9 / 16);
    expect(by.brown).toBeCloseTo(3 / 16);
    expect(by.red).toBeCloseTo(4 / 16);
    expect(sq.eggs).toHaveLength(4);
  });

  it("linked loci produce mostly parental gametes", () => {
    const A1 = allele();
    const A2 = allele();
    const P = genome(hap({ [L.size2]: A1, [L.limb1]: A2 }), hap());
    const g = gameteClasses(P, [L.size2, L.limb1]);
    const parental = g.find((c) => c.alleles[0] === A1 && c.alleles[1] === A2)!;
    expect(parental.p).toBeCloseTo((1 - haldane(2)) / 2);
  });

  it("X-linked cross: father passes X to daughters, Y to sons", () => {
    const Xm = allele({ effect: 2 });
    const father = withKaryotype(hap({ [L.vis2]: Xm }), hap(), "M", "XY");
    const g = gameteClasses(father, [L.vis2]);
    expect(g).toHaveLength(2);
    expect(g.some((c) => c.alleles[0] === null)).toBe(true);
  });
});

describe("genome editing", () => {
  const { hap, allele, genome } = testKit();
  it("edits create new alleles without mutating the original", () => {
    const g = genome(hap({ [L.size1]: allele({ effect: 0.1 }) }), hap());
    const g2 = editAllele(g, L.size1, "a", { effect: 2 });
    expect(g.a[L.size1]!.effect).toBe(0.1);
    expect(g2.a[L.size1]!.effect).toBe(2);
    expect(g2.a[L.size1]!.id).not.toBe(g.a[L.size1]!.id);
    const h = makeHomozygous(g2, L.size1, "a");
    expect(h.b[L.size1]).toBe(h.a[L.size1]);
  });
});
