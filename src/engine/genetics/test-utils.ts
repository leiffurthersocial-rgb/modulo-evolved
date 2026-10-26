import { AlleleFactory } from "./alleles";
import { LOCI } from "./layout";
import type { Allele, Genome, Haplotype } from "./types";

/** Build a uniform haplotype (one shared allele at every locus) then override specific loci. */
export function testKit() {
  const f = new AlleleFactory();
  const filler = LOCI.map(() =>
    f.make({ effect: 0, dom: 1, copies: 1, expr: 1, lof: false, origin: "test" }),
  );
  const hap = (overrides: Record<number, Allele | null> = {}): Haplotype =>
    filler.map((a, i) => (i in overrides ? overrides[i] : a));
  const allele = (p: Partial<Omit<Allele, "id">> = {}) =>
    f.make({ effect: 0, dom: 1, copies: 1, expr: 1, lof: false, origin: "test", ...p });
  const genome = (a: Haplotype, b: Haplotype): Genome => ({ a, b });
  return { f, hap, allele, genome };
}
