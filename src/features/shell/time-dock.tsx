"use client";

import { useEffect, useRef } from "react";
import { FastForward, Pause, Play, Rewind, StepForward } from "lucide-react";
import { Button } from "@/ui/button";
import { Tooltip } from "@/ui/tooltip";
import { Separator } from "@/ui/separator";
import { SPEEDS, formatSimTime, useSim } from "@/state/sim-store";

export function TimeDock() {
  const paused = useSim((s) => s.paused);
  const speedIndex = useSim((s) => s.speedIndex);
  const day = useSim((s) => Math.floor(s.day));
  const { togglePaused, step, faster, slower } = useSim.getState();
  const t = formatSimTime(day);

  useSimClock();

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
          {SPEEDS[speedIndex]}× {paused ? "· paused" : ""}
        </span>
      </div>
    </div>
  );
}

/**
 * Placeholder clock until the simulation worker lands (milestone 3):
 * advances sim time at the selected speed without touching React every frame.
 */
function useSimClock() {
  const last = useRef<number | null>(null);
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      const { paused, speedIndex, advance } = useSim.getState();
      if (last.current !== null && !paused) {
        advance(((now - last.current) / 1000) * SPEEDS[speedIndex]);
      }
      last.current = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}
