import { create } from "zustand";

/** Discrete speed steps; index 2 is real-time (1 sim-day per second). */
export const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64] as const;
const DEFAULT_SPEED = 2;

interface SimState {
  paused: boolean;
  speedIndex: number;
  /** Simulated time in days. Driven by the simulation worker from M3 on. */
  day: number;
  seed: number;
  togglePaused: () => void;
  setPaused: (paused: boolean) => void;
  faster: () => void;
  slower: () => void;
  setSpeedIndex: (i: number) => void;
  step: () => void;
  advance: (days: number) => void;
}

export const useSim = create<SimState>()((set, get) => ({
  paused: true,
  speedIndex: DEFAULT_SPEED,
  day: 0,
  seed: 0x5eed,
  togglePaused: () => set({ paused: !get().paused }),
  setPaused: (paused) => set({ paused }),
  faster: () => set({ speedIndex: Math.min(SPEEDS.length - 1, get().speedIndex + 1) }),
  slower: () => set({ speedIndex: Math.max(0, get().speedIndex - 1) }),
  setSpeedIndex: (speedIndex) => set({ speedIndex: Math.max(0, Math.min(SPEEDS.length - 1, speedIndex)) }),
  step: () => set({ paused: true, day: Math.floor(get().day) + 1 }),
  advance: (days) => set({ day: get().day + days }),
}));

export function formatSimTime(day: number) {
  const year = Math.floor(day / 365);
  const d = Math.floor(day % 365);
  return { year, day: d };
}
