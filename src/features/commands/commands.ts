import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Box,
  CloudSun,
  Dna,
  FastForward,
  GitBranch,
  GitMerge,
  Globe2,
  Keyboard,
  PanelRight,
  Pause,
  Rewind,
  ScanSearch,
  Scissors,
  StepForward,
} from "lucide-react";
import { useUi, type DockTab, type Mode } from "@/state/ui-store";
import { useSim } from "@/state/sim-store";

export type CommandGroup = "Simulation" | "Navigate" | "Panels" | "Help";

export interface Command {
  id: string;
  label: string;
  group: CommandGroup;
  icon?: LucideIcon;
  /**
   * Shortcut in "mod+k" / "shift+/" / "space" form. `mod` is ⌘ on Apple, Ctrl elsewhere.
   * Avoid combos iPadOS Safari reserves (⌘L, ⌘T, ⌘W, ⌘R, ⌘N, ⌘Tab).
   */
  shortcut?: string;
  /** Extra search terms for the command palette. */
  keywords?: string[];
  run: () => void;
}

export const MODES: { id: Mode; label: string; icon: LucideIcon; shortcut: string; description: string }[] = [
  { id: "world", label: "World", icon: Globe2, shortcut: "1", description: "Watch the ecosystem evolve" },
  { id: "genome", label: "Genome Editor", icon: Dna, shortcut: "2", description: "Edit loci and alleles" },
  {
    id: "cross",
    label: "Cross Lab",
    icon: GitMerge,
    shortcut: "3",
    description: "Breed and predict offspring",
  },
  {
    id: "splice",
    label: "Splice Lab",
    icon: Scissors,
    shortcut: "4",
    description: "Build chimeras from body parts",
  },
  {
    id: "phylogeny",
    label: "Phylogeny",
    icon: GitBranch,
    shortcut: "5",
    description: "Species tree and splits",
  },
];

export const DOCK_TABS: { id: DockTab; label: string; icon: LucideIcon; shortcut: string }[] = [
  { id: "inspector", label: "Inspector", icon: ScanSearch, shortcut: "i" },
  { id: "environment", label: "Environment", icon: CloudSun, shortcut: "e" },
  { id: "charts", label: "Charts", icon: Activity, shortcut: "c" },
];

/** Single source of truth for actions: drives hotkeys, the palette and the shortcut sheet. */
export function getCommands(): Command[] {
  const ui = useUi.getState();
  const sim = useSim.getState();
  return [
    {
      id: "sim.toggle",
      label: sim.paused ? "Play simulation" : "Pause simulation",
      group: "Simulation",
      icon: Pause,
      shortcut: "space",
      keywords: ["play", "pause", "resume", "stop"],
      run: () => useSim.getState().togglePaused(),
    },
    {
      id: "sim.step",
      label: "Step one day",
      group: "Simulation",
      icon: StepForward,
      shortcut: ".",
      keywords: ["tick", "advance"],
      run: () => useSim.getState().step(),
    },
    {
      id: "sim.faster",
      label: "Speed up",
      group: "Simulation",
      icon: FastForward,
      shortcut: "]",
      keywords: ["fast forward", "time scale"],
      run: () => useSim.getState().faster(),
    },
    {
      id: "sim.slower",
      label: "Slow down",
      group: "Simulation",
      icon: Rewind,
      shortcut: "[",
      keywords: ["slow motion", "time scale"],
      run: () => useSim.getState().slower(),
    },
    ...MODES.map<Command>((m) => ({
      id: `mode.${m.id}`,
      label: `Go to ${m.label}`,
      group: "Navigate",
      icon: m.icon,
      shortcut: m.shortcut,
      keywords: [m.description],
      run: () => useUi.getState().setMode(m.id),
    })),
    ...DOCK_TABS.map<Command>((t) => ({
      id: `dock.${t.id}`,
      label: `Toggle ${t.label} panel`,
      group: "Panels",
      icon: t.icon,
      shortcut: t.shortcut,
      run: () => useUi.getState().toggleDockTab(t.id),
    })),
    {
      id: "dock.toggle",
      label: ui.dockOpen ? "Hide side panel" : "Show side panel",
      group: "Panels",
      icon: PanelRight,
      shortcut: "\\",
      run: () => useUi.getState().toggleDock(),
    },
    {
      id: "help.shortcuts",
      label: "Keyboard shortcuts",
      group: "Help",
      icon: Keyboard,
      shortcut: "?",
      keywords: ["help", "keys", "hotkeys"],
      run: () => useUi.getState().setShortcutsOpen(true),
    },
    {
      id: "help.palette",
      label: "Command palette",
      group: "Help",
      icon: Box,
      shortcut: "mod+k",
      run: () => useUi.getState().setPaletteOpen(true),
    },
  ];
}
