"use client";

import type { Phenotype } from "@/engine/anatomy/phenotype";
import type { Stats } from "@/engine/anatomy/stats";
import { cn } from "@/lib/cn";
import { InfoTip } from "@/ui/info-tip";

export interface StatDef {
  key: string;
  label: string;
  value: (ph: Phenotype, st: Stats) => number;
  format: (v: number, ph: Phenotype, st: Stats) => string;
  info: string;
  /** Higher is better (for comparison colouring). */
  better?: "up" | "down";
}

export const STATS: StatDef[] = [
  {
    key: "mass",
    label: "Mass",
    value: (p) => p.massKg,
    format: (v) => (v < 1 ? `${(v * 1000).toFixed(0)} g` : `${v.toFixed(v < 10 ? 1 : 0)} kg`),
    info: "Adult body mass: species baseline × polygenic size genes (GH1, IGF1, HMGA2…) with epistasis and a regulatory enhancer.",
  },
  {
    key: "bite",
    label: "Bite force",
    value: (_p, s) => s.biteN,
    format: (v) => `${v.toFixed(0)} N`,
    info: "Jaw module bite coefficient × 60·M^0.67 × dentition × MYH16 genotype. Calibrated to lion ≈ 4.5 kN, crocodile ≈ 16 kN, human ≈ 0.7 kN.",
    better: "up",
  },
  {
    key: "speed",
    label: "Top speed",
    value: (_p, s) => s.speedKmh,
    format: (v) => (v > 0 ? `${v.toFixed(0)} km/h` : "—"),
    info: "Hirt et al. (2017) allometric speed curve × hindlimb design × limb genes. Borrowed legs on a heavier body are overloaded.",
    better: "up",
  },
  {
    key: "swim",
    label: "Swim speed",
    value: (_p, s) => s.swimKmh,
    format: (v) => (v > 0 ? `${v.toFixed(0)} km/h` : "—"),
    info: "From fins, a heavy swimming tail, webbed feet, or a slow mammalian paddle.",
    better: "up",
  },
  {
    key: "flight",
    label: "Flight",
    value: (_p, s) => s.flightScore,
    format: (v, _p, s) =>
      s.wingLoading === Infinity
        ? "no wings"
        : `${s.canFly ? "flies" : "grounded"} · ${s.wingLoading.toFixed(0)} N/m²`,
    info: "Wing loading (weight / wing area) and the flight-power limit: muscle power scales with M, required power with M^7/6, capping flapping flight near 15–20 kg.",
    better: "up",
  },
  {
    key: "bmr",
    label: "Metabolism",
    value: (_p, s) => s.fmrKJ,
    format: (v) => `${(v / 4.184).toFixed(0)} kcal/d`,
    info: "Field metabolic rate ≈ activity level × Kleiber BMR (∝ M^0.75), plus brain and foreign-part costs.",
    better: "down",
  },
  {
    key: "thermal",
    label: "Comfort range",
    value: (_p, s) => s.heatLimitC - s.coldLimitC,
    format: (_v, _p, s) => `${s.coldLimitC.toFixed(0)} … ${s.heatLimitC.toFixed(0)} °C`,
    info: "Ambient temperatures tolerated without extra thermoregulation cost: thermal-optimum genes ± breadth, shifted by insulation, fat, sweating and ear size.",
    better: "up",
  },
  {
    key: "sense",
    label: "Senses",
    value: (_p, s) => s.senseM,
    format: (v) => `${v.toFixed(0)} m`,
    info: "Max of vision (eye size × RHO/OPN1LW), hearing (ear module × OTOF) and smell (OR7).",
    better: "up",
  },
  {
    key: "fert",
    label: "Fertility",
    value: (p, s) => p.fertility * s.fertilityMult,
    format: (v) => `${(v * 100).toFixed(0)}%`,
    info: "Litter-size multiplier from FSHB × developmental cost of foreign body parts.",
    better: "up",
  },
  {
    key: "life",
    label: "Lifespan",
    value: (p) => p.lifespanY,
    format: (v) => `${v.toFixed(0)} y`,
    info: "Expected lifespan from the species baseline and FOXO3 genotype (Gompertz ageing).",
    better: "up",
  },
  {
    key: "immunity",
    label: "Immunity",
    value: (p) => p.immunity,
    format: (v) => `${(v * 100).toFixed(0)}%`,
    info: "MHC genes with heterozygote advantage plus an epistatic MHC-A × MHC-B term.",
    better: "up",
  },
  {
    key: "dev",
    label: "Dev. cost",
    value: (_p, s) => s.devCost,
    format: (v) => (v > 0 ? `${(v * 100).toFixed(0)}%` : "none"),
    info: "Developmental-integration cost of body parts from other species, weighted by how long ago the lineages diverged.",
    better: "down",
  },
];

export function StatGrid({
  ph,
  st,
  compare,
}: {
  ph: Phenotype;
  st: Stats;
  compare?: { ph: Phenotype; st: Stats };
}) {
  return (
    <dl className="grid grid-cols-2 gap-1.5">
      {STATS.map((s) => {
        const v = s.value(ph, st);
        let delta: "up" | "down" | null = null;
        if (compare) {
          const c = s.value(compare.ph, compare.st);
          if (Math.abs(v - c) > Math.max(1e-6, Math.abs(c) * 0.03)) delta = v > c ? "up" : "down";
        }
        const good = delta && s.better ? delta === s.better : null;
        return (
          <div key={s.key} className="rounded-md bg-surface-2 px-2.5 py-1.5">
            <dt className="flex items-center gap-1 text-[10px] tracking-wider text-fg-subtle uppercase">
              {s.label}
              <InfoTip title={s.label} side="left" className="size-4">
                {s.info}
              </InfoTip>
            </dt>
            <dd
              className={cn(
                "truncate font-mono text-xs tabular-nums",
                good === true && "text-success",
                good === false && "text-danger",
              )}
            >
              {delta === "up" ? "▲ " : delta === "down" ? "▼ " : ""}
              {s.format(v, ph, st)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

const TRAITS: { key: keyof Phenotype; label: string; info: string }[] = [
  {
    key: "boldness",
    label: "Boldness",
    info: "DRD4-like novelty seeking: bold animals flee later and explore more.",
  },
  {
    key: "sociality",
    label: "Sociality",
    info: "OXTR-like: drives herding, pack hunting, schooling and band cohesion.",
  },
  { key: "aggression", label: "Aggression", info: "MAOA-like: attack threshold and contest success." },
  {
    key: "choosiness",
    label: "Choosiness",
    info: "Female preference strength for ornaments (Fisherian sexual selection).",
  },
  {
    key: "ornament",
    label: "Ornament",
    info: "Mane, antlers, plumage: a costly signal, mostly male-expressed.",
  },
];

export function TraitBars({ ph }: { ph: Phenotype }) {
  return (
    <div className="space-y-1.5">
      {TRAITS.map((t) => {
        const v = ph[t.key] as number;
        return (
          <div key={t.key} className="flex items-center gap-2 text-xs">
            <span className="flex w-24 items-center gap-1 text-fg-muted">
              {t.label}
              <InfoTip title={t.label} side="left" className="size-4">
                {t.info}
              </InfoTip>
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-accent/80" style={{ width: `${v * 100}%` }} />
            </div>
            <span className="w-8 text-right font-mono tabular-nums">{Math.round(v * 100)}</span>
          </div>
        );
      })}
    </div>
  );
}
