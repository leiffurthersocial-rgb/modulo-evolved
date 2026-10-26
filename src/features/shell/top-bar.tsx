"use client";

import { Command, Keyboard } from "lucide-react";
import { Button } from "@/ui/button";
import { Tooltip } from "@/ui/tooltip";
import { useUi } from "@/state/ui-store";
import { MODES } from "../commands/commands";

export function TopBar() {
  const mode = useUi((s) => s.mode);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const setShortcutsOpen = useUi((s) => s.setShortcutsOpen);
  const current = MODES.find((m) => m.id === mode)!;

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 pt-[max(env(safe-area-inset-top),12px)] safe-px">
      <div className="pointer-events-auto flex h-14 items-center gap-3 rounded-lg border border-border pr-4 pl-3 shadow-panel glass">
        <Logo />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">Modulo Evolved</span>
          <span className="text-[11px] text-fg-subtle">{current.label}</span>
        </div>
      </div>

      <div className="pointer-events-auto flex h-14 items-center gap-1 rounded-lg border border-border px-1 shadow-panel glass">
        <Tooltip content="Command palette" shortcut="mod+k" side="bottom">
          <Button
            variant="ghost"
            className="h-11 gap-2 px-3 text-fg-muted"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette"
          >
            <Command />
            <span className="hidden text-sm md:inline">Commands</span>
          </Button>
        </Tooltip>
        <Tooltip content="Shortcuts & gestures" shortcut="?" side="bottom">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShortcutsOpen(true)}
            aria-label="Show keyboard shortcuts and gestures"
          >
            <Keyboard />
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 64 64" className="size-7" aria-hidden>
      <path
        d="M20 14c0 12 24 12 24 18S20 38 20 50"
        fill="none"
        stroke="#2dd4bf"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M44 14c0 12-24 12-24 18s24 6 24 18"
        fill="none"
        stroke="#5eead4"
        strokeOpacity=".55"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}
