"use client";

import { useMemo, useState } from "react";
import { Baby, Dna, GitMerge, Repeat, Save, Scissors, Shuffle } from "lucide-react";
import { Rng } from "@/engine/rng/rng";
import { crossFertility, geneticDistance } from "@/engine/genetics/distance";
import { LOCI, LOCUS_INDEX } from "@/engine/genetics/layout";
import {
  determineSex,
  fertilize,
  isHeterogametic,
  makeGamete,
  withKaryotype,
} from "@/engine/genetics/meiosis";
import { DEFAULT_RATES, mutateGamete } from "@/engine/genetics/mutation";
import { editorFactory } from "@/engine/genetics/alleles";
import type { Genome, Sex } from "@/engine/genetics/types";
import { computePhenotype } from "@/engine/anatomy/phenotype";
import { computeStats } from "@/engine/anatomy/stats";
import { SPECIES } from "@/engine/species/roster";
import { CreaturePreview } from "@/render/creatures/creature-preview";
import { displayLength } from "@/render/creatures/rig";
import { useLab, newId, type LabGenome } from "@/state/lab-store";
import { Button } from "@/ui/button";
import { InfoTip } from "@/ui/info-tip";
import { cn } from "@/lib/cn";
import { Histogram } from "../charts/histogram";
import { SectionTitle } from "../inspector/inspector-panel";
import { express } from "../labs/body";
import { SourcePicker } from "../labs/source-picker";
import { ReleaseButton } from "../labs/release";
import { Stage } from "../labs/stage";
import { Workspace } from "../labs/workspace";
import { openInEditor, sendToSplice } from "../labs/actions";
import { PunnettSquare } from "./punnett-square";

export function CrossLab() {
  const { a, b } = useLab((s) => s.cross);
  const [picking, setPicking] = useState<"a" | "b" | null>(null);
  const [litter, setLitter] = useState<LabGenome[]>([]);
  const [seed, setSeed] = useState(1);

  const compat = useMemo(() => {
    if (!a || !b) return null;
    const d = geneticDistance(a.genome, b.genome);
    return {
      d,
      fert: crossFertility(d),
      sameSpecies: a.species === b.species,
      sexesOk: a.sex === "F" && b.sex === "M",
    };
  }, [a, b]);

  const breed = () => {
    if (!a || !b) return;
    const sp = SPECIES[a.species];
    const rng = new Rng(Date.now() ^ seed);
    const f = editorFactory();
    const n = Math.max(2, Math.min(8, Math.round(sp.litter) + 1));
    const kids: LabGenome[] = [];
    for (let i = 0; i < n; i++) {
      const egg = makeGamete(a.genome, rng);
      const sperm = makeGamete(b.genome, rng);
      mutateGamete(egg, DEFAULT_RATES, rng, f);
      mutateGamete(sperm, DEFAULT_RATES, rng, f);
      const g = fertilize(egg, sperm);
      const sex = determineSex(g, sp.sexSystem, rng, 32);
      kids.push({
        id: newId(),
        name: `${sp.name} F${generation(a, b)} #${i + 1}`,
        species: a.species,
        sex,
        genome: g,
        createdAt: Date.now(),
        parents: [a.id, b.id],
        kind: "cross",
      });
    }
    setSeed((s) => s + 1);
    setLitter(kids);
  };

  return (
    <Workspace
      title="Cross Lab"
      subtitle="Pick two parents, predict offspring with a Punnett square, then breed real litters"
      actions={
        a && b ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                useLab.getState().setCross("a", b.sex === "F" ? b : a);
                useLab.getState().setCross("b", b.sex === "F" ? a : b);
              }}
            >
              <Repeat /> Swap
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!compat || compat.fert <= 0 || !compat.sexesOk}
              onClick={breed}
            >
              <Baby /> Breed litter
            </Button>
          </>
        ) : null
      }
    >
      <SourcePicker
        key={picking ?? "none"}
        open={picking !== null}
        onOpenChange={(o) => !o && setPicking(null)}
        preferSex={picking === "a" ? "F" : "M"}
        onPick={(g) => picking && useLab.getState().setCross(picking, g)}
        title={picking === "a" ? "Choose the mother (♀)" : "Choose the father (♂)"}
      />
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-4">
          {(a || b) && <FamilyStage mother={a} father={b} litter={a && b ? litter : []} />}
          <div className="grid grid-cols-2 gap-3">
            <ParentSlot label="Mother ♀" g={a} onPick={() => setPicking("a")} slot="a" />
            <ParentSlot label="Father ♂" g={b} onPick={() => setPicking("b")} slot="b" />
          </div>
          {compat && (
            <div
              className={cn(
                "rounded-lg border p-3 text-sm",
                compat.fert >= 1 && compat.sexesOk
                  ? "border-success/30 bg-success/5"
                  : compat.fert > 0 && compat.sexesOk
                    ? "border-warning/40 bg-warning/5"
                    : "border-danger/40 bg-danger/5",
              )}
            >
              <p className="flex items-center gap-1.5 font-medium">
                Genetic distance {compat.d.toFixed(2)} → hybrid fertility {(compat.fert * 100).toFixed(0)}%
                <InfoTip title="Reproductive isolation" side="top">
                  Allele-sharing distance between the parents. Beyond ~0.55, accumulated Dobzhansky–Muller
                  incompatibilities make hybrids less viable; beyond ~0.8, crosses fail. Different species are
                  typically ~1.0 apart — for cross-species parts use the Splice Lab instead.
                </InfoTip>
              </p>
              {!compat.sexesOk && (
                <p className="mt-1 text-danger">
                  A cross needs a female mother and a male father. Use “switch sex” on a parent.
                </p>
              )}
              {compat.fert <= 0 && compat.sexesOk && (
                <p className="mt-1 text-danger">
                  These lineages are reproductively isolated: no viable offspring.
                </p>
              )}
            </div>
          )}
          {a && b && <Distributions a={a.genome} b={b.genome} species={a.species} />}
        </div>
        <div className="space-y-4">
          {a && b ? (
            <PunnettSquare mother={a.genome} father={b.genome} species={a.species} />
          ) : (
            <div className="flex h-60 items-center justify-center rounded-lg border border-dashed border-border p-6 text-center text-sm text-fg-muted">
              Choose a mother and a father to see the Punnett square and predicted offspring.
            </div>
          )}
          {litter.length > 0 && a && b && <Litter kids={litter} parents={[a, b]} />}
        </div>
      </div>
    </Workspace>
  );
}

