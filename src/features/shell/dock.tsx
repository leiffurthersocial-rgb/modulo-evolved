"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { useUi, type DockTab } from "@/state/ui-store";
import { DOCK_TABS } from "../commands/commands";
import { EnvironmentPanel } from "./environment-panel";
import { InspectorPanel } from "../inspector/inspector-panel";
import { ChartsPanel } from "../charts/charts-panel";
import { AnimalsPanel } from "../animals/animals-panel";

/**
 * Docked side panel. Landscape: right-hand column. Portrait: bottom sheet.
 * Floats over the 3D view so the simulation never reflows.
 */
export function Dock() {
  const open = useUi((s) => s.dockOpen);
  const tab = useUi((s) => s.dockTab);
  const setTab = useUi((s) => s.setDockTab);
  const toggleDock = useUi((s) => s.toggleDock);

  if (!open) return null;

  return (
    <aside
      aria-label="Side panel"
      data-tour="dock"
      className={cn(
        "absolute z-10 flex animate-slide-in-right flex-col overflow-hidden rounded-xl border border-border shadow-panel glass",
        // Landscape iPad: right column between top bar and time dock.
        "landscape:top-[calc(max(env(safe-area-inset-top),12px)+68px)] landscape:right-[max(env(safe-area-inset-right),12px)] landscape:bottom-[calc(max(env(safe-area-inset-bottom),12px)+68px)] landscape:w-[min(408px,36vw)]",
        // Portrait iPad: bottom sheet above the time dock.
        "portrait:right-[max(env(safe-area-inset-right),12px)] portrait:bottom-[calc(max(env(safe-area-inset-bottom),12px)+68px)] portrait:left-[calc(max(env(safe-area-inset-left),12px)+76px)] portrait:h-[42vh] portrait:animate-slide-in-up",
      )}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as DockTab)} className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-1 border-b border-border p-2">
          <TabsList className="flex-1">
            {DOCK_TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.id} value={t.id} aria-label={t.label} className="min-w-11">
                  <Icon aria-hidden />
                  {/* Four tabs don't fit a narrow dock: inactive ones show just their icon. */}
                  <span className={t.id === tab ? undefined : "sr-only"}>{t.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          <Button variant="ghost" size="icon" onClick={toggleDock} aria-label="Close side panel">
            <X />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <TabsContent value="inspector" className="h-full">
            <InspectorPanel />
          </TabsContent>
          <TabsContent value="animals">
            <AnimalsPanel />
          </TabsContent>
          <TabsContent value="environment" className="p-4">
            <EnvironmentPanel />
          </TabsContent>
          <TabsContent value="charts" className="h-full">
            <ChartsPanel />
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  );
}
