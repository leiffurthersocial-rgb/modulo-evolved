"use client";

import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { useModalOpen } from "@/lib/use-modal-open";

export default function StageCanvas({ children, distance }: { children: ReactNode; distance: number }) {
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const covered = useModalOpen();
  return (
    <Canvas
      frameloop={covered ? "never" : "always"}
      dpr={[1, 2]}
      camera={{ position: [distance * 0.85, distance * 0.5, distance * 0.85], fov: 38 }}
      className="touch-none"
    >
      <hemisphereLight args={["#cfe3ff", "#2b2a22", 0.75]} />
      <directionalLight position={[4, 7, 5]} intensity={1.6} />
      <directionalLight position={[-5, 3, -4]} intensity={0.5} color="#7dd3fc" />
      {children}
      <ContactShadows position={[0, 0.001, 0]} opacity={0.55} scale={12} blur={2.4} far={4} />
      <OrbitControls
        target={[0, distance * 0.17, 0]}
        enablePan={false}
        minDistance={distance * 0.4}
        maxDistance={distance * 2.5}
        autoRotate={!reduced}
        autoRotateSpeed={0.8}
        maxPolarAngle={Math.PI * 0.49}
      />
    </Canvas>
  );
}
