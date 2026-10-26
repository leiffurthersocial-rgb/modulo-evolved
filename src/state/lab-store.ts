import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Genome, Sex } from "@/engine/genetics/types";
import type { SpeciesId } from "@/engine/species/types";

/** A genome kept in the lab library ("lines"). */
export interface LabGenome {
  id: string;
  name: string;
  species: SpeciesId;
  sex: Sex;
  genome: Genome;
  createdAt: number;
  /** Library ids of parents (Cross Lab) for lineage history. */
  parents?: [string, string];
  /** World agent this was sampled from. */
  sourceAgent?: number;
  kind: "wild" | "edited" | "cross" | "chimera";
}

interface LabState {
  library: LabGenome[];
  editor: { current: LabGenome | null; past: LabGenome[]; future: LabGenome[] };
  cross: { a: LabGenome | null; b: LabGenome | null };
  splice: { base: LabGenome | null };
  save: (g: LabGenome) => void;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  edit: (g: LabGenome | null) => void;
  /**
   * Apply a change to the editor genome, recording undo history. Consecutive commits with the
   * same `mergeKey` (e.g. one slider drag) collapse into a single undo step.
   */
  commit: (g: LabGenome, mergeKey?: string) => void;
  lastMerge: string | null;
  undo: () => void;
  redo: () => void;
  setCross: (slot: "a" | "b", g: LabGenome | null) => void;
  setSpliceBase: (g: LabGenome | null) => void;
}

export const newId = () => Math.random().toString(36).slice(2, 10);

export const useLab = create<LabState>()(
  persist(
    (set, get) => ({
      library: [],
      editor: { current: null, past: [], future: [] },
      cross: { a: null, b: null },
      splice: { base: null },
      save: (g) => set({ library: [g, ...get().library.filter((x) => x.id !== g.id)].slice(0, 200) }),
      remove: (id) => set({ library: get().library.filter((x) => x.id !== id) }),
      rename: (id, name) => set({ library: get().library.map((x) => (x.id === id ? { ...x, name } : x)) }),
      edit: (g) => set({ editor: { current: g, past: [], future: [] }, lastMerge: null }),
      lastMerge: null,
      commit: (g, mergeKey) => {
        const e = get().editor;
        if (mergeKey && mergeKey === get().lastMerge) {
          set({ editor: { ...e, current: g, future: [] } });
          return;
        }
        set({
          editor: { current: g, past: e.current ? [...e.past, e.current].slice(-100) : e.past, future: [] },
          lastMerge: mergeKey ?? null,
        });
      },
      undo: () => {
        const e = get().editor;
        if (!e.past.length || !e.current) return;
        set({
          editor: {
            current: e.past[e.past.length - 1],
            past: e.past.slice(0, -1),
            future: [e.current, ...e.future],
          },
          lastMerge: null,
        });
      },
      redo: () => {
        const e = get().editor;
        if (!e.future.length || !e.current) return;
        set({
          editor: { current: e.future[0], past: [...e.past, e.current], future: e.future.slice(1) },
          lastMerge: null,
        });
      },
      setCross: (slot, g) => set({ cross: { ...get().cross, [slot]: g } }),
      setSpliceBase: (g) => set({ splice: { base: g } }),
    }),
    {
      name: "modulo-lab",
      version: 1,
      skipHydration: true,
      partialize: (s) => ({
        library: s.library,
        cross: s.cross,
        splice: s.splice,
        editor: { current: s.editor.current, past: [], future: [] },
      }),
    },
  ),
);
