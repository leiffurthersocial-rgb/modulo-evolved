"use client";

import { useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useWorld } from "@/sim/world-store";
import { renderAgents } from "./creatures/render-state";

const TAP_MS = 350;
const DOUBLE_MS = 320;
const LONG_MS = 520;
const SLOP = 9;

/**
 * Touch-first picking: tap selects the nearest animal on screen (generous radius for
 * fingers), double-tap follows it, long-press opens the context menu. Works with mouse too.
 */
export function Interaction() {
  const { gl, camera } = useThree();

  useEffect(() => {
    const el = gl.domElement;
    let down: { x: number; y: number; t: number; id: number } | null = null;
    let moved = false;
    let longTimer: ReturnType<typeof setTimeout> | null = null;
    let lastTap = { t: 0, id: -1 };
    const v = new THREE.Vector3();

    const pick = (clientX: number, clientY: number): number | null => {
      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      let best: number | null = null;
      let bestD = Infinity;
      for (const [id, a] of renderAgents) {
        v.set(a.x, a.y + a.size * 0.4, a.z).project(camera);
        if (v.z > 1) continue;
        const sx = ((v.x + 1) / 2) * rect.width;
        const sy = ((1 - v.y) / 2) * rect.height;
        const d = Math.hypot(sx - px, sy - py);
        const dist = camera.position.distanceTo(new THREE.Vector3(a.x, a.y, a.z));
        const radius = Math.max(30, (a.size / dist) * rect.height * 1.2);
        if (d < radius && d + dist * 0.05 < bestD) {
          bestD = d + dist * 0.05;
          best = id;
        }
      }
      return best;
    };

    const onDown = (e: PointerEvent) => {
      if (!e.isPrimary) {
        down = null;
        if (longTimer) clearTimeout(longTimer);
        return;
      }
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      moved = false;
      if (longTimer) clearTimeout(longTimer);
      longTimer = setTimeout(() => {
        if (!down || moved) return;
        const id = pick(down.x, down.y);
        if (id !== null) {
          useWorld.getState().select(id);
          useWorld.getState().openContextMenu({ id, x: down.x, y: down.y });
        }
        down = null;
      }, LONG_MS);
    };
    const onMove = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > SLOP) moved = true;
    };
    const onUp = (e: PointerEvent) => {
      if (longTimer) clearTimeout(longTimer);
      if (!down || moved || e.pointerId !== down.id) {
        down = null;
        return;
      }
      const now = performance.now();
      if (now - down.t > TAP_MS) {
        down = null;
        return;
      }
      const id = pick(e.clientX, e.clientY);
      const w = useWorld.getState();
      if (id !== null && lastTap.id === id && now - lastTap.t < DOUBLE_MS) w.follow(id);
      else if (id !== null) w.select(id);
      else {
        w.openContextMenu(null);
        if (now - lastTap.t < DOUBLE_MS && lastTap.id === -1) w.follow(null);
      }
      lastTap = { t: now, id: id ?? -1 };
      down = null;
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      const id = pick(e.clientX, e.clientY);
      if (id !== null) {
        useWorld.getState().select(id);
        useWorld.getState().openContextMenu({ id, x: e.clientX, y: e.clientY });
      }
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("contextmenu", onContext);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("contextmenu", onContext);
      if (longTimer) clearTimeout(longTimer);
    };
  }, [gl, camera]);

  return null;
}
