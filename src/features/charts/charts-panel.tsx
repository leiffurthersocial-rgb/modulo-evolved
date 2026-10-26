"use client";

import { useEffect, useMemo, useState } from "react";
import { LOCI, LOCUS_INDEX } from "@/engine/genetics/layout";
import type { AlleleTrack, TraitKey } from "@/engine/sim/recorder";
import { SPECIES } from "@/engine/species/roster";
import type { SpeciesId } from "@/engine/species/types";
import { sim } from "@/sim/client";
import { useWorld } from "@/sim/world-store";
import { cn } from "@/lib/cn";
import { InfoTip } from "@/ui/info-tip";
import { Switch } from "@/ui/switch";
import { Histogram } from "./histogram";
import { LineChart, type Series } from "./line-chart";

const TRAITS: { key: TraitKey; label: string; format: (v: number) => string }[] = [
  { key: "mass", label: "Body mass (kg)", format: (v) => v.toFixed(v < 10 ? 2 : 0) },
  { key: "speed", label: "Top speed (km/h)", format: (v) => v.toFixed(0) },
  { key: "bite", label: "Bite force (N)", format: (v) => v.toFixed(0) },
  { key: "ornament", label: "Ornament", format: (v) => v.toFixed(2) },
  { key: "sociality", label: "Sociality", format: (v) => v.toFixed(2) },
  { key: "lightness", label: "Pigment lightness", format: (v) => v.toFixed(2) },
  { key: "immunity", label: "Immunity", format: (v) => v.toFixed(2) },
  { key: "het", label: "Heterozygosity", format: (v) => v.toFixed(2) },
  { key: "culture", label: "Culture (humans)", format: (v) => v.toFixed(2) },
];

const PALETTE = ["#2dd4bf", "#f59e0b", "#60a5fa", "#f87171", "#c084fc", "#4ade80", "#e879f9", "#fbbf24"];

export function ChartsPanel() {
  const series = useWorld((s) => s.series);
  const counts = useWorld((s) => s.speciesCounts);
  const present = useMemo(() => {
    const ids = new Set<SpeciesId>();
    for (const p of series) for (const k of Object.keys(p.species) as SpeciesId[]) ids.add(k);
    return [...ids].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0));
  }, [series, counts]);
  const [focus, setFocus] = useState<SpeciesId | null>(null);
  const species = focus && present.includes(focus) ? focus : (present[0] ?? "rabbit");

  if (series.length < 2)
    return (
      <p className="p-6 text-sm text-fg-muted">Collecting data… charts appear after a few simulated days.</p>
    );

  return (
    <div className="space-y-6 p-4">
      <PopulationChart present={present} />
      <DiversityChart />
      <section className="space-y-2">
        <h3 className="text-[11px] font-medium tracking-wider text-fg-subtle uppercase">Focus species</h3>
        <div className="flex flex-wrap gap-1">
          {present.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={species === id}
              onClick={() => setFocus(id)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-fg-muted focus-ring pointer-coarse:h-11",
                species === id && "border-accent/60 bg-accent-muted/40 text-accent-strong",
              )}
            >
              <span className="size-2 rounded-full" style={{ background: SPECIES[id].color }} />
              {SPECIES[id].name}
            </button>
          ))}
        </div>
      </section>
      <TraitChart species={species} />
      <AlleleChart species={species} />
      <Distribution species={species} />
      <DeathCauses />
      <ClimateChart />
    </div>
  );
}

function Card({
  title,
  info,
  children,
  extra,
}: {
  title: string;
  info: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-fg-subtle uppercase">
          {title}
          <InfoTip title={title} side="left">
            {info}
          </InfoTip>
        </h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

function PopulationChart({ present }: { present: SpeciesId[] }) {
  const series = useWorld((s) => s.series);
  const [hidden, setHidden] = useState<Set<SpeciesId>>(new Set());
  const [log, setLog] = useState(true);
  const data: Series[] = present
    .filter((id) => !hidden.has(id))
    .map((id) => ({
      key: id,
      label: SPECIES[id].name,
      color: SPECIES[id].color,
      points: series.map((p) => [p.day, p.species[id]?.n ?? 0] as [number, number]),
    }));
  return (
    <Card
      title="Population"
      info="Individuals per species over time. Predator–prey cycles, seasonal booms and crashes, and extinctions all show up here. Log scale makes small and large populations comparable."
      extra={
        <label className="flex items-center gap-2 text-xs text-fg-muted">
          log
          <Switch checked={log} onCheckedChange={setLog} aria-label="Logarithmic scale" />
        </label>
      }
    >
      <LineChart series={data} logY={log} label="Population per species" height={170} />
      <div className="flex flex-wrap gap-1">
        {present.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={!hidden.has(id)}
            onClick={() =>
              setHidden((h) => {
                const n = new Set(h);
                if (n.has(id)) n.delete(id);
                else n.add(id);
                return n;
              })
            }
            className={cn(
              "flex h-7 items-center gap-1 rounded px-1.5 text-[11px] focus-ring pointer-coarse:h-9",
              hidden.has(id) ? "text-fg-subtle line-through" : "text-fg-muted",
            )}
          >
            <span
              className="size-2 rounded-full"
              style={{ background: SPECIES[id].color, opacity: hidden.has(id) ? 0.3 : 1 }}
            />
            {SPECIES[id].name}
          </button>
        ))}
      </div>
    </Card>
  );
}

