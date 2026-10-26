import type { SpeciesId } from "@/engine/species/types";

/** How a head is sculpted (chosen by the species that donated the head/jaw module). */
export type Muzzle =
  | "horse"
  | "deer"
  | "dog"
  | "cat"
  | "bear"
  | "pig"
  | "rabbit"
  | "elephant"
  | "human"
  | "croc"
  | "frog"
  | "bird"
  | "fish";

/**
 * Species-typical markings and sculpting cues that aren't part of the genetic model: the look of
 * a real animal (countershaded bellies, a fox's black socks and white tail tip, a deer's rump
 * patch). Each cue is taken from the species that donated the relevant body part, so chimeras
 * inherit them with the part.
 */
export interface Look {
  muzzle: Muzzle;
  /** Countershading: belly colour and strength. */
  belly?: [string, number];
  /** Shoulder hump/ridge (bear, boar). */
  hump?: number;
  hooves?: boolean;
  /** Lower-leg colour. */
  socks?: string;
  earTip?: string;
  tailTip?: string;
  /** Pale rump patch. */
  rump?: string;
  /** Crest/mane along the neck. */
  crest?: string;
  nose?: string;
  /** Muzzle colour (blended with the coat). */
  muzzleColor?: [string, number];
  /** Spotted rather than striped when the pattern gene is expressed. */
  spots?: boolean;
  /** Dorsal fin position along the body (fish). */
  dorsalZ?: number;
}

export const LOOKS: Record<SpeciesId, Look> = {
  rabbit: { muzzle: "rabbit", belly: ["#efe7da", 0.75], tailTip: "#f4f1ea", nose: "#b98585" },
  deer: {
    muzzle: "deer",
    belly: ["#e6d6b8", 0.6],
    hooves: true,
    rump: "#efe6d2",
    nose: "#231b17",
    muzzleColor: ["#d9c7a8", 0.35],
  },
  zebra: { muzzle: "horse", hooves: true, crest: "#141414", nose: "#1b1b1b", tailTip: "#141414" },
  elephant: { muzzle: "elephant", nose: "#4d4946" },
  boar: { muzzle: "pig", hooves: true, hump: 0.55, crest: "#221b17", nose: "#4a3d39" },
  bear: { muzzle: "bear", hump: 0.6, nose: "#17110e", muzzleColor: ["#b48c62", 0.45] },
  human: { muzzle: "human" },
  fox: {
    muzzle: "dog",
    belly: ["#f3efe6", 0.85],
    socks: "#2a1a12",
    earTip: "#2a1a12",
    tailTip: "#f3efe6",
    nose: "#1b1410",
    muzzleColor: ["#f3efe6", 0.5],
  },
  wolf: {
    muzzle: "dog",
    belly: ["#dcd7cc", 0.65],
    tailTip: "#2a2622",
    nose: "#141210",
    muzzleColor: ["#d8d2c6", 0.45],
  },
  lion: {
    muzzle: "cat",
    belly: ["#ecdcb8", 0.5],
    tailTip: "#2b1d12",
    crest: "#5b3a1e",
    nose: "#3a2621",
    muzzleColor: ["#efe2c4", 0.4],
  },
  crocodile: { muzzle: "croc", belly: ["#cfc68f", 0.75] },
  frog: { muzzle: "frog", belly: ["#e6dfac", 0.7] },
  sparrow: { muzzle: "bird", belly: ["#ddd2bd", 0.75] },
  duck: { muzzle: "bird", belly: ["#cfc6b4", 0.45] },
  hawk: { muzzle: "bird", belly: ["#efe4cf", 0.8], tailTip: "#b4532c" },
  sardine: { muzzle: "fish", belly: ["#e9eff3", 0.95], dorsalZ: 0.02 },
  pike: { muzzle: "fish", belly: ["#e6dfba", 0.75], spots: true, dorsalZ: -0.32 },
  shark: { muzzle: "fish", belly: ["#eef1f2", 0.9], dorsalZ: 0.08 },
};
