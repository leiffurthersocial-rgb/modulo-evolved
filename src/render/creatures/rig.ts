import * as THREE from "three";
import type { RGB } from "@/engine/anatomy/color";
import type { Slot } from "@/engine/genetics/types";
import { SPECIES } from "@/engine/species/roster";
import type { LimbKind, PartSpecs, SpeciesId } from "@/engine/species/types";
import { GEO, type GeoId } from "./geometry";

/**
 * Procedural rig: turns a body description (base species + expressed modules) into a list
 * of parametric parts. Parts attach to sockets on the torso, and legs are always sized to
 * reach the ground, so any chimera assembles coherently.
 *
 * Body space: +z forward, +y up, origin on the ground under the torso; 1 unit = torso length.
 */
export type Anim =
  | "none"
  | "legA"
  | "legB"
  | "hop"
  | "armA"
  | "armB"
  | "wingL"
  | "wingR"
  | "tail"
  | "fishTail"
  | "trunk"
  | "earFlap"
  | "fin";

export interface RigPart {
  geo: GeoId;
  /** 0: always drawn, 1: medium distance, 2: close-up only. */
  lod: 0 | 1 | 2;
  color: RGB;
  color2: RGB;
  pattern: number;
  /** Joint transform: T(pivot) · R(base). */
  pre: THREE.Matrix4;
  /** Alternative joint transform when folded/tucked (wings on the ground, bird legs in flight). */
  preAlt?: THREE.Matrix4;
  /** Applied after the animated rotation: T(offset) · S(scale). */
  post: THREE.Matrix4;
  /** pre · post, for unanimated parts. */
  local: THREE.Matrix4;
  anim: Anim;
  axis: 0 | 1 | 2;
  amp: number;
  phase: number;
}

export interface RigInput {
  species: SpeciesId;
  sex: "F" | "M";
  modules: Record<Slot, SpeciesId | null>;
  color: RGB;
  color2: RGB;
  pattern: number;
  ornament: number;
  limb: number;
  fat: number;
}

type V3 = [number, number, number];

const UP = new THREE.Vector3(0, 1, 0);
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

function mat(pos: V3, quat: THREE.Quaternion, scale: V3 = [1, 1, 1]) {
  return new THREE.Matrix4().compose(new THREE.Vector3(...pos), quat.clone(), new THREE.Vector3(...scale));
}
function eulerQ(x = 0, y = 0, z = 0) {
  return new THREE.Quaternion().setFromEuler(tmpE.set(x, y, z, "XYZ"));
}
const ID_Q = new THREE.Quaternion();

const darker = (c: RGB, k = 0.55): RGB => [c[0] * k, c[1] * k, c[2] * k];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const EYE: RGB = hex("#14110f");
const IVORY: RGB = hex("#efe6cf");
const HORN: RGB = hex("#cdb894");
const BEAK: RGB = hex("#5a4632");
const BILL: RGB = hex("#e2b13c");
const HOOK: RGB = hex("#e7c64a");
const WEB: RGB = hex("#e88a2c");
const TALON: RGB = hex("#4a4038");
const BIRDFOOT: RGB = hex("#b88a70");

