"use client";

import dynamic from "next/dynamic";
import { useUi } from "@/state/ui-store";

const GenomeEditor = dynamic(() => import("../editor/genome-editor").then((m) => m.GenomeEditor), {
  ssr: false,
});
const CrossLab = dynamic(() => import("../cross/cross-lab").then((m) => m.CrossLab), { ssr: false });
const SpliceLab = dynamic(() => import("../splice/splice-lab").then((m) => m.SpliceLab), { ssr: false });
const Phylogeny = dynamic(() => import("../phylogeny/phylogeny-view").then((m) => m.PhylogenyView), {
  ssr: false,
});

/** Workspace surface for non-world modes (the world keeps simulating underneath). */
export function ModeOverlay() {
  const mode = useUi((s) => s.mode);
  if (mode === "world") return null;
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-[5] animate-fade-in bg-bg/60 backdrop-blur-[2px]"
        aria-hidden
      />
      {mode === "genome" && <GenomeEditor />}
      {mode === "cross" && <CrossLab />}
      {mode === "splice" && <SpliceLab />}
      {mode === "phylogeny" && <Phylogeny />}
    </>
  );
}
