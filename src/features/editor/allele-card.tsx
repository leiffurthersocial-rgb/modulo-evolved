"use client";

import type { Allele, Slot } from "@/engine/genetics/types";
import type { LocusDef } from "@/engine/genetics/types";
import type { MutationKind } from "@/engine/genetics/mutation";
import { SPECIES, SPECIES_IDS } from "@/engine/species/roster";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/button";
import { InfoTip } from "@/ui/info-tip";
import { Slider } from "@/ui/slider";
import { Switch } from "@/ui/switch";

const log = (v: number) => Math.log10(v);
const unlog = (v: number) => 10 ** v;

export function AlleleCard({
  title,
  allele,
  locus,
  symbol,
  onChange,
  onMutate,
  onCopyToOther,
}: {
  title: string;
  allele: Allele | null;
  locus: LocusDef;
  symbol?: string;
  onChange: (changes: Partial<Omit<Allele, "id">>, field: string) => void;
  onMutate: (kind: MutationKind) => void;
  onCopyToOther: () => void;
}) {
  if (!allele) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-fg-muted">
        <p className="mb-1 text-[11px] tracking-wider text-fg-subtle uppercase">{title}</p>
        No copy here: this haplotype carries the Y/W chromosome, so the locus is <b>hemizygous</b> and its
        single allele is always expressed.
      </div>
    );
  }
  const domLabel = allele.dom > 2.5 ? "dominant" : allele.dom < 0.4 ? "recessive" : "additive";
  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-border bg-surface-2 p-4",
        allele.lof && "border-danger/40",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] tracking-wider text-fg-subtle uppercase">{title}</p>
        <span className="font-mono text-xs text-fg-muted">
          {symbol} · id {String(allele.id).slice(-6)}
          {allele.origin === "editor" && <span className="ml-1 text-warning">edited</span>}
        </span>
      </div>

      {locus.kind === "module" ? (
        <label className="block text-sm">
          <span className="mb-1 block text-fg-muted">Developmental program (donor species)</span>
          <select
            value={allele.module?.species ?? ""}
            onChange={(e) =>
              onChange({ module: { slot: locus.slot as Slot, species: e.target.value || null } }, "module")
            }
            className="h-11 w-full rounded-md border border-border bg-surface-3 px-3 text-sm focus-ring"
          >
            <option value="">None (part absent)</option>
            {SPECIES_IDS.filter((id) => SPECIES[id].parts[locus.slot as Slot] !== null).map((id) => (
              <option key={id} value={id}>
                {SPECIES[id].name}
              </option>
            ))}
          </select>
        </label>
      ) : locus.kind === "color" ? (
        <div role="radiogroup" aria-label="Variant" className="grid grid-cols-2 gap-1.5">
          {[
            { label: "Functional (dominant)", effect: 1, dom: locus.key === "colS" ? 1 : 4 },
            { label: "Variant (recessive)", effect: -1, dom: 1 },
          ].map((v) => (
            <button
              key={v.label}
              type="button"
              role="radio"
              aria-checked={allele.effect === v.effect}
              onClick={() => onChange({ effect: v.effect, dom: v.dom }, "variant")}
              className={cn(
                "min-h-11 rounded-md border border-border px-2 text-sm text-fg-muted focus-ring",
                allele.effect === v.effect && "border-accent/60 bg-accent-muted/40 text-accent-strong",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      ) : locus.kind === "neutral" ? (
        <p className="text-sm text-fg-muted">
          Repeat length {allele.effect}. Neutral markers don&apos;t affect the phenotype; they record ancestry
          and drift.
        </p>
      ) : (
        <>
          <Field
            label="Effect size"
            value={allele.effect.toFixed(2)}
            info="Additive effect on the trait (per copy). Founder alleles are ~N(0, 0.45)."
          >
            <Slider
              aria-label="Effect size"
              min={-3}
              max={3}
              step={0.01}
              value={[allele.effect]}
              onValueChange={([v]) => onChange({ effect: v }, "effect")}
            />
          </Field>
          <Field
            label="Dominance"
            value={`${allele.dom.toFixed(2)} · ${domLabel}`}
            info="Weight in heterozygotes: the genotype value is the dominance-weighted mean of the two alleles."
          >
            <Slider
              aria-label="Dominance"
              min={-1}
              max={1}
              step={0.01}
              value={[log(allele.dom)]}
              onValueChange={([v]) => onChange({ dom: unlog(v) }, "dom")}
            />
          </Field>
          <Field
            label="Expression (cis-regulatory)"
            value={`${allele.expr.toFixed(2)}×`}
            info="Promoter/enhancer strength: scales this allele's effect. Changed by regulatory mutations."
          >
            <Slider
              aria-label="Expression"
              min={-1}
              max={0.6}
              step={0.01}
              value={[log(allele.expr)]}
              onValueChange={([v]) => onChange({ expr: unlog(v) }, "expr")}
            />
          </Field>
        </>
      )}

      {locus.kind !== "neutral" && locus.kind !== "module" && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-sm text-fg-muted">Copies</span>
            <InfoTip title="Copy number" side="top">
              Tandem duplications add copies and raise dosage. Copy-number variation is common in real genomes
              (e.g. amylase genes in humans).
            </InfoTip>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Fewer copies"
              disabled={allele.copies <= 1}
              onClick={() => onChange({ copies: allele.copies - 1 }, "copies-")}
            >
              −
            </Button>
            <span className="w-4 text-center font-mono text-sm">{allele.copies}</span>
            <Button
              size="icon"
              variant="ghost"
              aria-label="More copies"
              disabled={allele.copies >= 4}
              onClick={() => onChange({ copies: allele.copies + 1 }, "copies+")}
            >
              +
            </Button>
          </div>
          <label className="ml-auto flex items-center gap-2 text-sm text-fg-muted">
            Loss of function
            <Switch
              checked={allele.lof}
              onCheckedChange={(lof) => onChange({ lof }, "lof")}
              aria-label="Loss of function"
            />
          </label>
        </div>
      )}

      <div>
        <p className="mb-1.5 flex items-center gap-1 text-[11px] tracking-wider text-fg-subtle uppercase">
          Mutate
          <InfoTip title="Mutation operators" side="top">
            The same operators the simulation uses: point (small effect change), indel (usually a frameshift →
            loss of function), duplication (+1 copy) and regulatory shift (expression up or down).
          </InfoTip>
        </p>
        <div className="grid grid-cols-4 gap-1">
          {(["point", "indel", "duplication", "regulatory"] as MutationKind[]).map((k) => (
            <Button
              key={k}
              size="sm"
              variant="outline"
              className="px-1 capitalize"
              onClick={() => onMutate(k)}
            >
              {k === "duplication" ? "dup" : k === "regulatory" ? "reg" : k}
            </Button>
          ))}
        </div>
      </div>
      <Button size="sm" variant="ghost" className="w-full" onClick={onCopyToOther}>
        Copy to other chromosome (make homozygous)
      </Button>
    </div>
  );
}

function Field({
  label,
  value,
  info,
  children,
}: {
  label: string;
  value: string;
  info: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1 text-fg-muted">
          {label}
          <InfoTip title={label} side="top">
            {info}
          </InfoTip>
        </span>
        <span className="font-mono text-xs tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}
