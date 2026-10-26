"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Dna, Feather, Fish, Footprints, GitMerge, RotateCcw, Save, Sparkles } from "lucide-react";
import type { Genome, Sex, Slot } from "@/engine/genetics/types";
import { SLOTS } from "@/engine/genetics/types";
import { donorsFor, modulesOf, OPTIONAL_SLOTS, splice } from "@/engine/genetics/splice";
import { divergenceMya } from "@/engine/species/phylo";
import { SPECIES } from "@/engine/species/roster";
import type { SpeciesId } from "@/engine/species/types";
import { CreaturePreview } from "@/render/creatures/creature-preview";
import { sim } from "@/sim/client";
import { useLab, newId, type LabGenome } from "@/state/lab-store";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { InfoTip } from "@/ui/info-tip";
import { cn } from "@/lib/cn";
import { StatGrid } from "../inspector/stat-blocks";
import { SectionTitle } from "../inspector/inspector-panel";
import { express } from "../labs/body";
import { SourcePicker } from "../labs/source-picker";
import { ReleaseButton } from "../labs/release";
import { Stage } from "../labs/stage";
import { Workspace } from "../labs/workspace";
import { openInEditor, sendToCross } from "../labs/actions";

const SLOT_LABEL: Record<Slot, string> = {
  head: "Head",
  jaw: "Jaw / beak",
  teeth: "Teeth",
  eyes: "Eyes",
  ears: "Ears",
  forelimbs: "Forelimbs",
  hindlimbs: "Hindlimbs",
  tail: "Tail",
  covering: "Skin & coat",
  wings: "Wings",
  fins: "Fins",
};

const PRESETS: {
  name: string;
  base: SpeciesId;
  sex: Sex;
  changes: Partial<Record<Slot, SpeciesId | null>>;
}[] = [
  {
    name: "Lion with a crocodile jaw",
    base: "lion",
    sex: "M",
    changes: { jaw: "crocodile", teeth: "crocodile" },
  },
  { name: "Winged rabbit", base: "rabbit", sex: "F", changes: { wings: "hawk" } },
  { name: "Human with hawk wings", base: "human", sex: "M", changes: { wings: "hawk" } },
  { name: "Zebra-striped lion", base: "lion", sex: "F", changes: { covering: "zebra" } },
  {
    name: "Elephant on rabbit legs",
    base: "elephant",
    sex: "F",
    changes: { hindlimbs: "rabbit", forelimbs: "rabbit" },
  },
  { name: "Walking shark", base: "shark", sex: "F", changes: { hindlimbs: "wolf", forelimbs: "wolf" } },
  { name: "Wolf with fins", base: "wolf", sex: "M", changes: { fins: "shark", covering: "duck" } },
];

