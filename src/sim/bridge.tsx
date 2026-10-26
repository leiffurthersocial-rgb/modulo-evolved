"use client";

import { useEffect } from "react";
import { scenarioById } from "@/engine/sim/scenarios";
import { useEnv } from "@/state/env-store";
import { DAYS_PER_SEC_AT_1X, SPEEDS, useSim } from "@/state/sim-store";
import { sim } from "./client";
import { useScenario } from "./scenario-store";

/** Keeps the worker in sync with UI stores. Mount once. */
export function SimBridge() {
  useEffect(() => {
    if (!sim.started) {
      void Promise.resolve(useScenario.persist.rehydrate()).then(() => {
        if (sim.started) return;
        const { scenarioId, seed } = useScenario.getState();
        startScenario(scenarioId, seed);
      });
    }
    const unsubSim = useSim.subscribe((s, prev) => {
      if (s.paused !== prev.paused) sim.setRunning(!s.paused);
      if (s.speedIndex !== prev.speedIndex) sim.setSpeed(SPEEDS[s.speedIndex] * DAYS_PER_SEC_AT_1X);
    });
    let envTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubEnv = useEnv.subscribe(() => {
      if (envTimer) clearTimeout(envTimer);
      envTimer = setTimeout(() => sim.setEnv(useEnv.getState().settings()), 80);
    });
    return () => {
      unsubSim();
      unsubEnv();
    };
  }, []);
  return null;
}

export function startScenario(id: string, seed: number, maxAgents?: number) {
  const sc = scenarioById(id);
  useScenario.getState().set({ scenarioId: sc.id, seed });
  useEnv.getState().load(sc.env, "custom");
  const s = useSim.getState();
  sim.init(
    {
      seed,
      terrain: sc.terrain,
      env: sc.env,
      counts: sc.counts,
      maxAgents: maxAgents ?? useScenario.getState().maxAgents,
    },
    sc.id,
    sc.schedule,
  );
  sim.setSpeed(SPEEDS[s.speedIndex] * DAYS_PER_SEC_AT_1X);
  sim.setRunning(!s.paused);
}
