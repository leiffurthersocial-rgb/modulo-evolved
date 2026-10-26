"use client";

import dynamic from "next/dynamic";

const WorldScene = dynamic(() => import("@/render/world-scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-surface-3 border-t-accent motion-reduce:animate-none" />
    </div>
  ),
});

export function Viewport() {
  return (
    <div className="absolute inset-0" role="application" aria-roledescription="3D simulation view">
      <WorldScene />
    </div>
  );
}
