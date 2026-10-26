"use client";

import { useEffect, useState } from "react";
import type { Phenotype } from "@/engine/anatomy/phenotype";
import type { Stats } from "@/engine/anatomy/stats";
import type { Genome, Sex } from "@/engine/genetics/types";
import type { SpeciesId } from "@/engine/species/types";
import { sim } from "@/sim/client";

export interface AgentDetail {
  id: number;
  species: SpeciesId;
  lineage: number;
  lineageName: string;
  sex: Sex;
  ageDays: number;
  generation: number;
  motherId: number;
  fatherId: number;
  offspring: number;
  energy: number;
  maxEnergy: number;
  state: string;
  culture: number;
  infected: boolean;
  gestating: boolean;
  heterozygosity: number;
  ph: Phenotype;
  st: Stats;
  genome: Genome;
  position: [number, number, number];
  temperature: number;
}

/** Polls the worker for a live agent's details. `dead` holds the cause once it is gone. */
export function useAgent(id: number | null, interval = 600) {
  const [state, setState] = useState<{ id: number | null; detail: AgentDetail | null; dead: string | null }>({
    id: null,
    detail: null,
    dead: null,
  });
  useEffect(() => {
    if (id === null) return;
    let alive = true;
    const poll = async () => {
      const d = await sim.rpc<AgentDetail | null>("getAgent", id);
      if (!alive) return;
      if (d) setState({ id, detail: d, dead: null });
      else {
        const rec = sim.deaths.find((x) => x.id === id);
        setState((s) => ({ id, detail: s.id === id ? s.detail : null, dead: rec?.cause ?? "gone" }));
      }
    };
    void poll();
    const t = setInterval(poll, interval);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id, interval]);
  return state.id === id ? { detail: state.detail, dead: state.dead } : { detail: null, dead: null };
}
