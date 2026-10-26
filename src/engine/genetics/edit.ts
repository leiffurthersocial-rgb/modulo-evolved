import type { Rng } from "../rng/rng";
import { editorFactory, type AlleleFactory } from "./alleles";
import { LOCI } from "./layout";
import { mutateAllele, type MutationKind } from "./mutation";
import type { Allele, Genome } from "./types";

export type Strand = "a" | "b";

let factory: AlleleFactory | null = null;
const f = () => (factory ??= editorFactory());

/** Replace the allele on one strand with a modified copy (new identity: a new variant). */
export function editAllele(
  g: Genome,
  locus: number,
  strand: Strand,
  changes: Partial<Omit<Allele, "id">>,
): Genome {
  const al = g[strand][locus];
  if (!al) return g;
  const next = f().derive(al, { ...changes, origin: "editor" });
  return setAllele(g, locus, strand, next);
}

export function setAllele(g: Genome, locus: number, strand: Strand, al: Allele | null): Genome {
  const arr = [...g[strand]];
  arr[locus] = al;
  return strand === "a" ? { a: arr, b: g.b } : { a: g.a, b: arr };
}

/** Apply a real mutation operator (same as in the simulation) to one allele. */
export function mutateAt(g: Genome, locus: number, strand: Strand, kind: MutationKind, rng: Rng): Genome {
  const al = g[strand][locus];
  if (!al) return g;
  return setAllele(g, locus, strand, { ...mutateAllele(al, kind, rng, f(), locus), origin: "editor" });
}

/** Make a locus homozygous for the allele on `from`. */
export function makeHomozygous(g: Genome, locus: number, from: Strand): Genome {
  const al = g[from][locus];
  const other: Strand = from === "a" ? "b" : "a";
  if (!al || g[other][locus] === null) return g;
  return setAllele(g, locus, other, al);
}

export function swapStrands(g: Genome, locus: number): Genome {
  if (!g.a[locus] || !g.b[locus]) return g;
  const a = [...g.a];
  const b = [...g.b];
  [a[locus], b[locus]] = [b[locus], a[locus]];
  return { a, b };
}

/** Count of loci that differ from a reference genome (by allele identity). */
export function diffCount(g: Genome, ref: Genome) {
  let n = 0;
  for (let i = 0; i < LOCI.length; i++) if (g.a[i]?.id !== ref.a[i]?.id || g.b[i]?.id !== ref.b[i]?.id) n++;
  return n;
}
