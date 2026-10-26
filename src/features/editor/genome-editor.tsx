"use client";

import { useMemo, useState } from "react";
import { BookOpen, Dna, GitMerge, Link2, Redo2, Save, Scissors, Undo2, ArrowLeftRight } from "lucide-react";
import { copyText, shareUrl } from "@/persistence/share";
import { useWorld } from "@/sim/world-store";
import { Rng } from "@/engine/rng/rng";
import {
  editAllele,
  makeHomozygous,
  mutateAt,
  swapStrands,
  diffCount,
  type Strand,
} from "@/engine/genetics/edit";
import { genotypeValue, traitValues } from "@/engine/genetics/expression";
import { CHROMOSOMES, LOCI, LOCUS_INDEX } from "@/engine/genetics/layout";
import { alleleSymbols } from "@/engine/genetics/punnett";
import type { MutationKind } from "@/engine/genetics/mutation";
import { SPECIES } from "@/engine/species/roster";
import { CreaturePreview } from "@/render/creatures/creature-preview";
import { useLab, newId, type LabGenome } from "@/state/lab-store";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Tooltip } from "@/ui/tooltip";
import { StatGrid, TraitBars } from "../inspector/stat-blocks";
import { SectionTitle } from "../inspector/inspector-panel";
import { express } from "../labs/body";
import { Ideogram, KIND_COLOR, KIND_LABEL } from "../labs/ideogram";
import { SourcePicker } from "../labs/source-picker";
import { ReleaseButton } from "../labs/release";
import { Stage } from "../labs/stage";
import { Workspace } from "../labs/workspace";
import { sendToCross, sendToSplice } from "../labs/actions";
import { AlleleCard } from "./allele-card";
import { LocusList } from "./locus-list";

export function GenomeEditor() {
  const editor = useLab((s) => s.editor);
  const [picker, setPicker] = useState(false);
  const current = editor.current;

  return (
    <Workspace
      title="Genome Editor"
      subtitle={
        current
          ? `${current.name} · ${SPECIES[current.species].latin}`
          : "Edit loci and alleles with a live phenotype preview"
      }
      actions={
        <>
          <Button size="sm" variant="outline" onClick={() => setPicker(true)}>
            <BookOpen /> Choose genome
          </Button>
          {current && (
            <EditorActions
              current={current}
              canUndo={editor.past.length > 0}
              canRedo={editor.future.length > 0}
            />
          )}
        </>
      }
    >
      <SourcePicker
        open={picker}
        onOpenChange={setPicker}
        onPick={(g) => useLab.getState().edit(g)}
        title="Open a genome in the editor"
      />
      {current ? (
        <EditorBody current={current} baseline={editor.past[0] ?? current} />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-accent-muted/50 text-accent-strong">
            <Dna className="size-7" />
          </div>
          <p className="max-w-md text-sm text-fg-muted">
            Open a genome from your library, start from a wild-type individual of any of the 18 species, or
            tap an animal in the world and choose <b>Edit genome</b>.
          </p>
          <Button variant="primary" onClick={() => setPicker(true)}>
            Choose genome
          </Button>
        </div>
      )}
    </Workspace>
  );
}

