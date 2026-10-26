"use client";

import {
  Crosshair,
  Dna,
  GitMerge,
  Heart,
  MousePointerClick,
  Scissors,
  Skull,
  Trash2,
  Utensils,
} from "lucide-react";
import { useUi } from "@/state/ui-store";
import { feedAnimal } from "../animals/actions";
import { SPECIES } from "@/engine/species/roster";
import { SLOTS } from "@/engine/genetics/types";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { InfoTip } from "@/ui/info-tip";
import { cn } from "@/lib/cn";
import { useWorld } from "@/sim/world-store";
import { sim } from "@/sim/client";
import { labGenomeFrom, openInEditor, sendToCross, sendToSplice } from "../labs/actions";
import { Ideogram } from "../labs/ideogram";
import { useAgent, type AgentDetail } from "./use-agent";
import { StatGrid, TraitBars } from "./stat-blocks";

const STATE_LABEL: Record<string, string> = {
  wander: "Wandering",
  forage: "Foraging",
  flee: "Fleeing!",
  hunt: "Hunting",
  mate: "Courting",
  rest: "Resting",
  eat: "Eating",
};

const DIET_TONE = {
  herbivore: "herbivore",
  granivore: "herbivore",
  planktivore: "herbivore",
  insectivore: "omnivore",
  omnivore: "omnivore",
  carnivore: "carnivore",
} as const;

export function InspectorPanel() {
  const selectedId = useWorld((s) => s.selectedId);
  const followId = useWorld((s) => s.followId);
  const { detail, dead } = useAgent(selectedId);

  if (selectedId === null) {
    return (
      <Empty
        icon={<MousePointerClick className="size-6" />}
        title="Nothing selected"
        body="Tap an animal to inspect its genome, phenotype and lineage. Double-tap (or F) to follow it; long-press for more."
      />
    );
  }
  if (!detail) return <div className="p-6 text-sm text-fg-muted">Loading…</div>;
  return <Inspector d={detail} dead={dead} following={followId === selectedId} />;
}