function DiversityChart() {
  const series = useWorld((s) => s.series);
  return (
    <Card
      title="Biodiversity"
      info="Richness = number of lineages alive (new species add to it). Shannon H′ = −Σ p ln p also accounts for how evenly individuals are spread across lineages."
    >
      <LineChart
        label="Biodiversity"
        height={110}
        yMin={0}
        series={[
          {
            key: "rich",
            label: "Richness",
            color: "#2dd4bf",
            points: series.map((p) => [p.day, p.richness]),
          },
          {
            key: "shannon",
            label: "Shannon H′ ×5",
            color: "#f59e0b",
            points: series.map((p) => [p.day, p.shannon * 5]),
            dashed: true,
          },
        ]}
      />
    </Card>
  );
}

function TraitChart({ species }: { species: SpeciesId }) {
  const series = useWorld((s) => s.series);
  const [trait, setTrait] = useState<TraitKey>("mass");
  const t = TRAITS.find((x) => x.key === trait)!;
  return (
    <Card
      title={`${SPECIES[species].name}: trait means`}
      info="Population mean of a trait over time. Directional change means selection (or drift in small populations); compare with the environment you set."
      extra={
        <select
          value={trait}
          onChange={(e) => setTrait(e.target.value as TraitKey)}
          aria-label="Trait"
          className="h-9 rounded-md border border-border bg-surface-2 px-2 text-xs focus-ring pointer-coarse:h-11"
        >
          {TRAITS.map((x) => (
            <option key={x.key} value={x.key}>
              {x.label}
            </option>
          ))}
        </select>
      }
    >
      <LineChart
        label={`${t.label} mean`}
        height={120}
        yFormat={t.format}
        series={[
          {
            key: trait,
            label: t.label,
            color: SPECIES[species].color,
            points: series
              .filter((p) => p.species[species])
              .map((p) => [p.day, p.species[species]!.m[trait]]),
          },
        ]}
      />
    </Card>
  );
}

function AlleleChart({ species }: { species: SpeciesId }) {
  const [locus, setLocus] = useState(species === "human" ? "lactase" : "colE");
  const [track, setTrack] = useState<AlleleTrack | null>(null);
  const day = useWorld((s) => Math.floor(s.day / 5));
  useEffect(() => {
    let alive = true;
    void sim.rpc<AlleleTrack | null>("getTrack", species, locus).then((t) => alive && setTrack(t));
    return () => {
      alive = false;
    };
  }, [species, locus, day]);
  const data: Series[] = useMemo(() => {
    if (!track) return [];
    const totals = new Map<number, number>();
    track.freqs.forEach((f) =>
      Object.entries(f).forEach(([id, v]) => totals.set(Number(id), (totals.get(Number(id)) ?? 0) + v)),
    );
    const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    return top.map(([id], k) => ({
      key: String(id),
      label: `allele …${String(id).slice(-4)}`,
      color: PALETTE[k % PALETTE.length],
      points: track.days.map((d, i) => [d, track.freqs[i][id] ?? 0] as [number, number]),
    }));
  }, [track]);
  return (
    <Card
      title={`${SPECIES[species].name}: allele frequencies`}
      info="Frequencies of the commonest alleles at a locus. Without selection they wander randomly (genetic drift, faster in small populations); under selection one rises steadily. New mutations appear as new lines. Tracking starts when you pick a locus."
      extra={
        <select
          value={locus}
          onChange={(e) => setLocus(e.target.value)}
          aria-label="Locus"
          className="h-9 max-w-40 rounded-md border border-border bg-surface-2 px-2 text-xs focus-ring pointer-coarse:h-11"
        >
          {LOCI.map((l) => (
            <option key={l.key} value={l.key}>
              {l.name} · {l.trait ?? l.slot ?? l.kind}
            </option>
          ))}
        </select>
      }
    >
      {data.length ? (
        <LineChart
          label="Allele frequencies"
          height={120}
          yMin={0}
          yFormat={(v) => v.toFixed(2)}
          series={data}
        />
      ) : (
        <p className="text-xs text-fg-subtle">
          Tracking {LOCI[LOCUS_INDEX[locus]].name}… check back in a few days.
        </p>
      )}
    </Card>
  );
}

