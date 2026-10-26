"use client";

import { useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr, CameraControls, PerformanceMonitor } from "@react-three/drei";
import { useWorld } from "@/sim/world-store";
import { renderProfile, useSettings } from "@/state/settings-store";
import { sim } from "@/sim/client";
import { Creatures } from "./creatures/creatures";
import { renderAgents } from "./creatures/render-state";
import { Effects } from "./effects";
import { Interaction } from "./interaction";
import { TerrainMesh } from "./terrain-mesh";
import { useCameraKeys } from "./use-camera-keys";

const HOME = { pos: [120, 120, 150] as const, target: [0, 0, 10] as const };

export default function WorldScene() {
  const info = useWorld((s) => s.info);
  const selectedId = useWorld((s) => s.selectedId);
  const quality = useSettings((s) => s.quality);
  const degraded = useSettings((s) => s.degraded);
  const profile = renderProfile(quality, degraded);
  return (
    <Canvas
      shadows={profile.shadows}
      dpr={profile.dpr}
      camera={{ position: [...HOME.pos], fov: 45, near: 0.3, far: 1400 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      className="touch-none"
      aria-label="3D world view"
    >
      <PerformanceMonitor onDecline={() => useSettings.getState().set({ degraded: true })} />
      <AdaptiveDpr pixelated={false} />
      <color attach="background" args={["#0b1016"]} />
      <fog attach="fog" args={["#0b1016", 200, 460]} />
      <Lights />
      {info && <TerrainMesh key={`${info.seed}-${info.terrain}`} seed={info.seed} kind={info.terrain} />}
      {info && <Creatures maxAgents={info.maxAgents} selectedId={selectedId} />}
      <Effects />
      <Interaction />
      <Controls />
    </Canvas>
  );
}

function Lights() {
  const warmth = useWorld((s) => s.seasonWarmth);
  // Low winter sun is cooler and weaker; summer sun warm and bright.
  const sun = `hsl(${32 + 10 * warmth}, ${60 + 30 * warmth}%, ${86 + 6 * warmth}%)`;
  return (
    <>
      <hemisphereLight args={["#bcd7ff", "#2b2a22", 0.85]} />
      <directionalLight
        position={[80, 70 + 60 * warmth, 40]}
        intensity={1.6 + 0.8 * warmth}
        color={sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-130}
        shadow-camera-right={130}
        shadow-camera-top={130}
        shadow-camera-bottom={-130}
        shadow-camera-far={420}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
      />
    </>
  );
}

function Controls() {
  const ref = useRef<CameraControls>(null);
  useCameraKeys(ref, HOME);
  useEffect(() => {
    ref.current?.setLookAt(...HOME.pos, ...HOME.target, false);
  }, []);
  const lastFollow = useRef<number | null>(null);
  useFrame(() => {
    const c = ref.current;
    const id = useWorld.getState().followId;
    if (!c || id === null) {
      lastFollow.current = null;
      return;
    }
    const a = renderAgents.get(id);
    if (!a) {
      if (!sim.index.has(id)) useWorld.getState().follow(null);
      return;
    }
    c.moveTo(a.x, a.y + a.size * 0.5, a.z, true);
    if (lastFollow.current !== id) {
      // Swoop in close when we start following someone new.
      lastFollow.current = id;
      c.dollyTo(Math.max(5, a.size * 9), true);
      c.rotatePolarTo(Math.PI * 0.27, true);
    }
  });
  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={3}
      maxDistance={340}
      maxPolarAngle={Math.PI * 0.48}
      smoothTime={0.2}
    />
  );
}
