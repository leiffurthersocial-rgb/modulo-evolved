import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Mode = "world" | "genome" | "cross" | "splice" | "phylogeny";
export type DockTab = "inspector" | "environment" | "charts";

interface UiState {
  mode: Mode;
  dockOpen: boolean;
  dockTab: DockTab;
  paletteOpen: boolean;
  shortcutsOpen: boolean;
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
      setMode: (mode) => set({ mode }),
      setDockTab: (dockTab) => set({ dockTab, dockOpen: true }),
      toggleDockTab: (tab) => {
        const { dockOpen, dockTab } = get();
        if (dockOpen && dockTab === tab) set({ dockOpen: false });
        else set({ dockTab: tab, dockOpen: true });
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
