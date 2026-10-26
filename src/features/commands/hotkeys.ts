"use client";

import { useEffect } from "react";
import { getCommands } from "./commands";
import { useUi } from "@/state/ui-store";

const isApple = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

/** Normalizes a KeyboardEvent to our combo syntax, e.g. "mod+k", "?", "space". */
export function eventToCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  const mod = isApple() ? e.metaKey : e.ctrlKey;
  if (mod) parts.push("mod");
  if (e.altKey) parts.push("alt");
  let key = e.key.toLowerCase();
  if (key === " ") key = "space";
  // Shift is implied for printable symbols like "?" — only record it for letters/named keys.
  if (e.shiftKey && (key.length > 1 || /[a-z]/.test(key))) parts.push("shift");
  parts.push(key);
  return parts.join("+");
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/** Global keyboard shortcuts (hardware keyboards incl. iPad Magic Keyboard). */
export function useGlobalHotkeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      const combo = eventToCombo(e);
      const { paletteOpen, shortcutsOpen } = useUi.getState();
      // While a modal is open only the palette toggle is global; the dialog handles Esc.
      if ((paletteOpen || shortcutsOpen) && combo !== "mod+k") return;
      if (isTypingTarget(e.target) && (!combo.startsWith("mod+") || combo.endsWith("+z"))) return;
      // Buttons consume Space for activation; don't double-fire play/pause.
      if (combo === "space" && e.target instanceof HTMLButtonElement) return;

      if (combo === "mod+k") {
        e.preventDefault();
        useUi.getState().setPaletteOpen(!paletteOpen);
        return;
      }
      const cmd = getCommands().find((c) => c.shortcut === combo);
      if (cmd) {
        e.preventDefault();
        cmd.run();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
