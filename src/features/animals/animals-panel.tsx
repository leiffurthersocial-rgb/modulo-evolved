"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronsRight, Eraser, MapPin, Square, Utensils } from "lucide-react";
import { SPECIES, SPECIES_IDS } from "@/engine/species/roster";
import type { SpeciesId } from "@/engine/species/types";
import { cn } from "@/lib/cn";
import { sim } from "@/sim/client";
import { useWorld } from "@/sim/world-store";
import { useEnv } from "@/state/env-store";
import { useUi } from "@/state/ui-store";
import { Button } from "@/ui/button";
import { InfoTip } from "@/ui/info-tip";
import { Slider } from "@/ui/slider";
import { Switch } from "@/ui/switch";
import { SectionTitle } from "../inspector/inspector-panel";

/** Hands-on keeper tools: place animals, feed them, cap populations and fast-forward generations. */
export function AnimalsPanel() {
  return (
    <div className="space-y-6 p-4">
      <Generations />
      <PlaceAnimals />
      <Populations />
      <WorldTools />
    </div>
  );
}

// ------------------------------------------------------------------ generations

function Generations() {
  const ff = useWorld((s) => s.fastForward);
  const mean = useWorld((s) => s.meanGeneration);
  const counts = useWorld((s) => s.speciesCounts);
  const present = SPECIES_IDS.filter((id) => (counts[id] ?? 0) > 0);
  const [species, setSpecies] = useState<SpeciesId | "all">("all");
  const target = species !== "all" && !present.includes(species) ? "all" : species;

  if (ff) {
    const span = Math.max(1e-6, ff.target - ff.from);
    const progress = Math.min(1, Math.max(0, (ff.current - ff.from) / span));
    return (
      <section className="space-y-2">
        <SectionTitle>Fast-forwarding</SectionTitle>
        <p className="text-sm">
          {ff.species ? SPECIES[ff.species].name : "All animals"}: generation {ff.current.toFixed(1)} →{" "}
          {ff.target}
        </p>
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-3"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
        >
          <div className="h-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="text-xs text-fg-muted">
          {ff.days < 730 ? `${Math.round(ff.days)} days` : `${(ff.days / 365).toFixed(1)} years`} simulated
        </p>
        <Button size="sm" variant="secondary" onClick={() => sim.cancelFastForward()}>
          <Square /> Stop
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <SectionTitle info="Runs the simulation flat out (without waiting for real time) until the average generation number of living animals has gone up by the chosen amount. Founders are generation 0, their young generation 1, and so on.">
        Generations
      </SectionTitle>
      <p className="text-sm text-fg-muted">
        Average generation of living animals: <span className="font-mono text-fg">{mean.toFixed(1)}</span>
      </p>
      <label className="flex items-center gap-2 text-sm text-fg-muted">
        For
        <select
          value={target}
          onChange={(e) => setSpecies(e.target.value as SpeciesId | "all")}
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2 text-sm text-fg focus-ring"
          aria-label="Species to fast-forward"
        >
          <option value="all">All animals</option>
          {present.map((id) => (
            <option key={id} value={id}>
              {SPECIES[id].name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-3 gap-1.5">
        {[1, 5, 10].map((n) => (
          <Button
            key={n}
            size="sm"
            variant={n === 1 ? "primary" : "secondary"}
            disabled={present.length === 0}
            aria-label={`Fast-forward ${n} generation${n > 1 ? "s" : ""}`}
            onClick={() => sim.fastForward(n, target === "all" ? null : target)}
          >
            <ChevronsRight /> +{n}
          </Button>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ place animals

function PlaceAnimals() {
  const tool = useUi((s) => s.spawnTool);
  const [species, setSpecies] = useState<SpeciesId>(tool?.species ?? "human");
  const [sex, setSex] = useState<"F" | "M" | "pair">(tool?.sex ?? "pair");
  const [count, setCount] = useState(tool?.count ?? 2);
  // Keep an active tool in sync with the choices.
  useEffect(() => {
    if (useUi.getState().spawnTool) useUi.getState().setSpawnTool({ species, sex, count });
  }, [species, sex, count]);

  return (
    <section className="space-y-2">
      <SectionTitle info="Choose a species, then tap the ground in the 3D view to release wild-type animals there (each with its own genome drawn from the species' founding gene pool). Fish go in water.">
        Place animals
      </SectionTitle>
      <div className="grid grid-cols-3 gap-1">
        {SPECIES_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={species === id}
            onClick={() => setSpecies(id)}
            className={cn(
              "flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 text-left text-xs text-fg-muted focus-ring",
              species === id && "border-accent/60 bg-accent-muted/40 text-fg",
            )}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ background: SPECIES[id].color }} />
            <span className="truncate">{SPECIES[id].name}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div role="radiogroup" aria-label="Sex" className="inline-flex gap-1 rounded-lg bg-surface-2 p-1">
          {(
            [
              ["F", "♀"],
              ["M", "♂"],
              ["pair", "♀♂"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={sex === v}
              aria-label={v === "F" ? "Females" : v === "M" ? "Males" : "Mixed pairs"}
              onClick={() => setSex(v)}
              className={cn(
                "h-9 min-w-11 rounded-md px-2 text-sm text-fg-muted focus-ring pointer-coarse:h-11",
                sex === v && "bg-surface-3 text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Stepper value={count} min={1} max={20} onChange={setCount} label="How many" />
      </div>
      <Button
        className="h-auto min-h-11 w-full py-2 whitespace-normal"
        variant={tool ? "primary" : "secondary"}
        onClick={() => useUi.getState().setSpawnTool(tool ? null : { species, sex, count })}
      >
        <MapPin /> {tool ? "Done placing" : `Place ${count} × ${SPECIES[species].name} — then tap the ground`}
      </Button>
    </section>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <Button
        size="icon"
        variant="secondary"
        aria-label={`Fewer (${label})`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </Button>
      <span className="w-8 text-center font-mono text-sm tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button
        size="icon"
        variant="secondary"
        aria-label={`More (${label})`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </Button>
    </div>
  );
}

// ------------------------------------------------------------------ per-species controls

function Populations() {
  const counts = useWorld((s) => s.speciesCounts);
  const caps = useEnv((s) => s.caps);
  const provision = useEnv((s) => s.provision);
  const ids = SPECIES_IDS.filter(
    (id) => (counts[id] ?? 0) > 0 || caps[id] !== undefined || (provision[id] ?? 0) > 0,
  );
  const [open, setOpen] = useState<SpeciesId | null>(null);

  return (
    <section className="space-y-2">
      <SectionTitle info="Per-species controls. Max population caps births (the world's total animal budget still applies). Daily food is delivered by the keeper: enough for that many adults of the species; young and small animals eat less. With food set, animals no longer need to forage.">
        Species
      </SectionTitle>
      {ids.length === 0 && <p className="text-sm text-fg-muted">No animals. Place some above.</p>}
      <ul className="space-y-1">
        {ids.map((id) => (
          <SpeciesRow
            key={id}
            id={id}
            count={counts[id] ?? 0}
            open={open === id}
            onToggle={() => setOpen(open === id ? null : id)}
          />
        ))}
      </ul>
    </section>
  );
}

function SpeciesRow({
  id,
  count,
  open,
  onToggle,
}: {
  id: SpeciesId;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  const sp = SPECIES[id];
  const cap = useEnv((s) => s.caps[id]);
  const food = useEnv((s) => s.provision[id] ?? 0);
  const store = useWorld((s) => s.rations[id]);
  const summary = [cap !== undefined ? `max ${cap}` : null, food > 0 ? `food for ${food}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="rounded-lg border border-border bg-surface-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left focus-ring"
      >
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: sp.color }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{sp.name}</span>
          {summary && <span className="block truncate text-[11px] text-fg-subtle">{summary}</span>}
        </span>
        <span className="font-mono text-sm tabular-nums">{count}</span>
        <ChevronDown className={cn("size-4 text-fg-subtle transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-3 pt-2 pb-3">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <Switch
                  checked={cap !== undefined}
                  onCheckedChange={(on) => useEnv.getState().setCap(id, on ? Math.max(2, count) : null)}
                  aria-label={`Limit ${sp.name} population`}
                />
                Max population
              </span>
              <span className="font-mono text-xs text-fg-muted">{cap ?? "auto"}</span>
            </div>
            {cap !== undefined && (
              <Slider
                min={0}
                max={300}
                step={1}
                value={[cap]}
                onValueChange={([v]) => useEnv.getState().setCap(id, v)}
                aria-label={`${sp.name} max population`}
              />
            )}
          </div>
          <div>
            <div className="flex items-center justify-between text-sm">
              <span>Daily food</span>
              <span className="font-mono text-xs text-fg-muted">
                {food > 0 ? `enough for ${food} ${food === 1 ? "adult" : "adults"}` : "none (forage)"}
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[food]}
              onValueChange={([v]) => useEnv.getState().setProvision(id, v)}
              aria-label={`${sp.name} daily food`}
            />
            {food > 0 && store !== undefined && (
              <p className="text-[11px] text-fg-subtle">
                In the trough: {Math.round(Math.min(1.5, store) * 100)}% of a day&apos;s ration
                {store < 0.05 ? " — eaten as soon as it arrives; they want more" : ""}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                void sim
                  .rpc<number>("feedAll", id)
                  .then((n) => useWorld.getState().pushNotice(`Fed ${n} ${sp.name.toLowerCase()}.`))
              }
            >
              <Utensils /> Feed all
            </Button>
            <ConfirmButton
              label="Remove all"
              confirm={`Remove ${count}?`}
              onConfirm={() => void sim.rpc("clear", id)}
            />
          </div>
        </div>
      )}
    </li>
  );
}

function ConfirmButton({
  label,
  confirm,
  onConfirm,
}: {
  label: string;
  confirm: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      size="sm"
      variant={armed ? "danger" : "secondary"}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      <Eraser /> {armed ? confirm : label}
    </Button>
  );
}

// ------------------------------------------------------------------ world-wide

function WorldTools() {
  const predation = useEnv((s) => s.predation);
  const food = useEnv((s) => s.food);
  const total = useWorld((s) => s.agentCount);
  return (
    <section className="space-y-2">
      <SectionTitle>Whole world</SectionTitle>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1">
          Predators hunt
          <InfoTip title="Predation" side="top">
            Off: every species lives in its own enclosure, so nobody gets eaten.
          </InfoTip>
        </span>
        <Switch
          checked={predation}
          onCheckedChange={(v) => useEnv.getState().set({ predation: v })}
          aria-label="Predators hunt"
        />
      </div>
      <div>
        <div className="flex items-center justify-between text-sm">
          <span>Wild plants &amp; prey</span>
          <span className="font-mono text-xs text-fg-muted">{food.toFixed(2)}×</span>
        </div>
        <Slider
          min={0}
          max={2}
          step={0.05}
          value={[food]}
          onValueChange={([v]) => useEnv.getState().set({ food: v })}
          aria-label="Wild food"
        />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          disabled={total === 0}
          onClick={() =>
            void sim
              .rpc<number>("feedAll")
              .then((n) => useWorld.getState().pushNotice(`Fed all ${n} animals.`))
          }
        >
          <Utensils /> Feed everyone
        </Button>
        <ConfirmButton
          label="Clear island"
          confirm="Remove all?"
          onConfirm={() =>
            void sim
              .rpc<number>("clear")
              .then((n) => useWorld.getState().pushNotice(`Cleared ${n} animals. Place new ones above.`))
          }
        />
      </div>
    </section>
  );
}
