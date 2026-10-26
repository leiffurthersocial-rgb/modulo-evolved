"use client";

import { useEffect, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { useModalOpen } from "@/lib/use-modal-open";
import { useSettings } from "@/state/settings-store";

/**
 * Lab previews are small, slowly turning turntables: they redraw at a low fixed rate rather than
 * every display frame (Cross Lab shows three at once, each with its own WebGL context), redraw
 * immediately while being dragged, and stop entirely while a dialog covers them.
 */
export default function StageCanvas({
  children,
  distance,
  targetY,
}: {
  children: ReactNode;
  distance: number;
  /** Height the camera looks at (default scales with the distance). */
  targetY?: number;
}) {
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const covered = useModalOpen();
  const battery = useSettings((s) => s.quality === "battery");
  return (
    <Canvas
      frameloop={covered ? "never" : "demand"}
      dpr={battery ? 1 : [1, 1.5]}
      camera={{ position: [distance * 0.85, (targetY ?? 0) + distance * 0.5, distance * 0.85], fov: 38 }}
      className="touch-none"
    >
      <Ticker fps={reduced ? 0 : battery ? 6 : 12} />
      <hemisphereLight args={["#cfe3ff", "#2b2a22", 0.75]} />
      <directionalLight position={[4, 7, 5]} intensity={1.6} />
      <directionalLight position={[-5, 3, -4]} intensity={0.5} color="#7dd3fc" />
      {children}
      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={0.55}
        scale={12}
        blur={2.4}
        far={4}
        resolution={256}
      />
      <OrbitControls
        target={[0, targetY ?? distance * 0.17, 0]}
        enablePan={false}
        minDistance={distance * 0.4}
        maxDistance={distance * 2.5}
        autoRotate={!reduced && !battery}
        autoRotateSpeed={0.8}
        maxPolarAngle={Math.PI * 0.49}
      />
    </Canvas>
  );
}

function Ticker({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
    if (!fps) return;
    const t = setInterval(() => invalidate(), 1000 / fps);
    return () => clearInterval(t);
  }, [fps, invalidate]);
  return null;
}
