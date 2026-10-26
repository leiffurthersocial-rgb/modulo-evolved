"use client";

import { create } from "zustand";
import type { SeriesPoint } from "@/engine/sim/recorder";
import type { DeathCause, Lineage, WorldEvent } from "@/engine/sim/types";
import type { SpeciesId } from "@/engine/species/types";
import type { InitInfo, StatsMsg } from "./protocol";

export interface Notice {
  day: number;
  text: string;
  kind: string;
  key: number;
}

interface WorldState {
  ready: boolean;
  epoch: number;
  info: InitInfo | null;
  day: number;
  rate: number;
  agentCount: number;
  temperature: number;
  season: string;
  seasonWarmth: number;
  speciesCounts: Partial<Record<SpeciesId, number>>;
  lineageCounts: Record<number, number>;
  lineages: Lineage[];
  totals: Record<string, number>;
  deathCauses: Partial<Record<DeathCause, number>>;
  notices: Notice[];
  events: WorldEvent[];
  series: SeriesPoint[];
  selectedId: number | null;
  followId: number | null;
  contextMenu: { id: number; x: number; y: number } | null;
  onInit: () => void;
  onReady: (info: InitInfo, epoch: number) => void;
  onFrame: (day: number, rate: number, count: number) => void;
  onStats: (m: StatsMsg) => void;
  select: (id: number | null) => void;
  follow: (id: number | null) => void;
  openContextMenu: (m: { id: number; x: number; y: number } | null) => void;
  dismissNotice: (key: number) => void;
  pushNotice: (text: string, kind?: string) => void;
}

let noticeKey = 1;

export const useWorld = create<WorldState>()((set, get) => ({
  ready: false,
  epoch: 0,
  info: null,
  day: 0,
  rate: 0,
  agentCount: 0,
  temperature: 0,
  season: "Spring",
  seasonWarmth: 0.5,
  speciesCounts: {},
  lineageCounts: {},
  lineages: [],
  totals: {},
  deathCauses: {},
  notices: [],
  events: [],
  series: [],
  selectedId: null,
  followId: null,
  contextMenu: null,
  onInit: () =>
    set({ ready: false, selectedId: null, followId: null, contextMenu: null, notices: [], series: [] }),
  onReady: (info, epoch) => set({ ready: true, info, epoch }),
  onFrame: (day, rate, count) => {
    const s = get();
    // Throttle React updates: whole-day changes or noticeable rate changes only.
    if (
      Math.floor(day * 10) !== Math.floor(s.day * 10) ||
      Math.abs(rate - s.rate) > s.rate * 0.1 + 0.01 ||
      count !== s.agentCount
    )
      set({ day, rate, agentCount: count });
  },
  onStats: (m) => {
    const s = get();
    const fresh = m.notices.map((n) => ({ ...n, key: noticeKey++ }));
    set({
      temperature: m.temperature,
      season: m.season,
      seasonWarmth: m.seasonWarmth,
      speciesCounts: m.speciesCounts,
      lineageCounts: m.lineageCounts,
      lineages: m.lineages.length ? m.lineages : s.lineages,
      totals: m.totals,
      deathCauses: m.deathCauses,
      events: m.events,
      agentCount: m.agentCount,
      notices: fresh.length ? [...s.notices, ...fresh].slice(-40) : s.notices,
      series: m.seriesReset ? m.series : m.series.length ? [...s.series, ...m.series] : s.series,
    });
    const sel = s.selectedId;
    if (sel !== null && m.agentCount >= 0) {
      // Selection is cleared by the inspector when the agent no longer exists.
    }
  },
  select: (id) => set({ selectedId: id, contextMenu: null }),
  follow: (id) => set({ followId: id, selectedId: id ?? get().selectedId, contextMenu: null }),
  openContextMenu: (contextMenu) => set({ contextMenu }),
  dismissNotice: (key) => set({ notices: get().notices.filter((n) => n.key !== key) }),
  pushNotice: (text, kind = "event") =>
    set({ notices: [...get().notices, { day: get().day, text, kind, key: noticeKey++ }].slice(-40) }),
}));
