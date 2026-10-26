"use client";

import { useSettings, type Quality } from "@/state/settings-store";
import { useUi } from "@/state/ui-store";
import { Dialog, DialogContent } from "@/ui/dialog";
import { cn } from "@/lib/cn";

const OPTIONS: { id: Quality; label: string; note: string }[] = [
  { id: "auto", label: "Auto", note: "Starts high and drops shadows/resolution if the frame rate falls." },
  { id: "high", label: "High", note: "Full resolution and soft shadows. Best on M-series iPads." },
  {
    id: "battery",
    label: "Battery saver",
    note: "No shadows, lower resolution. Cooler and longer battery life.",
  },
];

export function SettingsDialog() {
  const open = useUi((s) => s.dialog === "settings");
  const quality = useSettings((s) => s.quality);
  const degraded = useSettings((s) => s.degraded);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && useUi.getState().setDialog(null)}>
      <DialogContent title="Settings" className="max-w-[520px]">
        <div className="border-b border-border px-5 py-4 pr-14">
          <h2 className="text-base font-semibold">Settings</h2>
        </div>
        <div className="space-y-5 p-5">
          <section>
            <h3 className="mb-2 text-[11px] font-medium tracking-wider text-fg-subtle uppercase">
              Graphics quality
            </h3>
            <div role="radiogroup" aria-label="Graphics quality" className="space-y-1.5">
              {OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={quality === o.id}
                  onClick={() => useSettings.getState().set({ quality: o.id, degraded: false })}
                  className={cn(
                    "w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-left focus-ring",
                    quality === o.id && "border-accent/60 bg-accent-muted/30",
                  )}
                >
                  <p className="text-sm">{o.label}</p>
                  <p className="text-xs text-fg-muted">{o.note}</p>
                </button>
              ))}
            </div>
            {quality === "auto" && degraded && (
              <p className="mt-2 text-xs text-warning">
                Auto quality lowered settings to keep the frame rate smooth.
              </p>
            )}
          </section>
          <section className="space-y-1 text-sm text-fg-muted">
            <h3 className="mb-1 text-[11px] font-medium tracking-wider text-fg-subtle uppercase">
              Accessibility
            </h3>
            <p>
              Motion follows your system “Reduce Motion” setting: idle turntables stop and UI transitions
              become instant.
            </p>
            <p>Every action is reachable by touch, keyboard (press ?) and the command palette (⌘K).</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