function Distribution({ species }: { species: SpeciesId }) {
  const [trait, setTrait] = useState<TraitKey>("mass");
  const [values, setValues] = useState<number[]>([]);
  const day = useWorld((s) => Math.floor(s.day / 3));
  useEffect(() => {
    let alive = true;
    void sim.rpc<number[]>("traitValues", species, trait).then((v) => alive && setValues(v));
    return () => {
      alive = false;
    };
  }, [species, trait, day]);
  const t = TRAITS.find((x) => x.key === trait)!;
  return (
    <Card
      title={`${SPECIES[species].name}: distribution now`}
      info="Current spread of a trait across living individuals. Polygenic traits are roughly normal; selection shifts or narrows the distribution; disruptive selection can split it."
      extra={
        <select
          value={trait}
          onChange={(e) => setTrait(e.target.value as TraitKey)}
          aria-label="Distribution trait"
          className="h-9 rounded-md border border-border bg-surface-2 px-2 text-xs focus-ring pointer-coarse:h-11"
        >
          {TRAITS.map((x) => (
            <option key={x.key} value={x.key}>
              {x.label}
            </option>
          ))}
        </select>
      }
    >
      <Histogram
        values={values}
        label={`${t.label} · n = ${values.length}`}
        format={t.format}
        color={SPECIES[species].color}
      />
    </Card>
  );
}

const CAUSE_COLOR: Record<string, string> = {
  predation: "#f87171",
  starvation: "#f59e0b",
  age: "#9aa7b4",
  disease: "#84cc16",
  cold: "#60a5fa",
  heat: "#fb923c",
  uv: "#facc15",
  hunted: "#e879f9",
  catastrophe: "#ef4444",
  culled: "#6b7886",
};

function DeathCauses() {
  const causes = useWorld((s) => s.deathCauses);
  const totals = useWorld((s) => s.totals);
  const entries = Object.entries(causes).filter(([, v]) => (v ?? 0) > 0) as [string, number][];
  const total = entries.reduce((a, [, v]) => a + v, 0) || 1;
  return (
    <Card
      title="Births, deaths & mutations"
      info="Cumulative totals since the world began. Causes of death reveal what limits populations: predation, starvation, disease, climate or human hunting."
    >
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {[
          ["Births", totals.births],
          ["Deaths", totals.deaths],
          ["Mutations", totals.mutations],
          ["New species", totals.speciations],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md bg-surface-2 p-1.5">
            <p className="text-[9px] tracking-wider text-fg-subtle uppercase">{k}</p>
            <p className="font-mono text-xs">{(v as number | undefined) ?? 0}</p>
          </div>
        ))}
      </div>
      <div className="flex h-3 overflow-hidden rounded-full">
        {entries.map(([k, v]) => (
          <div
            key={k}
            title={`${k}: ${v}`}
            style={{ width: `${(v / total) * 100}%`, background: CAUSE_COLOR[k] }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 text-xs">
        {entries
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => (
            <li key={k} className="flex justify-between">
              <span className="flex items-center gap-1.5 text-fg-muted capitalize">
                <span className="size-2 rounded-sm" style={{ background: CAUSE_COLOR[k] }} />
                {k}
              </span>
              <span className="font-mono">{Math.round((v / total) * 100)}%</span>
            </li>
          ))}
      </ul>
    </Card>
  );
}

function ClimateChart() {
  const series = useWorld((s) => s.series);
  const maxVeg = Math.max(1, ...series.map((p) => p.vegetation));
  return (
    <Card
      title="Climate & vegetation"
      info="Sea-level temperature (seasons, ice ages, impact winters) and total plant biomass — the energy base of the food web."
    >
      <LineChart
        label="Temperature and vegetation"
        height={110}
        yFormat={(v) => v.toFixed(0)}
        series={[
          {
            key: "t",
            label: "Temperature °C",
            color: "#fb923c",
            points: series.map((p) => [p.day, p.temperature]),
          },
          {
            key: "v",
            label: "Vegetation (% of max)",
            color: "#84cc16",
            points: series.map((p) => [p.day, (p.vegetation / maxVeg) * 40]),
            dashed: true,
          },
        ]}
      />
    </Card>
  );
}
