"use client";

import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, CameraControls, PerformanceMonitor } from "@react-three/drei";
import { useWorld } from "@/sim/world-store";
import { renderProfile, useSettings } from "@/state/settings-store";
import { useUi } from "@/state/ui-store";
import { sim } from "@/sim/client";
import { Creatures } from "./creatures/creatures";
import { renderAgents } from "./creatures/render-state";
import { Effects } from "./effects";
import { Interaction } from "./interaction";
import { TerrainMesh } from "./terrain-mesh";
import { useCameraKeys } from "./use-camera-keys";
import { Sky } from "./sky";
import { lazy, Suspense } from "react";
import type { TerrainKind } from "@/engine/world/terrain";

const Post = lazy(() => import("./post"));

type Home = { pos: readonly [number, number, number]; target: readonly [number, number, number] };
const HOME: Home = { pos: [120, 120, 150], target: [0, 0, 10] };
/** Small worlds start with the camera closer in. */
const ZOO_HOME: Home = { pos: [38, 34, 52], target: [0, 0, 2] };
const MINI_HOME: Home = { pos: [62, 58, 80], target: [0, 0, 4] };
const homeFor = (kind: TerrainKind | undefined) =>
  kind === "zoo" ? ZOO_HOME : kind === "mini" ? MINI_HOME : HOME;

export default function WorldScene() {
  const info = useWorld((s) => s.info);
  const selectedId = useWorld((s) => s.selectedId);
  const quality = useSettings((s) => s.quality);
  const degraded = useSettings((s) => s.degraded);
  const profile = renderProfile(quality, degraded);
  // Behind a lab workspace the world shows as a blurred still; the worker keeps simulating.
  const visible = useUi((s) => s.mode === "world");
  return (
    <Canvas
      frameloop={visible && !profile.fps ? "always" : "demand"}
      shadows={profile.shadows}
      dpr={profile.dpr}
      camera={{ position: [...HOME.pos], fov: 45, near: 0.3, far: 1400 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      className="touch-none"
      aria-label="3D world view"
    >
      <FpsCap fps={visible ? profile.fps : 0} />
      <PerformanceMonitor onDecline={() => useSettings.getState().set({ degraded: true })} />
      <AdaptiveDpr pixelated={false} />
      <color attach="background" args={["#0b1016"]} />
      <fog attach="fog" args={["#11252c", 220, 520]} />
      <Sky />
      <Lights />
      {info && <TerrainMesh key={`${info.seed}-${info.terrain}`} seed={info.seed} kind={info.terrain} />}
      {info && <Creatures maxAgents={info.maxAgents} selectedId={selectedId} />}
      <Effects />
      <Interaction />
      <Controls kind={info?.terrain} />
      {quality === "high" && (
        <Suspense fallback={null}>
          <Post />
        </Suspense>
      )}
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

/** Renders at a fixed rate in demand mode (low battery). */
function FpsCap({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!fps) return;
    const t = setInterval(() => invalidate(), 1000 / fps);
    return () => clearInterval(t);
  }, [fps, invalidate]);
  return null;
}

function Controls({ kind }: { kind: TerrainKind | undefined }) {
  const ref = useRef<CameraControls>(null);
  const home = homeFor(kind);
  useCameraKeys(ref, home);
  useEffect(() => {
    const h = homeFor(kind);
    ref.current?.setLookAt(...h.pos, ...h.target, false);
  }, [kind]);
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
