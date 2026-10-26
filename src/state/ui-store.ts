import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SpeciesId } from "@/engine/species/types";

export type Mode = "world" | "genome" | "cross" | "splice" | "phylogeny";
export type DockTab = "inspector" | "animals" | "environment" | "charts";

/** Tap-to-place tool for releasing wild animals. */
export interface SpawnTool {
  species: SpeciesId;
  sex: "F" | "M" | "pair";
  count: number;
}
export type DialogId = "newWorld" | "saves" | "settings" | "welcome" | null;

interface UiState {
  mode: Mode;
  dockOpen: boolean;
  dockTab: DockTab;
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  dialog: DialogId;
  tourStep: number | null;
  /** Active tap-to-place tool (null = normal selection). */
  spawnTool: SpawnTool | null;
  /** Animal waiting for a mate to be tapped (manual breeding). */
  pairing: number | null;
  setSpawnTool: (t: SpawnTool | null) => void;
  setPairing: (id: number | null) => void;
  setDialog: (d: DialogId) => void;
  setTourStep: (s: number | null) => void;
  setMode: (mode: Mode) => void;
  setDockTab: (tab: DockTab) => void;
  /** Opens the dock on `tab`, or closes it if that tab is already showing. */
  toggleDockTab: (tab: DockTab) => void;
  toggleDock: () => void;
  setPaletteOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      mode: "world",
      dockOpen: true,
      dockTab: "environment",
      paletteOpen: false,
      shortcutsOpen: false,
      dialog: null,
      tourStep: null,
      spawnTool: null,
      pairing: null,
      setSpawnTool: (spawnTool) => set({ spawnTool, pairing: null }),
      setPairing: (pairing) => set({ pairing, spawnTool: null }),
      setDialog: (dialog) => set({ dialog }),
      setTourStep: (tourStep) => set({ tourStep }),
      setMode: (mode) => set({ mode }),
      setDockTab: (dockTab) => set({ dockTab, dockOpen: true, mode: "world" }),
      toggleDockTab: (tab) => {
        const { dockOpen, dockTab } = get();
        if (dockOpen && dockTab === tab && get().mode === "world") set({ dockOpen: false });
        else set({ dockTab: tab, dockOpen: true, mode: "world" });
      },
      toggleDock: () => set({ dockOpen: !get().dockOpen }),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
    }),
    {
      name: "modulo-ui",
      version: 1,
      // Rehydrated in an effect after mount to avoid SSR hydration mismatches.
      skipHydration: true,
      // Only layout preferences persist; transient overlays always start closed.
      partialize: ({ mode, dockOpen, dockTab }) => ({ mode, dockOpen, dockTab }),
    },
  ),
);