function generation(a: LabGenome, b: LabGenome) {
  const depth = (g: LabGenome): number =>
    g.kind === "cross" ? 1 + Number(/F(\d+)/.exec(g.name)?.[1] ?? 0) - 1 : 0;
  return Math.max(depth(a), depth(b)) + 1;
}

function ParentSlot({
  label,
  g,
  onPick,
  slot,
}: {
  label: string;
  g: LabGenome | null;
  onPick: () => void;
  slot: "a" | "b";
}) {
  const ex = useMemo(() => (g ? express(g.genome, g.species, g.sex) : null), [g]);
  const switchSex = () => {
    if (!g) return;
    const sex: Sex = g.sex === "F" ? "M" : "F";
    const sys = SPECIES[g.species].sexSystem;
    const genome = withKaryotype([...g.genome.a], [...g.genome.b], sex, sys);
    useLab.getState().setCross(slot, { ...g, sex, genome, id: newId() });
  };
  return (
    <div className="space-y-2">
      <p className="text-[11px] tracking-wider text-fg-subtle uppercase">{label}</p>
      {g && ex ? (
        <>
          <p className="truncate text-sm font-medium">{g.name}</p>
          <p className="text-xs text-fg-muted">
            {SPECIES[g.species].name} · {ex.ph.coat} · {ex.ph.massKg.toFixed(ex.ph.massKg < 10 ? 1 : 0)} kg
          </p>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="flex-1" onClick={onPick}>
              Change
            </Button>
            {SPECIES[g.species].sexSystem !== "TSD" && (
              <Button size="sm" variant="ghost" onClick={switchSex} aria-label="Switch sex">
                <Shuffle /> ♀/♂
              </Button>
            )}
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={onPick}
          className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-fg-muted focus-ring hover:border-accent/50 hover:text-fg"
        >
          <GitMerge className="size-5" /> Choose {label.split(" ")[0].toLowerCase()}
        </button>
      )}
    </div>
  );
}

/**
 * One 3D stage for the whole family: parents at the back, the latest litter in front. (A single
 * WebGL context instead of one per animal keeps Cross Lab light on iPad.)
 */
function FamilyStage({
  mother,
  father,
  litter,
}: {
  mother: LabGenome | null;
  father: LabGenome | null;
  litter: LabGenome[];
}) {
  const parents = useMemo(
    () => [mother, father].map((g) => (g ? express(g.genome, g.species, g.sex) : null)),
    [mother, father],
  );
  const kids = useMemo(() => litter.map((k) => ({ k, ex: express(k.genome, k.species, k.sex) })), [litter]);
  const all = [...parents.filter((p) => p !== null), ...kids.map((k) => k.ex)];
  const s = Math.max(...all.map((ex) => displayLength(ex.st.lengthM))) * 1.15;
  // Litter in rows of up to four in front; parents behind, all turned towards the camera.
  const cols = Math.min(4, Math.max(1, kids.length));
  const rows = Math.ceil(kids.length / cols);
  const width = Math.max(2, cols) * s;
  return (
    <Stage
      distance={Math.max(3, width * 0.85 + rows * s * 0.6 + s)}
      targetY={s * 0.25}
      className="relative h-56 overflow-hidden rounded-lg border border-border bg-[radial-gradient(ellipse_at_center,#16202a,#0b1016)]"
    >
      {parents.map((ex, i) =>
        ex ? (
          <CreaturePreview
            key={i}
            body={ex.rig}
            lengthM={ex.st.lengthM}
            position={[(i === 0 ? -0.65 : 0.65) * s, 0, kids.length ? -s * 0.9 : 0]}
            heading={0.75}
          />
        ) : null,
      )}
      {kids.map(({ k, ex }, i) => (
        <CreaturePreview
          key={k.id}
          body={ex.rig}
          lengthM={ex.st.lengthM}
          position={[((i % cols) - (cols - 1) / 2) * s, 0, s * 0.3 + Math.floor(i / cols) * s * 0.85]}
          heading={0.75}
        />
      ))}
    </Stage>
  );
}

