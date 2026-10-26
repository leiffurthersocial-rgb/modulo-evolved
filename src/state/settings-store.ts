import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Quality = "auto" | "high" | "battery";

interface SettingsState {
  quality: Quality;
  /** Set by the performance monitor when frame rate drops (auto quality only). */
  degraded: boolean;
  welcomed: boolean;
  /** Quality to return to when low battery mode is switched off. */
  prevQuality: Exclude<Quality, "battery">;
  set: (p: Partial<Pick<SettingsState, "quality" | "degraded" | "welcomed" | "prevQuality">>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      quality: "auto",
      degraded: false,
      welcomed: false,
      prevQuality: "auto",
      set: (p) => set(p),
    }),
    {
      name: "modulo-settings",
      version: 1,
      skipHydration: true,
      partialize: (s) => ({ quality: s.quality, welcomed: s.welcomed, prevQuality: s.prevQuality }),
    },
  ),
);

/** Low battery mode: 30 fps, native resolution, no shadows or effects, slower simulation ticks. */
export function toggleLowBattery() {
  const s = useSettings.getState();
  if (s.quality === "battery") s.set({ quality: s.prevQuality, degraded: false });
  else s.set({ prevQuality: s.quality, quality: "battery" });
}

/** Effective render settings. */
export function renderProfile(q: Quality, degraded: boolean) {
  const battery = q === "battery";
  const low = battery || (q === "auto" && degraded);
  return {
    shadows: !low,
    dpr: (battery ? [1, 1] : low ? [1, 1.25] : q === "high" ? [1, 2] : [1, 1.75]) as [number, number],
    /** Frame-rate cap (0 = display rate). */
    fps: battery ? 30 : 0,
  };
}