function EditorActions({
  current,
  canUndo,
  canRedo,
}: {
  current: LabGenome;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const lab = useLab.getState();
  return (
    <>
      <Tooltip content="Undo" shortcut="mod+z">
        <Button size="icon" variant="ghost" aria-label="Undo" disabled={!canUndo} onClick={lab.undo}>
          <Undo2 />
        </Button>
      </Tooltip>
      <Tooltip content="Redo" shortcut="mod+shift+z">
        <Button size="icon" variant="ghost" aria-label="Redo" disabled={!canRedo} onClick={lab.redo}>
          <Redo2 />
        </Button>
      </Tooltip>
      <Button size="sm" onClick={() => lab.save({ ...current, id: newId(), createdAt: Date.now() })}>
        <Save /> Save line
      </Button>
      <Button size="sm" onClick={() => sendToCross(current.sex === "F" ? "a" : "b", current)}>
        <GitMerge /> Cross
      </Button>
      <Button size="sm" onClick={() => sendToSplice(current)}>
        <Scissors /> Splice
      </Button>
      <Tooltip content="Copy a link that opens this genome">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Share genome link"
          onClick={async () => {
            const ok = await copyText(
              shareUrl({
                genome: {
                  species: current.species,
                  sex: current.sex,
                  name: current.name,
                  genome: current.genome,
                },
              }),
            );
            useWorld.getState().pushNotice(ok ? "Genome link copied." : "Couldn't access the clipboard.");
          }}
        >
          <Link2 />
        </Button>
      </Tooltip>
      <ReleaseButton species={current.species} genome={current.genome} name={current.name} />
    </>
  );
}

function EditorBody({ current, baseline }: { current: LabGenome; baseline: LabGenome }) {
  const [locus, setLocus] = useState(LOCUS_INDEX.size1);
  const expr = useMemo(() => express(current.genome, current.species, current.sex), [current]);
  const base = useMemo(() => express(baseline.genome, baseline.species, baseline.sex), [baseline]);
  const def = LOCI[locus];
  const g = current.genome;
  const symbols = alleleSymbols(locus, [
    g.a[locus],
    g.b[locus],
    baseline.genome.a[locus],
    baseline.genome.b[locus],
  ]);
  const traits = useMemo(() => traitValues(g), [g]);
  const edits = diffCount(g, baseline.genome);

  const update = (genome: typeof g, mergeKey?: string) =>
    useLab
      .getState()
      .commit({ ...current, genome, kind: current.kind === "wild" ? "edited" : current.kind }, mergeKey);
  const change = (strand: Strand) => (changes: Parameters<typeof editAllele>[3], field: string) =>
    update(editAllele(g, locus, strand, changes), `${locus}:${strand}:${field}`);
  const mutate = (strand: Strand) => (kind: MutationKind) =>
    update(mutateAt(g, locus, strand, kind, new Rng(Date.now() ^ locus)));

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)_minmax(280px,340px)]">
      {/* Loci */}
      <div className="space-y-3 lg:max-h-[calc(100dvh-260px)] lg:overflow-y-auto lg:pr-1">
        <Ideogram genome={g} selected={locus} onSelect={setLocus} className="max-h-56" />
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-subtle">
          {Object.entries(KIND_LABEL).map(([k, label]) => (
            <li key={k} className="flex items-center gap-1">
              <span
                className="size-2 rounded-full"
                style={{ background: KIND_COLOR[k as keyof typeof KIND_COLOR] }}
              />
              {label}
            </li>
          ))}
        </ul>
        <LocusList genome={g} baseline={baseline.genome} selected={locus} onSelect={setLocus} />
      </div>

      {/* Locus detail */}
      <div className="min-w-0 space-y-4">
        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{def.name}</h3>
            <Badge>{KIND_LABEL[def.kind]}</Badge>
            {def.trait && <Badge tone="accent">{def.trait}</Badge>}
            {def.slot && <Badge tone="accent">{def.slot}</Badge>}
          </div>
          <p className="mt-1 font-mono text-xs text-fg-subtle">
            {def.key} · chromosome {CHROMOSOMES[def.chrom].name} at {def.posCM} cM
          </p>
          <p className="mt-2 text-sm text-fg-muted">{def.info}</p>
          {(def.kind === "quant" || def.kind === "regulatory" || def.kind === "major") && (
            <p className="mt-2 text-sm">
              Genotypic value <span className="font-mono">{genotypeValue(g, locus).toFixed(2)}</span>
              {def.trait && (
                <>
                  {" "}
                  · whole-genome {def.trait} score{" "}
                  <span className="font-mono">{traits[def.trait].toFixed(2)}</span>
                </>
              )}
            </p>
          )}
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          <AlleleCard
            title="Maternal chromosome"
            allele={g.a[locus]}
            locus={def}
            symbol={g.a[locus] ? symbols.get(g.a[locus]!.id) : undefined}
            onChange={change("a")}
            onMutate={mutate("a")}
            onCopyToOther={() => update(makeHomozygous(g, locus, "a"))}
          />
          <AlleleCard
            title="Paternal chromosome"
            allele={g.b[locus]}
            locus={def}
            symbol={g.b[locus] ? symbols.get(g.b[locus]!.id) : undefined}
            onChange={change("b")}
            onMutate={mutate("b")}
            onCopyToOther={() => update(makeHomozygous(g, locus, "b"))}
          />
        </div>
        <Button size="sm" variant="ghost" onClick={() => update(swapStrands(g, locus))}>
          <ArrowLeftRight /> Swap maternal / paternal
        </Button>
      </div>

      {/* Phenotype */}
      <div className="space-y-4">
        <Stage distance={Math.max(3, expr.st.lengthM ** 0.6 * 4)}>
          <CreaturePreview body={expr.rig} lengthM={expr.st.lengthM} walking />
        </Stage>
        <div className="flex items-center justify-between text-xs text-fg-muted">
          <span>
            {current.sex === "F" ? "♀" : "♂"} {SPECIES[current.species].name} · {expr.ph.coat}
            {expr.ph.pattern > 0.25 ? ", patterned" : ""}
          </span>
          <span>{edits ? `${edits} loci edited` : "unedited"}</span>
        </div>
        <section>
          <SectionTitle info="Green/red arrows compare against the genome as it was when you opened it.">
            Phenotype
          </SectionTitle>
          <StatGrid ph={expr.ph} st={expr.st} compare={base} />
          {expr.st.notes.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-warning">
              {expr.st.notes.map((n) => (
                <li key={n}>• {n}</li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <SectionTitle>Behaviour</SectionTitle>
          <TraitBars ph={expr.ph} />
        </section>
        <p className="text-xs text-fg-subtle">
          Viability (recessive load): {(expr.ph.viability * 100).toFixed(0)}%
        </p>
      </div>
    </div>
  );
}
