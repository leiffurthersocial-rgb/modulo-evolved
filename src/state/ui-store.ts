import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Mode = "world" | "genome" | "cross" | "splice" | "phylogeny";
export type DockTab = "inspector" | "environment" | "charts";
export type DialogId = "newWorld" | "saves" | "settings" | "welcome" | null;

interface UiState {
  mode: Mode;
  dockOpen: boolean;
  dockTab: DockTab;
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  dialog: DialogId;
  tourStep: number | null;
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
