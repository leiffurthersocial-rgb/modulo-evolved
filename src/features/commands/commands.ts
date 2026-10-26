import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Crosshair,
  Flame,
  Snowflake,
  Biohazard,
  Undo2,
  Globe,
  FolderOpen,
  Settings,
  Compass,
  Redo2,
  SunDim,
  XCircle,
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
  PawPrint,
  Utensils,
  Eraser,
  BatteryLow,
  ChevronsRight,
  MapPin,
} from "lucide-react";
import { useUi, type DockTab, type Mode } from "@/state/ui-store";
import { useSim } from "@/state/sim-store";
import { useWorld } from "@/sim/world-store";
import { useLab } from "@/state/lab-store";
import { sim } from "@/sim/client";
import { startScenario } from "@/sim/bridge";
import { useScenario } from "@/sim/scenario-store";
import { toggleLowBattery, useSettings } from "@/state/settings-store";

export type CommandGroup =
  "World" | "Simulation" | "Camera" | "Events" | "Edit" | "Navigate" | "Panels" | "Help";

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
  { id: "animals", label: "Animals", icon: PawPrint, shortcut: "b" },
  { id: "environment", label: "Climate", icon: CloudSun, shortcut: "e" },
  { id: "charts", label: "Charts", icon: Activity, shortcut: "c" },
];

/** Single source of truth for actions: drives hotkeys, the palette and the shortcut sheet. */
export function getCommands(): Command[] {
  const ui = useUi.getState();
  const simState = useSim.getState();
  return [
    {
      id: "world.new",
      label: "New world…",
      group: "World",
      icon: Globe,
      keywords: ["scenario", "restart", "reset", "seed"],
      run: () => useUi.getState().setDialog("newWorld"),
    },
    {
      id: "world.saves",
      label: "Save & load…",
      group: "World",
      icon: FolderOpen,
      shortcut: "mod+s",
      keywords: ["export", "import", "file", "share"],
      run: () => useUi.getState().setDialog("saves"),
    },
    {
      id: "world.settings",
      label: "Settings",
      group: "World",
      icon: Settings,
      keywords: ["graphics", "quality", "battery"],
      run: () => useUi.getState().setDialog("settings"),
    },
    {
      id: "world.tour",
      label: "Guided tour",
      group: "Help",
      icon: Compass,
      keywords: ["onboarding", "tutorial", "help"],
      run: () => useUi.getState().setTourStep(0),
    },
    {
      id: "sim.toggle",
      label: simState.paused ? "Play simulation" : "Pause simulation",
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
      run: () => {
        useSim.getState().setPaused(true);
        sim.step(1);
      },
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
    {
      id: "camera.follow",
      label: "Follow selected animal",
      group: "Camera",
      icon: Crosshair,
      shortcut: "f",
      keywords: ["track", "camera", "chase"],
      run: () => {
        const w = useWorld.getState();
        w.follow(w.followId === null ? w.selectedId : null);
      },
    },
    {
      id: "camera.deselect",
      label: "Clear selection",
      group: "Camera",
      icon: XCircle,
      shortcut: "escape",
      run: () => {
        const u = useUi.getState();
        if (u.spawnTool || u.pairing !== null) {
          u.setSpawnTool(null);
          u.setPairing(null);
          return;
        }
        useWorld.getState().follow(null);
        useWorld.getState().select(null);
      },
    },
    {
      id: "animals.place",
      label: "Place animals…",
      group: "World",
      icon: MapPin,
      keywords: ["spawn", "add", "release", "put", "zoo"],
      run: () => useUi.getState().setDockTab("animals"),
    },
    {
      id: "animals.breed",
      label: "Breed selected animal with…",
      group: "World",
      icon: PawPrint,
      keywords: ["mate", "pair", "cross", "zoo", "offspring"],
      run: () => {
        const id = useWorld.getState().selectedId;
        if (id === null) useWorld.getState().pushNotice("Select an animal first, then pick its mate.");
        else useUi.getState().setPairing(id);
      },
    },
    {
      id: "animals.feedAll",
      label: "Feed every animal",
      group: "World",
      icon: Utensils,
      keywords: ["food", "hungry", "energy", "zoo"],
      run: () =>
        void sim.rpc<number>("feedAll").then((n) => useWorld.getState().pushNotice(`Fed all ${n} animals.`)),
    },
    {
      id: "animals.clear",
      label: "Clear island (remove all animals)",
      group: "World",
      icon: Eraser,
      keywords: ["empty", "reset", "kill", "remove", "wipe"],
      run: () =>
        void sim.rpc<number>("clear").then((n) => useWorld.getState().pushNotice(`Cleared ${n} animals.`)),
    },
    {
      id: "animals.generation",
      label: "Fast-forward one generation",
      group: "Simulation",
      icon: ChevronsRight,
      shortcut: "g",
      keywords: ["generations", "skip", "breed", "evolve", "time"],
      run: () => (useWorld.getState().fastForward ? sim.cancelFastForward() : sim.fastForward(1, null)),
    },
    {
      id: "world.zoo",
      label: "New Breeding Zoo",
      group: "World",
      icon: PawPrint,
      keywords: ["zoo", "paddock", "enclosure", "breeding", "scenario"],
      run: () => startScenario("zoo", useScenario.getState().seed),
    },
    {
      id: "world.mini",
      label: "New Mini Island",
      group: "World",
      icon: Globe,
      keywords: ["small", "tiny", "island", "scenario", "battery"],
      run: () => startScenario("mini", useScenario.getState().seed),
    },
    {
      id: "world.battery",
      label: useSettings.getState().quality === "battery" ? "Turn off low battery mode" : "Low battery mode",
      group: "World",
      icon: BatteryLow,
      keywords: ["power", "energy", "saver", "performance", "fps", "quality"],
      run: () => toggleLowBattery(),
    },
    {
      id: "event.drought",
      label: "Trigger drought",
      group: "Events",
      icon: SunDim,
      keywords: ["catastrophe", "dry"],
      run: () => sim.trigger("drought"),
    },
    {
      id: "event.iceAge",
      label: "Trigger ice age",
      group: "Events",
      icon: Snowflake,
      keywords: ["catastrophe", "cold", "glacial"],
      run: () => sim.trigger("iceAge"),
    },
    {
      id: "event.meteor",
      label: "Meteor strike",
      group: "Events",
      icon: Flame,
      keywords: ["catastrophe", "impact", "asteroid"],
      run: () => sim.trigger("meteor"),
    },
    {
      id: "event.plague",
      label: "Release a plague",
      group: "Events",
      icon: Biohazard,
      keywords: ["catastrophe", "disease", "epidemic"],
      run: () => sim.trigger("plague"),
    },
    {
      id: "edit.undo",
      label: "Undo genome edit",
      group: "Edit",
      icon: Undo2,
      shortcut: "mod+z",
      run: () => useLab.getState().undo(),
    },
    {
      id: "edit.redo",
      label: "Redo genome edit",
      group: "Edit",
      icon: Redo2,
      shortcut: "mod+shift+z",
      run: () => useLab.getState().redo(),
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
