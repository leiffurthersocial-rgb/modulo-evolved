import type { SpeciesId } from "../species/types";
import type { TerrainKind } from "../world/terrain";
import { DEFAULT_ENV, type CatastropheKind, type EnvSettings } from "./types";

export interface Scenario {
  id: string;
  name: string;
  tagline: string;
  /** What to look for (shown in the scenario picker and tour). */
  lesson: string;
  terrain: TerrainKind;
  env: EnvSettings;
  counts: Partial<Record<SpeciesId, number>>;
  /** Scheduled catastrophes: [day, kind]. */
  schedule?: [number, CatastropheKind][];
  /** Suggested agent budget (small worlds need fewer). */
  maxAgents?: number;
  /** Open the Animals panel on start (hands-on scenarios). */
  handsOn?: boolean;
}

const env = (patch: Partial<EnvSettings>): EnvSettings => ({
  ...DEFAULT_ENV,
  ...patch,
  impact: { ...DEFAULT_ENV.impact, ...patch.impact },
});

export const SCENARIOS: Scenario[] = [
  {
    id: "zoo",
    name: "Breeding Zoo",
    tagline: "A fenced paddock with a pond. You feed the animals and decide who breeds.",
    lesson:
      'Set daily rations ("enough food for 10 humans"), pair animals by hand and fast-forward generations to watch traits change.',
    terrain: "zoo",
    env: env({
      temperature: 18,
      humidity: 0.6,
      food: 0,
      seasonality: 0,
      disease: false,
      uv: 0.5,
      predation: false,
      provision: { human: 10, rabbit: 16, deer: 6 },
    }),
    counts: { human: 6, rabbit: 6, deer: 4 },
    maxAgents: 300,
    handsOn: true,
  },
  {
    id: "mini",
    name: "Mini Island",
    tagline: "A small island with a handful of species. Easy on the battery.",
    lesson: "Small populations: drift is strong and every individual matters. Add or remove animals freely.",
    terrain: "mini",
    env: env({ temperature: 15, humidity: 0.7, seasonality: 0.3, uv: 0.5 }),
    counts: { rabbit: 20, deer: 10, human: 8, fox: 3, frog: 10, duck: 6, sparrow: 10, sardine: 16 },
    maxAgents: 200,
    handsOn: true,
  },
  {
    id: "temperate",
    name: "Temperate Island",
    tagline: "A European-style island: deer, boar, wolves, bears and a band of humans.",
    lesson: "Watch predator–prey cycles, herds and packs, and how seasons drive breeding and starvation.",
    terrain: "island",
    env: env({ temperature: 11, humidity: 0.65, seasonality: 0.6, uv: 0.35 }),
    counts: {
      rabbit: 50,
      deer: 50,
      boar: 30,
      bear: 3,
      human: 20,
      fox: 8,
      wolf: 6,
      frog: 30,
      sparrow: 30,
      duck: 16,
      hawk: 5,
      sardine: 60,
      pike: 8,
      shark: 3,
    },
  },
  {
    id: "savanna",
    name: "African Savanna",
    tagline: "Zebra herds, elephants, lions, crocodiles and early humans.",
    lesson:
      "Lions need large herds. Crocodile sex ratios follow nest temperature; humans out-run prey in the heat.",
    terrain: "continent",
    env: env({ temperature: 26, humidity: 0.55, food: 1.4, seasonality: 0.35, uv: 0.85 }),
    counts: {
      zebra: 110,
      elephant: 8,
      lion: 4,
      human: 20,
      crocodile: 4,
      boar: 30,
      rabbit: 30,
      sparrow: 30,
      hawk: 5,
      duck: 12,
      frog: 20,
      sardine: 40,
      pike: 6,
    },
  },
  {
    id: "archipelago",
    name: "Archipelago Speciation",
    tagline: "Five islands separated by sea. Populations drift apart.",
    lesson:
      "Geographic isolation + drift + mutation → allopatric speciation. Check the Phylogeny view as lineages split.",
    terrain: "archipelago",
    env: env({ temperature: 16, humidity: 0.7, seasonality: 0.4, mutationRate: 6 }),
    counts: {
      rabbit: 70,
      deer: 30,
      boar: 24,
      frog: 40,
      sparrow: 30,
      duck: 14,
      hawk: 4,
      fox: 6,
      sardine: 60,
      pike: 6,
      shark: 3,
    },
  },
  {
    id: "iceage",
    name: "Ice Age",
    tagline: "A cold steppe plunges into a glacial period after two months.",
    lesson:
      "Selection for fat, fur and cold tolerance; Bergmann's rule; bottlenecks and extinctions. Not everyone makes it.",
    terrain: "continent",
    env: env({ temperature: 9, humidity: 0.55, food: 1.2, seasonality: 0.7, uv: 0.2 }),
    counts: {
      deer: 50,
      wolf: 8,
      bear: 5,
      human: 20,
      rabbit: 50,
      fox: 8,
      duck: 12,
      sardine: 50,
      pike: 6,
      hawk: 4,
    },
    schedule: [[60, "iceAge"]],
  },
  {
    id: "overkill",
    name: "Human Arrival",
    tagline: "Hunters with tools arrive among naive megafauna.",
    lesson: "The overkill hypothesis: large, slow-breeding species vanish first. Try a protected area.",
    terrain: "continent",
    env: env({
      temperature: 22,
      humidity: 0.55,
      seasonality: 0.4,
      uv: 0.7,
      impact: { enabled: true, hunting: 0.6, clearing: 0.2, farming: 0.2, herding: true, protectedArea: 0 },
    }),
    counts: {
      elephant: 10,
      zebra: 60,
      deer: 30,
      boar: 24,
      lion: 3,
      human: 30,
      rabbit: 30,
      sparrow: 20,
      duck: 10,
      frog: 20,
      sardine: 30,
      pike: 6,
    },
  },
  {
    id: "hardy",
    name: "Hardy–Weinberg Lab",
    tagline: "One large rabbit population: no predators, no mutation, random mating.",
    lesson: "Allele frequencies stay put (apart from drift). Compare genotype frequencies to p², 2pq, q².",
    terrain: "island",
    env: env({ temperature: 15, humidity: 0.7, seasonality: 0, disease: false, mutationRate: 0, food: 1.5 }),
    counts: { rabbit: 220 },
  },
  {
    id: "founder",
    name: "Founder Effect",
    tagline: "Six rabbits colonise an empty island.",
    lesson:
      "A tiny founding population carries a random subset of alleles: low diversity, strong drift, exposed recessive load.",
    terrain: "island",
    env: env({ temperature: 15, humidity: 0.7, seasonality: 0.2, disease: false, food: 1.4 }),
    counts: { rabbit: 6, hawk: 2 },
  },
];

export const DEFAULT_SCENARIO = SCENARIOS.find((s) => s.id === "temperate")!;

export function scenarioById(id: string) {
  return SCENARIOS.find((s) => s.id === id) ?? DEFAULT_SCENARIO;
}
