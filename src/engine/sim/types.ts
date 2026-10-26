import type { Genome, Sex } from "../genetics/types";
import type { Phenotype } from "../anatomy/phenotype";
import type { Stats } from "../anatomy/stats";
import type { SpeciesId } from "../species/types";
import type { TerrainKind } from "../world/terrain";

export interface HumanImpact {
  enabled: boolean;
  /** 0..1 hunting pressure on medium/large animals. */
  hunting: number;
  /** 0..1 fraction of vegetation capacity cleared outside protected areas. */
  clearing: number;
  /** 0..1 agriculture: extra food for humans, less wild habitat. */
  farming: number;
  /** Pastoralism: milk is available to lactase-persistent humans. */
  herding: boolean;
  /** 0..1 radius of a central protected area (fraction of the world). */
  protectedArea: number;
}

export interface EnvSettings {
  temperature: number;
  humidity: number;
  food: number;
  seasonality: number;
  disease: boolean;
  /** 0..1 UV intensity: drives selection on human skin pigmentation. */
  uv: number;
  /** Multiplier on all mutation rates. */
  mutationRate: number;
  impact: HumanImpact;
}

export const DEFAULT_ENV: EnvSettings = {
  temperature: 14,
  humidity: 0.65,
  food: 1,
  seasonality: 0.5,
  disease: true,
  uv: 0.5,
  mutationRate: 1,
  impact: { enabled: false, hunting: 0.3, clearing: 0.3, farming: 0.3, herding: false, protectedArea: 0.25 },
};

export type CatastropheKind = "drought" | "iceAge" | "meteor" | "plague";

export interface WorldEvent {
  kind: CatastropheKind;
  start: number;
  end: number;
  x?: number;
  z?: number;
}

export type AgentState = "wander" | "forage" | "flee" | "hunt" | "mate" | "rest" | "eat";
export const STATE_CODES: Record<AgentState, number> = {
  wander: 0,
  forage: 1,
  flee: 2,
  hunt: 3,
  mate: 4,
  rest: 5,
  eat: 6,
};

export type DeathCause =
  | "predation"
  | "starvation"
  | "age"
  | "disease"
  | "cold"
  | "heat"
  | "uv"
  | "hunted"
  | "catastrophe"
  | "culled";

export interface Agent {
  id: number;
  species: SpeciesId;
  lineage: number;
  genome: Genome;
  sex: Sex;
  ph: Phenotype;
  st: Stats;
  generation: number;
  motherId: number;
  fatherId: number;
  birthDay: number;
  offspring: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  /** Preferred altitude above ground for flyers. */
  altitude: number;
  flying: boolean;
  energy: number;
  maxEnergy: number;
  /** 0..1 sprint stamina; sweating animals recover it faster. */
  stamina: number;
  state: AgentState;
  targetId: number;
  /** Carcass being scavenged (0 = none). */
  carcass: number;
  /** Time (days) spent in the current chase. */
  chase: number;
  thinkAt: number;
  lastThink: number;
  wanderAngle: number;
  gestation: { until: number; father: Genome; fatherId: number; fatherLineage: number } | null;
  breedCooldownUntil: number;
  infected: number;
  immuneUntil: number;
  /** Human cumulative culture (tool/foraging know-how), 0..1. */
  culture: number;
  anim: number;
  /** Set while the agent is being removed. */
  dead?: DeathCause;
}

export interface Lineage {
  id: number;
  name: string;
  species: SpeciesId;
  parent: number | null;
  bornDay: number;
  extinctDay: number | null;
  color: string;
  /** Pending split candidate streak (internal). */
  splitStreak?: number;
}

export interface WorldConfig {
  seed: number;
  terrain: TerrainKind;
  maxAgents: number;
  /** Initial counts per species (missing = roster default). */
  counts: Partial<Record<SpeciesId, number>>;
  env: EnvSettings;
  /** Construct an empty world (used when restoring a save). */
  skipPopulate?: boolean;
}

export const DEFAULT_CONFIG: WorldConfig = {
  seed: 0x5eed,
  terrain: "island",
  maxAgents: 600,
  counts: {},
  env: DEFAULT_ENV,
};