/** Predicted offspring trait distributions from 600 simulated meioses (no mutation). */
function Distributions({ a, b, species }: { a: Genome; b: Genome; species: LabGenome["species"] }) {
  const data = useMemo(() => {
    const rng = new Rng(7);
    const sp = SPECIES[species];
    const mass: number[] = [];
    const speed: number[] = [];
    const bite: number[] = [];
    let males = 0;
    let viable = 0;
    const N = 600;
    for (let i = 0; i < N; i++) {
      const g = fertilize(makeGamete(a, rng), makeGamete(b, rng));
      const sex = determineSex(g, sp.sexSystem, rng, 32);
      if (sex === "M") males++;
      const ph = computePhenotype(g, species, sex);
      const st = computeStats(ph);
      viable += ph.viability;
      mass.push(ph.massKg);
      speed.push(st.speedKmh || st.swimKmh);
      bite.push(st.biteN);
    }
    const pa = computePhenotype(a, species, "F");
    const pb = computePhenotype(b, species, isHeterogametic(b) && sp.sexSystem === "XY" ? "M" : "M");
    return {
      mass,
      speed,
      bite,
      males: males / N,
      viable: viable / N,
      pa,
      pb,
      sa: computeStats(pa),
      sb: computeStats(pb),
    };
  }, [a, b, species]);
  return (
    <section className="space-y-3">
      <SectionTitle info="600 offspring generated by real meiosis (crossovers, independent assortment) from these exact parents. Polygenic traits form near-normal distributions; parent values are marked.">
        Predicted offspring
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2 text-center text-sm">
        <div className="rounded-md bg-surface-2 p-2">
          <p className="text-[10px] tracking-wider text-fg-subtle uppercase">Sex ratio</p>
          <p className="font-mono">{Math.round(data.males * 100)}% ♂</p>
        </div>
        <div className="rounded-md bg-surface-2 p-2">
          <p className="text-[10px] tracking-wider text-fg-subtle uppercase">Mean viability</p>
          <p className="font-mono">{(data.viable * 100).toFixed(0)}%</p>
        </div>
      </div>
      <Histogram
        label="Adult mass (kg)"
        values={data.mass}
        format={(v) => v.toFixed(v < 10 ? 1 : 0)}
        markers={[
          { value: data.pa.massKg, label: "♀" },
          { value: data.pb.massKg, label: "♂", color: "#60a5fa" },
        ]}
      />
      <Histogram
        label="Top speed (km/h)"
        values={data.speed}
        format={(v) => v.toFixed(0)}
        markers={[
          { value: data.sa.speedKmh || data.sa.swimKmh, label: "♀" },
          { value: data.sb.speedKmh || data.sb.swimKmh, label: "♂", color: "#60a5fa" },
        ]}
      />
      <Histogram
        label="Bite force (N)"
        values={data.bite}
        format={(v) => v.toFixed(0)}
        markers={[
          { value: data.sa.biteN, label: "♀" },
          { value: data.sb.biteN, label: "♂", color: "#60a5fa" },
        ]}
      />
    </section>
  );
}

function Litter({ kids, parents }: { kids: LabGenome[]; parents: [LabGenome, LabGenome] }) {
  const lab = useLab.getState();
  const expressed = kids.map((k) => ({ k, ex: express(k.genome, k.species, k.sex) }));
  return (
    <section className="space-y-3">
      <SectionTitle info="Each offspring got one recombined gamete from each parent, with mutations at the simulation's rates.">
        Litter
      </SectionTitle>
      <ul className="space-y-1.5">
        {expressed.map(({ k, ex }) => (
          <li
            key={k.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 p-2 pl-3 text-sm"
          >
            <span className="mr-auto">
              {k.sex === "F" ? "♀" : "♂"} {ex.ph.coat}
              {ex.ph.pattern > 0.25 ? " striped" : ""} · {ex.ph.massKg.toFixed(ex.ph.massKg < 10 ? 1 : 0)} kg
              · viability {(ex.ph.viability * 100).toFixed(0)}%
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                for (const p of parents) if (!lab.library.some((x) => x.id === p.id)) lab.save(p);
                lab.save(k);
              }}
            >
              <Save /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => lab.setCross(k.sex === "F" ? "a" : "b", k)}>
              <GitMerge /> As parent
            </Button>
            <Button size="sm" variant="ghost" onClick={() => openInEditor(k)}>
              <Dna /> Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => sendToSplice(k)}>
              <Scissors />
            </Button>
          </li>
        ))}
      </ul>
      <ReleaseButton
        species={kids[0].species}
        genome={kids[0].genome}
        name={`${parents[0].name} × ${parents[1].name}`}
        label="Release first pup"
      />
    </section>
  );
}

export const COAT_LOCI = [LOCUS_INDEX.colB, LOCUS_INDEX.colE];
export { LOCI };
