import * as THREE from "three";
import type { RGB } from "@/engine/anatomy/color";
import type { Slot } from "@/engine/genetics/types";
import { SPECIES } from "@/engine/species/roster";
import type { LimbKind, PartSpecs, SpeciesId } from "@/engine/species/types";
import { GEO, type GeoId } from "./geometry";
import { LOOKS, type Look, type Muzzle } from "./looks";

/**
 * Procedural rig: turns a body description (base species + expressed modules) into a list
 * of parametric parts. Parts attach to sockets on the torso, and legs are always sized to
 * reach the ground, so any chimera assembles coherently. Each part is sculpted after the
 * species that donated it (see `looks.ts`): a fox head keeps its white muzzle and black ear
 * tips wherever it ends up.
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
  /** Applied after the animated rotation: T(offset) · R · S(scale). */
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
type Q = THREE.Quaternion;

interface Joint {
  pivot: V3;
  rot: Q;
  rotAlt?: Q;
  anim: Anim;
  axis: 0 | 1 | 2;
  amp: number;
  phase: number;
}
interface Style {
  color?: RGB;
  color2?: RGB;
  pattern?: number;
  lod?: 0 | 1 | 2;
}
/** A positioned, oriented frame (torso, head). */
interface Frame {
  p: V3;
  q: Q;
}

const ID_Q = new THREE.Quaternion();
const ONE = new THREE.Vector3(1, 1, 1);
const tmpE = new THREE.Euler();
const eulerQ = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(tmpE.set(x, y, z, "XYZ"));
const vec = (v: V3) => new THREE.Vector3(v[0], v[1], v[2]);
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const plus = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const lerp3 = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Orientation whose local +y points along `dir`, with local +x as close as possible to `hint`. */
function orient(dir: V3, hint: V3): Q {
  const y = vec(dir).normalize();
  const h = vec(hint);
  const x = h.sub(y.clone().multiplyScalar(h.dot(y)));
  if (x.lengthSq() < 1e-8) x.set(1, 0, 0);
  x.normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** Point `l` of a frame, in body space. */
const at = (f: Frame, l: V3): V3 => {
  const v = vec(l).applyQuaternion(f.q);
  return [f.p[0] + v.x, f.p[1] + v.y, f.p[2] + v.z];
};

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
const lum = (c: RGB) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];

const EYE: RGB = hex("#14110f");
const IVORY: RGB = hex("#efe6cf");
const HORN: RGB = hex("#b9a27d");
const HOOF: RGB = hex("#2a2420");
const CLAW: RGB = hex("#3a332c");
const BEAK: RGB = hex("#4d4339");
const BILL_M: RGB = hex("#d9c13a");
const BILL_F: RGB = hex("#c27a2e");
const HAWK_BEAK: RGB = hex("#2f2d2b");
const CERE: RGB = hex("#e7c64a");
const WEB: RGB = hex("#e88a2c");
const TALON: RGB = hex("#d8b23a");
const BIRDFOOT: RGB = hex("#a88370");
const FROG_EYE: RGB = hex("#c9a227");
const PINK: RGB = hex("#d79a95");
/** Earthy clothing for humans (picked per individual). */
const CLOTHES = ["#7a5a3a", "#4f5d3a", "#5a4a6a", "#8a3b2a", "#3a4c5e", "#9a7a4a", "#6b6b5c", "#2f4a46"].map(
  hex,
);
const TROUSERS = ["#3a3128", "#2c3442", "#4a4032", "#3b3b3b", "#5a4a38"].map(hex);

const PITCH: Record<Muzzle, number> = {
  horse: 0.95,
  deer: 0.6,
  dog: 0.18,
  cat: 0.12,
  bear: 0.22,
  pig: 0.35,
  rabbit: 0.25,
  elephant: 0.2,
  human: 0,
  croc: 0.02,
  frog: 0,
  bird: 0.05,
  fish: 0,
};

/** Cranium radii relative to head size. */
const CRANIUM: Record<Muzzle, V3> = {
  horse: [0.3, 0.34, 0.36],
  deer: [0.32, 0.34, 0.38],
  dog: [0.36, 0.34, 0.38],
  cat: [0.42, 0.38, 0.38],
  bear: [0.44, 0.4, 0.4],
  pig: [0.38, 0.42, 0.44],
  rabbit: [0.34, 0.34, 0.42],
  elephant: [0.56, 0.62, 0.5],
  human: [0.38, 0.48, 0.42],
  croc: [0.4, 0.24, 0.42],
  frog: [0.62, 0.32, 0.45],
  bird: [0.38, 0.38, 0.44],
  fish: [0.42, 0.48, 0.55],
};

