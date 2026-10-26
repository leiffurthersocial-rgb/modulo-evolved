import { create } from "zustand";

export type BiomeId = "temperate" | "savanna" | "tundra" | "rainforest" | "desert" | "archipelago";

export interface EnvParams {
  /** Mean annual temperature, °C. */
  temperature: number;
  /** Relative humidity, 0–1. */
  humidity: number;
  /** Primary productivity multiplier, 0–2. */
  food: number;
  /** Seasonal amplitude, 0–1. */
  seasonality: number;
  disease: boolean;
}

export const BIOMES: Record<BiomeId, { label: string; params: EnvParams }> = {
  temperate: {
    label: "Temperate",
    params: { temperature: 11, humidity: 0.65, food: 1, seasonality: 0.6, disease: true },
  },
  savanna: {
    label: "Savanna",
    params: { temperature: 26, humidity: 0.4, food: 0.8, seasonality: 0.5, disease: true },
  },
  tundra: {
    label: "Tundra",
    params: { temperature: -8, humidity: 0.5, food: 0.35, seasonality: 0.9, disease: false },
  },
  rainforest: {
    label: "Rainforest",
    params: { temperature: 27, humidity: 0.9, food: 1.7, seasonality: 0.1, disease: true },
  },
  desert: {
    label: "Desert",
    params: { temperature: 30, humidity: 0.1, food: 0.25, seasonality: 0.4, disease: false },
  },
  archipelago: {
    label: "Archipelago",
    params: { temperature: 20, humidity: 0.75, food: 1.1, seasonality: 0.3, disease: true },
  },
};

interface EnvState extends EnvParams {
  biome: BiomeId | "custom";
  applyBiome: (id: BiomeId) => void;
  set: (patch: Partial<EnvParams>) => void;
}

export const useEnv = create<EnvState>()((set) => ({
  biome: "temperate",
  ...BIOMES.temperate.params,
  applyBiome: (id) => set({ biome: id, ...BIOMES[id].params }),
  set: (patch) => set({ ...patch, biome: "custom" }),
}));
