"use client";

import { Command, Compass, FolderOpen, Globe2, Keyboard, Link2, Menu, Settings } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { copyText, shareUrl } from "@/persistence/share";
import { useScenario } from "@/sim/scenario-store";
import { useEnv } from "@/state/env-store";
import { Button } from "@/ui/button";
import { Tooltip } from "@/ui/tooltip";
import { useUi } from "@/state/ui-store";
import { MODES } from "../commands/commands";
import { useWorld } from "@/sim/world-store";
import { scenarioById } from "@/engine/sim/scenarios";

export function TopBar() {
  const mode = useUi((s) => s.mode);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const setShortcutsOpen = useUi((s) => s.setShortcutsOpen);
  const current = MODES.find((m) => m.id === mode)!;
  const agents = useWorld((s) => s.agentCount);
  const species = useWorld((s) => Object.values(s.speciesCounts).filter((n) => (n ?? 0) > 0).length);
  const lineages = useWorld(
    (s) => s.lineages.filter((l) => l.extinctDay === null && (s.lineageCounts[l.id] ?? 0) > 0).length,
  );
  const scenario = useWorld((s) => (s.info ? scenarioById(s.info.scenario).name : ""));

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 pt-[max(env(safe-area-inset-top),12px)] safe-px">
      <div className="pointer-events-auto flex h-14 items-center gap-3 rounded-lg border border-border pr-4 pl-3 shadow-panel glass">
        <Logo />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">Modulo Evolved</span>
          <span className="text-[11px] text-fg-subtle">
            {current.label}
            {scenario && ` · ${scenario}`}
          </span>
        </div>
        <div className="ml-2 hidden items-center gap-3 border-l border-border pl-3 font-mono text-[11px] text-fg-muted tabular-nums sm:flex">
          <span title="Animals alive">{agents} animals</span>
          <span title="Species (lineages) alive">{lineages || species} species</span>
        </div>
      </div>

      <div className="pointer-events-auto flex h-14 items-center gap-1 rounded-lg border border-border px-1 shadow-panel glass">
        <WorldMenu />
        <Tooltip content="Command palette" shortcut="mod+k" side="bottom">
          <Button
            data-tour="commands"
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

function WorldMenu() {
  const ui = useUi.getState();
  const item =
    "focus-ring flex h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-sm text-fg-muted outline-none data-[highlighted]:bg-surface-3 data-[highlighted]:text-fg";
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          className="h-11 gap-2 px-3 text-fg-muted"
          aria-label="World menu"
          data-tour="menu"
        >
          <Menu />
          <span className="hidden text-sm md:inline">World</span>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-60 animate-pop-in rounded-lg border border-border p-1 shadow-panel glass"
        >
          <DropdownMenu.Item className={item} onSelect={() => ui.setDialog("newWorld")}>
            <Globe2 className="size-4" /> New world…
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => ui.setDialog("saves")}>
            <FolderOpen className="size-4" /> Save &amp; load…
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={item}
            onSelect={() => {
              const { scenarioId, seed } = useScenario.getState();
              void copyText(shareUrl({ scenario: scenarioId, seed, env: useEnv.getState().settings() }));
            }}
          >
            <Link2 className="size-4" /> Copy share link
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item className={item} onSelect={() => ui.setTourStep(0)}>
            <Compass className="size-4" /> Guided tour
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => ui.setDialog("settings")}>
            <Settings className="size-4" /> Settings
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
