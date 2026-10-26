"use client";

import dynamic from "next/dynamic";

const Scene = dynamic(() => import("./scene"), { ssr: false });

/** Developer view: every species' default rig side by side (used for visual QA). */
export function Gallery() {
  return (
    <div className="h-dvh w-full bg-bg">
      <Scene />
    </div>
  );
}
