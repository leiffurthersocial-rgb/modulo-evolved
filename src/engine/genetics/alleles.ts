import type { Allele } from "./types";

/**
 * Hands out allele ids. The simulation uses a sequential, serialisable counter so runs
 * are reproducible; editor-made alleles use random ids from a disjoint range.
 */
export class AlleleFactory {
  constructor(public nextId = 1) {}

  make(p: Omit<Allele, "id">): Allele {
    return Object.freeze({ ...p, id: this.nextId++ });
  }

  /** Copy an allele with changes, giving it a new identity (a new mutation). */
  derive(from: Allele, changes: Partial<Omit<Allele, "id">>): Allele {
    return this.make({ ...from, ...changes });
  }
}

const EDITOR_ID_BASE = 2 ** 40;

/** Allele factory for hand-edited genomes; ids can't collide with simulation ids. */
export function editorFactory(): AlleleFactory {
  return new AlleleFactory(EDITOR_ID_BASE + Math.floor(Math.random() * 2 ** 40));
}