export function buildRig(b: RigInput): RigPart[] {
  const sp = SPECIES[b.species];
  const torso = sp.parts.torso;
  const P = <S extends Slot>(slot: S): { spec: NonNullable<PartSpecs[S]>; donor: SpeciesId } | null => {
    const donor = b.modules[slot];
    if (!donor) return null;
    const spec = SPECIES[donor].parts[slot];
    return spec ? { spec: spec as NonNullable<PartSpecs[S]>, donor } : null;
  };
  const lookOf = (donor: SpeciesId | null | undefined): Look => LOOKS[donor ?? b.species];
  const parts: RigPart[] = [];
  const body = b.color;
  const body2 = b.color2;
  const pat = b.pattern;
  const tLook = LOOKS[b.species];
  const male = b.sex === "M";
  const bellyC: RGB = tLook.belly ? mix(body, hex(tLook.belly[0]), 0.85) : body;
  const striped = pat > 0.05;
  /** Coat on rounded body parts: stripes/spots from the pattern gene, otherwise countershading. */
  const coat = (lod: 0 | 1 | 2 = 0, k = 1): Style =>
    striped
      ? { color: body, color2: body2, pattern: (tLook.spots ? 1 + pat : pat) * k, lod }
      : { color: body, color2: bellyC, pattern: -(tLook.belly?.[1] ?? 0) * k, lod };
  /** Coat on limbs and tails (stripes only; countershading needs an ellipsoid). */
  const fur = (lod: 0 | 1 | 2 = 1, color = body): Style =>
    striped && !tLook.spots ? { color, color2: body2, pattern: pat * 0.8, lod } : { color, lod };

  // ------------------------------------------------------------ primitives
  const STATIC: Joint = { pivot: [0, 0, 0], rot: ID_Q, anim: "none", axis: 0, amp: 0, phase: 0 };
  const joint = (pivot: V3, o: Partial<Joint> = {}): Joint => ({ ...STATIC, pivot, ...o });
  const frameJoint = (f: Frame): Joint => ({ ...STATIC, pivot: f.p, rot: f.q });

  const push = (geo: GeoId, j: Joint, offset: V3, q: Q, scale: V3, st: Style = {}) => {
    const pre = new THREE.Matrix4().compose(vec(j.pivot), j.rot, ONE);
    const post = new THREE.Matrix4().compose(vec(offset), q, vec(scale));
    parts.push({
      geo,
      lod: st.lod ?? 1,
      color: st.color ?? body,
      color2: st.color2 ?? body2,
      pattern: st.pattern ?? 0,
      pre,
      preAlt: j.rotAlt ? new THREE.Matrix4().compose(vec(j.pivot), j.rotAlt, ONE) : undefined,
      post,
      local: pre.clone().multiply(post),
      anim: j.anim,
      axis: j.axis,
      amp: j.amp,
      phase: j.phase,
    });
  };
  /** Ellipsoid. */
  const blob = (j: Joint, c: V3, r: V3, st?: Style, q: Q = ID_Q) => push(GEO.sphere, j, c, q, r, st);
  /** Segment from a to b (cyl/taper/cone; base radius r across, rz in the other direction). */
  const seg = (j: Joint, a: V3, bb: V3, r: number, st?: Style, geo: GeoId = GEO.taper, rz = r) => {
    const d = sub(bb, a);
    const len = Math.hypot(d[0], d[1], d[2]);
    if (len < 1e-4) return;
    push(geo, j, a, orient(d, [1, 0, 0]), [r, len, rz], st);
  };
  /** Flat blade (ear, fin, wing, feather fan) pointing along `dir`, chord along `hint`. */
  const blade = (j: Joint, at0: V3, dir: V3, hint: V3, chord: number, len: number, st?: Style, thick = 0.7) =>
    push(GEO.blade, j, at0, orient(dir, hint), [chord, len, thick], st);

  // ------------------------------------------------------------ stance
  const fore = P("forelimbs");
  const hind = P("hindlimbs");
  const limbK = clamp(b.limb, 0.6, 1.5);
  const fatK = 1 + 0.35 * (b.fat - 0.35);
  const kind = torso.kind;
  const biped = kind === "biped";
  const W = (torso.w * (biped ? 1 : fatK)) / 2;
  const H = (torso.h / 2) * (biped ? 1 : fatK);

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
    const legs = Math.max(stanceHeight(hind), stanceHeight(fore));
    center = [0, legs > 0 ? legs + H * 0.4 : 0, 0];
  } else if (kind === "frog") {
    center = [0, H + Math.max(0.05, stanceHeight(hind) * 0.35), 0];
    pitch = -0.35;
  } else if (kind === "bird") {
    // Raptors perch upright; songbirds and ducks sit more level.
    const upright = b.species === "hawk";
    center = [0, stanceHeight(hind) * 0.85 + H * (upright ? 1.05 : 0.8), 0];
    pitch = upright ? -0.62 : -0.28;
  } else {
    let hindH = stanceHeight(hind);
    let foreH = stanceHeight(fore);
    if (!foreH && hindH) foreH = Math.max(H * 0.4, hindH * 0.55);
    else if (!hindH && foreH) hindH = Math.max(H * 0.4, foreH * 0.55);
    const hip = hindH + H * 0.6;
    const shoulder = foreH + H * 0.6;
    center = [0, Math.max(H, (hip + shoulder) / 2), 0];
    pitch = Math.atan2(hip - shoulder, 0.95);
  }
  const T: Frame = { p: center, q: eulerQ(pitch, 0, 0) };
  const JT = frameJoint(T);

  // ------------------------------------------------------------ torso
  let neckBase: V3 | null = null;
  let headC: V3;
  const head = P("head");
  const hs = head?.spec.size ?? 0.25;
  const neckLen = head?.spec.neck ?? 0.1;
  let rear: V3;
  let shoulderY = 0;
  /** Clothing colours (humans), shared by the torso, arms and legs. */
  let bipedColors: { shirt: RGB; trousers: RGB } | null = null;

  if (biped) {
    shoulderY = hipY + 0.3;
    const shirt = CLOTHES[Math.floor((body[0] * 977 + body[1] * 613 + body[2] * 331) * 7) % CLOTHES.length];
    const trousers = TROUSERS[Math.floor((body[0] * 421 + body[2] * 887) * 5) % TROUSERS.length];
    const human = b.species === "human";
    const top: Style = human ? { color: shirt, lod: 0 } : coat(0);
    const bottom: Style = human ? { color: trousers, lod: 0 } : coat(0);
    blob(STATIC, [0, hipY + 0.02, 0], [0.125 * fatK, 0.075, 0.085 * fatK], bottom);
    blob(STATIC, [0, hipY + 0.12, 0.005], [0.12 * fatK, 0.1, 0.08 * fatK], top);
    blob(STATIC, [0, hipY + 0.235, 0], [0.15 * (torso.w / 0.3), 0.095, 0.085], top);
    seg(
      STATIC,
      [0, shoulderY - 0.03, 0],
      [0, shoulderY + 0.05, 0.005],
      0.034,
      { color: body, lod: 1 },
      GEO.cyl,
    );
    headC = [0, shoulderY + neckLen + hs * 0.5, 0.01];
    rear = [0, hipY + 0.02, -0.08];
    if (human) bipedColors = { shirt, trousers };
  } else if (kind === "fish") {
    blob(JT, [0, 0, -0.02], [W, H, 0.4], coat(0));
    blob(JT, [0, 0, 0.2], [W * 0.95, H * 0.95, 0.24], coat(0));
    // Caudal peduncle narrowing to the tail.
    seg(JT, [0, 0, -0.28], [0, 0, -0.6], W * 0.6, fur(0), GEO.taper, H * 0.55);
    headC = at(T, [0, 0, 0.32]);
    rear = at(T, [0, 0, -0.58]);
  } else if (kind === "bird") {
    blob(JT, [0, 0, -0.04], [W, H, 0.42], coat(0));
    blob(JT, [0, -H * 0.1, 0.18], [W * 0.95, H * 0.92, 0.3], coat(0));
    blob(JT, [0, H * 0.05, -0.32], [W * 0.62, H * 0.55, 0.2], { color: body, lod: 1 });
    neckBase = at(T, [0, H * 0.45, 0.36]);
    headC = plus(at(T, [0, H * 0.6, 0.4]), [0, hs * 0.18 + neckLen * 0.75, hs * 0.15 + neckLen * 0.35]);
    rear = at(T, [0, H * 0.05, -0.45]);
  } else if (kind === "croc") {
    blob(JT, [0, 0, 0], [W * 1.1, H, 0.48], coat(0));
    blob(JT, [0, -H * 0.05, 0.3], [W * 0.9, H * 0.85, 0.22], coat(0));
    // Back armour: two rows of scutes.
    for (const s of [-1, 1])
      for (let k = 0; k < 5; k++)
        push(GEO.cone, JT, [s * W * 0.35, H * 0.88, 0.32 - k * 0.15], ID_Q, [W * 0.12, H * 0.35, W * 0.14], {
          color: darker(body, 0.75),
          lod: 2,
        });
    headC = plus(at(T, [0, -H * 0.05, 0.5]), [0, 0, hs * 0.3]);
    rear = at(T, [0, 0, -0.46]);
  } else if (kind === "frog") {
    blob(JT, [0, 0, -0.04], [W, H, 0.45], coat(0));
    headC = plus(at(T, [0, H * 0.15, 0.36]), [0, 0, hs * 0.18]);
    rear = at(T, [0, 0, -0.45]);
  } else {
    // Quadrupeds: barrel, deep chest, haunches, optional hump.
    blob(JT, [0, 0, -0.01], [W, H, 0.46], coat(0));
    blob(JT, [0, H * 0.04, 0.24], [W * 0.97, H * 0.97, 0.25], coat(0));
    blob(JT, [0, H * 0.02, -0.26], [W * 0.9, H * 0.92, 0.24], coat(0));
    const hump = tLook.hump ?? 0;
    if (hump > 0)
      blob(JT, [0, H * (0.4 + 0.25 * hump), 0.2], [W * 0.72, H * (0.45 + 0.3 * hump), 0.25], coat(0));
    if (tLook.crest && b.species === "boar")
      seg(
        JT,
        [0, H * 0.98, 0.32],
        [0, H * 0.9, -0.1],
        0.012,
        { color: hex(tLook.crest), lod: 2 },
        GEO.box,
        H * 0.25,
      );
    if (tLook.rump)
      blob(JT, [0, H * 0.1, -0.48], [W * 0.62, H * 0.55, 0.06], { color: hex(tLook.rump), lod: 1 });
    rear = at(T, [0, H * 0.4, -0.48]);
    if (neckLen >= 0.12) {
      neckBase = at(T, [0, H * 0.35, 0.34]);
      const ang = neckLen > 0.3 ? 1.0 : 0.6;
      headC = plus(neckBase, [0, Math.sin(ang) * neckLen + hs * 0.12, Math.cos(ang) * neckLen + hs * 0.25]);
    } else {
      headC = plus(at(T, [0, H * 0.3, 0.46]), [0, hs * 0.05, hs * 0.3]);
    }
  }

  // ------------------------------------------------------------ neck
  if (neckBase && head && neckLen > 0.04) {
    const base = kind === "bird" ? neckBase : at(T, [0, H * 0.1, 0.3]);
    const rx = kind === "bird" ? hs * 0.24 : Math.min(W * 0.75, hs * 0.5);
    const rz = kind === "bird" ? hs * 0.26 : H * 0.62;
    const duckM = head.donor === "duck" && male;
    seg(STATIC, base, headC, rx, duckM ? { color: hex("#1f5f3c"), lod: 0 } : fur(0), GEO.taper, rz);
    if (duckM) {
      // White collar of the drake.
      const c = lerp3(base, headC, 0.3);
      seg(
        STATIC,
        c,
        plus(c, [0, 0.012, 0.004]),
        rx * 0.92,
        { color: hex("#f2f0e8"), lod: 2 },
        GEO.cyl,
        rz * 0.92,
      );
    }
    const crest = head ? lookOf(head.donor).crest : undefined;
    if (crest && head.donor !== "lion" && head.donor !== "boar") {
      // Upright mane along the top of the neck (zebra).
      const a = plus(base, [0, rz * 0.8, -0.02]);
      const c = plus(headC, [0, hs * 0.25, -hs * 0.3]);
      seg(STATIC, a, c, 0.018, { color: hex(crest), lod: 1 }, GEO.box, rz * 0.45);
    }
  }

  // ------------------------------------------------------------ head
  if (head) drawHead(head.donor);

  function drawHead(donor: SpeciesId) {
    const hl = lookOf(donor);
    const style = hl.muzzle;
    const cr = CRANIUM[style];
    let r: V3 = [hs * cr[0], hs * cr[1], hs * cr[2]];
    if (style === "fish") r = [W * 0.92, H * 0.9, 0.2];
    const HF: Frame = { p: headC, q: eulerQ(PITCH[style], 0, 0) };
    const JH = frameJoint(HF);
    const duckM = donor === "duck" && male;
    const headStyle: Style =
      style === "human"
        ? { color: body, lod: 0 }
        : duckM
          ? { color: hex("#1f5f3c"), lod: 0 }
          : { ...coat(0, style === "fish" ? 1 : 0.8) };
    blob(JH, [0, 0, 0], r, headStyle);
    const front: V3 = [0, -r[1] * 0.15, r[2] * 0.7];

    // Hair and face (humans)
    if (style === "human") {
      const l = clamp((lum(body) - 0.35) * 2.2, 0, 1);
      const hair = mix(hex("#15100c"), hex("#6b4a2b"), l);
      blob(JH, [0, r[1] * 0.28, -r[2] * 0.1], [r[0] * 1.08, r[1] * 0.78, r[2] * 1.06], {
        color: hair,
        lod: 1,
      });
      if (!male)
        blob(JH, [0, -r[1] * 0.35, -r[2] * 0.55], [r[0] * 1.0, r[1] * 1.05, r[2] * 0.5], {
          color: hair,
          lod: 1,
        });
    }

    // Sparrow cock: grey crown and black bib.
    if (donor === "sparrow" && male) {
      blob(JH, [0, r[1] * 0.35, -r[2] * 0.05], [r[0] * 0.92, r[1] * 0.7, r[2] * 0.92], {
        color: hex("#7c7a76"),
        lod: 2,
      });
      blob(JH, [0, -r[1] * 0.75, r[2] * 0.35], [r[0] * 0.55, r[1] * 0.45, r[2] * 0.35], {
        color: hex("#1d1a17"),
        lod: 2,
      });
    }

    drawMuzzle(HF, JH, r, front);
    drawEyes(JH, r, style);
    drawEars(HF, r);

    // Antlers (male deer and deer-headed chimeras), grown upright regardless of head pitch.
    if (head!.spec.antlers && male && b.ornament > 0.12) {
      const k = (0.3 + 0.6 * b.ornament) * (hs / 0.28);
      for (const s of [-1, 1]) {
        const b0 = at(HF, [s * r[0] * 0.45, r[1] * 0.8, -r[2] * 0.15]);
        const b1 = plus(b0, [s * 0.1 * k, 0.28 * k, -0.08 * k]);
        const b2 = plus(b1, [s * 0.06 * k, 0.26 * k, 0.02 * k]);
        const st: Style = { color: HORN, lod: 1 };
        seg(STATIC, b0, b1, 0.022 * k, st, GEO.taper);
        seg(STATIC, b1, b2, 0.016 * k, st, GEO.cone);
        const tine = (from: V3, d: V3) =>
          seg(STATIC, from, plus(from, d), 0.012 * k, { color: HORN, lod: 2 }, GEO.cone);
        tine(lerp3(b0, b1, 0.25), [s * 0.01 * k, 0.06 * k, 0.12 * k]);
        tine(lerp3(b0, b1, 0.8), [s * 0.02 * k, 0.1 * k, 0.1 * k]);
        tine(lerp3(b1, b2, 0.6), [s * 0.05 * k, 0.12 * k, -0.04 * k]);
      }
    }

    // Lion's mane: a ruff framing the face, sized by the ornament trait.
    if (head!.spec.mane && male) {
      const m = 0.75 + 0.55 * b.ornament;
      const mc: Style = { color: hex(hl.crest ?? "#5b3a1e"), lod: 0 };
      blob(JH, [0, r[1] * 0.05, -r[2] * 0.62], [r[0] * 1.55 * m, r[1] * 1.6 * m, r[2] * 0.8 * m], mc);
      blob(
        STATIC,
        lerp3(headC, at(T, [0, H * 0.3, 0.35]), 0.55),
        [r[0] * 1.4 * m, r[1] * 1.6 * m, r[2] * 1.1 * m],
        {
          ...mc,
          lod: 1,
        },
      );
    }

    // Elephant trunk: hangs from the face nearly to the ground, curling at the tip.
    if (head!.spec.trunk) {
      const start = at(HF, [0, -r[1] * 0.3, r[2] * 0.85]);
      const L = Math.max(0.15, start[1] * 0.92);
      const J = joint(start, { anim: "trunk", axis: 0, amp: 0.12, phase: 0 });
      const pts: V3[] = [
        [0, 0, 0],
        [0, -L * 0.38, L * 0.06],
        [0, -L * 0.72, L * 0.06],
        [0, -L * 0.95, L * 0.16],
      ];
      for (let i = 0; i < 3; i++)
        seg(J, pts[i], pts[i + 1], hs * (0.22 - i * 0.05), { color: body, lod: i === 0 ? 0 : 1 }, GEO.taper);
    }
  }

  function drawMuzzle(HF: Frame, JH: Joint, r: V3, front: V3) {
    const jaw = P("jaw");
    if (!jaw) return;
    const jl = lookOf(jaw.donor);
    const len = jaw.spec.len;
    const mcol = jl.muzzleColor ? mix(body, hex(jl.muzzleColor[0]), jl.muzzleColor[1]) : body;
    const nose = jl.nose ? hex(jl.nose) : darker(body, 0.35);
    const ms: Style = { color: mcol, lod: 1 };
    let tip: V3 = plus(front, [0, 0, len]);
    switch (jl.muzzle) {
      case "horse":
      case "deer": {
        tip = [0, -r[1] * 0.25, r[2] * 0.55 + len];
        seg(
          JH,
          [0, -r[1] * 0.05, r[2] * 0.2],
          tip,
          r[0] * 0.72,
          ms,
          jl.muzzle === "horse" ? GEO.cyl : GEO.taper,
          r[1] * 0.8,
        );
        const nr = jl.muzzle === "horse" ? r[0] * 0.62 : r[0] * 0.4;
        blob(JH, tip, [nr, nr * 0.9, nr * 0.8], { color: nose, lod: 2 });
        break;
      }
      case "dog": {
        tip = [0, -r[1] * 0.25, r[2] * 0.6 + len];
        seg(JH, [0, -r[1] * 0.12, r[2] * 0.3], tip, r[0] * 0.55, ms, GEO.taper, r[1] * 0.55);
        seg(JH, [0, -r[1] * 0.42, r[2] * 0.35], plus(tip, [0, -r[1] * 0.18, -len * 0.12]), r[0] * 0.3, {
          color: mcol,
          lod: 2,
        });
        blob(JH, plus(tip, [0, r[1] * 0.04, 0]), [r[0] * 0.2, r[0] * 0.16, r[0] * 0.16], {
          color: nose,
          lod: 2,
        });
        break;
      }
      case "cat": {
        const c: V3 = [0, -r[1] * 0.3, r[2] * 0.68];
        blob(JH, c, [r[0] * 0.5, r[1] * 0.38, r[2] * 0.42], { color: mix(body, mcol, 0.6), lod: 1 });
        tip = [0, -r[1] * 0.14, r[2] * 1.05];
        blob(JH, tip, [r[0] * 0.17, r[0] * 0.12, r[0] * 0.1], { color: nose, lod: 2 });
        break;
      }
      case "bear": {
        tip = [0, -r[1] * 0.35, r[2] * 0.55 + len * 0.85];
        seg(JH, [0, -r[1] * 0.12, r[2] * 0.35], tip, r[0] * 0.55, ms, GEO.cyl, r[1] * 0.52);
        blob(JH, tip, [r[0] * 0.25, r[0] * 0.18, r[0] * 0.14], { color: nose, lod: 2 });
        break;
      }
      case "pig": {
        tip = [0, -r[1] * 0.3, r[2] * 0.55 + len * 0.7];
        seg(JH, [0, -r[1] * 0.05, r[2] * 0.3], tip, r[0] * 0.72, ms, GEO.taper, r[1] * 0.68);
        // The flat disc nose.
        seg(
          JH,
          plus(tip, [0, 0, -0.006]),
          plus(tip, [0, 0, 0.01]),
          r[0] * 0.4,
          { color: nose, lod: 1 },
          GEO.cyl,
          r[1] * 0.38,
        );
        break;
      }
      case "rabbit": {
        const c: V3 = [0, -r[1] * 0.3, r[2] * 0.62];
        blob(JH, c, [r[0] * 0.62, r[1] * 0.5, r[2] * 0.48], { ...coat(1, 0.6), color: mcol });
        tip = [0, -r[1] * 0.18, r[2] * 1.05];
        blob(JH, tip, [r[0] * 0.14, r[0] * 0.1, r[0] * 0.08], { color: PINK, lod: 2 });
        break;
      }
      case "human": {
        seg(
          JH,
          [0, r[1] * 0.0, r[2] * 0.82],
          [0, -r[1] * 0.18, r[2] * 1.02],
          r[0] * 0.14,
          { color: body, lod: 2 },
          GEO.cone,
        );
        break;
      }
      case "croc": {
        tip = [0, -r[1] * 0.3, r[2] * 0.5 + len];
        seg(JH, [0, -r[1] * 0.1, r[2] * 0.4], tip, r[0] * 0.78, { ...coat(1, 0.7) }, GEO.taper, r[1] * 0.45);
        seg(
          JH,
          [0, -r[1] * 0.55, r[2] * 0.4],
          plus(tip, [0, -r[1] * 0.25, -len * 0.04]),
          r[0] * 0.66,
          {
            color: mix(body, bellyC, 0.6),
            lod: 1,
          },
          GEO.taper,
          r[1] * 0.25,
        );
        blob(JH, plus(tip, [0, r[1] * 0.18, -len * 0.03]), [r[0] * 0.2, r[1] * 0.18, r[0] * 0.18], {
          color: body,
          lod: 2,
        });
        break;
      }
      case "bird": {
        const k = jaw.spec.kind;
        if (k === "flatbill") {
          const bill = male && jaw.donor === "duck" ? BILL_M : BILL_F;
          tip = [0, -r[1] * 0.3, r[2] * 0.5 + len];
          seg(
            JH,
            [0, -r[1] * 0.12, r[2] * 0.55],
            tip,
            r[0] * 0.5,
            { color: bill, lod: 1 },
            GEO.cyl,
            r[1] * 0.18,
          );
        } else if (k === "hooked") {
          blob(JH, [0, -r[1] * 0.02, r[2] * 0.82], [r[0] * 0.36, r[1] * 0.3, r[2] * 0.22], {
            color: CERE,
            lod: 2,
          });
          const mid: V3 = [0, -r[1] * 0.12, r[2] * 0.8 + len * 0.55];
          seg(
            JH,
            [0, -r[1] * 0.08, r[2] * 0.85],
            mid,
            r[0] * 0.32,
            { color: HAWK_BEAK, lod: 1 },
            GEO.taper,
            r[1] * 0.38,
          );
          seg(
            JH,
            mid,
            plus(mid, [0, -len * 0.42, len * 0.12]),
            r[0] * 0.16,
            { color: HAWK_BEAK, lod: 2 },
            GEO.cone,
          );
        } else {
          tip = [0, -r[1] * 0.18, r[2] * 0.8 + len];
          seg(
            JH,
            [0, -r[1] * 0.1, r[2] * 0.82],
            tip,
            r[0] * 0.4,
            { color: BEAK, lod: 1 },
            GEO.cone,
            r[1] * 0.38,
          );
        }
        break;
      }
      case "fish": {
        const k = jaw.spec.kind;
        if (k === "shark") {
          tip = [0, r[1] * 0.05, r[2] + len * 0.45];
          seg(JH, [0, 0, r[2] * 0.6], tip, r[0] * 0.78, { ...coat(0) }, GEO.cone, r[1] * 0.62);
        } else if (len > 0.15) {
          // Pike: a long, flat "duck-bill" snout.
          tip = [0, -r[1] * 0.1, r[2] * 0.7 + len];
          seg(
            JH,
            [0, -r[1] * 0.05, r[2] * 0.6],
            tip,
            r[0] * 0.62,
            { ...coat(1, 0.6) },
            GEO.taper,
            r[1] * 0.38,
          );
        } else {
          tip = [0, 0, r[2] * 0.9 + len * 0.6];
          seg(JH, [0, 0, r[2] * 0.6], tip, r[0] * 0.6, { ...coat(1) }, GEO.cone, r[1] * 0.55);
        }
        break;
      }
      default:
        break;
    }
    drawTeeth(JH, r, tip, len, jaw.donor);
    void HF;
  }

  function drawTeeth(JH: Joint, r: V3, tip: V3, len: number, jawDonor: SpeciesId) {
    const teeth = P("teeth");
    if (!teeth) return;
    const t = teeth.spec.kind;
    if (t === "tusks") {
      const big = teeth.donor === "elephant";
      for (const s of [-1, 1]) {
        const a: V3 = big
          ? [s * r[0] * 0.4, -r[1] * 0.55, r[2] * 0.6]
          : [s * r[0] * 0.42, tip[1] - r[1] * 0.05, tip[2] - len * 0.3];
        const k = big ? hs * 1.4 : hs * 0.5;
        const m = plus(a, big ? [s * 0.02 * k, -0.12 * k, 0.22 * k] : [s * 0.05 * k, 0.12 * k, -0.02 * k]);
        seg(JH, a, m, (big ? 0.05 : 0.03) * k, { color: IVORY, lod: 1 }, GEO.taper);
        seg(
          JH,
          m,
          plus(m, big ? [s * 0.01 * k, 0.06 * k, 0.16 * k] : [s * 0.02 * k, 0.08 * k, -0.05 * k]),
          (big ? 0.025 : 0.015) * k,
          {
            color: IVORY,
            lod: 2,
          },
          GEO.cone,
        );
      }
    } else if (t === "conical" || t === "serrated") {
      const n = t === "conical" ? 5 : 4;
      for (const s of [-1, 1])
        for (let k = 0; k < n; k++) {
          const p = lerp3(
            [s * r[0] * 0.55, -r[1] * 0.45, r[2] * 0.55],
            [s * r[0] * 0.3, tip[1] - r[1] * 0.25, tip[2] - 0.01],
            k / n,
          );
          push(GEO.cone, JH, p, eulerQ(Math.PI, 0, 0), [r[0] * 0.06, r[1] * 0.2, r[0] * 0.06], {
            color: IVORY,
            lod: 2,
          });
        }
    } else if (t === "carnassial" && lookOf(jawDonor).muzzle !== "bird") {
      for (const s of [-1, 1])
        push(
          GEO.cone,
          JH,
          [s * r[0] * 0.18, tip[1] - r[1] * 0.12, tip[2] - len * 0.18],
          eulerQ(Math.PI, 0, 0),
          [r[0] * 0.05, r[1] * 0.2, r[0] * 0.05],
          { color: IVORY, lod: 2 },
        );
    }
  }

  function drawEyes(JH: Joint, r: V3, style: Muzzle) {
    const eyes = P("eyes");
    if (!eyes) return;
    // Eye size follows the eye gene, but never outgrows the head it sits in.
    const er = Math.min(clamp(eyes.spec.size * 0.42, 0.008, 0.07), r[0] * (style === "frog" ? 0.45 : 0.24));
    if (style === "frog") {
      for (const s of [-1, 1]) {
        const c: V3 = [s * r[0] * 0.55, r[1] * 0.8, r[2] * 0.15];
        blob(JH, c, [er, er, er], { color: FROG_EYE, lod: 1 });
        blob(JH, plus(c, [s * er * 0.35, er * 0.15, er * 0.55]), [er * 0.55, er * 0.4, er * 0.5], {
          color: EYE,
          lod: 2,
        });
      }
      return;
    }
    const fwd = eyes.spec.forward;
    for (const s of [-1, 1]) {
      const x = r[0] * (0.82 - fwd * 0.3);
      const z = r[2] * (0.35 + fwd * 0.35);
      const y = style === "croc" || style === "fish" ? r[1] * 0.35 : r[1] * 0.22;
      blob(JH, [s * x, y, z], [er, er, er * 0.85], { color: EYE, lod: 2 });
    }
  }

  function drawEars(HF: Frame, r: V3) {
    const ears = P("ears");
    if (!ears || ears.spec.kind === "none") return;
    const el = lookOf(ears.donor);
    const es = ears.spec.size;
    for (const s of [-1, 1]) {
      switch (ears.spec.kind) {
        case "pointed": {
          const side = ears.donor === "deer" ? 0.95 : ears.donor === "boar" ? 0.6 : 0.3;
          const base = at(HF, [s * r[0] * 0.55, r[1] * 0.72, -r[2] * 0.2]);
          const d: V3 = [s * Math.sin(side), Math.cos(side), -0.15];
          const q = orient(d, [0, 0, 1]);
          push(GEO.cone, STATIC, base, q, [es * 0.3, es * 0.85, es * 0.13], { color: body, lod: 1 });
          if (el.earTip)
            push(
              GEO.cone,
              STATIC,
              plus(
                base,
                vec([0, es * 0.42, 0])
                  .applyQuaternion(q)
                  .toArray() as V3,
              ),
              q,
              [es * 0.17, es * 0.45, es * 0.15],
              { color: hex(el.earTip), lod: 2 },
            );
          break;
        }
        case "round": {
          const c = at(HF, [s * r[0] * 0.62, r[1] * 0.78, -r[2] * 0.15]);
          blob(STATIC, c, [es * 0.6, es * 0.55, es * 0.3], { color: body, lod: 1 });
          break;
        }
        case "long": {
          const base = at(HF, [s * r[0] * 0.4, r[1] * 0.75, -r[2] * 0.3]);
          const J = joint(base, { anim: "earFlap", axis: 0, amp: 0.08, phase: s });
          blade(J, [0, 0, 0], [s * 0.15, 1, -0.25], [0, 0, 1], es * 0.32, es, { color: body, lod: 1 });
          blade(
            J,
            [0, es * 0.06, 0.008],
            [s * 0.15, 1, -0.25],
            [0, 0, 1],
            es * 0.2,
            es * 0.8,
            { color: PINK, lod: 2 },
            0.4,
          );
          break;
        }
        case "large": {
          const base = at(HF, [s * r[0] * 0.8, r[1] * 0.35, -r[2] * 0.25]);
          const J = joint(base, { anim: "earFlap", axis: 1, amp: 0.22, phase: s });
          // Hangs down and back, flat against the side of the head.
          blade(
            J,
            [0, 0, 0],
            [s * 0.3, -1, -0.35],
            [0, 0, 1],
            es * 0.7,
            es * 0.8,
            { color: body, lod: 1 },
            0.5,
          );
          break;
        }
        case "human": {
          const c = at(HF, [s * r[0] * 0.98, 0, 0]);
          blob(STATIC, c, [es * 0.22, es * 0.55, es * 0.38], { color: body, lod: 2 });
          break;
        }
      }
    }
  }

  // ------------------------------------------------------------ limbs
  const legPhase = (front: boolean, s: number): Anim => ((front ? s > 0 : s < 0) ? "legA" : "legB");

  function drawLeg(
    attach: V3,
    spec: { kind: LimbKind; len: number; thick: number },
    donor: SpeciesId,
    front: boolean,
    s: number,
  ) {
    const ll = lookOf(donor);
    const t = Math.max(0.012, spec.thick);
    const L = Math.max(0.02, attach[1]);
    const anim: Anim = biped ? (s > 0 ? "legA" : "legB") : legPhase(front, s);
    const J = joint(attach, { anim, axis: 0, amp: 0.45 });
    const sock = ll.socks ? hex(ll.socks) : null;
    const lower: Style = sock ? { color: sock, lod: 1 } : fur(1);
    switch (spec.kind) {
      case "grasping": {
        if (!biped && !front) break;
        const len = biped ? spec.len * limbK * 0.62 : L;
        const sleeve = bipedColors?.shirt;
        const JA = joint(attach, {
          anim: biped ? (s > 0 ? "armB" : "armA") : anim,
          axis: 0,
          amp: biped ? 0.4 : 0.45,
        });
        const elbow: V3 = [s * 0.012, -len * 0.5, -0.01];
        const wrist: V3 = [s * 0.018, -len * 0.95, 0.03];
        seg(JA, [0, 0, 0], elbow, t * 0.78, sleeve ? { color: sleeve, lod: 1 } : fur(1), GEO.cyl);
        seg(JA, elbow, wrist, t * 0.62, { color: body, lod: 1 }, GEO.cyl);
        blob(JA, plus(wrist, [0, -t * 0.4, 0.004]), [t * 0.55, t * 0.75, t * 0.45], { color: body, lod: 2 });
        if (!biped)
          blob(JA, [0, -L + t * 0.3, t * 0.3], [t * 0.7, t * 0.35, t * 0.9], { color: body, lod: 2 });
        return;
      }
      case "sprawling": {
        const JS = joint(attach, { anim, axis: 1, amp: 0.35 });
        const elbow: V3 = [s * L * 0.75, -L * 0.1, 0.02];
        const foot: V3 = [s * L * 0.85, -L + t * 0.35, 0.06];
        seg(JS, [0, 0, 0], elbow, t * 1.1, fur(1), GEO.taper);
        seg(JS, elbow, foot, t * 0.8, fur(1), GEO.cyl);
        if (ll.muzzle === "frog") {
          blade(
            JS,
            foot,
            [s * 0.3, 0, 1],
            [1, 0, 0],
            t * 2.2,
            t * 2.4,
            { color: mix(body, bellyC, 0.3), lod: 2 },
            0.3,
          );
        } else
          blob(JS, plus(foot, [s * t * 0.2, -t * 0.15, t * 0.5]), [t * 0.95, t * 0.35, t * 1.3], {
            color: darker(body, 0.85),
            lod: 2,
          });
        return;
      }
      case "hopping": {
        const JH2 = joint(attach, { anim: "hop", axis: 0, amp: 0.5 });
        if (ll.muzzle === "frog") {
          // Folded frog leg: thigh forward-out, shin back, long webbed foot forward.
          const knee: V3 = [s * spec.len * 0.22, -L * 0.5, spec.len * 0.12];
          const ankle: V3 = [s * spec.len * 0.26, -L + t * 0.4, -spec.len * 0.14];
          seg(JH2, [0, 0, 0], knee, t * 1.3, fur(1), GEO.taper);
          seg(JH2, knee, ankle, t * 0.8, fur(1), GEO.taper);
          seg(JH2, ankle, plus(ankle, [s * 0.02, -t * 0.25, spec.len * 0.2]), t * 0.5, fur(2), GEO.taper);
          blade(
            JH2,
            plus(ankle, [0, -t * 0.3, spec.len * 0.14]),
            [0, 0, 1],
            [1, 0, 0],
            t * 2.2,
            t * 2.2,
            {
              color: mix(body, bellyC, 0.3),
              lod: 2,
            },
            0.3,
          );
          return;
        }
        blob(JH2, [0, -L * 0.36, -0.02], [t * 1.4, L * 0.55, Math.max(L * 0.6, t * 2)], coat(1, 0.8));
        blob(JH2, [0, -L + t * 0.3, spec.len * 0.14], [t * 0.75, t * 0.3, spec.len * 0.38], {
          color: mix(body, bellyC, 0.45),
          lod: 1,
        });
        return;
      }
      case "bird":
      case "webbed":
      case "talons": {
        const footC = spec.kind === "webbed" ? WEB : spec.kind === "talons" ? TALON : BIRDFOOT;
        const JB = joint(attach, { anim, axis: 0, amp: 0.5, rotAlt: eulerQ(1.25, 0, 0) });
        const knee: V3 = [0, -L * 0.35, -t * 0.5];
        seg(
          JB,
          [0, 0, 0],
          knee,
          t * 1.3,
          { color: kind === "bird" ? body : fur(1).color, lod: 1 },
          GEO.taper,
        );
        seg(JB, knee, [0, -L + t * 0.25, t * 0.2], t * 0.42, { color: footC, lod: 1 }, GEO.cyl);
        const ankle: V3 = [0, -L + t * 0.2, t * 0.2];
        if (spec.kind === "webbed") {
          blade(
            JB,
            plus(ankle, [0, -t * 0.15, 0]),
            [0, 0, 1],
            [1, 0, 0],
            t * 4.5,
            t * 4.2,
            { color: footC, lod: 2 },
            0.3,
          );
        } else {
          for (const k of [-1, 0, 1])
            seg(JB, ankle, [k * t * 1.6, -L + 0.004, t * 3.2], t * 0.22, { color: footC, lod: 2 }, GEO.taper);
          seg(JB, ankle, [0, -L + 0.004, -t * 2.2], t * 0.2, { color: footC, lod: 2 }, GEO.taper);
          if (spec.kind === "talons")
            for (const k of [-1, 1])
              push(
                GEO.cone,
                JB,
                [k * t * 1.6, -L + 0.004, t * 3.2],
                eulerQ(Math.PI / 2 + 0.6, 0, 0),
                [t * 0.18, t * 0.9, t * 0.18],
                {
                  color: CLAW,
                  lod: 2,
                },
              );
        }
        return;
      }
      case "pillar": {
        seg(J, [0, -L, 0], [0, 0, 0], t * 0.78, fur(1), GEO.cyl);
        seg(J, [0, -L, 0], [0, -L + 0.04, 0], t * 0.86, { color: darker(body, 0.92), lod: 1 }, GEO.cyl);
        for (const k of [-1, 0, 1])
          blob(J, [k * t * 0.4, -L + 0.018, t * 0.78], [t * 0.16, t * 0.12, t * 0.09], {
            color: IVORY,
            lod: 2,
          });
        return;
      }
      case "plantigrade":
      case "bipedal": {
        const trou = biped ? bipedColors?.trousers : undefined;
        if (biped) {
          // Human legs: thigh, shin, shoe.
          const knee: V3 = [0, -L * 0.5, 0.012];
          const st: Style = trou ? { color: trou, lod: 1 } : fur(1);
          seg(J, [0, 0, 0], knee, t * 0.85, st, GEO.cyl);
          seg(J, knee, [0, -L + t * 0.55, -0.005], t * 0.66, st, GEO.cyl);
          blob(J, [0, -L + t * 0.36, t * 0.45], [t * 0.58, t * 0.36, t * 1.1], {
            color: trou ? hex("#2a211b") : darker(body, 0.8),
            lod: 1,
          });
          return;
        }
        blob(J, [0, -L * 0.06, 0], [t * 1.15, L * 0.24, t * 1.3], coat(1, 0.5));
        seg(J, [0, -L * 0.25, 0], [0, -L + t * 0.5, 0.01], t * 0.82, lower, GEO.taper);
        blob(J, [0, -L + t * 0.42, t * 0.55], [t * 1.1, t * 0.45, t * 1.6], {
          color: darker(sock ?? body, 0.8),
          lod: 1,
        });
        for (const k of [-1, 0, 1])
          push(
            GEO.cone,
            J,
            [k * t * 0.55, -L + t * 0.2, t * 2.0],
            eulerQ(Math.PI / 2, 0, 0),
            [t * 0.12, t * 0.4, t * 0.12],
            {
              color: CLAW,
              lod: 2,
            },
          );
        return;
      }
      default: {
        // Cursorial: deep shoulder/haunch, slim lower leg, hoof or paw.
        const hoof = ll.hooves;
        const footH = hoof ? t * 0.9 : t * 0.4;
        let footZ: number;
        if (front) {
          blob(J, [0, -L * 0.04, 0], [t * 1.05, L * 0.2, t * 1.45], coat(1, 0.6));
          seg(J, [0, -L * 0.18, 0.005], [0, -L * 0.6, 0.012], t * 0.72, fur(1), GEO.cyl);
          seg(J, [0, -L * 0.6, 0.012], [0, -L + footH, 0.02], t * 0.46, lower, GEO.cyl);
          footZ = 0.02;
        } else {
          blob(J, [0, -L * 0.04, -0.005], [t * 1.2, L * 0.26, t * 1.8], coat(1, 0.6));
          const hock: V3 = [0, -L * 0.6, -L * 0.12];
          seg(J, [0, -L * 0.24, -0.01], hock, t * 0.7, fur(1), GEO.cyl);
          seg(J, hock, [0, -L + footH, -L * 0.04], t * 0.44, lower, GEO.cyl);
          footZ = -L * 0.04;
        }
        if (hoof)
          seg(J, [0, -L + footH, footZ], [0, -L, footZ + 0.004], t * 0.6, { color: HOOF, lod: 2 }, GEO.cyl);
        else
          blob(J, [0, -L + t * 0.38, footZ + t * 0.35], [t * 0.75, t * 0.4, t * 1.05], {
            color: darker(sock ?? body, 0.85),
            lod: 2,
          });
      }
    }
  }

  if (fore && fore.spec.kind !== "none") {
    for (const s of [-1, 1]) {
      const attach: V3 = biped
        ? [s * 0.165, shoulderY - 0.02, 0]
        : kind === "frog"
          ? at(T, [s * W * 0.55, -H * 0.5, 0.35])
          : kind === "croc"
            ? at(T, [s * W * 0.85, -H * 0.3, 0.32])
            : kind === "bird"
              ? at(T, [s * W * 0.5, -H * 0.4, 0.2])
              : at(T, [s * W * 0.6, -H * 0.45, 0.3]);
      drawLeg(attach, fore.spec, fore.donor, true, s);
    }
  }
  if (hind && hind.spec.kind !== "none") {
    for (const s of [-1, 1]) {
      const attach: V3 = biped
        ? [s * 0.07, hipY, 0]
        : kind === "bird"
          ? at(T, [s * W * 0.35, -H * 0.7, -0.02])
          : kind === "frog"
            ? at(T, [s * W * 0.75, -H * 0.3, -0.4])
            : kind === "croc"
              ? at(T, [s * W * 0.85, -H * 0.3, -0.32])
              : at(T, [s * W * 0.58, -H * 0.4, -0.3]);
      drawLeg(attach, hind.spec, hind.donor, false, s);
    }
  }

  // ------------------------------------------------------------ tail
  const tail = P("tail");
  if (tail && tail.spec.kind !== "none") {
    const t = tail.spec;
    const tl = lookOf(tail.donor);
    const tip = tl.tailTip ? hex(tl.tailTip) : null;
    switch (t.kind) {
      case "short": {
        const c = tip ?? mix(body, bellyC, 0.4);
        blob(STATIC, rear, [0.04 + t.len * 0.3, 0.04 + t.len * 0.35, 0.04 + t.len * 0.25], {
          color: c,
          lod: 1,
        });
        break;
      }
      case "thin":
      case "tufted": {
        const J = joint(rear, { anim: "tail", axis: 1, amp: 0.4 });
        const r0 = Math.max(0.012, t.thick);
        const p1: V3 = [0, -t.len * 0.05, -t.len * 0.3];
        const p2: V3 = [0, -t.len * 0.5, -t.len * 0.42];
        const p3: V3 = [0, -t.len * 0.9, -t.len * 0.45];
        seg(J, [0, 0, 0], p1, r0, fur(1), GEO.taper);
        seg(J, p1, p2, r0 * 0.6, fur(1), GEO.taper);
        seg(J, p2, p3, r0 * 0.4, fur(2), GEO.taper);
        if (t.kind === "tufted" || tip)
          blob(J, plus(p3, [0, -r0 * 1.2, 0]), [r0 * 1.3, r0 * (t.kind === "tufted" ? 3 : 2), r0 * 1.3], {
            color: tip ?? darker(body, 0.4),
            lod: 2,
          });
        break;
      }
      case "bushy": {
        const J = joint(rear, { anim: "tail", axis: 1, amp: 0.3 });
        const d: V3 = [0, -0.55, -1];
        const q = orient(d, [1, 0, 0]);
        const n = vec(d).normalize();
        const mid = n
          .clone()
          .multiplyScalar(t.len * 0.5)
          .toArray() as V3;
        const end = n
          .clone()
          .multiplyScalar(t.len * 0.95)
          .toArray() as V3;
        blob(J, mid, [t.thick, t.len * 0.52, t.thick * 1.1], coat(1, 0.5), q);
        blob(J, end, [t.thick * 0.6, t.thick * 0.9, t.thick * 0.65], { color: tip ?? body, lod: 2 }, q);
        break;
      }
      case "heavy": {
        const J = joint(rear, { anim: "fishTail", axis: 1, amp: 0.22 });
        const p1: V3 = [0, -H * 0.3, -t.len * 0.5];
        const p2: V3 = [0, -H * 0.6, -t.len];
        seg(J, [0, 0, 0.05], p1, W * 0.75, fur(0), GEO.taper, H * 0.8);
        seg(J, p1, p2, W * 0.38, fur(1), GEO.taper, H * 0.4);
        for (let k = 0; k < 4; k++)
          push(
            GEO.cone,
            J,
            lerp3([0, H * 0.45, -0.02], [0, -H * 0.35, -t.len * 0.85], k / 4),
            ID_Q,
            [W * 0.08, H * 0.3, W * 0.1],
            {
              color: darker(body, 0.75),
              lod: 2,
            },
          );
        break;
      }
      case "feather": {
        const c = tip ?? mix(body, body2, 0.25);
        const J = joint(rear, { anim: "tail", axis: 1, amp: 0.08 });
        blade(J, [0, 0, 0], [0, -0.25, -1], [1, 0, 0], t.len * 0.55, t.len, { color: c, lod: 1 }, 0.5);
        if (tail.donor === "duck" && male)
          seg(
            J,
            [0, 0.01, -t.len * 0.4],
            [0, t.len * 0.35, -t.len * 0.45],
            0.012,
            { color: hex("#1d1d1d"), lod: 2 },
            GEO.cone,
          );
        break;
      }
      case "fish":
      case "shark": {
        const J = joint(rear, { anim: "fishTail", axis: 1, amp: 0.35 });
        const shark = t.kind === "shark";
        const fin = mix(body, darker(body, 0.7), 0.4);
        for (const s of [1, -1]) {
          const a = shark ? (s > 0 ? 0.75 : 0.85) : 0.62;
          const len = t.len * (shark ? (s > 0 ? 1.35 : 0.7) : 1);
          const d: V3 = [0, s * Math.sin(a), -Math.cos(a)];
          blade(
            J,
            [0, 0, 0],
            d,
            [0, Math.cos(a), Math.sin(a) * s],
            t.len * 0.5,
            len,
            { color: fin, lod: 0 },
            0.5,
          );
        }
        break;
      }
    }
  }

  // ------------------------------------------------------------ wings
  const wings = P("wings");
  if (wings) {
    const half = wings.spec.span / 2;
    const chord = clamp(
      wings.spec.kind === "broad" ? 0.5 : wings.spec.kind === "short" ? 0.42 : 0.34,
      0.25,
      0.55,
    );
    const wl = lookOf(wings.donor);
    for (const s of [-1, 1]) {
      const pivot: V3 = biped
        ? [s * 0.12, shoulderY - 0.01, -0.06]
        : kind === "bird"
          ? at(T, [s * W * 0.82, H * 0.5, 0.18])
          : at(T, [s * W * 0.85, H * 0.65, 0.18]);
      // Folded: span runs back along the side of the body, chord hanging down.
      const fold = new THREE.Quaternion()
        .multiplyQuaternions(eulerQ(0, 0, s * Math.PI * 0.44), eulerQ(0, (s * Math.PI) / 2, 0))
        .premultiply(eulerQ(-0.1, 0, 0));
      const J = joint(pivot, {
        anim: s < 0 ? "wingL" : "wingR",
        axis: 2,
        amp: 0.75,
        rot: ID_Q,
        rotAlt: fold,
      });
      blade(
        J,
        [0, 0, -chord * 0.5],
        [s, 0, 0],
        [0, 0, -1],
        chord,
        half,
        {
          color: mix(body, body2, 0.12),
          color2: mix(body, bellyC, 0.5),
          pattern: 0,
          lod: 0,
        },
        0.6,
      );
      // Dark primaries at the wing tip.
      blade(
        J,
        [s * half * 0.52, 0.004, -chord * 0.3],
        [s, 0, -0.15],
        [0, 0, -1],
        chord * 0.5,
        half * 0.5,
        {
          color: darker(body, wl.muzzle === "bird" ? 0.6 : 0.8),
          lod: 2,
        },
        0.5,
      );
    }
  }

  // ------------------------------------------------------------ fins
  const fins = P("fins");
  if (fins) {
    const fl = lookOf(fins.donor);
    const fs = fins.spec.size * (fins.spec.kind === "shark" ? 1.3 : 1);
    const fc = mix(body, darker(body, 0.7), 0.4);
    const dz = fl.dorsalZ ?? 0;
    const shark = fins.spec.kind === "shark";
    blade(
      JT,
      [0, H * 0.82, dz],
      [0, 1, shark ? -0.45 : -0.6],
      [0, 0.3, 1],
      fs * (shark ? 0.6 : 0.75),
      fs * (shark ? 0.75 : 0.5),
      { color: fc, lod: 0 },
      0.5,
    );
    if (shark)
      blade(
        JT,
        [0, H * 0.55, -0.4],
        [0, 1, -0.6],
        [0, 0.3, 1],
        fs * 0.25,
        fs * 0.22,
        { color: fc, lod: 2 },
        0.5,
      );
    if (fins.donor === "pike")
      blade(
        JT,
        [0, -H * 0.8, -0.32],
        [0, -1, -0.6],
        [0, -0.3, 1],
        fs * 0.6,
        fs * 0.4,
        { color: fc, lod: 2 },
        0.5,
      );
    for (const s of [-1, 1]) {
      const J = joint(at(T, [s * W * 0.75, -H * 0.35, 0.25]), { anim: "fin", axis: 2, amp: 0.25, phase: s });
      const d: V3 = shark ? [s, -0.25, -0.5] : [s * 0.6, -0.4, -1];
      blade(
        J,
        [0, 0, 0],
        d,
        [0, 0, 1],
        fs * (shark ? 0.5 : 0.35),
        fs * (shark ? 0.9 : 0.5),
        { color: fc, lod: 1 },
        0.5,
      );
    }
  }

  return parts;
}

/** Visual length (world units) from body length in metres: compressed so sparrows and elephants share a scene. */
export function displayLength(lengthM: number) {
  return 1.25 * Math.max(0.05, lengthM) ** 0.6;
}
