"use client";

import { useEffect } from "react";
import { GitBranch, Skull, Zap, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useWorld } from "@/sim/world-store";

/** Toasts for speciation, extinction and catastrophes. */
export function Notices() {
  const notices = useWorld((s) => s.notices);
  const recent = notices.slice(-3);
  useEffect(() => {
    if (!recent.length) return;
    const t = setTimeout(() => useWorld.getState().dismissNotice(recent[0].key), 7000);
    return () => clearTimeout(t);
  }, [recent]);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute bottom-[calc(max(env(safe-area-inset-bottom),12px)+72px)] left-[calc(max(env(safe-area-inset-left),12px)+76px)] z-20 flex w-80 flex-col gap-2"
    >
      {recent.map((n) => {
        const Icon = n.kind === "speciation" ? GitBranch : n.kind === "extinction" ? Skull : Zap;
        return (
          <div
            key={n.key}
            className={cn(
              "pointer-events-auto flex animate-slide-in-up items-start gap-3 rounded-lg border border-border p-3 shadow-panel glass",
              n.kind === "speciation" && "border-accent/40",
              n.kind === "extinction" && "border-danger/40",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                n.kind === "speciation"
                  ? "text-accent"
                  : n.kind === "extinction"
                    ? "text-danger"
                    : "text-warning",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm">{n.text}</p>
              <p className="font-mono text-[11px] text-fg-subtle">
                Year {Math.floor(n.day / 365)}, day {Math.floor(n.day % 365)}
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => useWorld.getState().dismissNotice(n.key)}
              className="-m-2 flex size-11 items-center justify-center rounded-md text-fg-subtle focus-ring hover:text-fg"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
