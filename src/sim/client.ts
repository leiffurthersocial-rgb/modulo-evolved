"use client";

import type { CatastropheKind, EnvSettings, WorldConfig } from "@/engine/sim/types";
import type { SpeciesId } from "@/engine/species/types";
import type { BodyDesc, FromWorker, InitInfo, StatsMsg, ToWorker } from "./protocol";
import { useWorld } from "./world-store";

/**
 * Main-thread handle to the simulation worker. High-frequency data (frames, vegetation)
 * lives here as plain fields read by the render loop; UI-level data goes to Zustand.
 */
class SimClient {
  private worker: Worker | null = null;
  private nextRpc = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  bodies = new Map<number, BodyDesc>();
  frame: { buf: Float32Array; count: number; day: number; at: number } = {
    buf: new Float32Array(0),
    count: 0,
    day: 0,
    at: 0,
  };
  /** id → index in current frame buffer. */
  index = new Map<number, number>();
  vegetation: Float32Array | null = null;
  vegVersion = 0;
  info: InitInfo | null = null;
  /** Bumped on every world (re)initialisation so the renderer can rebuild. */
  epoch = 0;
  deaths: { id: number; x: number; y: number; z: number; at: number; cause: string }[] = [];

  get started() {
    return this.worker !== null;
  }

  private ensure() {
    if (this.worker || typeof window === "undefined") return;
    this.worker = new Worker(new URL("../worker/sim.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => this.onMessage(e.data);
  }

  private send(msg: ToWorker) {
    this.ensure();
    this.worker?.postMessage(msg);
  }

  private onMessage(m: FromWorker) {
    switch (m.type) {
      case "ready":
        this.info = m.info;
        this.bodies.clear();
        for (const b of m.bodies) this.bodies.set(b.id, b);
        this.epoch++;
        useWorld.getState().onReady(m.info, this.epoch);
        break;
      case "frame": {
        for (const b of m.born) this.bodies.set(b.id, b);
        const now = performance.now();
        for (const d of m.died) {
          this.bodies.delete(d.id);
          this.deaths.push({ ...d, at: now });
        }
        if (this.deaths.length > 64) this.deaths.splice(0, this.deaths.length - 64);
        this.frame = { buf: m.buf, count: m.count, day: m.day, at: now };
        this.index.clear();
        for (let i = 0; i < m.count; i++) this.index.set(m.buf[i * 10], i);
        useWorld.getState().onFrame(m.day, m.rate, m.count);
        break;
      }
      case "stats":
        useWorld.getState().onStats(m as StatsMsg);
        break;
      case "veg":
        this.vegetation = m.data;
        this.vegVersion++;
        break;
      case "rpc": {
        const p = this.pending.get(m.id);
        if (!p) return;
        this.pending.delete(m.id);
        if (m.error) p.reject(new Error(m.error));
        else p.resolve(m.result);
        break;
      }
    }
  }

  init(config: Partial<WorldConfig>, scenario: string, schedule?: [number, CatastropheKind][]) {
    useWorld.getState().onInit();
    this.send({ type: "init", config, scenario, schedule });
  }
  setRunning(running: boolean) {
    this.send({ type: "setRunning", running });
  }
  setSpeed(daysPerSec: number) {
    this.send({ type: "setSpeed", daysPerSec });
  }
  step(days: number) {
    this.send({ type: "step", days });
  }
  setEnv(env: EnvSettings) {
    this.send({ type: "setEnv", env });
  }
  fastForward(generations: number, species: SpeciesId | null) {
    this.send({ type: "fastForward", generations, species });
  }
  cancelFastForward() {
    this.send({ type: "cancelFastForward" });
  }
  setLowPower(low: boolean) {
    this.send({ type: "setLowPower", low });
  }
  trigger(kind: CatastropheKind, x?: number, z?: number) {
    this.send({ type: "trigger", kind, x, z });
  }

  rpc<T>(method: string, ...args: unknown[]): Promise<T> {
    this.ensure();
    const id = this.nextRpc++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker?.postMessage({ type: "rpc", id, method, args } satisfies ToWorker);
    });
  }

  /** Current world-space position of an agent from the latest frame. */
  positionOf(id: number): [number, number, number] | null {
    const i = this.index.get(id);
    if (i === undefined) return null;
    const b = this.frame.buf;
    return [b[i * 10 + 1], b[i * 10 + 2], b[i * 10 + 3]];
  }
}

export const sim = new SimClient();
