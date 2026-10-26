"use client";

import { useState } from "react";
import { Dices, Play } from "lucide-react";
import { SCENARIOS } from "@/engine/sim/scenarios";
import { SPECIES } from "@/engine/species/roster";
import type { SpeciesId } from "@/engine/species/types";
import { startScenario } from "@/sim/bridge";
import { useScenario } from "@/sim/scenario-store";
import { useUi } from "@/state/ui-store";
import { Button } from "@/ui/button";
import { Dialog, DialogContent } from "@/ui/dialog";
import { InfoTip } from "@/ui/info-tip";
import { cn } from "@/lib/cn";

const BUDGETS = [
  { n: 300, label: "Light", note: "older iPads, long battery" },
  { n: 600, label: "Standard", note: "recommended for iPad" },
  { n: 1000, label: "Large", note: "M-series iPad / desktop" },
];

export function NewWorldDialog() {
  const open = useUi((s) => s.dialog === "newWorld");
  const current = useScenario();
  const [pick, setPick] = useState(current.scenarioId);
  const [seed, setSeed] = useState(String(current.seed));
  const [budget, setBudget] = useState(current.maxAgents);
  const sc = SCENARIOS.find((s) => s.id === pick) ?? SCENARIOS[0];
  const close = () => useUi.getState().setDialog(null);
  const start = () => {
    useScenario.getState().set({ maxAgents: budget });
    startScenario(sc.id, Number(seed) >>> 0 || 1, budget);
    useUi.getState().setMode("world");
    close();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent title="New world" className="max-w-[860px]">
        <div className="border-b border-border px-5 py-4 pr-14">
          <h2 className="text-base font-semibold">New world</h2>
          <p className="text-sm text-fg-muted">
            Each scenario is a ready-made experiment. Same seed + settings = same run.
          </p>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ul className="space-y-1.5" role="listbox" aria-label="Scenarios">
            {SCENARIOS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={pick === s.id}
                  onClick={() => setPick(s.id)}
                  className={cn(
                    "w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-left focus-ring",
                    pick === s.id && "border-accent/60 bg-accent-muted/30",
                  )}
                >
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-fg-muted">{s.tagline}</p>
                </button>
              </li>
            ))}
          </ul>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface-2 p-4">
              <p className="text-[11px] tracking-wider text-fg-subtle uppercase">What to look for</p>
              <p className="mt-1 text-sm">{sc.lesson}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {(Object.entries(sc.counts) as [SpeciesId, number][]).map(([id, n]) => (
                  <span
                    key={id}
                    className="flex items-center gap-1 rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-fg-muted"
                  >
                    <span className="size-2 rounded-full" style={{ background: SPECIES[id].color }} />
                    {SPECIES[id].name} {n}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-fg-subtle">
                {sc.terrain} · {sc.env.temperature} °C · humidity {Math.round(sc.env.humidity * 100)}%
                {sc.env.mutationRate !== 1 ? ` · mutation ×${sc.env.mutationRate}` : ""}
                {sc.env.impact.enabled ? " · human impact on" : ""}
              </p>
            </div>
            <label className="block text-sm">
              <span className="mb-1 flex items-center gap-1 text-fg-muted">
                Seed
                <InfoTip title="Reproducible runs" side="top">
                  The seed drives terrain, founders and every random event. Same seed and settings reproduce
                  the same history (in the same browser engine).
                </InfoTip>
              </span>
              <span className="flex gap-1.5">
                <input
                  value={seed}
                  onChange={(e) => setSeed(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  aria-label="Seed"
                  className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-3 font-mono text-sm focus-ring"
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Random seed"
                  onClick={() => setSeed(String(Math.floor(Math.random() * 1e9)))}
                >
                  <Dices />
                </Button>
              </span>
            </label>
            <div>
              <p className="mb-1 text-sm text-fg-muted">Animal budget</p>
              <div className="grid grid-cols-3 gap-1.5">
                {BUDGETS.map((b) => (
                  <button
                    key={b.n}
                    type="button"
                    aria-pressed={budget === b.n}
                    onClick={() => setBudget(b.n)}
                    className={cn(
                      "rounded-md border border-border bg-surface-2 px-2 py-2 text-left focus-ring",
                      budget === b.n && "border-accent/60 bg-accent-muted/30",
                    )}
                  >
                    <p className="text-sm">{b.label}</p>
                    <p className="text-[11px] text-fg-subtle">
                      {b.n} · {b.note}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <Button variant="primary" className="w-full" onClick={start}>
              <Play /> Start {sc.name}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
