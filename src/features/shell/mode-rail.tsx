"use client";

import { cn } from "@/lib/cn";
import { Tooltip } from "@/ui/tooltip";
import { useUi } from "@/state/ui-store";
import { MODES } from "../commands/commands";

export function ModeRail() {
  const mode = useUi((s) => s.mode);
  const setMode = useUi((s) => s.setMode);

  return (
    <nav
      aria-label="Workspaces"
      data-tour="rail"
      className="absolute top-1/2 left-[max(env(safe-area-inset-left),12px)] z-20 flex -translate-y-1/2 flex-col gap-1 rounded-xl border border-border p-1.5 shadow-panel glass"
    >
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = m.id === mode;
        return (
          <Tooltip key={m.id} content={m.label} shortcut={m.shortcut} side="right">
            <button
              type="button"
              aria-label={m.label}
              aria-current={active ? "page" : undefined}
              onClick={() => setMode(m.id)}
              className={cn(
                "relative flex size-12 items-center justify-center rounded-lg text-fg-muted focus-ring transition-colors duration-150 hover:bg-surface-3 hover:text-fg active:scale-95",
                active &&
                  "bg-accent-muted/60 text-accent-strong hover:bg-accent-muted/60 hover:text-accent-strong",
              )}
            >
              <Icon className="size-5" />
              {active && (
                <span
                  className="absolute top-1/2 -left-1.5 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent"
                  aria-hidden
                />
              )}
            </button>
          </Tooltip>
        );
      })}
    </nav>
  );
}
