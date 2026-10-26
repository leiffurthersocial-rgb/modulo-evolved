"use client";

import { Heart, MapPin, X } from "lucide-react";
import { SPECIES } from "@/engine/species/roster";
import { sim } from "@/sim/client";
import { useUi } from "@/state/ui-store";
import { Button } from "@/ui/button";

/** Shows which tap tool is active (placing animals, choosing a mate) with a way out. */
export function ToolBanner() {
  const tool = useUi((s) => s.spawnTool);
  const pairing = useUi((s) => s.pairing);
  const mode = useUi((s) => s.mode);
  if (mode !== "world" || (!tool && pairing === null)) return null;
  const body = pairing !== null ? sim.bodies.get(pairing) : undefined;
  const cancel = () => (tool ? useUi.getState().setSpawnTool(null) : useUi.getState().setPairing(null));
  return (
    <div
      role="status"
      className="pointer-events-auto absolute top-[calc(max(env(safe-area-inset-top),12px)+68px)] left-[calc(max(env(safe-area-inset-left),12px)+76px)] z-20 flex max-w-[min(520px,calc(100vw-110px))] animate-pop-in items-center gap-3 rounded-full border border-accent/50 py-1 pr-1 pl-4 shadow-panel glass"
    >
      {tool ? (
        <MapPin className="size-4 shrink-0 text-accent" />
      ) : (
        <Heart className="size-4 shrink-0 text-accent" />
      )}
      <span className="text-sm">
        {tool
          ? `Tap the ground to place ${tool.count} × ${SPECIES[tool.species].name}${tool.sex === "pair" ? " (pairs)" : tool.sex === "F" ? " ♀" : " ♂"}`
          : `Tap a mate for ${body ? SPECIES[body.species].name : "animal"} #${pairing} ${body?.sex === "F" ? "♀" : "♂"}`}
      </span>
      <Button size="sm" variant="secondary" className="rounded-full" onClick={cancel}>
        <X /> {tool ? "Done" : "Cancel"}
      </Button>
    </div>
  );
}