export function buildRig(b: RigInput): RigPart[] {
  const sp = SPECIES[b.species];
  const torso = sp.parts.torso;
  const P = <S extends Slot>(slot: S): { spec: NonNullable<PartSpecs[S]>; donor: SpeciesId } | null => {
    const donor = b.modules[slot];
    if (!donor) return null;
    const spec = SPECIES[donor].parts[slot];
    return spec ? { spec: spec as NonNullable<PartSpecs[S]>, donor } : null;
  };
  const parts: RigPart[] = [];
  const body = b.color;
  const body2 = b.color2;
  const pat = b.pattern;

  const add = (
    geo: GeoId,
    o: {
      pivot: V3;
      rot?: THREE.Quaternion;
      rotAlt?: THREE.Quaternion;
      offset?: V3;
      scale: V3;
      color?: RGB;
      color2?: RGB;
      pattern?: number;
      lod?: 0 | 1 | 2;
      anim?: Anim;
      axis?: 0 | 1 | 2;
      amp?: number;
      phase?: number;
    },
  ) => {
    const pre = mat(o.pivot, o.rot ?? ID_Q);
    const post = mat(o.offset ?? [0, 0, 0], ID_Q, o.scale);
    parts.push({
      geo,
      lod: o.lod ?? 1,
      color: o.color ?? body,
      color2: o.color2 ?? body2,
      pattern: o.pattern ?? 0,
      pre,
      preAlt: o.rotAlt ? mat(o.pivot, o.rotAlt) : undefined,
      post,
      local: pre.clone().multiply(post),
      anim: o.anim ?? "none",
      axis: o.axis ?? 0,
      amp: o.amp ?? 0,
      phase: o.phase ?? 0,
    });
  };

  /** Cylinder/cone spanning two points (base at `from`). */
  const segment = (geo: GeoId, from: V3, to: V3, r: number, o: Partial<Parameters<typeof add>[1]> = {}) => {
    const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    const len = dir.length();
    if (len < 1e-4) return;
    tmpQ.setFromUnitVectors(UP, dir.normalize());
    add(geo, { pivot: from, rot: tmpQ.clone(), scale: [r, len, r], ...o });
  };

  // ------------------------------------------------------------ torso & stance
  const fore = P("forelimbs");
  const hind = P("hindlimbs");
  const limbK = Math.max(0.6, Math.min(1.5, b.limb));
  const fatK = 1 + 0.35 * (b.fat - 0.35);
  const kind = torso.kind;
  const biped = kind === "biped";
  const w = torso.w * (biped ? 1 : fatK);
  const hh = (torso.h / 2) * (biped ? 1 : fatK);

  const stanceHeight = (l: { spec: { kind: LimbKind; len: number } } | null) => {
    if (!l || l.spec.kind === "none") return 0;
    const len = l.spec.len * limbK;
    switch (l.spec.kind) {
      case "sprawling":
        return len * 0.45;
      case "hopping":
        return len * 0.42;
      case "grasping":
        return biped ? 0 : len * 0.9;
      default:
        return len;
    }
  };

  let center: V3;
  let pitch = 0;
  let hipY = 0;
  if (biped) {
    hipY = Math.max(0.2, stanceHeight(hind) || 0.25);
    center = [0, hipY + 0.17, 0];
  } else if (kind === "fish") {
    center = [0, 0, 0];
  } else if (kind === "frog") {
    const hy = Math.max(0.05, stanceHeight(hind) * 0.5);
    center = [0, hh + hy, 0];
    pitch = -0.35;
  } else if (kind === "bird") {
    const legH = stanceHeight(hind);
    center = [0, legH * 0.85 + hh, 0];
    pitch = -0.18;
  } else {
    let hindH = stanceHeight(hind);
    let foreH = stanceHeight(fore);
    if (!hindH && !foreH) {
      hindH = 0;
      foreH = 0;
    } else if (!foreH) foreH = Math.max(hh * 0.4, hindH * 0.55);
    else if (!hindH) hindH = Math.max(hh * 0.4, foreH * 0.55);
    const hip = hindH + hh * 0.55;
    const shoulder = foreH + hh * 0.55;
    center = [0, Math.max(hh, (hip + shoulder) / 2), 0];
    pitch = Math.atan2(hip - shoulder, 0.95);
  }
  const torsoQ = eulerQ(pitch, 0, 0);
  const onTorso = (lx: number, ly: number, lz: number): V3 => {
    const v = new THREE.Vector3(
      lx * (biped ? 0.15 : w / 2),
      ly * (biped ? 0.19 : hh),
      lz * (biped ? 0.1 : 0.5),
    );
    v.applyQuaternion(torsoQ);
    return [center[0] + v.x, center[1] + v.y, center[2] + v.z];
  };

  if (biped) {
    add(GEO.sphere, {
      pivot: center,
      scale: [0.15 * (torso.w / 0.3) * fatK, 0.19, 0.1 * fatK],
      pattern: pat,
      lod: 0,
    });
    // Pelvis wrapped in a simple garment (secondary palette colour)
    add(GEO.sphere, {
      pivot: [0, hipY + 0.02, 0],
      scale: [0.135 * fatK, 0.08, 0.095 * fatK],
      color: body2,
      lod: 1,
    });
  } else {
    add(GEO.sphere, { pivot: center, rot: torsoQ, scale: [w / 2, hh, 0.5], pattern: pat, lod: 0 });
  }

  // ------------------------------------------------------------ head
  const head = P("head");
  const hs = head?.spec.size ?? 0.25;
  let headC: V3;
  let neckBase: V3 | null = null;
  if (biped) {
    const shoulderY = hipY + 0.31;
    headC = [0, shoulderY + (head?.spec.neck ?? 0.04) + hs * 0.5, 0.01];
    neckBase = [0, shoulderY - 0.02, 0];
  } else if (kind === "fish" || kind === "croc" || kind === "frog" || (head?.spec.neck ?? 0) < 0.02) {
    headC = onTorso(0, 0.1, 1.0);
    headC[2] += hs * 0.32;
  } else {
    neckBase = onTorso(0, 0.45, 0.85);
    const neck = head?.spec.neck ?? 0.1;
    const ang = kind === "bird" ? 1.1 : neck > 0.3 ? 0.95 : 0.55;
    headC = [0, neckBase[1] + Math.sin(ang) * neck, neckBase[2] + Math.cos(ang) * neck + hs * 0.3];
  }
  if (neckBase && head && head.spec.neck > 0.02) {
    segment(GEO.cyl, neckBase, headC, Math.max(0.03, Math.min(w, 0.4) * 0.35), { lod: 1, pattern: pat });
  }
  const headKind = head?.spec.kind ?? "mammal";
  const hScale: V3 =
    headKind === "human"
      ? [hs * 0.4, hs * 0.5, hs * 0.44]
      : headKind === "bird"
        ? [hs * 0.4, hs * 0.4, hs * 0.48]
        : headKind === "reptile"
          ? [hs * 0.38, hs * 0.26, hs * 0.55]
          : headKind === "frog"
            ? [hs * 0.62, hs * 0.34, hs * 0.48]
            : headKind === "fish"
              ? [Math.min(hs * 0.42, w / 2), Math.min(hs * 0.48, hh), hs * 0.62]
              : [hs * 0.42, hs * 0.42, hs * 0.55];
  if (head) add(GEO.sphere, { pivot: headC, scale: hScale, pattern: pat * 0.6, lod: 0 });
  if (headKind === "human")
    add(GEO.sphere, {
      pivot: [headC[0], headC[1] + hScale[1] * 0.3, headC[2] - hScale[2] * 0.15],
      scale: [hScale[0] * 1.06, hScale[1] * 0.75, hScale[2] * 1.02],
      color: hex("#2a1d16"),
      lod: 1,
    });
  const headFront: V3 = [headC[0], headC[1] - hScale[1] * 0.15, headC[2] + hScale[2] * 0.8];

  // Mane (male lions & lion-headed chimeras): a sexually selected ornament.
  if (head?.spec.mane && b.sex === "M") {
    const r = hs * (0.3 + 0.32 * b.ornament);
    add(GEO.sphere, {
      pivot: [headC[0], headC[1] + hs * 0.02, headC[2] - hs * 0.22],
      scale: [r * 1.05, r * 1.1, r * 0.75],
      color: mix(darker(body, 0.6), [0.35, 0.2, 0.1], 0.5),
      lod: 1,
    });
  }

  // ------------------------------------------------------------ jaw / snout / beak
  const jaw = P("jaw");
  if (jaw) {
    const len = jaw.spec.len;
    const fwd = eulerQ(Math.PI / 2, 0, 0);
    switch (jaw.spec.kind) {
      case "short":
      case "long":
        add(GEO.cone, {
          pivot: headFront,
          rot: fwd,
          scale: [hs * (jaw.spec.kind === "short" ? 0.24 : 0.19), len, hs * 0.18],
          pattern: pat * 0.4,
          lod: 1,
        });
        add(GEO.sphere, {
          pivot: [headFront[0], headFront[1] + hs * 0.02, headFront[2] + len * 0.97],
          scale: [hs * 0.05, hs * 0.04, hs * 0.04],
          color: EYE,
          lod: 2,
        });
        break;
      case "croc":
        add(GEO.box, {
          pivot: headFront,
          offset: [0, 0, len / 2],
          scale: [hs * 0.42, hs * 0.18, len],
          lod: 1,
        });
        break;
      case "human":
        add(GEO.cone, {
          pivot: [headFront[0], headFront[1] + hs * 0.05, headFront[2] - hs * 0.08],
          rot: fwd,
          scale: [hs * 0.07, hs * 0.18, hs * 0.07],
          lod: 2,
        });
        break;
      case "beak":
        add(GEO.cone, {
          pivot: headFront,
          rot: fwd,
          scale: [hs * 0.16, len, hs * 0.14],
          color: BEAK,
          lod: 1,
        });
        break;
      case "hooked":
        add(GEO.cone, {
          pivot: headFront,
          rot: fwd,
          scale: [hs * 0.17, len * 0.9, hs * 0.17],
          color: HOOK,
          lod: 1,
        });
        add(GEO.cone, {
          pivot: [headFront[0], headFront[1], headFront[2] + len * 0.75],
          rot: eulerQ(Math.PI * 0.85, 0, 0),
          scale: [hs * 0.06, len * 0.35, hs * 0.06],
          color: TALON,
          lod: 2,
        });
        break;
      case "flatbill":
        add(GEO.box, {
          pivot: headFront,
          offset: [0, 0, len / 2],
          scale: [hs * 0.36, hs * 0.09, len],
          color: BILL,
          lod: 1,
        });
        break;
      default:
        break;
    }
    // Teeth
    const teeth = P("teeth");
    if (teeth) {
      const t = teeth.spec.kind;
      if (t === "tusks") {
        const tl = teeth.donor === "elephant" ? 0.32 : 0.09;
        for (const s of [-1, 1])
          add(GEO.cone, {
            pivot: [headFront[0] + s * hs * 0.16, headFront[1] - hs * 0.08, headFront[2]],
            rot: eulerQ(teeth.donor === "elephant" ? 1.9 : 0.7, 0, -s * 0.15),
            scale: [hs * 0.05, tl, hs * 0.05],
            color: IVORY,
            lod: 1,
          });
      } else if (t === "conical" || t === "serrated") {
        for (const s of [-1, 1])
          for (let k = 0; k < 3; k++)
            add(GEO.cone, {
              pivot: [
                headFront[0] + s * hs * 0.17,
                headFront[1] - hs * 0.05,
                headFront[2] + len * (0.2 + 0.25 * k),
              ],
              rot: eulerQ(Math.PI, 0, 0),
              scale: [hs * 0.025, hs * 0.07, hs * 0.025],
              color: IVORY,
              lod: 2,
            });
      } else if (t === "carnassial") {
        for (const s of [-1, 1])
          add(GEO.cone, {
            pivot: [headFront[0] + s * hs * 0.08, headFront[1] - hs * 0.06, headFront[2] + len * 0.75],
            rot: eulerQ(Math.PI, 0, 0),
            scale: [hs * 0.03, hs * 0.1, hs * 0.03],
            color: IVORY,
            lod: 2,
          });
      }
    }
  }

  // Trunk
  if (head?.spec.trunk) {
    let p: V3 = headFront;
    const segs: V3[] = [
      [0, -0.12, 0.08],
      [0, -0.16, 0.03],
      [0, -0.14, -0.02],
    ];
    segs.forEach((d, i) => {
      const to: V3 = [p[0] + d[0] * hs * 2.2, p[1] + d[1] * hs * 2.2, p[2] + d[2] * hs * 2.2];
      segment(GEO.cyl, p, to, hs * (0.11 - i * 0.025), {
        lod: 1,
        anim: "trunk",
        axis: 0,
        amp: 0.12 + i * 0.05,
        phase: i * 0.6,
      });
      p = to;
    });
  }

  // Antlers (male deer and deer-headed chimeras)
  if (head?.spec.antlers && b.sex === "M" && b.ornament > 0.12) {
    const k = 0.25 + 0.55 * b.ornament;
    for (const s of [-1, 1]) {
      const base: V3 = [headC[0] + s * hs * 0.18, headC[1] + hs * 0.35, headC[2] - hs * 0.05];
      const tip: V3 = [base[0] + s * k * 0.28, base[1] + k * 0.55, base[2] - k * 0.12];
      segment(GEO.cyl, base, tip, hs * 0.035, { color: HORN, lod: 1 });
      for (const f of [0.35, 0.65]) {
        const from: V3 = [
          base[0] + (tip[0] - base[0]) * f,
          base[1] + (tip[1] - base[1]) * f,
          base[2] + (tip[2] - base[2]) * f,
        ];
        segment(GEO.cone, from, [from[0] + s * 0.03, from[1] + k * 0.18, from[2] + k * 0.16], hs * 0.025, {
          color: HORN,
          lod: 2,
        });
      }
    }
  }

  // ------------------------------------------------------------ eyes & ears
  const eyes = P("eyes");
  if (eyes && head) {
    const r = Math.min(0.08, Math.max(0.012, eyes.spec.size * 0.42));
    const fwd = eyes.spec.forward;
    for (const s of [-1, 1])
      add(GEO.sphere, {
        pivot: [
          headC[0] + s * hScale[0] * (0.88 - fwd * 0.4),
          headC[1] + hScale[1] * 0.3,
          headC[2] + hScale[2] * (0.35 + fwd * 0.35),
        ],
        scale: [r, r, r],
        color: EYE,
        lod: 2,
      });
  }
  const ears = P("ears");
  if (ears && head && ears.spec.kind !== "none") {
    const es = ears.spec.size;
    for (const s of [-1, 1]) {
      const pivot: V3 = [
        headC[0] + s * hScale[0] * 0.6,
        headC[1] + hScale[1] * 0.75,
        headC[2] - hScale[2] * 0.25,
      ];
      switch (ears.spec.kind) {
        case "long":
          add(GEO.blade, {
            pivot,
            rot: eulerQ(-0.25, 0, -s * 0.15),
            scale: [es * 0.3, es, 1],
            lod: 1,
            anim: "earFlap",
            axis: 0,
            amp: 0.08,
            phase: s,
          });
          break;
        case "pointed":
          add(GEO.cone, {
            pivot,
            rot: eulerQ(-0.1, 0, -s * 0.25),
            scale: [es * 0.32, es * 0.85, es * 0.18],
            lod: 1,
          });
          break;
        case "round":
          add(GEO.sphere, { pivot, scale: [es * 0.6, es * 0.6, es * 0.3], lod: 1 });
          break;
        case "large":
          add(GEO.blade, {
            pivot: [headC[0] + s * hScale[0] * 0.85, headC[1] + hScale[1] * 0.3, headC[2] - hScale[2] * 0.2],
            rot: eulerQ(Math.PI * 0.9, s * 0.45, 0),
            scale: [es * 0.9, es * 1.05, 0.6],
            lod: 1,
            anim: "earFlap",
            axis: 1,
            amp: 0.25,
            phase: s,
          });
          break;
        case "human":
          add(GEO.sphere, {
            pivot: [headC[0] + s * hScale[0], headC[1], headC[2]],
            scale: [es * 0.25, es * 0.55, es * 0.4],
            lod: 2,
          });
          break;
      }
    }
  }

  // ------------------------------------------------------------ limbs
  const legPhase = (front: boolean, s: number): Anim => ((front ? s > 0 : s < 0) ? "legA" : "legB");
  const drawLeg = (
    attach: V3,
    spec: { kind: LimbKind; len: number; thick: number },
    front: boolean,
    s: number,
  ) => {
    const thick = Math.max(0.012, spec.thick * (biped ? 1 : 0.9));
    const ground = attach[1];
    const anim: Anim = biped ? (s > 0 ? "legA" : "legB") : legPhase(front, s);
    const swing = 0.45;
    switch (spec.kind) {
      case "grasping": {
        if (biped || front) {
          const len = biped ? spec.len * limbK : ground;
          add(GEO.cyl, {
            pivot: attach,
            rot: eulerQ(Math.PI, 0, s * 0.08),
            scale: [thick, len, thick],
            lod: 1,
            anim: biped ? (s > 0 ? "armB" : "armA") : anim,
            axis: 0,
            amp: biped ? 0.4 : swing,
          });
          if (biped)
            add(GEO.sphere, {
              pivot: attach,
              rot: eulerQ(Math.PI, 0, s * 0.08),
              offset: [0, len, 0],
              scale: [thick * 1.2, thick * 1.4, thick * 1.2],
              lod: 2,
              anim: s > 0 ? "armB" : "armA",
              axis: 0,
              amp: 0.4,
            });
        }
        return;
      }
      case "sprawling": {
        const ang = s * 0.75;
        const len = ground / Math.cos(ang);
        add(GEO.cyl, {
          pivot: attach,
          rot: eulerQ(Math.PI, 0, -ang),
          scale: [thick, len, thick],
          lod: 1,
          anim,
          axis: 1,
          amp: 0.35,
        });
        return;
      }
      case "hopping": {
        const thigh = thick * 2.2;
        add(GEO.sphere, {
          pivot: attach,
          rot: eulerQ(0.3, 0, 0),
          scale: [thick * 1.3, thigh * 1.4, thigh * 1.6],
          lod: 1,
          pattern: pat * 0.5,
          anim: "hop",
          axis: 0,
          amp: 0.5,
        });
        add(GEO.box, {
          pivot: [attach[0], 0.015, attach[2]],
          offset: [0, 0, spec.len * 0.15],
          scale: [thick * 1.1, 0.03, spec.len * 0.45],
          lod: 1,
          anim: "hop",
          axis: 0,
          amp: 0.25,
        });
        return;
      }
      case "bird":
      case "webbed":
      case "talons": {
        const footC = spec.kind === "webbed" ? WEB : spec.kind === "talons" ? TALON : BIRDFOOT;
        add(GEO.cyl, {
          pivot: attach,
          rot: eulerQ(Math.PI, 0, 0),
          rotAlt: eulerQ(Math.PI * 0.42, 0, 0),
          scale: [thick * 0.6, ground, thick * 0.6],
          color: footC,
          lod: 1,
          anim,
          axis: 0,
          amp: 0.5,
        });
        add(GEO.blade, {
          pivot: attach,
          rot: eulerQ(Math.PI, 0, 0),
          rotAlt: eulerQ(Math.PI * 0.42, 0, 0),
          offset: [0, ground, 0],
          scale: [thick * 4, thick * 4, 0.6],
          color: footC,
          lod: 2,
          anim,
          axis: 0,
          amp: 0.5,
        });
        return;
      }
      default: {
        const pillar = spec.kind === "pillar";
        add(GEO.cyl, {
          pivot: attach,
          rot: eulerQ(Math.PI, 0, 0),
          scale: [thick * (pillar ? 1.15 : 1), ground, thick * (pillar ? 1.15 : 1)],
          lod: 1,
          pattern: pat * 0.7,
          anim,
          axis: 0,
          amp: pillar ? 0.25 : swing,
        });
        add(GEO.box, {
          pivot: attach,
          rot: eulerQ(Math.PI, 0, 0),
          offset: [
            0,
            ground - thick * 0.4,
            spec.kind === "plantigrade" || spec.kind === "bipedal" ? -thick * 0.7 : 0,
          ],
          scale: [
            thick * 2,
            thick * 0.9,
            thick * (spec.kind === "plantigrade" || spec.kind === "bipedal" ? 3 : 2),
          ],
          color: spec.kind === "cursorial" || pillar ? darker(body, 0.45) : darker(body, 0.85),
          lod: 2,
          anim,
          axis: 0,
          amp: pillar ? 0.25 : swing,
        });
      }
    }
  };

  if (fore && fore.spec.kind !== "none") {
    for (const s of [-1, 1]) {
      const attach: V3 = biped
        ? [s * 0.17, hipY + 0.3, 0]
        : kind === "frog"
          ? onTorso(s * 0.55, -0.4, 0.55)
          : onTorso(s * 0.55, -0.35, 0.6);
      drawLeg(attach, fore.spec, true, s);
    }
  }
  if (hind && hind.spec.kind !== "none") {
    for (const s of [-1, 1]) {
      const attach: V3 = biped
        ? [s * 0.07, hipY, 0]
        : kind === "bird"
          ? onTorso(s * 0.35, -0.6, -0.05)
          : kind === "frog"
            ? onTorso(s * 0.75, -0.2, -0.55)
            : onTorso(s * 0.55, -0.35, -0.62);
      if (kind === "fish") attach[1] = Math.max(attach[1], 0.05);
      drawLeg(attach, hind.spec, false, s);
    }
  }

  // ------------------------------------------------------------ tail
  const tail = P("tail");
  if (tail && tail.spec.kind !== "none") {
    const t = tail.spec;
    const rear = biped ? ([0, hipY, -0.08] as V3) : onTorso(0, 0.25, -0.97);
    switch (t.kind) {
      case "short":
        add(GEO.sphere, {
          pivot: rear,
          scale: [0.05 + t.len * 0.3, 0.05 + t.len * 0.3, 0.05 + t.len * 0.3],
          color: mix(body, body2, 0.4),
          lod: 1,
        });
        break;
      case "thin":
      case "tufted": {
        add(GEO.cyl, {
          pivot: rear,
          rot: eulerQ(-2.5, 0, 0),
          scale: [Math.max(0.012, t.thick), t.len, Math.max(0.012, t.thick)],
          lod: 1,
          anim: "tail",
          axis: 1,
          amp: 0.4,
        });
        if (t.kind === "tufted")
          add(GEO.sphere, {
            pivot: rear,
            rot: eulerQ(-2.5, 0, 0),
            offset: [0, t.len, 0],
            scale: [0.04, 0.06, 0.04],
            color: darker(body, 0.4),
            lod: 2,
            anim: "tail",
            axis: 1,
            amp: 0.4,
          });
        break;
      }
      case "bushy":
        add(GEO.sphere, {
          pivot: rear,
          rot: eulerQ(-2.0, 0, 0),
          offset: [0, t.len * 0.5, 0],
          scale: [t.thick, t.len * 0.55, t.thick],
          lod: 1,
          anim: "tail",
          axis: 1,
          amp: 0.3,
        });
        add(GEO.sphere, {
          pivot: rear,
          rot: eulerQ(-2.0, 0, 0),
          offset: [0, t.len * 0.98, 0],
          scale: [t.thick * 0.55, t.thick * 0.7, t.thick * 0.55],
          color: body2,
          lod: 2,
          anim: "tail",
          axis: 1,
          amp: 0.3,
        });
        break;
      case "heavy": {
        const r = hh * 0.85;
        add(GEO.cone, {
          pivot: onTorso(0, 0, -0.95),
          rot: eulerQ(-Math.PI / 2 - pitch, 0, 0),
          scale: [r, t.len, r * 0.8],
          pattern: pat,
          lod: 0,
          anim: "fishTail",
          axis: 1,
          amp: 0.25,
        });
        break;
      }
      case "feather":
        add(GEO.blade, {
          pivot: rear,
          rot: eulerQ(-Math.PI / 2 - 0.15, 0, 0),
          scale: [t.len * 0.7, t.len, 1],
          color: mix(body, body2, 0.3),
          lod: 1,
        });
        break;
      case "fish":
      case "shark": {
        const big = t.kind === "shark" ? 1.25 : 1;
        for (const s of [-1, 1])
          add(GEO.blade, {
            pivot: onTorso(0, 0, -0.98),
            rot: eulerQ(-Math.PI / 2 + s * 0.55, 0, 0),
            scale: [t.len * 0.55, t.len * (s > 0 ? big : 1), 0.8],
            color: mix(body, body2, 0.3),
            lod: 0,
            anim: "fishTail",
            axis: 1,
            amp: 0.35,
          });
        break;
      }
    }
  }

  // ------------------------------------------------------------ wings
  const wings = P("wings");
  if (wings) {
    const half = wings.spec.span / 2;
    const chord = Math.max(
      0.25,
      Math.min(0.55, wings.spec.kind === "broad" ? 0.48 : wings.spec.kind === "short" ? 0.42 : 0.35),
    );
    for (const s of [-1, 1]) {
      add(GEO.blade, {
        pivot: biped ? [s * 0.12, hipY + 0.3, -0.05] : onTorso(s * 0.6, 0.35, 0.2),
        rot: eulerQ(0, 0, (-s * Math.PI) / 2),
        rotAlt: biped ? eulerQ(Math.PI - 0.35, 0, s * 0.3) : eulerQ(-Math.PI / 2 - 0.12, 0, s * 0.12),
        scale: [chord, half, 0.8],
        color: mix(body, body2, 0.15),
        pattern: pat * 0.5,
        lod: 0,
        anim: s < 0 ? "wingL" : "wingR",
        axis: 2,
        amp: 0.7,
      });
    }
  }

  // ------------------------------------------------------------ fins
  const fins = P("fins");
  if (fins) {
    const fs = fins.spec.size * (fins.spec.kind === "shark" ? 1.3 : 1);
    add(GEO.blade, {
      pivot: onTorso(0, 0.9, -0.05),
      rot: eulerQ(-0.35, 0, 0),
      scale: [fs * 0.6, fs * 0.7, 0.7],
      color: mix(body, body2, 0.25),
      lod: 1,
    });
    for (const s of [-1, 1])
      add(GEO.blade, {
        pivot: onTorso(s * 0.75, -0.35, 0.4),
        rot: eulerQ(-0.4, 0, -s * 1.9),
        scale: [fs * 0.35, fs * 0.55, 0.6],
        color: mix(body, body2, 0.25),
        lod: 2,
        anim: "fin",
        axis: 2,
        amp: 0.25,
        phase: s,
      });
  }

  return parts;
}

/** Visual length (world units) from body length in metres: compressed so sparrows and elephants share a scene. */
export function displayLength(lengthM: number) {
  return 1.25 * Math.max(0.05, lengthM) ** 0.6;
}
