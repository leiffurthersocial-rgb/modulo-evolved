import { create } from "zustand";
import { DEFAULT_ENV, normalizeEnv, type EnvSettings, type HumanImpact } from "@/engine/sim/types";
import type { SpeciesId } from "@/engine/species/types";

export type BiomeId = "temperate" | "savanna" | "tundra" | "rainforest" | "desert" | "steppe";

type Climate = Pick<EnvSettings, "temperature" | "humidity" | "food" | "seasonality" | "uv">;

export const BIOMES: Record<BiomeId, { label: string; params: Climate }> = {
  temperate: {
    label: "Temperate",
    params: { temperature: 11, humidity: 0.65, food: 1, seasonality: 0.6, uv: 0.35 },
  },
  savanna: {
    label: "Savanna",
    params: { temperature: 26, humidity: 0.45, food: 0.9, seasonality: 0.35, uv: 0.85 },
  },
  tundra: {
    label: "Tundra",
    params: { temperature: -6, humidity: 0.5, food: 0.45, seasonality: 0.9, uv: 0.15 },
  },
  rainforest: {
    label: "Rainforest",
    params: { temperature: 27, humidity: 0.92, food: 1.6, seasonality: 0.1, uv: 0.9 },
  },
  desert: {
    label: "Desert",
    params: { temperature: 30, humidity: 0.12, food: 0.3, seasonality: 0.4, uv: 1 },
  },
  steppe: {
    label: "Steppe",
    params: { temperature: 6, humidity: 0.35, food: 0.7, seasonality: 0.85, uv: 0.4 },
  },
};

interface EnvState extends EnvSettings {
  biome: BiomeId | "custom";
  applyBiome: (id: BiomeId) => void;
  set: (patch: Partial<EnvSettings>) => void;
  setImpact: (patch: Partial<HumanImpact>) => void;
  /** Set (or clear with null) a user population cap. */
  setCap: (id: SpeciesId, cap: number | null) => void;
  /** Keeper ration for a species, in "enough food for N adults" (0 = none). */
  setProvision: (id: SpeciesId, n: number) => void;
  load: (env: EnvSettings, biome?: BiomeId | "custom") => void;
  settings: () => EnvSettings;
}

export const useEnv = create<EnvState>()((set, get) => ({
  ...DEFAULT_ENV,
  biome: "temperate",
  applyBiome: (id) => set({ biome: id, ...BIOMES[id].params }),
  set: (patch) => set({ ...patch, biome: "custom" }),
  setImpact: (patch) => set({ impact: { ...get().impact, ...patch } }),
  setCap: (id, cap) => {
    const caps = { ...get().caps };
    if (cap === null) delete caps[id];
    else caps[id] = cap;
    set({ caps });
  },
  setProvision: (id, n) => {
    const provision = { ...get().provision };
    if (n <= 0) delete provision[id];
    else provision[id] = n;
    set({ provision });
  },
  load: (env, biome = "custom") => set({ ...normalizeEnv(env), biome }),
  settings: () => {
    const s = get();
    return {
      temperature: s.temperature,
      humidity: s.humidity,
      food: s.food,
      seasonality: s.seasonality,
      disease: s.disease,
      uv: s.uv,
      mutationRate: s.mutationRate,
      impact: { ...s.impact },
      predation: s.predation,
      provision: { ...s.provision },
      caps: { ...s.caps },
    };
  },
}));
