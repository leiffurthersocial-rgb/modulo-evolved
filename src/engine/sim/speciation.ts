import { SPECIES } from "../species/roster";
import type { Agent, Lineage } from "./types";
import type { World } from "./world";

/** Animals within this distance (world units) are treated as one interbreeding deme. */
const DEME_LINK = 22;
const MIN_DEME = 8;
/** F_ST above which isolated demes count as (incipient) species. Wright: 0.05–0.15 = moderate differentiation. Accelerated for the sandbox. */
const FST_SPLIT = 0.08;
/** Consecutive 30-day checks a split must persist. */
const STREAK = 3;
const SAMPLE = 40;

/**
 * Speciation and extinction tracking (allopatric model).
 *
 * Every 30 days each lineage is partitioned into spatially connected demes (animals that can
 * actually meet and mate). When two demes stay strongly differentiated — Wright's F_ST from
 * allele frequencies across all loci above 0.08 — for three checks in a row, the smaller deme
 * is declared a new species. Postzygotic isolation then accumulates with time apart
 * (see `isolation()`), so lineages that meet again interbreed less and less.
 */
export function trackSpeciation(w: World) {
  const byLineage = new Map<number, Agent[]>();
  for (const a of w.agents) {
    let arr = byLineage.get(a.lineage);
    if (!arr) byLineage.set(a.lineage, (arr = []));
    arr.push(a);
  }

  for (const lin of [...w.lineages]) {
    if (lin.extinctDay !== null) continue;
    const members = byLineage.get(lin.id) ?? [];
    if (members.length > 0) lin.everAlive = true;
    // Species never present in this world aren't "extinct", just absent.
    if (members.length === 0 && !lin.everAlive) continue;
    if (members.length === 0) {
      lin.extinctDay = w.day;
      w.totals.extinctions++;
      w.notices.push({ day: w.day, text: `${lin.name} went extinct.`, kind: "extinction" });
      continue;
    }
    if (members.length < MIN_DEME * 2) {
      lin.splitStreak = 0;
      continue;
    }
    const demes = spatialDemes(members).filter((d) => d.length >= MIN_DEME);
    if (demes.length < 2) {
      lin.splitStreak = 0;
      continue;
    }
    demes.sort((a, b) => b.length - a.length);
    let best: Agent[] | null = null;
    let bestF = 0;
    for (const d of demes.slice(1)) {
      const f = fst(w.rng.shuffle([...demes[0]]).slice(0, SAMPLE), w.rng.shuffle([...d]).slice(0, SAMPLE));
      if (f > bestF) {
        bestF = f;
        best = d;
      }
    }
    if (!best || bestF < FST_SPLIT) {
      lin.splitStreak = 0;
      continue;
    }
    lin.splitStreak = (lin.splitStreak ?? 0) + 1;
    if (lin.splitStreak < STREAK) continue;
    lin.splitStreak = 0;

    const l: Lineage = {
      id: w.lineages.length,
      name: speciesName(w, lin, demes[0], best),
      species: lin.species,
      parent: lin.id,
      bornDay: w.day,
      extinctDay: null,
      everAlive: true,
      color: shiftHue(lin.color, 40 + 70 * ((w.lineages.length * 37) % 5)),
    };
    w.lineages.push(l);
    for (const a of best) a.lineage = l.id;
    w.totals.speciations++;
    w.notices.push({
      day: w.day,
      text: `Speciation! ${l.name} split from ${lin.name} (F_ST = ${bestF.toFixed(2)}).`,
      kind: "speciation",
    });
  }
}

/**
 * Postzygotic isolation between two lineages from time since they diverged: Dobzhansky–Muller
 * incompatibilities accumulate roughly linearly with divergence time (Coyne & Orr 1989).
 */
