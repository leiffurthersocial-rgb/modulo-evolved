"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useUi } from "@/state/ui-store";
import { Button } from "@/ui/button";

const STEPS: { target: string; title: string; body: string }[] = [
  {
    target: "world",
    title: "A living island",
    body: "Every animal here has a diploid genome. Drag to orbit, two fingers to pan, pinch to zoom. Tap an animal to inspect it; double-tap to follow; long-press for more.",
  },
  {
    target: "time",
    title: "Control time",
    body: "Play, pause, step a day, or speed up to 512×. Evolution needs generations — fast-forward to watch allele frequencies and populations change.",
  },
  {
    target: "dock",
    title: "Inspector, environment & charts",
    body: "Tweak climate, trigger droughts or meteors, switch on human impact, and watch populations, traits and allele frequencies respond live.",
  },
  {
    target: "rail",
    title: "Your labs",
    body: "Edit genomes locus by locus, predict crosses with Punnett squares, splice body parts across species, and follow speciation in the phylogeny.",
  },
  {
    target: "menu",
    title: "Worlds & sharing",
    body: "Start a new scenario (archipelago speciation, ice age, human arrival…), save and load worlds, and share reproducible experiments as links.",
  },
  {
    target: "commands",
    title: "Keyboard too",
    body: "With a Magic Keyboard: ⌘K opens the command palette, ? shows every shortcut. Space pauses, [ ] change speed, 1–5 switch workspaces.",
  },
];

export function Tour() {
  const step = useUi((s) => s.tourStep);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const s = step !== null ? STEPS[step] : null;

  useLayoutEffect(() => {
    if (!s) return;
    const el = document.querySelector(`[data-tour="${s.target}"]`);
    const update = () => setRect(el ? el.getBoundingClientRect() : null);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [s]);

  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState();
      if (e.key === "Escape") ui.setTourStep(null);
      if (e.key === "ArrowRight" || e.key === "Enter")
        ui.setTourStep(step + 1 < STEPS.length ? step + 1 : null);
      if (e.key === "ArrowLeft" && step > 0) ui.setTourStep(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  if (step === null || !s) return null;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1000;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const big = rect && rect.width > vw * 0.6;
  // Place the card beside the highlighted element, inside the viewport.
  const cardW = 340;
  let left = vw / 2 - cardW / 2;
  let top = vh / 2 - 100;
  if (rect && !big) {
    left = rect.right + 16 + cardW < vw ? rect.right + 16 : Math.max(16, rect.left - cardW - 16);
    top = Math.min(vh - 240, Math.max(16, rect.top));
    if (rect.width > vw * 0.35) {
      left = Math.min(vw - cardW - 16, Math.max(16, rect.left + rect.width / 2 - cardW / 2));
      top = rect.top > vh / 2 ? rect.top - 230 : rect.bottom + 16;
    }
  }
  const pad = 8;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Tour: ${s.title}`}>
      {rect && !big ? (
        <div
          className="pointer-events-none absolute rounded-xl transition-all duration-300"
          style={{
            left: rect.left - pad,
            top: rect.top - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.62), 0 0 0 2px #2dd4bf",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/40" />
      )}
      <div
        className="absolute animate-pop-in space-y-3 rounded-xl border border-border p-5 shadow-panel glass"
        style={{ left, top, width: cardW }}
      >
        <p className="text-[11px] tracking-wider text-accent uppercase">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 className="text-base font-semibold">{s.title}</h2>
        <p className="text-sm text-fg-muted">{s.body}</p>
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={() => useUi.getState().setTourStep(null)}>
            Skip
          </Button>
          <span className="flex-1" />
          {step > 0 && (
            <Button size="sm" variant="outline" onClick={() => useUi.getState().setTourStep(step - 1)}>
              Back
            </Button>
          )}
          <Button
            size="sm"
            variant="primary"
            autoFocus
            onClick={() => useUi.getState().setTourStep(step + 1 < STEPS.length ? step + 1 : null)}
          >
            {step + 1 < STEPS.length ? "Next" : "Done"}
          </Button>
        </div>
      </div>
    </div>
  );
}
