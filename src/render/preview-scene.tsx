"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr, CameraControls, PerformanceMonitor } from "@react-three/drei";
import { Rng } from "@/engine/rng/rng";
import { buildTerrainGeometry, type TerrainOptions } from "./terrain";
import { useCameraKeys } from "./use-camera-keys";

const TERRAIN: TerrainOptions = { seed: 0x5eed, size: 220, segments: 110, maxHeight: 26 };
const HOME = { pos: [120, 120, 150] as const, target: [0, 0, 10] as const };

/**
 * Milestone-1 preview world: seeded low-poly island, water, trees and lighting.
 * Replaced by the worker-driven simulation scene in milestone 3.
 */
export default function PreviewScene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [...HOME.pos], fov: 45, near: 0.5, far: 1200 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      className="touch-none"
      aria-label="3D world view"
    >
      <PerformanceMonitor />
      <AdaptiveDpr pixelated={false} />
      <color attach="background" args={["#0b1016"]} />
      <fog attach="fog" args={["#0b1016", 180, 420]} />
      <hemisphereLight args={["#bcd7ff", "#2b2a22", 0.9]} />
      <directionalLight
        position={[80, 120, 40]}
        intensity={2.2}
        color="#fff3e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-130}
        shadow-camera-right={130}
        shadow-camera-top={130}
        shadow-camera-bottom={-130}
        shadow-camera-far={400}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
      />
      <World />
      <Controls />
    </Canvas>
  );
}

function Controls() {
  const ref = useRef<CameraControls>(null);
  useCameraKeys(ref, HOME);
  useEffect(() => {
    ref.current?.setLookAt(...HOME.pos, ...HOME.target, false);
  }, []);
  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={12}
      maxDistance={320}
      maxPolarAngle={Math.PI * 0.47}
      smoothTime={0.18}
    />
  );
}

function World() {
  const { geometry, height } = useMemo(() => buildTerrainGeometry(TERRAIN), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
      </mesh>
      <Water />
      <Trees height={height} />
    </group>
  );
}

function Water() {
  const ref = useRef<THREE.Mesh>(null);
  const reduced = usePrefersReducedMotion();
  useFrame(({ clock }) => {
    if (ref.current && !reduced) ref.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.08;
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} receiveShadow>
      <circleGeometry args={[400, 48]} />
      <meshStandardMaterial
        color="#1b6f7a"
        transparent
        opacity={0.82}
        roughness={0.25}
        metalness={0.1}
        flatShading
      />
    </mesh>
  );
}

function Trees({ height }: { height: (x: number, z: number) => number }) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);

  const placements = useMemo(() => {
    const rng = new Rng(TERRAIN.seed + 1);
    const out: { x: number; y: number; z: number; s: number; r: number }[] = [];
    for (let tries = 0; tries < 4000 && out.length < 420; tries++) {
      const x = rng.range(-100, 100);
      const z = rng.range(-100, 100);
      const y = height(x, z);
      const t = y / TERRAIN.maxHeight;
      if (y < 1 || t > 0.45) continue;
      if (!rng.chance(0.75 - t)) continue;
      out.push({ x, y, z, s: rng.range(0.7, 1.4), r: rng.range(0, Math.PI * 2) });
    }
    return out;
  }, [height]);

  useEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    placements.forEach((t, i) => {
      q.setFromAxisAngle(up, t.r);
      s.setScalar(t.s);
      p.set(t.x, t.y + 0.9 * t.s, t.z);
      trunks.current!.setMatrixAt(i, m.compose(p, q, s));
      p.set(t.x, t.y + 3.1 * t.s, t.z);
      crowns.current!.setMatrixAt(i, m.compose(p, q, s));
    });
    trunks.current!.instanceMatrix.needsUpdate = true;
    crowns.current!.instanceMatrix.needsUpdate = true;
  }, [placements]);

  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, placements.length]} castShadow>
        <cylinderGeometry args={[0.18, 0.28, 1.8, 5]} />
        <meshStandardMaterial color="#5a4330" flatShading roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, placements.length]} castShadow receiveShadow>
        <coneGeometry args={[1.4, 3.6, 6]} />
        <meshStandardMaterial color="#2f5a2c" flatShading roughness={0.9} />
      </instancedMesh>
    </>
  );
}

function usePrefersReducedMotion() {
  return useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
}
