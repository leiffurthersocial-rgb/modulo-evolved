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
import { SimBridge } from "@/sim/bridge";
import { ContextMenu } from "../world/context-menu";
import { Notices } from "../world/notices";
import { ToolBanner } from "../animals/tool-banner";
import { useWorld } from "@/sim/world-store";
import { useLab } from "@/state/lab-store";
import { useSettings } from "@/state/settings-store";
import { NewWorldDialog } from "../world/new-world-dialog";
import { SavesDialog } from "../world/saves-dialog";
import { SettingsDialog } from "../world/settings-dialog";
import { Welcome } from "../onboarding/welcome";
import { Tour } from "../onboarding/tour";
import { sim } from "@/sim/client";

export function AppShell() {
  const mode = useUi((s) => s.mode);
  useGlobalHotkeys();
  useBlockPageGestures();
  useEffect(() => {
    void useUi.persist.rehydrate();
    void useLab.persist.rehydrate();
    void Promise.resolve(useSettings.persist.rehydrate()).then(() => {
      const skip = new URLSearchParams(window.location.search).has("nowelcome");
      if (!useSettings.getState().welcomed && !skip && !window.location.hash.includes("m="))
        useUi.getState().setDialog("welcome");
    });
    // Debug/test handle (used by e2e tests and for poking at the sim from the console).
    (window as unknown as { __modulo: unknown }).__modulo = { useWorld, useUi, sim };
    // Selecting an animal opens the inspector.
    return useWorld.subscribe((s, prev) => {
      if (s.selectedId !== null && s.selectedId !== prev.selectedId) useUi.getState().setDockTab("inspector");
    });
  }, []);

  return (
    <TooltipProvider>
      <SimBridge />
      <main className="relative h-dvh w-full overflow-hidden bg-bg">
        <Viewport />
        <ModeOverlay />
        <TopBar />
        <ModeRail />
        {mode === "world" && <Dock />}
        <TimeDock />
        <Notices />
        <ToolBanner />
        <ContextMenu />
        <CommandPalette />
        <NewWorldDialog />
        <SavesDialog />
        <SettingsDialog />
        <Welcome />
        <Tour />
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
