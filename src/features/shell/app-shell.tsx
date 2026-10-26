"use client";

import { useEffect } from "react";
import { TooltipProvider } from "@/ui/tooltip";
import { useUi } from "@/state/ui-store";
import { useGlobalHotkeys } from "../commands/hotkeys";
import { CommandPalette } from "./command-palette";
import { Dock } from "./dock";
import { ModeOverlay } from "./mode-overlay";
import { ModeRail } from "./mode-rail";
import { ShortcutSheet } from "./shortcut-sheet";
import { TimeDock } from "./time-dock";
import { TopBar } from "./top-bar";
import { Viewport } from "./viewport";

export function AppShell() {
  useGlobalHotkeys();
  useBlockPageGestures();
  useEffect(() => {
    void useUi.persist.rehydrate();
  }, []);

  return (
    <TooltipProvider>
      <main className="relative h-dvh w-full overflow-hidden bg-bg">
        <Viewport />
        <ModeOverlay />
        <TopBar />
        <ModeRail />
        <Dock />
        <TimeDock />
        <CommandPalette />
        <ShortcutSheet />
      </main>
    </TooltipProvider>
  );
}

/** iPadOS Safari ignores user-scalable=no; block its pinch-zoom gesture events explicitly. */
function useBlockPageGestures() {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", prevent);
    document.addEventListener("gesturechange", prevent);
    return () => {
      document.removeEventListener("gesturestart", prevent);
      document.removeEventListener("gesturechange", prevent);
    };
  }, []);
}
