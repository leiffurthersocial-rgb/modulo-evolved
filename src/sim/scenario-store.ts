import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ScenarioState {
  scenarioId: string;
  seed: number;
  /** Agent budget: 600 suits iPad; desktops can go higher. */
  maxAgents: number;
  set: (p: Partial<Pick<ScenarioState, "scenarioId" | "seed" | "maxAgents">>) => void;
}

export const useScenario = create<ScenarioState>()(
  persist(
    (set) => ({
      scenarioId: "temperate",
      seed: 0x5eed,
      maxAgents: 600,
      set: (p) => set(p),
    }),
    { name: "modulo-scenario", version: 1, skipHydration: true },
  ),
);
