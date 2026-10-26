"use client";

import { useEffect, useRef } from "react";
import { Crosshair, Dna, GitMerge, ScanSearch, Scissors, Trash2 } from "lucide-react";
import { SPECIES } from "@/engine/species/roster";
import { sim } from "@/sim/client";
import { useWorld } from "@/sim/world-store";
import { useUi } from "@/state/ui-store";
import { labGenomeFrom, openInEditor, sendToCross, sendToSplice } from "../labs/actions";
import type { AgentDetail } from "../inspector/use-agent";

/** Long-press / right-click menu for an animal in the world. */
export function ContextMenu() {
  const menu = useWorld((s) => s.contextMenu);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    ref.current?.querySelector("button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && useWorld.getState().openContextMenu(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);
  if (!menu) return null;
  const body = sim.bodies.get(menu.id);
  const close = () => useWorld.getState().openContextMenu(null);
  const withGenome = async (fn: (d: AgentDetail) => void) => {
    close();
    const d = await sim.rpc<AgentDetail | null>("getAgent", menu.id);
    if (d) fn(d);
  };
  const lab = (d: AgentDetail) =>
    labGenomeFrom({ species: d.species, sex: d.sex, genome: d.genome, id: d.id });
  const items = [
    {
      icon: ScanSearch,
      label: "Inspect",
      run: () => {
        close();
        useUi.getState().setDockTab("inspector");
      },
    },
    {
      icon: Crosshair,
      label: "Follow",
      run: () => {
        close();
        useWorld.getState().follow(menu.id);
      },
    },
    { icon: Dna, label: "Edit genome", run: () => withGenome((d) => openInEditor(lab(d))) },
    { icon: GitMerge, label: "Cross Lab parent A", run: () => withGenome((d) => sendToCross("a", lab(d))) },
    { icon: GitMerge, label: "Cross Lab parent B", run: () => withGenome((d) => sendToCross("b", lab(d))) },
    { icon: Scissors, label: "Splice Lab", run: () => withGenome((d) => sendToSplice(lab(d))) },
    {
      icon: Trash2,
      label: "Remove",
      run: () => {
        close();
        void sim.rpc("kill", menu.id);
      },
    },
  ];
  const x = Math.min(menu.x, (typeof window !== "undefined" ? window.innerWidth : 1000) - 230);
  const y = Math.min(menu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 360);
  return (
    <>
      <div className="fixed inset-0 z-30" onPointerDown={close} aria-hidden />
      <div
        ref={ref}
        role="menu"
        aria-label="Animal actions"
        className="fixed z-40 w-56 animate-pop-in overflow-hidden rounded-lg border border-border p-1 shadow-panel glass"
        style={{ left: x, top: y }}
      >
        {body && (
          <p className="px-3 pt-2 pb-1 text-[11px] tracking-wider text-fg-subtle uppercase">
            {SPECIES[body.species].name} #{menu.id}
          </p>
        )}
        {items.map((it) => (
          <button
            key={it.label}
            role="menuitem"
            type="button"
            onClick={it.run}
            className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-fg-muted focus-ring hover:bg-surface-3 hover:text-fg"
          >
            <it.icon className="size-4" /> {it.label}
          </button>
        ))}
      </div>
    </>
  );
}
