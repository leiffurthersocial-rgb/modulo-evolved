"use client";

import { useEffect, useState } from "react";
import { Compass, History, Map as MapIcon, Sparkles } from "lucide-react";
import { useSettings } from "@/state/settings-store";
import { useUi } from "@/state/ui-store";
import { listSaves, loadWorld, AUTOSAVE_ID } from "@/persistence/world-io";
import type { SaveMeta } from "@/persistence/db";
import { scenarioById } from "@/engine/sim/scenarios";
import { Dialog, DialogContent } from "@/ui/dialog";

export function Welcome() {
  const open = useUi((s) => s.dialog === "welcome");
  const [auto, setAuto] = useState<SaveMeta | null>(null);
  useEffect(() => {
    if (!open) return;
    void listSaves()
      .then((s) => setAuto(s.find((x) => x.id === AUTOSAVE_ID) ?? null))
      .catch(() => setAuto(null));
  }, [open]);
  const close = () => {
    useSettings.getState().set({ welcomed: true });
    useUi.getState().setDialog(null);
  };
  const choices = [
    ...(auto
      ? [
          {
            icon: History,
            title: "Resume where you left off",
            body: `${scenarioById(auto.scenario).name}, year ${Math.floor(auto.day / 365)} · ${auto.animals} animals`,
            run: () => {
              close();
              void loadWorld(AUTOSAVE_ID);
            },
          },
        ]
      : []),
    {
      icon: Compass,
      title: "Take the 1-minute tour",
      body: "Learn the controls: touch, keyboard and the labs.",
      run: () => (close(), useUi.getState().setTourStep(0)),
    },
    {
      icon: MapIcon,
      title: "Choose a scenario",
      body: "Speciation on islands, an ice age, human arrival, Hardy–Weinberg…",
      run: () => (close(), useUi.getState().setDialog("newWorld")),
    },
    {
      icon: Sparkles,
      title: "Just explore",
      body: "Jump into the temperate island that's already running.",
      run: close,
    },
  ];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent title="Welcome to Modulo Evolved" className="max-w-[560px]">
        <div className="space-y-1 px-6 pt-6 pr-14">
          <p className="text-[11px] tracking-[0.2em] text-accent uppercase">Modulo Evolved</p>
          <h2 className="text-xl font-semibold">Evolution you can touch.</h2>
          <p className="text-sm text-fg-muted">
            A scientific sandbox: real diploid genetics, ecology and speciation across 18 species — including
            humans. Edit genomes, breed lines, splice chimeras, and watch selection happen.
          </p>
        </div>
        <ul className="space-y-1.5 p-6">
          {choices.map((c) => (
            <li key={c.title}>
              <button
                type="button"
                onClick={c.run}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface-2 p-3 text-left focus-ring hover:border-accent/50"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-muted/50 text-accent-strong">
                  <c.icon className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{c.title}</span>
                  <span className="block text-xs text-fg-muted">{c.body}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
