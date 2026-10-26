"use client";

import { useEffect } from "react";
import { scenarioById } from "@/engine/sim/scenarios";
import type { EnvSettings } from "@/engine/sim/types";
import { useEnv } from "@/state/env-store";
import { DAYS_PER_SEC_AT_1X, SPEEDS, useSim } from "@/state/sim-store";
import { useLab, newId } from "@/state/lab-store";
import { useUi } from "@/state/ui-store";
import { useSettings } from "@/state/settings-store";
import { clearShareHash, readShare } from "@/persistence/share";
import { saveWorld, AUTOSAVE_ID } from "@/persistence/world-io";
import { sim } from "./client";
import { useScenario } from "./scenario-store";
import { useWorld } from "./world-store";

let booted = false;

/** Keeps the worker in sync with UI stores, handles share links and autosave. Mount once. */
export function SimBridge() {
  useEffect(() => {
    if (!booted) {
      booted = true;
      void Promise.resolve(useScenario.persist.rehydrate()).then(boot);
    }
    const unsubSim = useSim.subscribe((s, prev) => {
      if (s.paused !== prev.paused) sim.setRunning(!s.paused);
      if (s.speedIndex !== prev.speedIndex) sim.setSpeed(SPEEDS[s.speedIndex] * DAYS_PER_SEC_AT_1X);
    });
    const syncPower = () => sim.setLowPower(useSettings.getState().quality === "battery");
    syncPower();
    const unsubSettings = useSettings.subscribe((s, prev) => s.quality !== prev.quality && syncPower());
    let envTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubEnv = useEnv.subscribe(() => {
      if (envTimer) clearTimeout(envTimer);
      envTimer = setTimeout(() => sim.setEnv(useEnv.getState().settings()), 80);
    });
    // Autosave every 2 minutes while running, and when the app is backgrounded (iPad).
    const autosave = () => {
      if (!useWorld.getState().ready) return;
      void saveWorld("Autosave", AUTOSAVE_ID).catch(() => undefined);
    };
    const timer = setInterval(() => !useSim.getState().paused && autosave(), 120_000);
    const onHide = () => document.visibilityState === "hidden" && autosave();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      unsubSim();
      unsubSettings();
      unsubEnv();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);
  return null;
}

function boot() {
  const params = new URLSearchParams(window.location.search);
  const agents = Number(params.get("agents")) || undefined;
  const share = readShare();
  const store = useScenario.getState();
  if (share?.scenario) {
    startScenario(share.scenario, share.seed ?? store.seed, agents, share.env);
    useWorld
      .getState()
      .pushNotice(`Opened a shared experiment: ${scenarioById(share.scenario).name}, seed ${share.seed}.`);
  } else {
    const id = params.get("scenario") ?? store.scenarioId;
    const seed = Number(params.get("seed")) || store.seed;
    startScenario(id, seed, agents);
  }
  if (share?.genome) {
    const g = share.genome;
    useLab.getState().edit({
      id: newId(),
      name: g.name,
      species: g.species,
      sex: g.sex,
      genome: g.genome,
      createdAt: Date.now(),
      kind: "edited",
    });
    useUi.getState().setMode("genome");
  }
  if (share) clearShareHash();
}

export function startScenario(id: string, seed: number, maxAgents?: number, envOverride?: EnvSettings) {
  const sc = scenarioById(id);
  const env = envOverride ?? sc.env;
  useScenario.getState().set({ scenarioId: sc.id, seed });
  useEnv.getState().load(env, "custom");
  const s = useSim.getState();
  sim.init(
    {
      seed,
      terrain: sc.terrain,
      env,
      counts: sc.counts,
      maxAgents: Math.min(maxAgents ?? useScenario.getState().maxAgents, sc.maxAgents ?? Infinity),
    },
    sc.id,
    sc.schedule,
  );
  if (sc.handsOn) useUi.getState().setDockTab("animals");
  sim.setSpeed(SPEEDS[s.speedIndex] * DAYS_PER_SEC_AT_1X);
  sim.setRunning(!s.paused);
}
