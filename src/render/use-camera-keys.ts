"use client";

import { useEffect, useState, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { CameraControls } from "@react-three/drei";
import { useUi } from "@/state/ui-store";

const MOVE_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowleft",
  "arrowright",
  "arrowup",
  "arrowdown",
  "=",
  "+",
  "-",
]);

/**
 * Keyboard camera for hardware keyboards (iPad Magic Keyboard, desktop):
 * WASD moves, arrows orbit/tilt, =/- zoom, 0 resets. Held keys move continuously.
 */
export function useCameraKeys(
  ref: RefObject<CameraControls | null>,
  home: { pos: readonly [number, number, number]; target: readonly [number, number, number] },
) {
  const held = useKeySet();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "0" && !isTyping(e) && !overlayOpen())
        ref.current?.setLookAt(...home.pos, ...home.target, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ref, home]);

  useFrame((_, dt) => {
    const c = ref.current;
    if (!c || held.size === 0) return;
    const speed = Math.max(8, c.distance * 0.9) * dt;
    const rot = 1.6 * dt;
    if (held.has("w")) c.forward(speed, true);
    if (held.has("s")) c.forward(-speed, true);
    if (held.has("a")) c.truck(-speed, 0, true);
    if (held.has("d")) c.truck(speed, 0, true);
    if (held.has("arrowleft")) c.rotate(-rot, 0, true);
    if (held.has("arrowright")) c.rotate(rot, 0, true);
    if (held.has("arrowup")) c.rotate(0, -rot * 0.6, true);
    if (held.has("arrowdown")) c.rotate(0, rot * 0.6, true);
    if (held.has("=") || held.has("+")) c.dolly(speed, true);
    if (held.has("-")) c.dolly(-speed, true);
  });
}

function useKeySet() {
  const [set] = useState(() => new Set<string>());
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!MOVE_KEYS.has(k) || e.metaKey || e.ctrlKey || e.altKey || isTyping(e) || overlayOpen()) return;
      if (k.startsWith("arrow") && ownsArrowKeys(e)) return;
      e.preventDefault();
      set.add(k);
    };
    const up = (e: KeyboardEvent) => set.delete(e.key.toLowerCase());
    const clear = () => set.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, [set]);
  return set;
}

function overlayOpen() {
  const { paletteOpen, shortcutsOpen } = useUi.getState();
  return paletteOpen || shortcutsOpen;
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA");
}

/** Sliders, tabs, menus etc. use arrow keys themselves. */
function ownsArrowKeys(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t?.closest?.(
    '[role="slider"],[role="tab"],[role="menu"],[role="listbox"],[role="radiogroup"],[cmdk-root]',
  );
}
