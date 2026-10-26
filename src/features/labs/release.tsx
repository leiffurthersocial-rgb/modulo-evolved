"use client";

import { useState } from "react";
import { Rocket } from "lucide-react";
import { Popover } from "radix-ui";
import type { Genome } from "@/engine/genetics/types";
import type { SpeciesId } from "@/engine/species/types";
import { sim } from "@/sim/client";
import { useWorld } from "@/sim/world-store";
import { useUi } from "@/state/ui-store";
import { Button } from "@/ui/button";
import { Slider } from "@/ui/slider";
import { Switch } from "@/ui/switch";

/** Release copies of a genome into the running world (as a new tracked lineage if named). */
export function ReleaseButton({
  species,
  genome,
  name,
  label = "Release",
}: {
  species: SpeciesId;
  genome: Genome;
  name: string;
  label?: string;
}) {
  const [count, setCount] = useState(6);
  const [newLineage, setNewLineage] = useState(true);
  const [open, setOpen] = useState(false);
  const release = async () => {
    await sim.rpc("spawn", { species, genome, count, lineageName: newLineage ? name : undefined });
    useWorld.getState().pushNotice(`Released ${count} × ${name} into the world.`);
    setOpen(false);
    useUi.getState().setMode("world");
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button size="sm" variant="primary">
          <Rocket /> {label}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="z-50 w-72 animate-pop-in space-y-4 rounded-lg border border-border bg-surface-2 p-4 shadow-panel"
        >
          <div>
            <div className="flex justify-between text-sm">
              <span id="rel-count">Individuals</span>
              <span className="font-mono">{count}</span>
            </div>
            <Slider
              aria-labelledby="rel-count"
              min={1}
              max={20}
              step={1}
              value={[count]}
              onValueChange={([v]) => setCount(v)}
            />
            <p className="text-xs text-fg-subtle">
              Sexes alternate. Clones share one genome, so expect a founder effect.
            </p>
          </div>
          <label className="flex h-11 items-center justify-between text-sm">
            Track as its own lineage
            <Switch checked={newLineage} onCheckedChange={setNewLineage} />
          </label>
          <Button variant="primary" className="w-full" onClick={() => void release()}>
            <Rocket /> Release into world
          </Button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
