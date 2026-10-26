import type { RGB } from "@/engine/anatomy/color";
import type { Slot } from "@/engine/genetics/types";
import type { SeriesPoint } from "@/engine/sim/recorder";
import type {
  CatastropheKind,
  DeathCause,
  EnvSettings,
  Lineage,
  WorldConfig,
  WorldEvent,
} from "@/engine/sim/types";
import type { SpeciesId } from "@/engine/species/types";
import type { TerrainKind } from "@/engine/world/terrain";

/** Floats per agent in a frame buffer. */
export const STRIDE = 10;
export const F = {
  id: 0,
  x: 1,
  y: 2,
  z: 3,
  heading: 4,
  scale: 5,
  anim: 6,
  flags: 7,
  state: 8,
  lineage: 9,
} as const;
export const FLAG = {
  infected: 1,
  flying: 2,
  swimming: 4,
  male: 8,
  eating: 16,
  juvenile: 32,
  gestating: 64,
} as const;

/** Static appearance of one individual (sent once when it appears). */
export interface BodyDesc {
  id: number;
  species: SpeciesId;
  sex: "F" | "M";
  lineage: number;
  modules: Record<Slot, SpeciesId | null>;
  color: RGB;
  color2: RGB;
  pattern: number;
  ornament: number;
  limb: number;
  fat: number;
  lengthM: number;
  canFly: boolean;
  aquatic: boolean;
}

export interface FrameMsg {
  type: "frame";
  day: number;
  count: number;
  buf: Float32Array;
  born: BodyDesc[];
  died: { id: number; cause: DeathCause; x: number; y: number; z: number; species: SpeciesId }[];
  /** Achieved simulation speed (days per real second). */
  rate: number;
}

export interface StatsMsg {
  type: "stats";
  day: number;
  temperature: number;
  season: string;
  seasonWarmth: number;
  speciesCounts: Partial<Record<SpeciesId, number>>;
  lineageCounts: Record<number, number>;
  lineages: Lineage[];
  totals: Record<string, number>;
  deathCauses: Record<DeathCause, number>;
  notices: { day: number; text: string; kind: string }[];
  events: WorldEvent[];
  series: SeriesPoint[];
  seriesReset: boolean;
  agentCount: number;
  /** Mean generation of living animals. */
  meanGeneration: number;
  /** Keeper food in store, as a fraction of each provisioned species' daily ration. */
  rations: Partial<Record<SpeciesId, number>>;
  fastForward: FastForwardStatus | null;
}

export interface FastForwardStatus {
  species: SpeciesId | null;
  from: number;
  target: number;
  current: number;
  days: number;
}

export interface VegMsg {
  type: "veg";
  data: Float32Array;
}

export interface InitInfo {
  seed: number;
  terrain: TerrainKind;
  maxAgents: number;
  scenario: string;
}

export interface ReadyMsg {
  type: "ready";
  info: InitInfo;
  bodies: BodyDesc[];
}

export type FromWorker =
  FrameMsg | StatsMsg | VegMsg | ReadyMsg | { type: "rpc"; id: number; result?: unknown; error?: string };

export type ToWorker =
  | { type: "init"; config: Partial<WorldConfig>; scenario: string; schedule?: [number, CatastropheKind][] }
  | { type: "setRunning"; running: boolean }
  | { type: "setSpeed"; daysPerSec: number }
  | { type: "step"; days: number }
  | { type: "setEnv"; env: EnvSettings }
  | { type: "fastForward"; generations: number; species: SpeciesId | null }
  | { type: "cancelFastForward" }
  | { type: "setLowPower"; low: boolean }
  | { type: "trigger"; kind: CatastropheKind; x?: number; z?: number }
  | { type: "rpc"; id: number; method: string; args: unknown[] };