export function SpliceLab() {
  const base = useLab((s) => s.splice.base);
  const [picker, setPicker] = useState(false);
  const [donors, setDonors] = useState<Partial<Record<SpeciesId, Genome>>>({});
  const [changes, setChanges] = useState<Partial<Record<Slot, SpeciesId | null>>>({});
  const [name, setName] = useState("");

  // Reset edits when the base changes.
  const [baseId, setBaseId] = useState<string | null>(null);
  if (base && base.id !== baseId) {
    setBaseId(base.id);
    setChanges({});
    setName("");
  }

  // Fetch donor genomes (wild founders from the world's allele pools) on demand.
  useEffect(() => {
    const needed = Object.values(changes).filter((d): d is SpeciesId => !!d && !donors[d]);
    if (!needed.length) return;
    let alive = true;
    void Promise.all(
      needed.map(async (d) => [d, await sim.rpc<Genome | null>("founder", d, "F")] as const),
    ).then((res) => {
      if (!alive) return;
      setDonors((prev) => {
        const next = { ...prev };
        for (const [d, g] of res) if (g) next[d] = g;
        return next;
      });
    });
    return () => {
      alive = false;
    };
  }, [changes, donors]);

  const ready = Object.values(changes).every((d) => !d || donors[d]);
  const genome = useMemo(
    () => (base && ready ? splice(base.genome, changes, donors) : (base?.genome ?? null)),
    [base, changes, donors, ready],
  );
  const exBase = useMemo(() => (base ? express(base.genome, base.species, base.sex) : null), [base]);
  const ex = useMemo(() => (base && genome ? express(genome, base.species, base.sex) : null), [base, genome]);
  const mods = genome ? modulesOf(genome) : null;
  const foreign =
    mods && base
      ? SLOTS.filter((s) => mods[s] !== (SPECIES[base.species].parts[s] ? base.species : null))
      : [];
  const autoName = base
    ? foreign.length
      ? `${SPECIES[base.species].name} × ${[...new Set(foreign.map((s) => (mods![s] ? SPECIES[mods![s]!].name.toLowerCase() : `no ${s}`)))].join(", ")}`
      : SPECIES[base.species].name
    : "";
  const finalName = name || autoName;
  const makeResult = (): LabGenome => ({
    ...base!,
    id: newId(),
    name: finalName,
    genome: genome!,
    createdAt: Date.now(),
    kind: foreign.length ? "chimera" : base!.kind,
  });

  const applyPreset = async (p: (typeof PRESETS)[number]) => {
    const g = await sim.rpc<Genome | null>("founder", p.base, p.sex);
    if (!g) return;
    useLab.getState().setSpliceBase({
      id: newId(),
      name: `Wild ${SPECIES[p.base].name.toLowerCase()}`,
      species: p.base,
      sex: p.sex,
      genome: g,
      createdAt: Date.now(),
      kind: "wild",
    });
    // Apply after the base resets.
    setTimeout(() => {
      setChanges(p.changes);
      setName(p.name);
    }, 0);
  };

  return (
    <Workspace
      title="Splice Lab"
      subtitle={
        base
          ? `Body plan: ${SPECIES[base.species].name} (${SPECIES[base.species].latin})`
          : "Swap body parts across species — the physics decides what works"
      }
      actions={
        <>
          <Button size="sm" variant="outline" onClick={() => setPicker(true)}>
            <BookOpen /> {base ? "Change base" : "Choose base animal"}
          </Button>
          {base && genome && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setChanges({})} disabled={!foreign.length}>
                <RotateCcw /> Reset
              </Button>
              <Button size="sm" onClick={() => useLab.getState().save(makeResult())}>
                <Save /> Save
              </Button>
              <Button size="sm" onClick={() => openInEditor(makeResult())}>
                <Dna /> Edit
              </Button>
              <Button size="sm" onClick={() => sendToCross(base.sex === "F" ? "a" : "b", makeResult())}>
                <GitMerge /> Cross
              </Button>
              <ReleaseButton species={base.species} genome={genome} name={finalName} />
            </>
          )}
        </>
      }
    >
      <SourcePicker
        open={picker}
        onOpenChange={setPicker}
        onPick={(g) => useLab.getState().setSpliceBase(g)}
        title="Choose the base body plan"
      />
      {!base || !ex || !exBase || !mods ? (
        <div className="space-y-5 p-6">
          <p className="max-w-xl text-sm text-fg-muted">
            Pick a base animal — its torso sets the body plan — then swap in parts from other species. Parts
            are written into the genome as body-module genes, so chimeras breed true. Stats are recomputed
            from the anatomy: wings too small for the body won&apos;t fly, borrowed legs can be overloaded,
            and distant parts cost fertility.
          </p>
          <Button variant="primary" onClick={() => setPicker(true)}>
            Choose base animal
          </Button>
          <Presets onPick={(p) => void applyPreset(p)} />
        </div>
      ) : (
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)_minmax(280px,340px)]">
          <div className="space-y-2">
            <SectionTitle info="Each slot is a body-module gene. Tap a species to graft its part; ‘none’ removes optional parts.">
              Body parts
            </SectionTitle>
            {SLOTS.map((slot) => (
              <SlotRow
                key={slot}
                slot={slot}
                base={base.species}
                current={mods[slot]}
                onChange={(d) => setChanges((c) => ({ ...c, [slot]: d }))}
              />
            ))}
          </div>

          <div className="min-w-0 space-y-3">
            <Stage
              distance={Math.max(3.5, ex.st.lengthM ** 0.6 * 4.2)}
              className="relative h-[min(52vh,460px)] overflow-hidden rounded-lg border border-border bg-[radial-gradient(ellipse_at_center,#16202a,#0b1016)]"
            >
              <CreaturePreview
                body={ex.rig}
                lengthM={ex.st.lengthM}
                walking={!ex.st.canFly && !ex.st.aquatic}
                flying={ex.st.canFly}
              />
            </Stage>
            <div className="space-y-2">
              <input
                value={name}
                placeholder={autoName}
                onChange={(e) => setName(e.target.value)}
                aria-label="Chimera name"
                className="h-11 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus-ring placeholder:text-fg-subtle"
              />
              <Habitat st={ex.st} />
            </div>
            {!ready && <p className="text-xs text-fg-subtle">Fetching donor genes…</p>}
            <Presets onPick={(p) => void applyPreset(p)} compact />
          </div>

          <div className="space-y-4">
            <section>
              <SectionTitle info="Compared with the unspliced animal. Green = better, red = worse.">
                Derived performance
              </SectionTitle>
              <StatGrid ph={ex.ph} st={ex.st} compare={exBase} />
            </section>
            <section className="space-y-2">
              <SectionTitle>Trade-offs</SectionTitle>
              {ex.st.notes.length ? (
                <ul className="space-y-1.5 text-sm">
                  {ex.st.notes.map((n) => (
                    <li
                      key={n}
                      className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-warning"
                    >
                      {n}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-muted">No major conflicts — this body plan hangs together.</p>
              )}
              {foreign.length > 0 && (
                <ul className="space-y-1 text-xs text-fg-muted">
                  {foreign.map((s) => (
                    <li key={s} className="flex justify-between gap-2">
                      <span>{SLOT_LABEL[s]}</span>
                      <span className="font-mono">
                        {mods[s]
                          ? `${SPECIES[mods[s]!].name} · ${divergenceMya(base.species, mods[s]!)} Myr apart`
                          : "removed"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </Workspace>
  );
}

function SlotRow({
  slot,
  base,
  current,
  onChange,
}: {
  slot: Slot;
  base: SpeciesId;
  current: SpeciesId | null;
  onChange: (d: SpeciesId | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const native = SPECIES[base].parts[slot] ? base : null;
  const changed = current !== native;
  return (
    <div className={cn("rounded-lg border border-border bg-surface-2", changed && "border-accent/50")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-12 w-full items-center gap-2 rounded-lg px-3 text-left text-sm focus-ring"
      >
        <span className="flex-1 text-fg-muted">{SLOT_LABEL[slot]}</span>
        {current ? (
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: SPECIES[current].color }} />
            {SPECIES[current].name}
          </span>
        ) : (
          <span className="text-fg-subtle">none</span>
        )}
        {changed && <Badge tone="accent">spliced</Badge>}
      </button>
      {open && (
        <div className="flex animate-fade-in flex-wrap gap-1 px-2 pb-2">
          {OPTIONAL_SLOTS.has(slot) && (
            <Chip active={current === null} onClick={() => onChange(null)}>
              none
            </Chip>
          )}
          {donorsFor(slot).map((d) => (
            <Chip key={d} active={current === d} onClick={() => onChange(d)} color={SPECIES[d].color}>
              {SPECIES[d].name}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-fg-muted focus-ring hover:text-fg pointer-coarse:h-11",
        active && "border-accent/60 bg-accent-muted/40 text-accent-strong",
      )}
    >
      {color && <span className="size-2 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}

function Habitat({ st }: { st: ReturnType<typeof express>["st"] }) {
  return (
    <div className="flex gap-1">
      <Badge tone={st.canWalk ? "herbivore" : "neutral"}>
        <Footprints className="size-3" /> {st.canWalk ? "walks" : "can't walk"}
      </Badge>
      <Badge tone={st.canSwim ? "herbivore" : "neutral"}>
        <Fish className="size-3" /> {st.aquatic ? "gills" : st.canSwim ? "swims" : "sinks"}
      </Badge>
      <Badge tone={st.canFly ? "accent" : "neutral"}>
        <Feather className="size-3" /> {st.canFly ? "flies" : "grounded"}
      </Badge>
      <InfoTip title="Habitat" side="top">
        Where this body can live in the world: walking needs legs (and no gills), swimming needs fins, a
        swimming tail or webbed feet, flight needs enough wing area and power for the body mass.
      </InfoTip>
    </div>
  );
}

function Presets({ onPick, compact }: { onPick: (p: (typeof PRESETS)[number]) => void; compact?: boolean }) {
  return (
    <div>
      {!compact && <SectionTitle>Try a preset</SectionTitle>}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button key={p.name} size="sm" variant="outline" onClick={() => onPick(p)}>
            <Sparkles /> {p.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
