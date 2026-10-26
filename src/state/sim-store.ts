import { create } from "zustand";

/** Speed multipliers. 1× = 0.1 simulated days per second (a year takes an hour). */
export const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512] as const;
export const DAYS_PER_SEC_AT_1X = 0.1;
const DEFAULT_SPEED = 5;

interface SimState {
  paused: boolean;
  speedIndex: number;
  togglePaused: () => void;
  setPaused: (paused: boolean) => void;
  faster: () => void;
  slower: () => void;
  setSpeedIndex: (i: number) => void;
}

export const useSim = create<SimState>()((set, get) => ({
  paused: false,
  speedIndex: DEFAULT_SPEED,
  togglePaused: () => set({ paused: !get().paused }),
  setPaused: (paused) => set({ paused }),
  faster: () => set({ speedIndex: Math.min(SPEEDS.length - 1, get().speedIndex + 1) }),
  slower: () => set({ speedIndex: Math.max(0, get().speedIndex - 1) }),
  setSpeedIndex: (speedIndex) => set({ speedIndex: Math.max(0, Math.min(SPEEDS.length - 1, speedIndex)) }),
}));

export function formatSimTime(day: number) {
  const year = Math.floor(day / 365);
  const d = Math.floor(day % 365);
  return { year, day: d };
}
