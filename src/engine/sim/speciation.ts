import { geneticDistance } from "../genetics/distance";
import { SPECIES } from "../species/roster";
import type { Agent, Lineage } from "./types";
import type { World } from "./world";

/** Individuals closer than this are considered part of one interbreeding cluster. */
const LINK = 0.5;
/** Mean distance between clusters needed before we call them separate species. */
const SPLIT = 0.6;
const SAMPLE = 64;
const MIN_CLUSTER = 6;

/**
 * Speciation and extinction tracking.
 *
 * Every 30 days each lineage is sampled; individuals are linked when their allele-sharing
 * distance is below LINK and connected components are found. When two large components
 * stay apart (mean distance > SPLIT, which also means sharply reduced hybrid fertility)
 * for two consecutive checks, the smaller ones are declared new species.
 */
export function trackSpeciation(w: World) {
  const byLineage = new Map<number, Agent[]>();
  for (const a of w.agents) {
    let arr = byLineage.get(a.lineage);
    if (!arr) byLineage.set(a.lineage, (arr = []));
    arr.push(a);
  }

  for (const lin of w.lineages) {
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
    if (members.length < MIN_CLUSTER * 2.5) {
      lin.splitStreak = 0;
      continue;
    }
    const sample = w.rng.shuffle([...members]).slice(0, SAMPLE);
    const comps = components(sample);
    const big = comps.filter((c) => c.length >= MIN_CLUSTER).sort((a, b) => b.length - a.length);
    if (big.length < 2 || meanBetween(big[0], big[1]) < SPLIT) {
      lin.splitStreak = 0;
      continue;
    }
    lin.splitStreak = (lin.splitStreak ?? 0) + 1;
    if (lin.splitStreak < 2) continue;
    lin.splitStreak = 0;

    // Split: the largest cluster keeps the parent lineage.
    const reps = big.map((c) => c.slice(0, 6));
    const newLins: Lineage[] = big.slice(1).map((c) => {
      const l: Lineage = {
        id: w.lineages.length,
        name: speciesName(w, lin, big[0], c),
        species: lin.species,
        parent: lin.id,
        bornDay: w.day,
        extinctDay: null,
        everAlive: true,
        color: shiftHue(lin.color, 40 + 70 * ((w.lineages.length * 37) % 5)),
      };
      w.lineages.push(l);
      w.totals.speciations++;
      w.notices.push({
        day: w.day,
        text: `Speciation! ${l.name} split from ${lin.name}.`,
        kind: "speciation",
      });
      return l;
    });
    for (const a of members) {
      let best = 0;
      let bestD = Infinity;
      reps.forEach((r, k) => {
        const d = r.reduce((s, b) => s + geneticDistance(a.genome, b.genome), 0) / r.length;
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      });
      if (best > 0) a.lineage = newLins[best - 1].id;
    }
  }
}

function components(sample: Agent[]): Agent[][] {
  const n = sample.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (find(i) === find(j)) continue;
      if (geneticDistance(sample[i].genome, sample[j].genome) < LINK) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, Agent[]>();
  sample.forEach((a, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(a);
  });
  return [...groups.values()];
}

function meanBetween(x: Agent[], y: Agent[]) {
  let s = 0;
  let n = 0;
  for (const a of x.slice(0, 12)) {
    for (const b of y.slice(0, 12)) {
      s += geneticDistance(a.genome, b.genome);
      n++;
    }
  }
  return s / n;
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
  if (dm > 1.12) epithet = "major";
  else if (dm < 0.88) epithet = "minor";
  else if (dl > 0.06) epithet = "pallidus";
  else if (dl < -0.06) epithet = "obscurus";
  else if (dt < -1.5) epithet = "borealis";
  else if (Math.abs(cx) > Math.abs(cz)) epithet = cx > 0 ? "orientalis" : "occidentalis";
  else epithet = cz > 0 ? "australis" : "septentrionalis";
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