function Inspector({ d, dead, following }: { d: AgentDetail; dead: string | null; following: boolean }) {
  const sp = SPECIES[d.species];
  const ageY = d.ageDays / 365;
  const energy = d.energy / d.maxEnergy;
  const chimeraSlots = SLOTS.filter((s) => d.ph.modules[s] && d.ph.modules[s] !== d.species);
  const lab = () =>
    labGenomeFrom({
      species: d.species,
      sex: d.sex,
      genome: d.genome,
      id: d.id,
      chimera: chimeraSlots.length > 0,
    });
  const w = useWorld.getState();

  return (
    <div className={cn("space-y-5 p-4", dead && "opacity-70")}>
      <header className="flex items-start gap-3">
        <span className="mt-1 size-3 shrink-0 rounded-full" style={{ background: sp.color }} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            {sp.name} <span className="font-mono text-xs font-normal text-fg-subtle">#{d.id}</span>
            <span aria-label={d.sex === "F" ? "female" : "male"} className="text-fg-muted">
              {d.sex === "F" ? "♀" : "♂"}
            </span>
          </h2>
          <p className="truncate text-xs text-fg-muted italic">{d.lineageName}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge tone={DIET_TONE[sp.diet]}>{sp.diet}</Badge>
            {chimeraSlots.length > 0 && <Badge tone="accent">chimera</Badge>}
            {d.infected && <Badge tone="carnivore">infected</Badge>}
            {d.gestating && (
              <Badge tone="omnivore">
                {sp.clade === "bird" || sp.clade === "reptile" ? "gravid" : "pregnant"}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {dead ? (
        <p className="flex items-center gap-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          <Skull className="size-4" /> Died ({dead}). Data shown is from its last moments.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant={following ? "primary" : "secondary"}
            onClick={() => w.follow(following ? null : d.id)}
          >
            <Crosshair /> {following ? "Following" : "Follow"}
          </Button>
          <Button size="sm" onClick={() => openInEditor(lab())}>
            <Dna /> Edit genome
          </Button>
          <Button size="sm" onClick={() => sendToCross(d.sex === "F" ? "a" : "b", lab())}>
            <GitMerge /> Cross Lab
          </Button>
          <Button size="sm" onClick={() => sendToSplice(lab())}>
            <Scissors /> Splice Lab
          </Button>
          <Button size="sm" onClick={() => void feedAnimal(d.id)}>
            <Utensils /> Feed
          </Button>
          <PairButton id={d.id} />
        </div>
      )}

      <section className="space-y-2">
        <Meter
          label="Energy"
          value={energy}
          tone={energy < 0.25 ? "danger" : energy < 0.5 ? "warning" : "accent"}
        />
        <div className="grid grid-cols-3 gap-2 text-center">
          <Mini label="State" value={STATE_LABEL[d.state] ?? d.state} />
          <Mini label="Age" value={ageY < 1 ? `${Math.round(d.ageDays)} d` : `${ageY.toFixed(1)} y`} />
          <Mini label="Gen." value={String(d.generation)} />
        </div>
        {d.species === "human" && (
          <Meter
            label="Culture"
            value={d.culture}
            tone="accent"
            info="Cumulative culture: tool and foraging know-how learned socially (fast, horizontal) rather than inherited genetically. Raises hunting success, foraging and cold tolerance; erodes in small, isolated groups."
          />
        )}
      </section>

      <section>
        <SectionTitle>Anatomy-derived performance</SectionTitle>
        <StatGrid ph={d.ph} st={d.st} />
        {d.st.notes.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-warning">
            {d.st.notes.map((n) => (
              <li key={n}>• {n}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>Behaviour genes</SectionTitle>
        <TraitBars ph={d.ph} />
      </section>

      <section>
        <SectionTitle info="Each bar is a chromosome; ticks are loci coloured by type. Wide ticks are heterozygous (two different alleles). Heterozygosity falls with inbreeding.">
          Genome · {(d.heterozygosity * 100).toFixed(0)}% heterozygous
        </SectionTitle>
        <Ideogram genome={d.genome} compact className="max-h-28" />
      </section>

      {chimeraSlots.length > 0 && (
        <section>
          <SectionTitle>Spliced modules</SectionTitle>
          <ul className="space-y-1 text-sm">
            {chimeraSlots.map((s) => (
              <li key={s} className="flex justify-between text-fg-muted">
                <span className="capitalize">{s}</span>
                <span className="text-fg">{d.ph.modules[s] ? SPECIES[d.ph.modules[s]!].name : "none"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle>Lineage</SectionTitle>
        <div className="grid grid-cols-3 gap-2 text-center">
          <ParentLink label="Mother" id={d.motherId} />
          <ParentLink label="Father" id={d.fatherId} />
          <Mini label="Offspring" value={String(d.offspring)} />
        </div>
      </section>

      {!dead && (
        <Button variant="danger" size="sm" className="w-full" onClick={() => sim.rpc("kill", d.id)}>
          <Trash2 /> Remove from world
        </Button>
      )}
    </div>
  );
}

function ParentLink({ label, id }: { label: string; id: number }) {
  const alive = id > 0 && sim.bodies.has(id);
  return (
    <button
      type="button"
      disabled={!alive}
      onClick={() => useWorld.getState().select(id)}
      className="min-h-11 rounded-md bg-surface-2 px-2 py-1.5 text-left focus-ring disabled:cursor-default"
    >
      <p className="text-[10px] tracking-wider text-fg-subtle uppercase">{label}</p>
      <p className={cn("font-mono text-xs", alive ? "text-accent" : "text-fg-muted")}>
        {id > 0 ? `#${id}${alive ? "" : " †"}` : "founder"}
      </p>
    </button>
  );
}

export function SectionTitle({ children, info }: { children: React.ReactNode; info?: string }) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-fg-subtle uppercase">
      {children}
      {info && (
        <InfoTip title={typeof children === "string" ? children : "About"} side="left">
          {info}
        </InfoTip>
      )}
    </h3>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-2 px-2 py-1.5 text-left">
      <p className="text-[10px] tracking-wider text-fg-subtle uppercase">{label}</p>
      <p className="truncate text-xs font-medium">{value}</p>
    </div>
  );
}

function Meter({
  label,
  value,
  tone,
  info,
}: {
  label: string;
  value: number;
  tone: "accent" | "warning" | "danger";
  info?: string;
}) {
  const color = tone === "danger" ? "bg-danger" : tone === "warning" ? "bg-warning" : "bg-accent";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-fg-muted">
          {label}
          {info && (
            <InfoTip title={label} side="left">
              {info}
            </InfoTip>
          )}
        </span>
        <span className="font-mono tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-surface-3"
        role="meter"
        aria-label={label}
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", color)}
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-surface-3 text-fg-subtle">
        {icon}
      </div>
      <p className="text-sm font-medium text-fg">{title}</p>
      <p className="max-w-64 text-sm text-fg-muted">{body}</p>
    </div>
  );
}

function PairButton({ id }: { id: number }) {
  const pairing = useUi((s) => s.pairing);
  const active = pairing === id;
  return (
    <Button
      size="sm"
      variant={active ? "primary" : "secondary"}
      onClick={() => useUi.getState().setPairing(active ? null : id)}
    >
      <Heart /> {active ? "Tap a mate…" : "Breed with…"}
    </Button>
  );
}
