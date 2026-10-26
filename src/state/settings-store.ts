import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Quality = "auto" | "high" | "battery";

interface SettingsState {
  quality: Quality;
  /** Set by the performance monitor when frame rate drops (auto quality only). */
  degraded: boolean;
  welcomed: boolean;
  set: (p: Partial<Pick<SettingsState, "quality" | "degraded" | "welcomed">>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      quality: "auto",
      degraded: false,
      welcomed: false,
      set: (p) => set(p),
    }),
    {
      name: "modulo-settings",
      version: 1,
      skipHydration: true,
      partialize: (s) => ({ quality: s.quality, welcomed: s.welcomed }),
    },
  ),
);

/** Effective render settings. */
export function renderProfile(q: Quality, degraded: boolean) {
  const low = q === "battery" || (q === "auto" && degraded);
  return { shadows: !low, dpr: (low ? [1, 1.25] : q === "high" ? [1, 2] : [1, 1.75]) as [number, number] };
}