export function isolation(w: World, l1: number, l2: number): number {
  if (l1 === l2) return 1;
  const a = w.lineages[l1];
  const b = w.lineages[l2];
  if (!a || !b) return 1;
  const split = Math.max(a.parent !== null ? a.bornDay : 0, b.parent !== null ? b.bornDay : 0);
  const years = Math.max(0, (w.day - split) / 365);
  return Math.max(0, 1 - years / 12);
}

function spatialDemes(members: Agent[]): Agent[][] {
  const n = members.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const r2 = DEME_LINK * DEME_LINK;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = members[i].x - members[j].x;
      const dz = members[i].z - members[j].z;
      if (dx * dx + dz * dz < r2) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, Agent[]>();
  members.forEach((a, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(a);
  });
  return [...groups.values()];
}

/** Wright's F_ST = (H_T − H_S) / H_T, ratio of sums over all loci. */
export function fst(x: Agent[], y: Agent[]): number {
  const L = x[0].genome.a.length;
  let num = 0;
  let den = 0;
  const freqs = (pop: Agent[], i: number) => {
    const m = new Map<number, number>();
    let n = 0;
    for (const a of pop)
      for (const al of [a.genome.a[i], a.genome.b[i]]) {
        if (!al) continue;
        m.set(al.id, (m.get(al.id) ?? 0) + 1);
        n++;
      }
    for (const [k, v] of m) m.set(k, v / n);
    return m;
  };
  for (let i = 0; i < L; i++) {
    const p = freqs(x, i);
    const q = freqs(y, i);
    const ids = new Set([...p.keys(), ...q.keys()]);
    let hx = 1;
    let hy = 1;
    let ht = 1;
    for (const id of ids) {
      const a = p.get(id) ?? 0;
      const b = q.get(id) ?? 0;
      hx -= a * a;
      hy -= b * b;
      ht -= ((a + b) / 2) ** 2;
    }
    num += ht - (hx + hy) / 2;
    den += ht;
  }
  return den > 0 ? num / den : 0;
}

const mean = (xs: Agent[], f: (a: Agent) => number) => xs.reduce((s, a) => s + f(a), 0) / xs.length;

function speciesName(w: World, parent: Lineage, main: Agent[], branch: Agent[]) {
  const genus = SPECIES[parent.species].latin.split(" ")[0];
  const dm = mean(branch, (a) => a.ph.massKg) / mean(main, (a) => a.ph.massKg);
  const dl = mean(branch, (a) => a.ph.lightness) - mean(main, (a) => a.ph.lightness);
  const dt = mean(branch, (a) => a.ph.thermalOpt) - mean(main, (a) => a.ph.thermalOpt);
  const cx = mean(branch, (a) => a.x);
  const cz = mean(branch, (a) => a.z);
  let epithet: string;
  if (dm > 1.1) epithet = "major";
  else if (dm < 0.9) epithet = "minor";
  else if (dl > 0.05) epithet = "pallidus";
  else if (dl < -0.05) epithet = "obscurus";
  else if (dt < -1.2) epithet = "borealis";
  else if (Math.hypot(cx, cz) > 40)
    epithet =
      Math.abs(cx) > Math.abs(cz)
        ? cx > 0
          ? "orientalis"
          : "occidentalis"
        : cz > 0
          ? "australis"
          : "septentrionalis";
  else epithet = "insularis";
  let name = `${genus} ${epithet}`;
  let k = 2;
  while (w.lineages.some((l) => l.name === name)) name = `${genus} ${epithet} ${roman(k++)}`;
  return name;
}

function roman(n: number) {
  return ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][n] ?? String(n);
}

function shiftHue(hex: string, deg: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = ((n >> 16) & 255) / 255;
  let g = ((n >> 8) & 255) / 255;
  let b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  h = (h + deg / 360) % 1;
  s = Math.max(s, 0.45);
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  r = hue2rgb(p, q, h + 1 / 3);
  g = hue2rgb(p, q, h);
  b = hue2rgb(p, q, h - 1 / 3);
  const c = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
