"use client";

import { useUi } from "@/state/ui-store";
import { MODES } from "../commands/commands";

const MILESTONE: Record<string, number> = { genome: 5, cross: 5, splice: 6, phylogeny: 7 };

/** Placeholder workspace surface for modes that land in later milestones. */
export function ModeOverlay() {
  const mode = useUi((s) => s.mode);
  if (mode === "world") return null;
  const m = MODES.find((x) => x.id === mode)!;
  const Icon = m.icon;
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] flex animate-fade-in items-center justify-center bg-bg/70 backdrop-blur-sm">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-accent-muted/50 text-accent-strong">
          <Icon className="size-7" />
        </div>
        <h2 className="text-lg font-semibold">{m.label}</h2>
        <p className="text-sm text-fg-muted">
          {m.description}. Arrives in milestone {MILESTONE[mode]}.
        </p>
      </div>
    </div>
  );
}
