"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const StageCanvas = dynamic(() => import("./stage-canvas"), {
  ssr: false,
  loading: () => (
    <div className="size-full animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" />
  ),
});

/** A small turntable 3D stage for lab previews. */
export function Stage({
  children,
  className,
  distance = 4,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
}) {
  return (
    <div
      className={
        className ??
        "relative h-64 overflow-hidden rounded-lg border border-border bg-[radial-gradient(ellipse_at_center,#16202a,#0b1016)]"
      }
    >
      <StageCanvas distance={distance}>{children}</StageCanvas>
    </div>
  );
}
