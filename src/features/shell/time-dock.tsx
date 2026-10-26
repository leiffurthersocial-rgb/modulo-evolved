"use client";

import { FastForward, Pause, Play, Rewind, StepForward } from "lucide-react";
import { Button } from "@/ui/button";
import { Tooltip } from "@/ui/tooltip";
import { Separator } from "@/ui/separator";
import { DAYS_PER_SEC_AT_1X, SPEEDS, formatSimTime, useSim } from "@/state/sim-store";
import { useWorld } from "@/sim/world-store";
import { sim } from "@/sim/client";

export function TimeDock() {
  const paused = useSim((s) => s.paused);
  const speedIndex = useSim((s) => s.speedIndex);
  const day = useWorld((s) => Math.floor(s.day));
  const rate = useWorld((s) => s.rate);
  const season = useWorld((s) => s.season);
  const { togglePaused, faster, slower } = useSim.getState();
  const step = () => {
    useSim.getState().setPaused(true);
    sim.step(1);
  };
  const t = formatSimTime(day);
  const requested = SPEEDS[speedIndex] * DAYS_PER_SEC_AT_1X;
  const throttled = !paused && rate > 0 && rate < requested * 0.8;

  return (
    <div
      role="toolbar"
      aria-label="Time controls"
      className="absolute bottom-[max(env(safe-area-inset-bottom),12px)] left-1/2 z-20 flex h-14 -translate-x-1/2 items-center gap-1 rounded-xl border border-border px-1.5 shadow-panel glass"
    >
      <Tooltip content="Slower" shortcut="[">
        <Button
          variant="ghost"
          size="icon"
          onClick={slower}
          aria-label="Slow down"
          disabled={speedIndex === 0}
        >
          <Rewind />
        </Button>
      </Tooltip>
      <Tooltip content={paused ? "Play" : "Pause"} shortcut="space">
        <Button
          variant="primary"
          size="icon"
          className="rounded-lg"
          onClick={togglePaused}
          aria-label={paused ? "Play" : "Pause"}
        >
          {paused ? <Play className="fill-current" /> : <Pause className="fill-current" />}
        </Button>
      </Tooltip>
      <Tooltip content="Faster" shortcut="]">
        <Button
          variant="ghost"
          size="icon"
          onClick={faster}
          aria-label="Speed up"
          disabled={speedIndex === SPEEDS.length - 1}
        >
          <FastForward />
        </Button>
      </Tooltip>
      <Tooltip content="Step one day" shortcut=".">
        <Button variant="ghost" size="icon" onClick={step} aria-label="Step one day">
          <StepForward />
        </Button>
      </Tooltip>
      <Separator orientation="vertical" className="mx-1.5" />
      <div className="flex min-w-[124px] flex-col px-2 font-mono tabular-nums" aria-live="off">
        <span className="text-sm text-fg">
          Y{t.year} · D{String(t.day).padStart(3, "0")}
        </span>
        <span className="text-[11px] text-fg-subtle">
          {paused ? "paused" : `${SPEEDS[speedIndex]}×`} · {season}
          {throttled && (
            <span className="text-warning" title="Your device is simulating as fast as it can">
              {" "}
              · max {Math.round(rate / DAYS_PER_SEC_AT_1X)}×
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
